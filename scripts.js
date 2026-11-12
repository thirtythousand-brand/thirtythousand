/* THIRTY THOUSAND — behaviour
   - mobile menu
   - header turns solid after the first scroll
   - reveal-on-scroll
   - parallax (transform-based: works on iOS, unlike background-attachment: fixed)
   - videos only play while visible
   Everything degrades gracefully: with JS off, or "reduce motion" on, the page is static and fully readable. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", String(open));
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
  }

  /* ---------- Header state ---------- */
  var header = document.querySelector(".site-header");
  function headerState() {
    if (header) header.classList.toggle("is-solid", window.scrollY > 40);
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Parallax ----------
     [data-parallax="0.12"]  element drifts against the scroll (speed = fraction of distance from viewport centre)
     [data-parallax-img]     the image inside a fixed frame glides (frame stays put, picture moves)
     [data-parallax-bg]      full-bleed media layer inside hero/band moves slower than the page */
  var drift = [];     // {el, base, speed}
  var glide = [];     // {frame, img}
  var layers = [];    // {wrap, host, speed}
  var vh = window.innerHeight;

  function measure() {
    vh = window.innerHeight;
    var sy = window.scrollY;
    drift.forEach(function (d) {
      d.el.style.transform = "none";
      var r = d.el.getBoundingClientRect();
      d.base = r.top + sy + r.height / 2;
    });
    layers.forEach(function (l) {
      var r = l.host.getBoundingClientRect();
      l.top = r.top + sy;
      l.h = r.height;
    });
  }

  function frameParallax() {
    if (reduce) return;
    var sy = window.scrollY;

    drift.forEach(function (d) {
      var off = (d.base - (sy + vh / 2)) * d.speed;
      if (Math.abs(off) < vh * 2) d.el.style.transform = "translate3d(0," + off.toFixed(1) + "px,0)";
    });

    glide.forEach(function (g) {
      var r = g.frame.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); // -1..1
      p = Math.max(-1, Math.min(1, p));
      g.img.style.transform = "translate3d(0," + (-p * r.height * 0.075).toFixed(1) + "px,0)";
    });

    layers.forEach(function (l) {
      var rel = sy - l.top; // how far the host's top has passed the viewport top
      if (rel < -vh || rel > l.h + vh) return;
      l.wrap.style.transform = "translate3d(0," + (rel * l.speed).toFixed(1) + "px,0)";
    });
  }

  var ticking = false;
  function onScroll() {
    headerState();
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { frameParallax(); ticking = false; });
  }

  document.querySelectorAll("[data-parallax]").forEach(function (el) {
    drift.push({ el: el, base: 0, speed: parseFloat(el.getAttribute("data-parallax")) || 0.1 });
  });
  document.querySelectorAll("[data-parallax-img]").forEach(function (frame) {
    var img = frame.querySelector("img, video");
    if (img) glide.push({ frame: frame, img: img });
  });
  document.querySelectorAll("[data-parallax-bg]").forEach(function (wrap) {
    layers.push({
      wrap: wrap,
      host: wrap.parentElement,
      speed: parseFloat(wrap.getAttribute("data-parallax-bg")) || 0.25,
      top: 0,
      h: 0
    });
  });

  if (!reduce) {
    measure();
    frameParallax();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { measure(); frameParallax(); });
    window.addEventListener("load", function () { measure(); frameParallax(); });
  } else {
    window.addEventListener("scroll", headerState, { passive: true });
  }
  headerState();

  /* ---------- Videos: play only when on screen ---------- */
  var vids = document.querySelectorAll("video[data-autoplay]");
  if (vids.length) {
    vids.forEach(function (v) { v.muted = true; v.playsInline = true; });
    if (reduce || !("IntersectionObserver" in window)) return;
    var vio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          var v = en.target;
          if (en.isIntersecting) {
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.2 }
    );
    vids.forEach(function (v) { vio.observe(v); });
  }
})();
