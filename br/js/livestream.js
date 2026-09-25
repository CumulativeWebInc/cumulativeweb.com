/* CWI Brasil — ponto de montagem da transmissão ao vivo.
 *
 * Estado inicial: "em breve" (placeholder no HTML).
 * Para ativar uma transmissão NÃO é preciso reconstruir o site:
 *
 *   1) Via JavaScript:  CWIStream.mount({ html: '<iframe src="..." ...></iframe>' });
 *   2) Via atributo:    <div id="cwi-livestream-embed" data-embed-url="https://www.youtube.com/embed/VIDEO_ID">
 *
 * O provedor pode ser qualquer iframe (YouTube, Twitch, Vimeo) ou SDK
 * montado via `mount({ node })`. O placeholder é removido automaticamente.
 */
(function () {
  "use strict";

  var SLOT_ID = "cwi-livestream-embed";
  var PLACEHOLDER_ID = "livestream-placeholder";

  function mount(opts) {
    var slot = document.getElementById(SLOT_ID);
    if (!slot) return false;
    var ph = document.getElementById(PLACEHOLDER_ID);
    if (ph) ph.remove();
    slot.querySelectorAll("iframe").forEach(function (el) { el.remove(); });
    if (opts && opts.node instanceof Node) {
      slot.appendChild(opts.node);
    } else if (opts && opts.html) {
      var tpl = document.createElement("template");
      tpl.innerHTML = opts.html.trim();
      var frame = tpl.content.querySelector("iframe");
      if (!frame) return false;
      // Endurece o iframe contra permissões excessivas por padrão.
      if (!frame.hasAttribute("sandbox")) {
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
      }
      frame.setAttribute("allowfullscreen", "");
      frame.setAttribute("title", "Transmissão ao vivo da CWI Brasil");
      slot.appendChild(frame);
    } else {
      return false;
    }
    slot.setAttribute("data-provider", (opts && opts.provider) || "custom");
    var meta = document.querySelector(".view-meta");
    if (meta) meta.textContent = "Status: transmissão ativa.";
    return true;
  }

  function unmount() {
    var slot = document.getElementById(SLOT_ID);
    if (!slot) return;
    slot.querySelectorAll("iframe").forEach(function (el) { el.remove(); });
    slot.setAttribute("data-provider", "");
    location.reload();
  }

  // Auto-montagem via data-embed-url (útil para operação sem código).
  function autoMount() {
    var slot = document.getElementById(SLOT_ID);
    if (!slot) return;
    var url = (slot.getAttribute("data-embed-url") || "").trim();
    if (!url) return;
    try {
      var u = new URL(url, location.href);
      if (u.protocol !== "https:") return; // apenas HTTPS
      mount({ html: '<iframe src="' + u.href.replace(/"/g, "&quot;") + '" allow="autoplay; encrypted-media; picture-in-picture"></iframe>', provider: u.hostname });
    } catch (e) { /* URL inválida: mantém o placeholder */ }
  }

  window.CWIStream = { mount: mount, unmount: unmount };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})();
