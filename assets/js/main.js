/* Market Tactical — shared UI behavior */
(function () {
  'use strict';

  /* Theme ---------------------------------------------------------------- */
  var root = document.documentElement;

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('mt-theme', theme); } catch (e) { /* private mode */ }
    document.dispatchEvent(new CustomEvent('mt:theme', { detail: theme }));
  }

  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      setTheme(next);
    });
  }

  /* Mobile nav ------------------------------------------------------------ */
  var burger = document.querySelector('.nav-burger');
  var links = document.querySelector('.nav-links');
  if (burger && links) {
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') links.classList.remove('open');
    });
  }

  /* Scroll reveal ---------------------------------------------------------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* Footer year ------------------------------------------------------------ */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* Count-up animation ------------------------------------------------------ */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.mtCountUp = function (el, target, opts) {
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 0;
    var prefix = opts.prefix || '';
    var suffix = opts.suffix || '';
    var duration = opts.duration || 1100;

    function fmt(v) {
      var s = v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      return prefix + s + suffix;
    }

    if (reduceMotion) { el.textContent = fmt(target); return; }

    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var t = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * eased);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  /* Hero canvas: slow-drawing market line ----------------------------------- */
  var canvas = document.getElementById('heroCanvas');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var points = [];
    var progress = 0;

    function cssVar(name) {
      return getComputedStyle(root).getPropertyValue(name).trim();
    }

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        /* layout not ready yet — try again next frame */
        requestAnimationFrame(resize);
        return;
      }
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildSeries(rect.width, rect.height);
      if (reduceMotion) { progress = 1; draw(); }
    }

    function buildSeries(w, h) {
      points = [];
      var n = Math.max(40, Math.floor(w / 26));
      var y = h * 0.72;
      for (var i = 0; i <= n; i++) {
        var x = (w / n) * i;
        var drift = -h * 0.32 * (i / n);            /* upward trend */
        var wobble = Math.sin(i * 0.7) * h * 0.035 + (Math.random() - 0.5) * h * 0.07;
        points.push({ x: x, y: y + drift + wobble });
      }
      progress = 0;
    }

    function draw() {
      if (!canvas.width || !points.length) return;
      var w = canvas.width / dpr, h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      /* grid */
      ctx.strokeStyle = cssVar('--grid-line') || 'rgba(148,163,184,0.1)';
      ctx.lineWidth = 1;
      var gap = 64;
      for (var gx = 0.5; gx < w; gx += gap) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (var gy = 0.5; gy < h; gy += gap) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      var count = Math.floor(points.length * Math.min(progress, 1));
      if (count > 1) {
        var brand = cssVar('--series-portfolio') || '#3987e5';

        /* area fill */
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (var i = 1; i < count; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.lineTo(points[count - 1].x, h);
        ctx.lineTo(points[0].x, h);
        ctx.closePath();
        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, brand + '33');
        grad.addColorStop(1, brand + '00');
        ctx.fillStyle = grad;
        ctx.fill();

        /* line */
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (var j = 1; j < count; j++) ctx.lineTo(points[j].x, points[j].y);
        ctx.strokeStyle = brand;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        /* leading dot */
        var tip = points[count - 1];
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = brand;
        ctx.fill();
      }
    }

    if (reduceMotion) {
      resize();
      window.addEventListener('resize', resize);
    } else {
      resize();
      (function loop() {
        progress += 0.0035;
        if (progress > 1.35) buildSeries(canvas.width / dpr, canvas.height / dpr);
        draw();
        requestAnimationFrame(loop);
      })();
      window.addEventListener('resize', resize);
    }

    document.addEventListener('mt:theme', function () { draw(); });
  }

  /* Hero live stats (index page) --------------------------------------------- */
  var heroStats = document.getElementById('heroStats');
  if (heroStats && window.MT) {
    MT.getData().then(function (d) {
      if (!d) return; /* fetches failed — keep the static values in the HTML */
      var cumEl = document.getElementById('statCumulative');
      var spyEl = document.getElementById('statSpy');
      var cagrEl = document.getElementById('statCagr');
      var sharpeEl = document.getElementById('statSharpe');
      var sinceEls = document.querySelectorAll('[data-since]');

      sinceEls.forEach(function (el) { el.textContent = d.sinceLabel; });

      if (cumEl) {
        cumEl.classList.toggle('pos', d.portCumulative >= 0);
        mtCountUp(cumEl, d.portCumulative, { decimals: 1, suffix: '%', prefix: d.portCumulative >= 0 ? '+' : '' });
      }
      if (spyEl) mtCountUp(spyEl, d.spyCumulative, { decimals: 1, suffix: '%', prefix: d.spyCumulative >= 0 ? '+' : '' });
      if (cagrEl) mtCountUp(cagrEl, d.summary.cagr, { decimals: 1, suffix: '%' });
      if (sharpeEl) mtCountUp(sharpeEl, d.summary.sharpe, { decimals: 2 });
    });
  }
})();
