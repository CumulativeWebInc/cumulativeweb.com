/* CWI — artist signup form (Signal Sessions). Posts multipart/form-data to the
 * CWI form endpoint's /api/artist-signup. No dependencies. */
(function () {
  "use strict";
  var ENDPOINT = (window.CWI_FORM_ENDPOINT || "https://cwi-brasil-form-production.up.railway.app/api/artist-signup").replace(/\/$/, "");
  var form = document.getElementById("artistForm");
  if (!form) return;
  var status = document.getElementById("formStatus");
  var btn = document.getElementById("sendBtn");

  function markInvalid(name, bad) {
    var wrap = form.querySelector('[data-field="' + name + '"]');
    if (wrap) wrap.classList.toggle("invalid", !!bad);
    return !bad;
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254; }
  function validUrl(v) {
    try {
      var u = new URL(v);
      return (u.protocol === "http:" || u.protocol === "https:") && v.length <= 500;
    } catch (e) { return false; }
  }
  function validate() {
    var ok = true;
    ok = markInvalid("nome", form.nome.value.trim().length < 2) && ok;
    ok = markInvalid("artist_name", form.artist_name.value.trim().length < 2) && ok;
    ok = markInvalid("email", !validEmail(form.email.value.trim())) && ok;
    ok = markInvalid("track_link", !validUrl(form.track_link.value.trim())) && ok;
    ok = markInvalid("consentimento", !document.getElementById("consentimento").checked) && ok;
    return ok;
  }
  function showStatus(kind, html) { status.className = "form-status " + kind; status.innerHTML = html; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) { showStatus("bad", "<strong>Heads up:</strong> check the highlighted fields and try again."); return; }
    btn.disabled = true; btn.textContent = "Sending…"; showStatus("", "");
    var data = new FormData(form);
    data.append("consentimento", document.getElementById("consentimento").checked ? "sim" : "");
    data.append("website", "");
    fetch(ENDPOINT, { method: "POST", body: data })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (b) { return { ok: res.ok, body: b }; }); })
      .then(function (r) {
        if (r.ok) {
          showStatus("ok", "<strong>Submission received.</strong> Our team reviews every track — we'll email you if yours gets picked for a session.");
          form.reset();
        } else {
          showStatus("bad", "<strong>Something went wrong:</strong> " + String((r.body && r.body.erro) || "could not send right now.") + ' Try again or email <a href="mailto:hp@cumulativeweb.com" style="color:#fff">hp@cumulativeweb.com</a> directly.');
        }
      })
      .catch(function () { showStatus("bad", '<strong>No connection to the server.</strong> Check your internet or email <a href="mailto:hp@cumulativeweb.com" style="color:#fff">hp@cumulativeweb.com</a> directly.'); })
      .finally(function () { btn.disabled = false; btn.textContent = "Submit my track"; });
  });
})();
