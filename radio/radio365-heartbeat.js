/* © 2026 Cumulative Web Inc. All rights reserved. (cumulativeweb.com)
 * Cumulative Radio 365 — listener heartbeat client (Icecast listener-stats parallel).
 *
 * Sends {session_id, track} to POST /radio/heartbeat every 30s while the
 * audio element is playing. The worker upserts the session into D1 and
 * GET /radio/listeners reads the Icecast-equivalent stats back.
 *
 * GATE #5 (2026-10-09, Black's law "fix the wrongs, make them correct"):
 * this client used to swallow every failure (empty .catch, bare try/catch,
 * non-2xx responses treated as success). It now:
 *   - retries transient failures: up to 3 attempts with exponential backoff
 *     (1s / 2s / 4s + jitter) per beat — bounded, never piles up;
 *   - treats any non-2xx HTTP response as a failure (the worker returns
 *     {error:...} with 400/500/503 on its bad paths — those are data now);
 *   - logs every failed attempt to the console with the [Radio365 heartbeat]
 *     tag (visible in devtools, queryable from error trackers);
 *   - marks the #npListeners badge with data-hb="degraded" and a title note
 *     when beats fail persistently (subtle, never a popup);
 *   - exposes window.Radio365Heartbeat.state() / .events(): counters plus a
 *     capped event ring buffer, so failed attempts are queryable from the
 *     console (the failed-attempt surface the audit asked for).
 * It still never throws into the player: every internal error is logged,
 * never propagated. Degrading gracefully is correct; degrading silently
 * was the gate.
 *
 * Vanilla ES5-ish, zero dependencies. Used by /radio.html and /br/radio.html
 * (both include it via <script src="/radio/radio365-heartbeat.js">).
 */
