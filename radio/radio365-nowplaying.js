/**
 * Cumulative Radio 365 — standalone now-playing library.
 *
 * Computes the current track as a pure function of wall-clock UTC time
 * and the static schedule.json. No server, no agent, no cron required.
 * Works "with or without you" — the browser does the math.
 *
 * Usage (browser):
 *   <script src="https://cumulativeweb.com/radio/radio365-nowplaying.js"></script>
 *   <script>
 *     Radio365NowPlaying.init({
 *       scheduleUrl: 'https://cumulativeweb.com/radio/schedule.json',
 *       onTrack: function(track) { console.log(track.artist, '-', track.title); }
 *     });
 *   </script>
 *
 * Usage (Node):
 *   const np = require('./radio365-nowplaying.js');
 *   const schedule = JSON.parse(fs.readFileSync('schedule.json'));
 *   const result = np.trackAtTime(schedule, Date.now());
 *   console.log(result.track.artist, '-', result.track.title);
 *
 * The schedule (cwi-radio-schedule/1) is a static file. Track-at-time is:
 *   pos = ((floor(now) - floor(epoch)) mod period + period) mod period
 * Slots are half-open: [offset, offset+duration).
 *
 * $0. No signups. No agent dependency.
 */
(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.Radio365NowPlaying = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_SCHEDULE_URL = 'https://cumulativeweb.com/radio/schedule.json';
  var REFRESH_MS = 15000;
  var FALLBACK_ART = 'https://cumulativeweb.com/assets/cwi-logo.jpg';

  function validateSchedule(s) {
    if (!s || typeof s !== 'object') throw new Error('schedule-invalid: not an object');
    if (s.schema !== 'cwi-radio-schedule/1') throw new Error('schedule-invalid: unknown schema ' + s.schema);
    if (!Array.isArray(s.tracks) || s.tracks.length === 0) throw new Error('schedule-invalid: empty tracks');
    if (typeof s.period_seconds !== 'number' || s.period_seconds <= 0) throw new Error('schedule-invalid: bad period_seconds');
    var epochMs = Date.parse(s.epoch);
    if (!isFinite(epochMs)) throw new Error('schedule-invalid: bad epoch');
    var TOL = 0.05;
    if (Math.abs(s.tracks[0].offset_seconds - 0) > TOL) throw new Error('schedule-invalid: first offset != 0');
    for (var i = 1; i < s.tracks.length; i++) {
      var prev = s.tracks[i - 1], cur = s.tracks[i];
      var want = prev.offset_seconds + prev.duration_seconds;
      if (Math.abs(cur.offset_seconds - want) > TOL) {
        throw new Error('schedule-invalid: slot ' + i + ' offset gap');
      }
      if (!(cur.duration_seconds > 0)) throw new Error('schedule-invalid: slot ' + i + ' bad duration');
    }
    var last = s.tracks[s.tracks.length - 1];
    if (Math.abs(last.offset_seconds + last.duration_seconds - s.period_seconds) > TOL) {
      throw new Error('schedule-invalid: last slot end != period_seconds');
    }
    return { epochMs: epochMs, periodMs: s.period_seconds * 1000 };
  }

  /**
   * @returns {{slot:number, position_seconds:number, track_ends_at:string, track:Object}}
   * track: {slot, offset_seconds, duration_seconds, artist, title, artwork}
   */
  function trackAtTime(schedule, nowMs) {
    var v = validateSchedule(schedule);
    var posMs = (Math.floor(nowMs) - Math.floor(v.epochMs)) % v.periodMs;
    if (posMs < 0) posMs += v.periodMs;
    var posS = posMs / 1000;
    for (var i = 0; i < schedule.tracks.length; i++) {
      var t = schedule.tracks[i];
      if (posS >= t.offset_seconds && posS < t.offset_seconds + t.duration_seconds) {
        var diffMs = Math.floor(nowMs) - Math.floor(v.epochMs);
        var loopIndex = Math.floor(diffMs / v.periodMs);
        var absLoopStart = Math.floor(v.epochMs) + loopIndex * v.periodMs;
        var trackEndAbs = absLoopStart + (t.offset_seconds + t.duration_seconds) * 1000;
        return {
          slot: i,
          position_seconds: Math.round((posS - t.offset_seconds) * 10) / 10,
          track_ends_at: new Date(trackEndAbs).toISOString(),
          track: {
            artist: t.artist || '',
            title: t.title || '',
            artwork: t.artwork || FALLBACK_ART,
            slot: i,
            program_version: schedule.program_version || ''
          }
        };
      }
    }
    throw new Error('schedule-invalid: no slot contains position ' + posS);
  }

  /**
   * Browser auto-mode: fetch schedule, compute now-playing, call onTrack on change.
   * Returns a stop() function.
   */
  function init(opts) {
    opts = opts || {};
    var scheduleUrl = opts.scheduleUrl || DEFAULT_SCHEDULE_URL;
    var onTrack = opts.onTrack || function () {};
    var onError = opts.onError || function () {};
    var refreshMs = opts.refreshMs || REFRESH_MS;

    var schedCache = null;
    var lastKey = null;
    var timer = null;
    var stopped = false;

    function keyOf(track) {
      return (track.artist || '') + '|' + (track.title || '') + '|' + (track.program_version || '');
    }

    function refresh() {
      if (stopped || !schedCache) return;
      try {
        var r = trackAtTime(schedCache, Date.now());
        var k = keyOf(r.track);
        if (k !== lastKey) {
          lastKey = k;
          onTrack(r.track, r);
        }
      } catch (e) {
        onError(e);
      }
    }

    function fetchSchedule() {
      if (typeof fetch === 'undefined') {
        onError(new Error('fetch not available; pass schedule directly via trackAtTime()'));
        return;
      }
      fetch(scheduleUrl, { cache: 'default' })
        .then(function (res) {
          if (!res.ok) throw new Error('schedule fetch ' + res.status);
          return res.json();
        })
        .then(function (s) {
          validateSchedule(s);
          schedCache = s;
          lastKey = null;
          refresh();
        })
        .catch(onError);
    }

    fetchSchedule();
    timer = setInterval(refresh, refreshMs);
    // Re-fetch schedule hourly in case the program was updated.
    var refetchTimer = setInterval(function () { if (!stopped) fetchSchedule(); }, 3600000);

    return function stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      if (refetchTimer) clearInterval(refetchTimer);
    };
  }

  return {
    trackAtTime: trackAtTime,
    validateSchedule: validateSchedule,
    init: init,
    FALLBACK_ART: FALLBACK_ART
  };
}));
