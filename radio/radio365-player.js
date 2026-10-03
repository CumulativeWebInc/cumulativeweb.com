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

  var HLS_URL = 'https://cumulativeweb.com/radio/hls/program.m3u8';
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

  /* ---------- player state badge (never a silent dead button) ---------- */
  var badge = null;
  function setState(state, label) {
    if (!badge) return;
    badge.setAttribute('data-state', state);
    badge.textContent = label;
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
    setState('idle', '');
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
    /* The program is a static 6h VOD loop — when it ends, start it over. */
    audio.addEventListener('ended', function () {
      try { audio.currentTime = 0; audio.play(); } catch (e) {}
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
    if (art && track.artwork && art.getAttribute('src') !== track.artwork) art.src = track.artwork;
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
      .then(function (s) { schedCache = s; refreshNp(); })
      .catch(function () { /* schedule fetch failed: leave the connecting placeholder */ });
    npTimer = setInterval(refreshNp, NP_REFRESH_MS);
  }

  function boot() {
    var audio = document.getElementById('radioAudio');
    if (audio) bootPlayer(audio);
    bootNowPlaying();
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
