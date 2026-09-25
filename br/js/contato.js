/* CWI Brasil — formulário de contato universal.
 * Envia multipart/form-data ao endpoint serverless configurado em
 * window.CWI_BR_ENDPOINT (padrão: URL de produção documentada no DEPLOY.md).
 * Sem dependências. Validação no cliente + validação real no servidor.
 */
(function () {
  "use strict";

  var ENDPOINT = (window.CWI_BR_ENDPOINT || "https://cwi-brasil-form-production.up.railway.app/api/contato").replace(/\/$/, "");
  var MAX_FILE = 10 * 1024 * 1024;
  var OK_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/zip"];
  var OK_EXT = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".zip"];

  var form = document.getElementById("contatoForm");
  if (!form) return;
  var status = document.getElementById("formStatus");
  var btn = document.getElementById("enviarBtn");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".type-tabs button"));
  var select = document.getElementById("tipo");

  function setTipo(tipo, focus) {
    var valid = ["evento", "promo", "modelos", "geral"];
    if (valid.indexOf(tipo) === -1) tipo = "geral";
    select.value = tipo;
    tabs.forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-tipo") === tipo ? "true" : "false");
    });
    if (focus) select.focus();
  }

  tabs.forEach(function (b) {
    b.addEventListener("click", function () { setTipo(b.getAttribute("data-tipo"), false); });
  });
  select.addEventListener("change", function () { setTipo(select.value, false); });

  // Pré-seleção via ?tipo=evento|promo|modelos|geral
  try {
    var q = new URLSearchParams(location.search).get("tipo");
    if (q) setTipo(q, false);
  } catch (e) {}

  function markInvalid(name, bad) {
    var wrap = form.querySelector('[data-field="' + name + '"]');
    if (wrap) wrap.classList.toggle("invalid", !!bad);
    return !bad;
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
  }

  function validate() {
    var ok = true;
    var nome = form.nome.value.trim();
    var email = form.email.value.trim();
    var tel = form.telefone.value.trim();
    var msg = form.mensagem.value.trim();
    var file = form.arquivo.files[0];

    ok = markInvalid("nome", nome.length < 2) && ok;
    ok = markInvalid("email", !validEmail(email)) && ok;
    ok = markInvalid("telefone", tel !== "" && !/^[+()\d\s.-]{6,30}$/.test(tel)) && ok;
    ok = markInvalid("mensagem", msg.length < 10) && ok;
    ok = markInvalid("consentimento", !form.consentimento.checked) && ok;

    var fileBad = false;
    if (file) {
      var ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      fileBad = file.size > MAX_FILE || OK_TYPES.indexOf(file.type) === -1 || OK_EXT.indexOf(ext) === -1;
    }
    ok = markInvalid("arquivo", fileBad) && ok;
    return ok;
  }

  function showStatus(kind, html) {
    status.className = "form-status " + kind;
    status.innerHTML = html;
    status.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) {
      showStatus("bad", "<strong>Atenção:</strong> verifique os campos destacados e tente de novo.");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Enviando…";
    showStatus("", "");

    var data = new FormData(form);
    // O servidor revalida tudo; o cliente só melhora a experiência.
    fetch(ENDPOINT, { method: "POST", body: data })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (r) {
        if (r.ok) {
          showStatus("ok", "<strong>Mensagem enviada!</strong> Obrigado pelo contato — enviamos uma confirmação para o seu e-mail. A equipe CWI responde em português em até 3 dias úteis.");
          form.reset();
          setTipo("geral", false);
        } else {
          var msg = (r.body && r.body.erro) || "Não foi possível enviar agora.";
          showStatus("bad", "<strong>Algo deu errado:</strong> " + escapeHtml(msg) + " Tente de novo ou escreva para <a href=\"mailto:hp@cumulativeweb.com\" style=\"color:#fff\">hp@cumulativeweb.com</a>.");
        }
      })
      .catch(function () {
        showStatus("bad", "<strong>Sem conexão com o servidor.</strong> Verifique sua internet ou escreva direto para <a href=\"mailto:hp@cumulativeweb.com\" style=\"color:#fff\">hp@cumulativeweb.com</a>.");
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Enviar mensagem";
      });
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