(function () {
  'use strict';

  var SINK = 'https://cwi-machine-data.hp-ace.workers.dev/radio/heartbeat';
  var BEAT_MS = 30000;
  var MAX_ATTEMPTS = 3;          /* bounded retry: 3 attempts per beat */
  var BASE_BACKOFF_MS = 1000;    /* 1s, 2s, 4s (+ jitter) */
  var LOG_TAG = '[Radio365 heartbeat]';
  var MAX_EVENTS = 50;           /* diagnostics ring buffer */
  var DEGRADED_AFTER = 2;        /* consecutive failed beats before the badge flips */

  function warn(msg) {
    try {
      if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
        console.warn(LOG_TAG, msg);
      }
    } catch (e) { /* logging must never break the player */ }
  }

  var state = {
    sent: 0,               /* beats acknowledged 2xx by the worker */
    failed: 0,             /* beats given up on after MAX_ATTEMPTS */
    attempts: 0,           /* total HTTP attempts made */
    consecutiveFailures: 0,
    lastError: null,
    lastOkAt: null,
    retrying: false
  };
  var events = [];         /* ring buffer: {t, kind, detail} */

  function logEvent(kind, detail) {
    try {
      events.push({ t: new Date().toISOString(), kind: kind, detail: detail || null });
      if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    } catch (e) {}
  }

  /* ---------- anonymous device/session id (survives reloads within a tab) ---------- */
  var sid = null;
  try {
    sid = sessionStorage.getItem('cwi_r365_sid');
    if (!sid) {
      var b = new Uint8Array(16);
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
      else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
      var hex = '';
      for (var j = 0; j < b.length; j++) hex += ('0' + b[j].toString(16)).slice(-2);
      sid = 's_' + hex;
      sessionStorage.setItem('cwi_r365_sid', sid);
    }
  } catch (e) {
    warn('session id store unavailable: ' + ((e && e.message) || e));
    sid = 's_fallback_' + String(Date.now());
  }

  function currentTrack() {
    try {
      var t = document.getElementById('npTitle');
      var a = document.getElementById('npArtist');
      return ((a && a.textContent) || '') + ' - ' + ((t && t.textContent) || '');
    } catch (e) {
      return ' - ';
    }
  }

  /* ---------- subtle visible indicator: never a popup, always a signal ---------- */
  function setIndicator() {
    try {
      var el = document.getElementById('npListeners');
      if (!el || !el.setAttribute) return;
      if (state.consecutiveFailures >= DEGRADED_AFTER) {
        el.setAttribute('data-hb', 'degraded');
        var title = el.getAttribute('title') || '';
        if (title.indexOf('reporting paused') === -1) {
          el.setAttribute('title', (title ? title + ' · ' : '') + 'listener reporting paused (heartbeat failing)');
        }
      } else {
        el.removeAttribute('data-hb');
      }
    } catch (e) {
      warn('indicator update failed: ' + ((e && e.message) || e));
    }
  }

  /* ---------- beat with bounded retry + backoff ---------- */
  function attempt(payload, n) {
    state.attempts++;
    var startedAt = Date.now();
    var p;
    try {
      p = fetch(SINK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (e) {
      /* fetch itself threw synchronously — treat like a failed attempt. */
      p = Promise.reject(e);
    }
    return p.then(function (r) {
      /* Non-2xx is a failure with data, not a silent success: the worker
         returns {error:'db_error'} / 500 etc. on its bad paths. */
      if (!r || !r.ok) {
        var st = (r && r.status) || 'no-response';
        return r && r.text ? r.text().then(function () { throw new Error('HTTP ' + st); },
                                            function () { throw new Error('HTTP ' + st); })
                          : (function () { throw new Error('HTTP ' + st); })();
      }
      return r;
    }).then(function () {
      state.sent++;
      state.consecutiveFailures = 0;
      state.lastOkAt = new Date().toISOString();
      state.retrying = false;
      logEvent('ok', { latencyMs: Date.now() - startedAt });
      setIndicator();
    }).catch(function (err) {
      var msg = (err && err.message) || String(err);
      warn('attempt ' + n + '/' + MAX_ATTEMPTS + ' failed (' + msg + ')');
      logEvent('attempt_failed', { attempt: n, error: msg });
      if (n < MAX_ATTEMPTS) {
        state.retrying = true;
        var backoff = BASE_BACKOFF_MS * Math.pow(2, n - 1) + Math.floor(Math.random() * 250);
        setTimeout(function () { attempt(payload, n + 1); }, backoff);
      } else {
        state.failed++;
        state.consecutiveFailures++;
        state.lastError = msg;
        state.retrying = false;
        warn('gave up after ' + MAX_ATTEMPTS + ' attempts (' + msg +
             ') — listener reporting paused; next beat in ' + (BEAT_MS / 1000) + 's');
        logEvent('failed', { error: msg });
        setIndicator();
      }
    });
  }

  function beat() {
    try {
      var audio = document.getElementById('radioAudio');
      if (!audio || audio.paused) return;
      attempt({ session_id: sid, track: currentTrack().slice(0, 200) }, 1);
    } catch (e) {
      /* beat() itself must never throw into the player loop. */
      var msg = (e && e.message) || String(e);
      warn('beat() threw (swallowed, player unaffected): ' + msg);
      logEvent('beat_threw', { error: msg });
    }
  }

  /* ---------- boot: wire play tap + 30s interval, then expose diagnostics ---------- */
  try {
    var audio0 = document.getElementById('radioAudio');
    if (audio0 && typeof audio0.addEventListener === 'function') {
      audio0.addEventListener('play', function () { beat(); });
    }
    setInterval(beat, BEAT_MS);
  } catch (e) {
    warn('init failed: ' + ((e && e.message) || e));
  }

  try {
    window.Radio365Heartbeat = {
      /* Snapshot of counters — queryable from the console. */
      state: function () { return JSON.parse(JSON.stringify(state)); },
      /* Last MAX_EVENTS failure/success events — the queryable failure surface. */
      events: function () { return events.slice(); },
      /* Manual beat for diagnostics (does not throw). */
      beat: function () { beat(); }
    };
  } catch (e) { /* exposure is nice-to-have */ }
})();
