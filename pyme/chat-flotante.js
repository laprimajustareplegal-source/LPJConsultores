/* Chat IA flotante para Mi cuenta (clientes y aliados) y el panel del equipo.
   Pone el mismo chat de la página principal en un botón abajo a la derecha.
   Debe cargarse ANTES de chat-pyme.js: deja listo el HTML que ese script busca. */
(function () {
  'use strict';
  window.LPJ_MULTIRAMO = true;
  var esEquipo = /asesor\.html/.test(location.pathname);
  if (!window.LPJ_SALUDO) {
    window.LPJ_SALUDO = esEquipo
      ? 'Soy el asesor IA de LPJ Consultores. Pregúnteme por procesos y documentos de cada aseguradora, coberturas o cómo responderle a un cliente.'
      : 'Soy su asesor de seguros con IA. Pregúnteme por sus pólizas, vencimientos y pagos, o pídame cotizar o mejorar un seguro.';
  }

  function montar() {
    if (document.getElementById('pcMensajes')) return;   // la página ya tiene el chat
    var envio = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5L4 12z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    var caja = document.createElement('div');
    caja.className = 'cf';
    caja.innerHTML =
      '<button type="button" class="cf-boton" id="cfBoton" aria-expanded="false" aria-controls="cfPanel">' +
        '<span class="cf-punto" aria-hidden="true"></span>Asesor IA</button>' +
      '<div class="cf-panel pyme-chat" id="cfPanel" role="dialog" aria-label="Asesor IA LPJ" hidden>' +
        '<div class="pc-head"><div class="pc-avatar">LPJ</div><div class="pc-head-txt"><strong>Asesor IA LPJ</strong><span>En línea</span></div>' +
        '<div class="pc-head-acc"><a class="pc-cuenta" id="pcCuenta" href="mi-cuenta.html" style="display:none">Ingresar</a>' +
        '<button type="button" class="pc-reiniciar" id="pcReiniciar">Reiniciar</button>' +
        '<button type="button" class="cf-cerrar" id="cfCerrar" aria-label="Cerrar chat">×</button></div></div>' +
        '<div class="pc-mensajes" id="pcMensajes" aria-live="polite"></div>' +
        '<form class="pc-entrada" id="pcForm" autocomplete="off"><input type="text" id="pcInput" placeholder="Escriba su pregunta" aria-label="Mensaje" maxlength="600">' +
        '<button type="submit" id="pcEnviar" aria-label="Enviar">' + envio + '</button></form>' +
        '<div class="pc-nota pc-privacidad">Guardamos esta conversación para atenderle mejor. <a href="politica-datos.html" target="_blank" rel="noopener">Política de datos</a></div>' +
      '</div>';
    document.body.appendChild(caja);

    var boton = document.getElementById('cfBoton'), panel = document.getElementById('cfPanel');
    function abrir(si) {
      panel.hidden = !si;
      boton.setAttribute('aria-expanded', si ? 'true' : 'false');
      caja.classList.toggle('abierto', si);
      if (si) setTimeout(function () { var i = document.getElementById('pcInput'); if (i) i.focus(); }, 50);
    }
    boton.addEventListener('click', function () { abrir(panel.hidden); });
    document.getElementById('cfCerrar').addEventListener('click', function () { abrir(false); boton.focus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { abrir(false); boton.focus(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
