/* La Prima Justa — fondo animado "red neuronal" detrás de las secciones azules.
   Un solo lienzo fijo detrás de toda la página: las secciones blancas lo tapan y las azules lo dejan ver.
   Puntos que flotan, líneas entre los cercanos, pulsos de luz que viajan por las conexiones y dos brillos
   lentos de fondo. Se pausa con la pestaña oculta y queda quieto si la persona pidió menos movimiento. */
(function () {
  'use strict';
  if (!document.body.classList.contains('sobrio')) return;
  var lienzo = document.createElement('canvas');
  lienzo.className = 'fondo-ia';
  lienzo.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(lienzo, document.body.firstChild);
  var ctx = lienzo.getContext('2d');
  if (!ctx) return;

  var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var W = 0, H = 0, puntos = [], pulsos = [], raton = { x: -9999, y: -9999 }, t0 = performance.now();
  var DIST = 150;

  function medir() {
    W = window.innerWidth; H = window.innerHeight;
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    lienzo.style.width = W + 'px'; lienzo.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    DIST = W < 700 ? 110 : 150;
    var n = Math.round(Math.min(110, Math.max(36, W * H / 13000)));
    while (puntos.length < n) puntos.push(nuevo());
    puntos.length = n;
  }
  function nuevo() {
    var v = 0.12 + Math.random() * 0.22, a = Math.random() * Math.PI * 2;
    return { x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
             r: 0.8 + Math.random() * 1.6, fase: Math.random() * Math.PI * 2 };
  }

  function brillo(x, y, rad, color) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(15,32,96,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  function cuadro(ahora) {
    var t = (ahora - t0) / 1000;
    ctx.clearRect(0, 0, W, H);

    // brillos lentos que se desplazan (dan profundidad)
    brillo(W * (0.22 + 0.10 * Math.sin(t * 0.07)), H * (0.30 + 0.12 * Math.cos(t * 0.05)), Math.max(W, H) * 0.55, 'rgba(22,68,200,0.30)');
    brillo(W * (0.82 + 0.08 * Math.cos(t * 0.06)), H * (0.72 + 0.10 * Math.sin(t * 0.08)), Math.max(W, H) * 0.45, 'rgba(64,140,255,0.16)');

    // mover puntos
    for (var i = 0; i < puntos.length; i++) {
      var p = puntos[i];
      if (!quieto) { p.x += p.vx; p.y += p.vy; }
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
    }

    // conexiones
    ctx.lineWidth = 1;
    var enlaces = [];
    for (i = 0; i < puntos.length; i++) {
      var a = puntos[i];
      for (var j = i + 1; j < puntos.length; j++) {
        var b = puntos[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < DIST * DIST) {
          var al = 1 - Math.sqrt(d2) / DIST;
          ctx.strokeStyle = 'rgba(150,185,255,' + (al * 0.28).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          enlaces.push([a, b]);
        }
      }
      // el cursor también se conecta
      var mx = a.x - raton.x, my = a.y - raton.y, m2 = mx * mx + my * my;
      if (m2 < DIST * DIST * 1.6) {
        var am = 1 - Math.sqrt(m2) / (DIST * 1.26);
        ctx.strokeStyle = 'rgba(120,220,255,' + (Math.max(0, am) * 0.45).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(raton.x, raton.y); ctx.stroke();
      }
    }

    // puntos con un leve titileo
    for (i = 0; i < puntos.length; i++) {
      p = puntos[i];
      var tt = 0.55 + 0.45 * Math.sin(t * 1.3 + p.fase);
      ctx.fillStyle = 'rgba(190,212,255,' + (0.45 + 0.4 * tt).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    // pulsos: chispas que recorren una conexión
    if (!quieto && enlaces.length && pulsos.length < 14 && Math.random() < 0.08) {
      var e = enlaces[(Math.random() * enlaces.length) | 0];
      pulsos.push({ a: e[0], b: e[1], k: 0, v: 0.012 + Math.random() * 0.02 });
    }
    for (i = pulsos.length - 1; i >= 0; i--) {
      var s = pulsos[i];
      s.k += s.v;
      if (s.k >= 1) { pulsos.splice(i, 1); continue; }
      var x = s.a.x + (s.b.x - s.a.x) * s.k, y = s.a.y + (s.b.y - s.a.y) * s.k;
      brillo(x, y, 14, 'rgba(110,230,255,0.55)');
      ctx.fillStyle = 'rgba(225,250,255,0.95)';
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }

    if (!quieto && !document.hidden) requestAnimationFrame(cuadro);
  }

  medir();
  window.addEventListener('resize', function () { medir(); if (quieto) cuadro(performance.now()); });
  window.addEventListener('pointermove', function (e) { raton.x = e.clientX; raton.y = e.clientY; }, { passive: true });
  document.addEventListener('pointerleave', function () { raton.x = raton.y = -9999; });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !quieto) requestAnimationFrame(cuadro); });
  requestAnimationFrame(cuadro);
})();
