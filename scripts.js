/* THIRTY THOUSAND — behaviour
   - mobile menu
   - header turns solid after the first scroll
   - reveal-on-scroll
   - parallax (transform-based: works on iOS, unlike background-attachment: fixed)
   - pop-up image carousel
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

  /* ---------- Pop-up carousel ----------
     Any [data-lightbox="group"] button opens the full-size image (data-full) with every other image in that group.
     Click outside the picture, press Escape or use the close button to leave; arrows, keys and swipes move between images. */
  var lbTriggers = document.querySelectorAll("[data-lightbox]");
  if (lbTriggers.length) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Image viewer");
    box.innerHTML =
      '<img class="lightbox__img" alt="" draggable="false">' +
      '<button class="lightbox__btn lightbox__close" type="button" aria-label="Close">\u2715</button>' +
      '<button class="lightbox__btn lightbox__prev" type="button" aria-label="Previous image">\u2190</button>' +
      '<button class="lightbox__btn lightbox__next" type="button" aria-label="Next image">\u2192</button>' +
      '<span class="lightbox__count" aria-live="polite"></span>';
    document.body.appendChild(box);
    var lbImg = box.querySelector(".lightbox__img");
    var lbCount = box.querySelector(".lightbox__count");
    var lbClose = box.querySelector(".lightbox__close");
    var lbItems = [], lbIndex = 0, lbOpener = null;

    function lbPad(n) { return n < 10 ? "0" + n : String(n); }
    function lbShow(i) {
      lbIndex = (i + lbItems.length) % lbItems.length;
      var t = lbItems[lbIndex];
      var thumb = t.querySelector("img");
      lbImg.src = t.getAttribute("data-full") || (thumb && thumb.src) || "";
      lbImg.alt = thumb ? thumb.alt : "";
      lbCount.textContent = lbPad(lbIndex + 1) + " / " + lbPad(lbItems.length);
      // warm the cache for the neighbours so paging feels instant
      [lbIndex + 1, lbIndex - 1].forEach(function (k) {
        var n = lbItems[(k + lbItems.length) % lbItems.length];
        if (n && n !== t) (new Image()).src = n.getAttribute("data-full") || "";
      });
    }
    function lbOpen(trigger) {
      var group = trigger.getAttribute("data-lightbox");
      lbItems = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox="' + group + '"]'));
      lbOpener = trigger;
      box.classList.toggle("lightbox--single", lbItems.length < 2);
      lbShow(lbItems.indexOf(trigger));
      box.classList.add("is-open");
      document.body.classList.add("lightbox-open");
      lbClose.focus();
    }
    function lbShut() {
      box.classList.remove("is-open");
      document.body.classList.remove("lightbox-open");
      if (lbOpener) lbOpener.focus();
    }
    lbTriggers.forEach(function (t) {
      t.addEventListener("click", function () { lbOpen(t); });
    });
    // a click anywhere except on the picture or a button leaves the viewer
    box.addEventListener("click", function (e) {
      if (e.target.closest(".lightbox__img")) return;
      var btn = e.target.closest(".lightbox__btn");
      if (!btn) return lbShut();
      if (btn === lbClose) lbShut();
      else lbShow(lbIndex + (btn.classList.contains("lightbox__next") ? 1 : -1));
    });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") lbShut();
      else if (e.key === "ArrowRight") lbShow(lbIndex + 1);
      else if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
      else if (e.key === "Tab") {
        // keep keyboard focus inside the viewer
        var f = Array.prototype.filter.call(box.querySelectorAll("button"), function (b) { return b.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var lbX = null;
    box.addEventListener("pointerdown", function (e) { lbX = e.clientX; });
    box.addEventListener("pointerup", function (e) {
      if (lbX === null || lbItems.length < 2) return;
      var dx = e.clientX - lbX;
      lbX = null;
      if (Math.abs(dx) > 50) lbShow(lbIndex + (dx < 0 ? 1 : -1));
    });
  }

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
