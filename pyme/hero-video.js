/* Video de fondo del titular: escoge la versión liviana en celular y no lo carga si la persona pidió
   menos movimiento o ahorro de datos (queda la imagen fija).
   Clips de Mixkit (licencia gratuita de uso comercial): 42041, 36318, 34612, 2469, 24127, 47555, 31450, 42343. */
(function () {
  'use strict';
  var sec = document.querySelector('.sobrio .pyme-sec');
  var nav = document.querySelector('.nav-wrap');
  if (!sec) return;
  function altoNav() { if (nav) document.documentElement.style.setProperty('--alto-nav', nav.offsetHeight + 'px'); }
  altoNav(); window.addEventListener('resize', altoNav);

  var capa = document.createElement('div');
  capa.className = 'hero-video'; capa.setAttribute('aria-hidden', 'true');
  capa.style.backgroundImage = 'url(video/hero-poster.jpg)';
  sec.insertBefore(capa, sec.firstChild); sec.classList.add('con-video');

  var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ahorro = navigator.connection && navigator.connection.saveData;
  if (quieto || ahorro) return;

  var v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('preload', 'auto');
  var base = window.innerWidth <= 900 ? 'video/hero-960' : 'video/hero-1600';
  [['.mp4', 'video/mp4'], ['.webm', 'video/webm']].forEach(function (f) {
    var s = document.createElement('source'); s.src = base + f[0]; s.type = f[1]; v.appendChild(s);
  });
  v.addEventListener('playing', function () { v.classList.add('listo'); });
  capa.appendChild(v);
  var p = v.play(); if (p && p.catch) p.catch(function () {});
  // pausa cuando el titular no está a la vista (ahorra batería)
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) {
    if (e[0].isIntersecting) { var q = v.play(); if (q && q.catch) q.catch(function () {}); } else v.pause();
  }).observe(sec);
})();
