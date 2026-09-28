/* CWI — independent artist signup. Posts multipart/form-data to the CWI form endpoint. No dependencies. */
(function () {
  "use strict";
  var ENDPOINT = (window.CWI_FORM_ENDPOINT || "https://cwi-brasil-form-production.up.railway.app/api/contato").replace(/\/$/, "");
  var form = document.getElementById("signupForm");
  if (!form) return;
  var status = document.getElementById("formStatus");
  var btn = document.getElementById("sendBtn");
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254; }
  function validUrl(v) { return v === "" || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v); }
  function markInvalid(name, bad) {
    var wrap = form.querySelector('[data-field="' + name + '"]');
    if (wrap) wrap.classList.toggle("invalid", !!bad);
    return !bad;
  }
  function validate() {
    var ok = true;
    ok = markInvalid("nome", val("nome").length < 2) && ok;
    ok = markInvalid("cidade", val("cidade").length < 2) && ok;
    ok = markInvalid("email", !validEmail(val("email"))) && ok;
    var tel = val("telefone");
    ok = markInvalid("telefone", tel !== "" && !/^[+()\d\s.-]{6,30}$/.test(tel)) && ok;
    ok = markInvalid("genero", val("genero") === "") && ok;
    ok = markInvalid("spotify", !validUrl(val("spotify"))) && ok;
    ok = markInvalid("youtube", !validUrl(val("youtube"))) && ok;
    ok = markInvalid("instagram", !validUrl(val("instagram"))) && ok;
    ok = markInvalid("sobre", val("sobre").length < 10) && ok;
    ok = markInvalid("consentimento", !document.getElementById("consentimento").checked) && ok;
    return ok;
  }
  function linha(k, v) { return v ? (k + ": " + v) : ""; }
  function montarMensagem() {
    var partes = [];
    partes.push(linha("Stage name", val("nome")));
    partes.push(linha("Real name", val("nome_real")));
    partes.push(linha("City", val("cidade")));
    partes.push(linha("Genre", val("genero")));
    partes.push(linha("Spotify", val("spotify")));
    partes.push(linha("YouTube", val("youtube")));
    partes.push(linha("Instagram", val("instagram")));
    partes.push(linha("How they found CWI", val("origem")));
    partes.push("About the project:\n" + val("sobre"));
    return partes.filter(Boolean).join("\n");
  }
  function showStatus(kind, html) { status.className = "form-status " + kind; status.innerHTML = html; }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) { showStatus("bad", "<strong>Heads up:</strong> check the highlighted fields and try again."); return; }
    btn.disabled = true; btn.textContent = "Sending…"; showStatus("", "");
    var data = new FormData();
    data.append("nome", val("nome"));
    data.append("email", val("email"));
    data.append("telefone", val("telefone"));
    data.append("tipo", "artista");
    data.append("mensagem", montarMensagem());
    data.append("consentimento", document.getElementById("consentimento").checked ? "sim" : "");
    data.append("website", "");
    fetch(ENDPOINT, { method: "POST", body: data })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (b) { return { ok: res.ok, body: b }; }); })
      .then(function (r) {
        if (r.ok) { showStatus("ok", "<strong>Signup received.</strong> Thanks for bringing your project to the movement — a confirmation is on its way to your email. Our A&amp;R team will listen to your work and reply."); form.reset(); }
        else { showStatus("bad", "<strong>Something went wrong:</strong> " + String((r.body && r.body.erro) || "could not send right now.")); }
      })
      .catch(function () { showStatus("bad", '<strong>No connection to the server.</strong> Check your internet or email <a href="mailto:hp@cumulativeweb.com" style="color:#fff">hp@cumulativeweb.com</a> directly.'); })
      .finally(function () { btn.disabled = false; btn.textContent = "Submit signup"; });
  });
})();
