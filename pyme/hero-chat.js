/* Vista previa: el titular se recoge cuando la persona empieza a conversar, para dar espacio al chat. */
(function () {
  'use strict';
  var sec = document.querySelector('.pyme-sec'), msgs = document.getElementById('pcMensajes');
  var rei = document.getElementById('pcReiniciar');
  if (!sec || !msgs) return;
  if (rei) rei.textContent = 'Nueva conversación';
  var antes = false;
  function revisar() {
    var ahora = !!msgs.querySelector('.pc-user');
    sec.classList.toggle('conversando', ahora);
    if (ahora && !antes) {
      var y = sec.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > y + 40) window.scrollTo({ top: y, behavior: 'smooth' });
    }
    antes = ahora;
  }
  new MutationObserver(revisar).observe(msgs, { childList: true });
  revisar();

  // Preguntas por rol: al tocar una, se escribe en el chat y se envía.
  var casos = document.getElementById('heroCasos'), input = document.getElementById('pcInput'), form = document.getElementById('pcForm');
  if (casos && input && form) casos.addEventListener('click', function (ev) {
    var b = ev.target.closest('.hero-caso');
    if (!b) return;
    input.value = b.getAttribute('data-q');
    if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true }));
  });
})();
