/* Cumulative Radio 365 — shared HLS player bootstrap.
 * STRONG + LIGHTWEIGHT build standard (2026-10-03):
 *  - LIGHTWEIGHT: native HLS first (iOS/desktop Safari play it natively — no
 *    hls.js is downloaded there). hls.js is injected ONLY when the browser
 *    reports no native HLS support (Android/desktop Chrome, Firefox).
 *  - STRONG: hls.js ships with retry/backoff so brief network blips recover;
 *    the player surface always shows a state (playing / buffering / error) —
 *    never a silent dead button.
 *  - Now-playing is computed client-side from /radio/schedule.json as a pure
 *    function of wall-clock time — the same function the server-side publisher
 *    uses, so the page can never drift from the schedule. Schedule is fetched
 *    once per page load (it is immutable within a program version).
 * Vanilla JS, zero dependencies. Safe to include on pages that only carry
 * <audio id="radioAudio"> (cena city pages): DOM extras are optional.
 */
(function () {
  'use strict';

  var HLS_URL = 'https://radio.cumulativeweb.com/live.m3u8';
  var SCHEDULE_URL = '/radio/schedule.json';
  var HLSJS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1';
  var NP_REFRESH_MS = 15000;

  /* ---------- track-at-time: pure function of (schedule, nowMs) ----------
   * Line-for-line port of cwi-company/radio/track-at-time.js (the publisher's
   * implementation). The agreement test executes both against the real
   * schedule.json — any divergence is a now-playing drift defect.
   * Returns {slot, position_seconds, track_ends_at, track}; throws on invalid. */
  function validateSchedule(s) {
    if (!s || typeof s !== 'object') throw new Error('schedule-invalid: not an object');
    if (s.schema !== 'cwi-radio-schedule/1') throw new Error('schedule-invalid: unknown schema ' + s.schema);
    if (!Array.isArray(s.tracks) || s.tracks.length === 0) throw new Error('schedule-invalid: empty tracks');
    if (typeof s.period_seconds !== 'number' || s.period_seconds <= 0) throw new Error('schedule-invalid: bad period_seconds');
    var epochMs = Date.parse(s.epoch);
    if (!isFinite(epochMs)) throw new Error('schedule-invalid: bad epoch');
    var TOL = 0.05, i, prev, cur, want, last;
    if (Math.abs(s.tracks[0].offset_seconds - 0) > TOL) throw new Error('schedule-invalid: first offset != 0');
    for (i = 1; i < s.tracks.length; i++) {
      prev = s.tracks[i - 1]; cur = s.tracks[i];
      want = prev.offset_seconds + prev.duration_seconds;
      if (Math.abs(cur.offset_seconds - want) > TOL) throw new Error('schedule-invalid: slot ' + i + ' offset gap');
      if (!(cur.duration_seconds > 0)) throw new Error('schedule-invalid: slot ' + i + ' bad duration');
    }
    last = s.tracks[s.tracks.length - 1];
    if (Math.abs(last.offset_seconds + last.duration_seconds - s.period_seconds) > TOL) {
      throw new Error('schedule-invalid: last slot end != period_seconds');
    }
    return { epochMs: epochMs, periodMs: s.period_seconds * 1000 };
  }

  function trackAtTime(schedule, nowMs) {
    var v = validateSchedule(schedule);
    var posMs = (Math.floor(nowMs) - Math.floor(v.epochMs)) % v.periodMs;
    if (posMs < 0) posMs += v.periodMs;
    var posS = posMs / 1000, i, t;
    for (i = 0; i < schedule.tracks.length; i++) {
      t = schedule.tracks[i];
      if (posS >= t.offset_seconds && posS < t.offset_seconds + t.duration_seconds) {
        var diffMs = Math.floor(nowMs) - Math.floor(v.epochMs);
        var loopIndex = Math.floor(diffMs / v.periodMs);
        var absLoopStart = Math.floor(v.epochMs) + loopIndex * v.periodMs;
        var trackEndAbs = absLoopStart + (t.offset_seconds + t.duration_seconds) * 1000;
        return {
          slot: i,
          position_seconds: Math.round((posS - t.offset_seconds) * 10) / 10,
          track_ends_at: new Date(trackEndAbs).toISOString(),
          track: t
        };
      }
    }
    throw new Error('schedule-invalid: no slot contains position ' + posS);
  }

  /* ---------- seek-to-live: align audio with the schedule ----------
   * ROOT CAUSE (2026-10-03): the program is a static VOD playlist, so
   * playback always began at segment 0 (schedule offset 0), while the
   * now-playing title/art were computed from wall-clock time. The two never
   * met: audio and art disagreed by a fixed phase offset forever.
   * Fix: on every play transition, seek the audio to the live schedule
   * position. A 60s drift guard re-syncs if audio and schedule ever diverge
   * by more than SYNC_THRESHOLD_S (covers the ~13s/loop HLS segment-rounding
   * drift vs the schedule period). */
  var SYNC_CHECK_MS = 60000;
  var SYNC_THRESHOLD_S = 8;
  var syncTimer = null;
  /* Declared-timeline ratio: the HLS media timeline (sum of EXTINF) vs the
   * schedule period. The encoder adds ~115ms/track of padding (~13s/loop),
   * so schedule seconds must be scaled to address the right audio.
   * Computed live from program.m3u8; 1 until measured. */
  var TIMELINE_RATIO = 1;
  var PERIOD_SECONDS = 21635.912;

  function measureTimeline() {
    fetch(HLS_URL, { cache: 'default' })
      .then(function (r) { if (!r.ok) throw new Error('m3u8 ' + r.status); return r.text(); })
      .then(function (txt) {
        var total = 0, m, re = /#EXTINF:([0-9.]+)/g;
        while ((m = re.exec(txt)) !== null) total += parseFloat(m[1]);
        if (total > 0 && PERIOD_SECONDS > 0) {
          var ratio = total / PERIOD_SECONDS;
          if (ratio > 0.9 && ratio < 1.1) TIMELINE_RATIO = ratio;
        }
      })
      .catch(function () { /* keep ratio 1: schedule seconds as-is */ });
  }

  function liveStreamPosition() {
    if (!schedCache) return null;
    try {
      var r = trackAtTime(schedCache, Date.now());
      return (r.track.offset_seconds + r.position_seconds) * TIMELINE_RATIO;
    } catch (e) { return null; }
  }

  function clampPos(pos, audio) {
    try {
      var d = audio.duration;
      if (isFinite(d) && d > 0 && pos >= d) return 0;
    } catch (e) {}
    return pos;
  }

  function seekHlsJs(audio, pos) {
    try {
      var hls = audio._radio365hls;
      if (!hls) return false;
      if (audio._radio365manifest) {
        try { audio.currentTime = pos; } catch (e) {}
        try { hls.startLoad(pos); } catch (e) {}
        return true;
      }
      /* Manifest not parsed yet: park the seek; MANIFEST_PARSED fires it. */
      audio._radio365pendingLive = pos;
      return true;
    } catch (e) { return false; }
  }

  function seekNative(audio, pos) {
    try {
      pos = clampPos(pos, audio);
      if (Math.abs(audio.currentTime - pos) <= 2) return true; /* already there */
      if (audio.readyState >= 1) { audio.currentTime = pos; return true; }
      /* Metadata not loaded yet: park the seek until it is. */
      var onMeta = function () {
        audio.removeEventListener('loadedmetadata', onMeta);
        try {
          var p = clampPos(pos, audio);
          if (Math.abs(audio.currentTime - p) > 2) audio.currentTime = p;
        } catch (e) {}
      };
      audio.addEventListener('loadedmetadata', onMeta);
      return true;
    } catch (e) { return false; }
  }

  /* Seek the audio element to the live schedule position, then play.
   * Used on every user play tap and on loop restart. */
  function startLivePlayback(audio) {
    var pos = liveStreamPosition();
    /* iOS Safari (2026-10-04): play() returns a promise — the old bare
       try/catch swallowed async rejections, leaving a dead button with no
       state. Now the tap shows buffering immediately and any rejection
       lands in the visible error state (tap to retry). */
    var doPlay = function () {
      setState('buffering', '\u2026 Buffering');
      try {
        var p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () { setState('error', 'Tap play to retry'); });
        }
      } catch (e) { setState('error', 'Tap play to retry'); }
    };
    if (pos === null) { doPlay(); return; } /* schedule not loaded yet */
    if (audio._radio365hls) {
      seekHlsJs(audio, pos);
      doPlay();
      return;
    }
    /* Native HLS path: seek first when possible, play in all cases. */
    if (audio.readyState >= 1) {
      seekNative(audio, pos);
      doPlay();
    } else {
      /* Not loaded yet: start loading now; the parked seek fires on metadata. */
      seekNative(audio, pos);
      doPlay();
    }
  }

  /* Drift guard: while playing, compare audio clock vs schedule clock once a
   * minute; re-sync if they diverge beyond the threshold. Loop-aware: near
   * the natural end of the program, let the 'ended' handler restart instead
   * of yanking the last seconds of audio. */
  function syncGuard() {
    var audio = document.getElementById('radioAudio');
    if (!audio || audio.paused || audio.seeking) return;
    var pos = liveStreamPosition();
    if (pos === null) return;
    try {
      var d = audio.duration, cur = audio.currentTime;
      if (isFinite(d) && d > 0) {
        if (pos >= d) return;                    /* schedule wrapped: 'ended' restarts */
        if (d - cur < 20 && pos < 30) return;     /* loop edge: let it end naturally */
      }
      if (Math.abs(cur - pos) > SYNC_THRESHOLD_S) {
        if (audio._radio365hls) seekHlsJs(audio, pos);
        else audio.currentTime = clampPos(pos, audio);
      }
    } catch (e) {}
  }

  /* ---------- player state badge (never a silent dead button) ---------- */
  var badge = null;
  var bigPlay = null;
  var FALLBACK_ART = 'https://cumulativeweb.com/assets/cwi-logo.jpg';
  function setState(state, label) {
    if (badge) {
      badge.setAttribute('data-state', state);
      badge.textContent = label;
    }
    /* The big play button mirrors state: idle/paused/error show the play
       triangle (error = tap to retry), playing shows pause, buffering spins. */
    if (bigPlay) {
      var bs = (state === 'playing') ? 'playing'
             : (state === 'buffering') ? 'buffering' : 'idle';
      bigPlay.setAttribute('data-state', bs);
      bigPlay.setAttribute('aria-label',
        bs === 'playing' ? 'Pause Cumulative Radio 365 live'
                         : 'Play Cumulative Radio 365 live');
    }
  }

  function attachNative(audio) {
    audio.src = HLS_URL;
  }

  function attachHlsJs(audio, onReady) {
    var s = document.createElement('script');
    s.src = HLSJS_CDN;
    s.async = true;
    s.onload = function () {
      try {
        var hls = new Hls({
          fragLoadingMaxRetry: 4,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 4,
          fragLoadingRetryDelay: 1000,
          manifestLoadingRetryDelay: 1000,
          levelLoadingRetryDelay: 1000
        });
        hls.on(Hls.Events.ERROR, function (ev, data) {
          if (!data || !data.fatal) return;
          try {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              setState('buffering', 'Reconnecting\u2026');
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              setState('buffering', 'Recovering\u2026');
              hls.recoverMediaError();
            } else {
              hls.destroy();
              setState('error', 'Stream error \u2014 tap play to retry');
            }
          } catch (e) { setState('error', 'Stream error \u2014 tap play to retry'); }
        });
        hls.loadSource(HLS_URL);
        hls.attachMedia(audio);
        audio._radio365hls = hls;
        audio._radio365manifest = false;
        audio._radio365pendingLive = null;
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          audio._radio365manifest = true;
          /* A seek parked before the manifest arrived: fire it now. */
          var p = audio._radio365pendingLive;
          if (p !== null && p !== undefined) {
            audio._radio365pendingLive = null;
            try { audio.currentTime = p; } catch (e) {}
            try { hls.startLoad(p); } catch (e) {}
          }
        });
        onReady();
      } catch (e) {
        setState('error', 'Player failed to start \u2014 tap play to retry');
        onReady();
      }
    };
    s.onerror = function () {
      /* hls.js failed to load: last resort is a bare src and the browser's
         own handling (plus the visible error state if that fails too). */
      audio.src = HLS_URL;
      setState('error', 'Player failed to load \u2014 check connection, tap play to retry');
      onReady();
    };
    document.head.appendChild(s);
  }

  function bootPlayer(audio) {
    badge = document.getElementById('playState');
    bigPlay = document.getElementById('bigPlay');
    setState('idle', 'Tap the green button to play');
    /* The big play button IS the control: one unmissable tap target that
       toggles the stream. The tap is a real user gesture, so iOS Safari's
       autoplay policy is satisfied and native HLS starts. */
    if (bigPlay) {
      bigPlay.addEventListener('click', function () {
        try {
          if (audio.paused) { startLivePlayback(audio); }
          else { audio.pause(); }
        } catch (e) {
          setState('error', 'Tap play to retry');
        }
      });
    }
    var hlsPending = false;   /* true while hls.js is still loading */
    var pendingPlay = false;  /* user tapped play before hls.js attached */
    audio.addEventListener('playing', function () { setState('playing', '\u25B6 Playing'); });
    audio.addEventListener('waiting', function () { setState('buffering', '\u2026 Buffering'); });
    audio.addEventListener('pause', function () { setState('paused', '\u275A\u275A Paused'); });
    audio.addEventListener('error', function () {
      if (hlsPending) return; /* hls.js on its way; the bare element has no src yet */
      if (audio.error && audio.error.code === 4) {
        setState('error', 'Format not supported on this device');
      } else {
        setState('error', 'Stream error \u2014 tap play to retry');
      }
    });
    /* The program is a static 6h VOD loop — when it ends, restart at the
       live schedule position (not 0: the schedule period and the encoded
       audio differ by ~13s/loop, so 0 would reintroduce the phase offset). */
    audio.addEventListener('ended', function () {
      try { startLivePlayback(audio); } catch (e) {}
    });
    /* Tap-to-retry after a fatal error: reset the source. */
    audio.addEventListener('play', function () {
      if (hlsPending) { pendingPlay = true; setState('buffering', '\u2026 Buffering'); return; }
      if (badge && badge.getAttribute('data-state') === 'error') {
        setState('buffering', '\u2026 Buffering');
        try {
          if (audio._radio365hls) { audio._radio365hls.startLoad(); }
          else { audio.src = HLS_URL; audio.load(); }
        } catch (e) {}
      }
    });
    function ready() {
      hlsPending = false;
      if (pendingPlay) {
        pendingPlay = false;
        try { audio.play(); } catch (e) {}
      }
    }
    try {
      if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        attachNative(audio); /* iOS/desktop Safari: native, no hls.js shipped */
      } else if (window.MediaSource) {
        hlsPending = true;
        attachHlsJs(audio, ready);
      } else {
        attachNative(audio); /* last resort: let the browser try */
      }
    } catch (e) {
      setState('error', 'Player failed to start \u2014 tap play to retry');
    }
  }

  /* ---------- now-playing from the schedule (cannot drift) ---------- */
  var schedCache = null;
  var npTimer = null;

  function renderNp(track) {
    var t = document.getElementById('npTitle');
    var a = document.getElementById('npArtist');
    var art = document.getElementById('npArt');
    if (t && track.title) t.textContent = track.title;
    if (a) a.textContent = track.artist || '';
    /* Artwork can be null in the schedule (not every slot carries art) —
       fall back to the CWI logo so the card never renders imageless. */
    if (art) {
      var want = track.artwork || FALLBACK_ART;
      if (art.getAttribute('src') !== want) art.src = want;
    }
    try {
      var ev;
      if (typeof CustomEvent === 'function') {
        ev = new CustomEvent('radio365:track', { detail: track });
      } else {
        ev = document.createEvent('CustomEvent');
        ev.initCustomEvent('radio365:track', false, false, track);
      }
      document.dispatchEvent(ev);
    } catch (e) {}
  }

  function refreshNp() {
    if (!schedCache) return;
    try {
      var r = trackAtTime(schedCache, Date.now());
      renderNp(r.track);
    } catch (e) { /* invalid schedule: leave the connecting placeholder */ }
  }

  function bootNowPlaying() {
    if (!document.getElementById('npTitle') && !document.getElementById('npArtist')) return;
    fetch(SCHEDULE_URL, { cache: 'default' })
      .then(function (r) { if (!r.ok) throw new Error('schedule ' + r.status); return r.json(); })
      .then(function (s) {
        schedCache = s;
        if (s && typeof s.period_seconds === 'number' && s.period_seconds > 0) {
          PERIOD_SECONDS = s.period_seconds;
        }
        refreshNp();
      })
      .catch(function () { /* schedule fetch failed: leave the connecting placeholder */ });
    npTimer = setInterval(refreshNp, NP_REFRESH_MS);
  }

  function boot() {
    var audio = document.getElementById('radioAudio');
    if (audio) bootPlayer(audio);
    bootNowPlaying();
    measureTimeline();
    /* Drift guard: keep the audio clock glued to the schedule clock. */
    if (!syncTimer) { try { syncTimer = setInterval(syncGuard, SYNC_CHECK_MS); } catch (e) {} }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Exposed for tests: the pure function must agree with the publisher. */
  window.Radio365 = window.Radio365 || {};
  window.Radio365.validateSchedule = validateSchedule;
  window.Radio365.trackAtTime = trackAtTime;
  window.Radio365.HLS_URL = HLS_URL;
})();
