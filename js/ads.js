/* Chargement automatique de Google AdSense à partir de js/config.js */
(function () {
  var cfg = (window.SITE_CONFIG || {}).ads;
  window.initAdSlots = function () {};
  if (!cfg || !cfg.enabled || !/^ca-pub-\d+$/.test(cfg.client)) return;

  var s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + cfg.client;
  document.head.appendChild(s);

  window.initAdSlots = function (root) {
    (root || document).querySelectorAll(".ad-slot[data-ad]").forEach(function (el) {
      var slot = cfg.slots[el.dataset.ad];
      if (!slot || el.dataset.done) return;
      el.dataset.done = "1";
      el.classList.add("on");
      var ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", cfg.client);
      ins.setAttribute("data-ad-slot", slot);
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
      el.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  };
})();
