/* CWI — mobile nav toggle. No dependencies. */
(function () {
  "use strict";
  var btn = document.querySelector(".menu-btn");
  var menu = document.getElementById("mobileMenu");
  if (!btn || !menu) return;
  btn.addEventListener("click", function () {
    var open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  menu.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Open menu");
    }
  });
})();
