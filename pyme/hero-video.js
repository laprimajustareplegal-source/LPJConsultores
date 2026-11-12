/* Video de fondo del titular: escoge la versión liviana en celular y no lo carga si la persona pidió
   menos movimiento o ahorro de datos (queda la imagen fija).
   Clips de Pexels y Mixkit (licencias gratuitas de uso comercial): Pexels 27072824, 12511385, 4186967, 3365440, 8986894, 4622328, 6509158, 20042803; Mixkit 2233, 4012. */
(function () {
  'use strict';
  var sec = document.querySelector('.sobrio .pyme-sec');
  var nav = document.querySelector('.nav-wrap');
  if (!sec) return;
  function altoNav() { if (nav) document.documentElement.style.setProperty('--alto-nav', nav.offsetHeight + 'px'); }
  altoNav(); window.addEventListener('resize', altoNav);

  var capa = document.createElement('div');
  capa.className = 'hero-video'; capa.setAttribute('aria-hidden', 'true');
  capa.style.backgroundImage = 'url(' + (window.LPJ_POSTER || 'video/hero-poster.jpg?v=3') + ')';
  sec.insertBefore(capa, sec.firstChild); sec.classList.add('con-video');

  var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ahorro = navigator.connection && navigator.connection.saveData;
  if (quieto || ahorro) return;

  var v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('preload', 'auto');
  // Una página de prueba puede fijar su propio video con window.LPJ_VIDEO = 'video/archivo.mp4'
  if (window.LPJ_VIDEO) {
    var s0 = document.createElement('source'); s0.src = window.LPJ_VIDEO; s0.type = 'video/mp4'; v.appendChild(s0);
  } else {
    var base = window.innerWidth <= 900 ? 'video/hero-720' : 'video/hero-1080';
    [['.mp4', 'video/mp4'], ['.webm', 'video/webm']].forEach(function (f) {
      var s = document.createElement('source'); s.src = base + f[0] + '?v=3'; s.type = f[1]; v.appendChild(s);
    });
  }
  v.addEventListener('playing', function () { v.classList.add('listo'); });
  capa.appendChild(v);
  var p = v.play(); if (p && p.catch) p.catch(function () {});
  // pausa cuando el titular no está a la vista (ahorra batería)
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) {
    if (e[0].isIntersecting) { var q = v.play(); if (q && q.catch) q.catch(function () {}); } else v.pause();
  }).observe(sec);
})();

// ---- Franja de aseguradoras justo debajo del titular ----
(function () {
  'use strict';
  var sec = document.querySelector('.sobrio .pyme-sec');
  if (!sec || document.querySelector('.franja-aseg')) return;
  var logos = [
    ['sura.svg', 'SURA', 31], ['allianz.svg', 'Allianz', 26], ['bolivar.svg', 'Seguros Bolívar', 40, 'fa-propio'],
    ['mapfre.svg', 'MAPFRE', 25], ['hdi.svg', 'HDI Seguros', 29], ['bbva.svg', 'BBVA Seguros', 24],
    ['estado.svg', 'Seguros del Estado', 46, 'fa-propio'], ['equidad.svg', 'La Equidad Seguros', 38], ['solidaria.svg', 'Aseguradora Solidaria de Colombia', 38]
  ];
  var f = document.createElement('section');
  f.className = 'franja-aseg'; f.setAttribute('aria-label', 'Aseguradoras con las que trabajamos');
  var fila = '<div class="fa-fila">';
  logos.forEach(function (l) {
    fila += '<img src="img/aseguradoras/' + l[0] + '" alt="' + l[1] + '"' + (l[3] ? ' class="' + l[3] + '"' : '') + ' style="--h:' + l[2] + 'px" loading="lazy" decoding="async">';
  });
  fila += '</div>';
  f.innerHTML = fila;
  sec.parentNode.insertBefore(f, sec.nextSibling);
})();

// ---- La barra se vuelve azul cuando pasa sobre una sección blanca ----
(function () {
  'use strict';
  var nav = document.querySelector('.sobrio .nav-wrap'), inner = nav && nav.querySelector('.nav-inner');
  if (!inner) return;
  var claras = [].slice.call(document.querySelectorAll('.titulo-seccion, .card-producto, .sec-sectores, .sec-proceso'));
  var pendiente = false;
  function revisar() {
    pendiente = false;
    var r = inner.getBoundingClientRect(), y = r.top + r.height / 2, sobre = false;
    for (var i = 0; i < claras.length; i++) {
      var c = claras[i].getBoundingClientRect();
      if (c.top <= y && c.bottom >= y) { sobre = true; break; }
    }
    nav.classList.toggle('sobre-claro', sobre);
  }
  function pedir() { if (!pendiente) { pendiente = true; requestAnimationFrame(revisar); } }
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);
  revisar();
})();
