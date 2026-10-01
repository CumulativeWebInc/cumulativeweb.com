// © 2026 Cumulative Web Inc. All rights reserved. (cumulativeweb.com)
// Radio 365 — attention-beacon wiring (first amplification pilot).
// Emits anonymous attention events (session_start, view, try) to the
// station's beacon sink. Best-effort: never blocks, never throws, and the
// page works identically with or without it.
(function () {
  try {
    if (!window.CWIBeacon) return;

    var DEV_KEY = "cwi_r365_dev";
    var dev = null;
    try { dev = window.localStorage.getItem(DEV_KEY); } catch (e) {}
    if (!dev) {
      try {
        var buf = new Uint8Array(8);
        if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
        else for (var i = 0; i < 8; i++) buf[i] = Math.floor(Math.random() * 256);
        var hex = "";
        for (var j = 0; j < buf.length; j++) hex += ("0" + buf[j].toString(16)).slice(-2);
        dev = "dev_" + hex;
      } catch (e) { dev = "dev_" + String(Math.floor(Math.random() * 1e16)); }
      try { window.localStorage.setItem(DEV_KEY, dev); } catch (e) {}
    }

    var beacon = window.CWIBeacon.start({
      product: "radio-365",
      sink: "https://ntfy.envs.net/cwi-r365-bcn-Wa1UFwUH302k",
      deviceId: function () { return dev; },
      flushMs: 60000,
      immediateEvents: ["try"]
    });

    beacon.ingest("session_start", {});
    beacon.ingest("view", { extra: { page: "/radio.html" } });

    var audio = document.getElementById("radioAudio");
    var tried = false;
    if (audio && audio.addEventListener) {
      audio.addEventListener("play", function () {
        if (tried) return;
        tried = true;
        try { beacon.ingest("try", { extra: { stream: "cumulative-365" } }); } catch (e) {}
      });
    }

    if (window.addEventListener) {
      window.addEventListener("pagehide", function () { try { beacon.flushNow(); } catch (e) {} });
    }

    // Exposed for diagnostics only.
    window.CWIBeaconRadio = { flush: function () { try { return beacon.flushNow(); } catch (e) { return false; } } };
  } catch (e) { /* the station plays on, beacon or not */ }
})();
