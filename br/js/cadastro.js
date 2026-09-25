/* CWI Brasil — formulário de cadastro de artista independente.
 * Envia multipart/form-data ao endpoint serverless configurado em
 * window.CWI_BR_ENDPOINT (padrão: URL de produção documentada no DEPLOY.md).
 * O servidor recebe tipo="artista"; os campos do formulário são montados em
 * uma mensagem estruturada em português. Sem dependências.
 * Validação no cliente + validação real no servidor.
 */
(function () {
  "use strict";

  var ENDPOINT = (window.CWI_BR_ENDPOINT || "https://cwi-brasil-form-production.up.railway.app/api/contato").replace(/\/$/, "");

  var form = document.getElementById("cadastroForm");
  if (!form) return;
  var status = document.getElementById("formStatus");
  var btn = document.getElementById("enviarBtn");

  function markInvalid(name, bad) {
    var wrap = form.querySelector('[data-field="' + name + '"]');
    if (wrap) wrap.classList.toggle("invalid", !!bad);
    return !bad;
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
  }

  function validUrl(v) {
    if (!v) return true; // opcional
    try {
      var u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function validate() {
    var ok = true;
    ok = markInvalid("nome", val("nome").length < 2) && ok;
    ok = markInvalid("cidade_uf", val("cidade_uf").length < 2) && ok;
    ok = markInvalid("telefone", !/^[+()\d\s.-]{6,30}$/.test(val("telefone"))) && ok;
    ok = markInvalid("email", !validEmail(val("email"))) && ok;
    ok = markInvalid("genero", val("genero") === "") && ok;
    ok = markInvalid("spotify", !validUrl(val("spotify"))) && ok;
    ok = markInvalid("youtube", !validUrl(val("youtube"))) && ok;
    ok = markInvalid("instagram", !validUrl(val("instagram"))) && ok;
    ok = markInvalid("sobre", val("sobre").length < 20) && ok;
    ok = markInvalid("consentimento", !document.getElementById("consentimento").checked) && ok;
    return ok;
  }

  function linha(rotulo, v) {
    return rotulo + ": " + (v || "—") + "\n";
  }

  function montarMensagem() {
    var partes = [];
    partes.push(linha("Nome artístico", val("nome")));
    partes.push(linha("Nome real", val("nome_real")));
    partes.push(linha("Cidade/UF", val("cidade_uf")));
    partes.push(linha("Gênero", val("genero")));
    partes.push(linha("Spotify", val("spotify")));
    partes.push(linha("YouTube", val("youtube")));
    partes.push(linha("Instagram", val("instagram")));
    partes.push(linha("Como conheceu a CWI", val("origem")));
    partes.push("Sobre o projeto:\n" + val("sobre"));
    return partes.join("\n");
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

    var data = new FormData();
    data.append("nome", val("nome"));
    data.append("email", val("email"));
    data.append("telefone", val("telefone"));
    data.append("tipo", "artista");
    data.append("mensagem", montarMensagem());
    data.append("consentimento", document.getElementById("consentimento").checked ? "sim" : "");
    data.append("website", ""); // honeypot: sempre vazio no envio legítimo

    // O servidor revalida tudo; o cliente só melhora a experiência.
    fetch(ENDPOINT, { method: "POST", body: data })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (r) {
        if (r.ok) {
          showStatus("ok", "<strong>Cadastro recebido!</strong> Obrigado por trazer seu projeto para o movimento — enviamos uma confirmação para o seu e-mail. Nossa equipe de A&amp;R vai ouvir seu trabalho e responde em português em até 3 dias úteis.");
          form.reset();
        } else {
          var msg = (r.body && r.body.erro) || "Não foi possível enviar agora.";
          showStatus("bad", "<strong>Algo deu errado:</strong> " + escapeHtml(msg) + " Tente de novo ou chame no <a href=\"https://wa.me/5582991368305\" target=\"_blank\" rel=\"noopener\" style=\"color:#fff\">WhatsApp +55 82 99136-8305</a>.");
        }
      })
      .catch(function () {
        showStatus("bad", "<strong>Sem conexão com o servidor.</strong> Verifique sua internet ou chame direto no <a href=\"https://wa.me/5582991368305\" target=\"_blank\" rel=\"noopener\" style=\"color:#fff\">WhatsApp +55 82 99136-8305</a>.");
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Enviar cadastro";
      });
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
