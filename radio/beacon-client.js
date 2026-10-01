// © 2026 Cumulative Web Inc. All rights reserved. (cumulativeweb.com)
// attention-beacon — browser client for Radio 365 (beacon payload v2).
// ===========================================================================
// BROWSER PORT of ai-utility-factory/attention-beacon/lib/beacon.js v1.0.0.
// Exactly one change from the lib: defaultDeviceId() uses the Web Crypto API
// instead of node:crypto (the lib's only Node-only import). All batching,
// flush, sendBeacon/fetch-keepalive, and never-throw semantics are identical.
//
// Privacy: payloads carry ONLY the product slug, an anonymous device id
// (persisted in localStorage so unique-device counts are stable), per-event
// counts for the window, and optional capped extras (public data only —
// never PII, never IPs).
(function (global) {
  "use strict";

  var SCHEMA_VERSION = 2;
  var MAX_EXTRAS_PER_FLUSH = 25;
  var MAX_ROLL_EVENTS = 2000;
  var MAX_STRING_LEN = 500;

  function defaults() {
    return { counts: {}, sums: {}, extras: [], windowStart: Date.now(), sent: 0, failed: 0 };
  }

  function cleanStr(v, maxLen) {
    if (typeof v !== "string" || v.length === 0) return undefined;
    return v.slice(0, maxLen || MAX_STRING_LEN);
  }

  function ingest(win, name, data) {
    data = data || {};
    var event = String(name || "unknown").slice(0, 80);
    win.counts[event] = (win.counts[event] || 0) + 1;
    for (var k in data) {
      if (k.slice(-7) === "_amount" && typeof data[k] === "number" && isFinite(data[k])) {
        win.sums[k] = (win.sums[k] || 0) + data[k];
      }
    }
    if (data.extra && typeof data.extra === "object" && win.extras.length < MAX_EXTRAS_PER_FLUSH) {
      var clean = { e: event };
      for (var ek in data.extra) {
        var ev = data.extra[ek];
        if (typeof ev === "string") clean[ek] = cleanStr(ev);
        else if (typeof ev === "number" && isFinite(ev)) clean[ek] = ev;
        else if (typeof ev === "boolean") clean[ek] = ev;
      }
      win.extras.push(clean);
    }
    return win;
  }

  function isEmpty(win) {
    for (var k in win.counts) return false;
    return win.extras.length === 0;
  }

  function buildPayload(win, product, deviceId) {
    var now = Date.now();
    return {
      v: SCHEMA_VERSION,
      product: String(product),
      d: String(deviceId),
      w: Math.max(1, Math.round((now - win.windowStart) / 1000)),
      t0: win.windowStart,
      t1: now,
      c: Object.assign({}, win.counts),
      s: Object.assign({}, win.sums),
      x: win.extras.map(function (e) { return Object.assign({}, e); })
    };
  }

  function serialize(payload) {
    try { return JSON.stringify(payload); } catch (e) { return null; }
  }

  function defaultTransport(env) {
    return function (endpoint, body) {
      try {
        if (env && env.navigator && typeof env.navigator.sendBeacon === "function") {
          return !!env.navigator.sendBeacon(endpoint, body);
        }
      } catch (e) { return false; }
      try {
        if (env && typeof env.fetch === "function") {
          env.fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body,
            keepalive: true
          }).catch(function () {});
          return true;
        }
      } catch (e) { return false; }
      return false;
    };
  }

  function defaultDeviceId() {
    try {
      var buf = new Uint8Array(8);
      (global.crypto || {}).getRandomValues
        ? global.crypto.getRandomValues(buf)
        : buf.map(function () { return Math.floor(Math.random() * 256); });
      var hex = "";
      for (var i = 0; i < buf.length; i++) hex += ("0" + buf[i].toString(16)).slice(-2);
      return "dev_" + hex;
    } catch (e) {
      return "dev_" + Math.floor(Math.random() * 1e16).toString(16);
    }
  }

  function flush(win, cfg, transport) {
    if (isEmpty(win)) return { sent: false, win: win };
    if (!cfg || !cfg.product || !cfg.sink || !cfg.deviceId) return { sent: false, win: win };
    var body = serialize(buildPayload(win, cfg.product, cfg.deviceId));
    if (!body) return { sent: false, win: win };
    var ok = false;
    try { ok = !!transport(cfg.sink, body); } catch (e) { ok = false; }
    if (ok) { win.sent++; return { sent: true, win: defaults() }; }
    win.failed++;
    var total = 0;
    for (var k in win.counts) total += win.counts[k];
    if (total > MAX_ROLL_EVENTS) {
      var fresh = defaults();
      fresh.failed = win.failed;
      fresh.sent = win.sent;
      return { sent: false, win: fresh };
    }
    return { sent: false, win: win };
  }

  function start(cfg, env) {
    cfg = cfg || {};
    if (!cfg.product) throw new Error("beacon: cfg.product (slug) is required");
    if (!cfg.sink) throw new Error("beacon: cfg.sink (endpoint URL) is required");
    var deviceId = (typeof cfg.deviceId === "function") ? cfg.deviceId()
      : (typeof cfg.deviceId === "string" ? cfg.deviceId : defaultDeviceId());
    var fullCfg = { product: cfg.product, sink: cfg.sink, deviceId: deviceId };
    var immediate = {};
    (cfg.immediateEvents || []).forEach(function (n) { immediate[String(n)] = true; });

    env = env || global;
    var transport = cfg.transport || defaultTransport(env);
    var win = defaults();

    var api = {
      ingest: function (name, data) {
        try { win = ingest(win, name, data); } catch (e) { /* never break the product */ }
        if (immediate[String(name)]) api.flushNow();
      },
      flushNow: function () {
        try {
          var r = flush(win, fullCfg, transport);
          win = r.win;
          return r.sent;
        } catch (e) { return false; }
      }
    };

    try {
      var ms = cfg.flushMs || 60000;
      if (env.setInterval) {
        var t = env.setInterval(function () { api.flushNow(); }, ms);
        if (t && typeof t.unref === "function") t.unref();
      }
      var onHide = function () { api.flushNow(); };
      if (env.document && typeof env.document.addEventListener === "function") {
        env.document.addEventListener("visibilitychange", function () {
          if (env.document.hidden) onHide();
        });
      }
      if (typeof env.addEventListener === "function") env.addEventListener("pagehide", onHide);
    } catch (e) { /* wiring is best-effort */ }
    return api;
  }

  global.CWIBeacon = {
    start: start,
    ingest: ingest,
    flush: flush,
    buildPayload: buildPayload,
    isEmpty: isEmpty,
    SCHEMA_VERSION: SCHEMA_VERSION,
    CANONICAL_EVENTS: ["session_start", "view", "try", "equip", "share", "convert"]
  };
})(typeof window !== "undefined" ? window : globalThis);
