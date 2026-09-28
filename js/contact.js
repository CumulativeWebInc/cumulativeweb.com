/* CWI — contact form. Posts multipart/form-data to the CWI form endpoint. No dependencies. */
(function () {
  "use strict";
  var ENDPOINT = (window.CWI_FORM_ENDPOINT || "https://cwi-brasil-form-production.up.railway.app/api/contato").replace(/\/$/, "");
  var MAX_FILE = 10 * 1024 * 1024;
  var OK_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/zip"];
  var form = document.getElementById("contactForm");
  if (!form) return;
  var status = document.getElementById("formStatus");
  var btn = document.getElementById("sendBtn");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".type-tabs button"));
  var select = document.getElementById("tipo");
  function setTipo(tipo, focus) {
    var valid = ["evento", "promo", "modelos", "geral"];
    if (valid.indexOf(tipo) === -1) tipo = "geral";
    select.value = tipo;
    tabs.forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tipo") === tipo ? "true" : "false"); });
    if (focus) select.focus();
  }
  tabs.forEach(function (b) { b.addEventListener("click", function () { setTipo(b.getAttribute("data-tipo"), false); }); });
  select.addEventListener("change", function () { setTipo(select.value, false); });
  try { var q = new URLSearchParams(location.search).get("tipo"); if (q) setTipo(q, false); } catch (e) {}
  function markInvalid(name, bad) {
    var wrap = form.querySelector('[data-field="' + name + '"]');
    if (wrap) wrap.classList.toggle("invalid", !!bad);
    return !bad;
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254; }
  function validate() {
    var ok = true;
    ok = markInvalid("nome", form.nome.value.trim().length < 2) && ok;
    ok = markInvalid("email", !validEmail(form.email.value.trim())) && ok;
    var tel = form.telefone.value.trim();
    ok = markInvalid("telefone", tel !== "" && !/^[+()\d\s.-]{6,30}$/.test(tel)) && ok;
    ok = markInvalid("mensagem", form.mensagem.value.trim().length < 10) && ok;
    var f = form.arquivo.files[0];
    ok = markInvalid("arquivo", !!(f && (f.size > MAX_FILE || OK_TYPES.indexOf(f.type) === -1))) && ok;
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
        if (r.ok) { showStatus("ok", "<strong>Message received.</strong> We'll reply by email."); form.reset(); setTipo("geral", false); }
        else { showStatus("bad", "<strong>Something went wrong:</strong> " + String((r.body && r.body.erro) || "could not send right now.") + ' Try again or email <a href="mailto:hp@cumulativeweb.com" style="color:#fff">hp@cumulativeweb.com</a> directly.'); }
      })
      .catch(function () { showStatus("bad", '<strong>No connection to the server.</strong> Check your internet or email <a href="mailto:hp@cumulativeweb.com" style="color:#fff">hp@cumulativeweb.com</a> directly.'); })
      .finally(function () { btn.disabled = false; btn.textContent = "Send message"; });
  });
})();
