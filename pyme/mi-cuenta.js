/* Portal del cliente — La Prima Justa */
(function () {
  'use strict';
  var C = window.LPJ_CONFIG || {};
  var L = window.LPJ;
  var E = L.escapar;
  var usuario = null, perfil = null, solicitudes = [], saliendo = false, errorCarga = '';

  function $(id) { return document.getElementById(id); }
  function ver(id, si) { $(id).classList.toggle('oculto', !si); }
  function mensaje(form, texto, ok) {
    var m = form.querySelector('.msg');
    m.textContent = texto || '';
    m.className = 'msg' + (texto ? (ok ? ' ok' : ' err') : '');
  }
  function correoValido(c) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c); }

  var SIGUIENTE = {
    recibida: ['Recibimos su solicitud', 'Su asesor la revisará y le enviará la cotización en máximo 24 horas hábiles. Si tiene su póliza actual o algún documento que ayude, súbalo aquí.'],
    en_analisis: ['Estamos analizando su solicitud', 'Su asesor está revisando sus riesgos y cotizando con las aseguradoras. Aquí verá la cotización cuando esté lista.'],
    cotizada: ['Su cotización está lista', 'Revísela en Documentos. Si está de acuerdo, solicite la emisión indicando la opción que eligió. Si quiere cambios (coberturas, límites, lo que pida un contrato), pida ajustes.'],
    ajustes_solicitados: ['Estamos ajustando su cotización', 'Su asesor está aplicando los cambios que pidió. Aquí verá la cotización ajustada cuando esté lista.'],
    emision_solicitada: ['Recibimos su solicitud de emisión', 'Para emitir necesitamos: RUT, cámara de comercio reciente, cédula del representante legal y el formulario de conocimiento del cliente (SARLAFT). Súbalos aquí si aún no lo ha hecho.'],
    en_emision: ['Estamos emitiendo su póliza', 'La aseguradora está expidiendo la póliza. Aquí verá la información de pago en cuanto esté lista.'],
    pago_pendiente: ['Su póliza está lista para pago', 'Pague con el link o la referencia que aparece arriba y luego repórtelo aquí.'],
    pago_reportado: ['Pago reportado', 'Estamos confirmando su pago con la aseguradora. Cuando quede confirmado, su póliza aparecerá como vigente.'],
    vigente: ['Su póliza está vigente', 'La encuentra en la pestaña Pólizas. Si necesita una modificación o tiene un siniestro, escríbale a su asesor.'],
    cancelada: ['Solicitud cancelada', 'Si quiere retomarla, cree una nueva solicitud o escríbanos por WhatsApp.']
  };

  var ACCIONES = {
    ajuste: { etiqueta: '¿Qué quiere cambiar? (coberturas, límites, deducibles, lo que le pide un contrato…)', boton: 'Enviar ajuste', texto: 'obligatorio', archivo: 'contrato', titulo: 'Ajuste pedido' },
    emision: { etiqueta: '¿Qué opción o aseguradora eligió? Agregue cualquier indicación para la emisión.', boton: 'Solicitar emisión', texto: 'obligatorio', archivo: 'documento_cliente', titulo: 'Solicitud de emisión', ayuda: 'Si los tiene a mano, adjunte RUT, cámara de comercio, cédula del representante legal y SARLAFT.' },
    pago: { etiqueta: '¿Cómo y cuándo pagó? (PSE, transferencia…)', boton: 'Reportar pago', texto: 'opcional', archivo: 'comprobante_pago', titulo: 'Pago reportado', ayuda: 'Adjunte el comprobante si lo tiene.' },
    documento: { etiqueta: 'Elija los documentos (RUT, cámara de comercio, cédula, SARLAFT, póliza, contrato…)', boton: 'Subir', texto: false, archivo: 'documento_cliente', titulo: 'Documentos nuevos' },
    mensaje: { etiqueta: 'Escriba su mensaje o pregunta para su asesor', boton: 'Enviar mensaje', texto: 'obligatorio', archivo: 'documento_cliente', titulo: 'Mensaje del cliente' }
  };

  // ---------- Arranque ----------
  // Espera la sesión sin dejar la página en blanco si el servidor tarda.
  function sesionConLimite(ms) {
    var s = L.usuario();
    return Promise.race([s, new Promise(function (r) { setTimeout(function () { r(undefined); }, ms); })]).then(function (u) {
      if (u === undefined) s.then(function (tarde) { if (tarde && !usuario) { usuario = tarde; mostrarPortal(); } });
      return u;
    });
  }

  async function iniciar() {
    if (!L.configurado) { ver('cargando', false); ver('sinConfig', true); return; }
    enlazarIngreso();
    enlazarPortal();
    var recuperando = /type=recovery/.test(L.hashInicial);
    var enlaceMalo = /error_description=|error_code=/.test(L.hashInicial);
    // Si la sesión se cierra en otra pestaña o vence, se vuelve al ingreso sin dejar datos en pantalla.
    L.alCambiarSesion(function (u, evento) {
      if (evento === 'SIGNED_OUT' && usuario && !saliendo) { limpiarPortal(); mostrarIngreso('Su sesión se cerró. Ingrese de nuevo.'); }
    });
    var u = await sesionConLimite(8000);
    ver('cargando', false);
    if (u === undefined) return mostrarIngreso('No pudimos conectar con el servidor. Intente de nuevo en unos minutos.');
    usuario = u;
    if (recuperando) {
      if (usuario) return mostrarNuevaClave();
      return mostrarIngreso('El enlace para cambiar la contraseña venció o ya se usó. Pida uno nuevo.');
    }
    if (usuario) return mostrarPortal();
    mostrarIngreso(enlaceMalo ? 'El enlace venció o ya se usó. Ingrese con su correo y su contraseña.' : '');
  }

  function pestanaIngreso(p) {
    document.querySelectorAll('#pestIngreso button').forEach(function (b) { b.classList.toggle('act', b.getAttribute('data-p') === p); });
    ver('fIngresar', p === 'ingresar'); ver('fCrear', p === 'crear');
    ver('fOlvido', p === 'olvido' && !!C.recuperarPorCorreo);
    ver('ayudaClave', p === 'olvido' && !C.recuperarPorCorreo);
    ver('pestIngreso', p !== 'olvido');
  }

  function mostrarIngreso(aviso) {
    ['vPortal', 'vNuevaClave', 'btnSalir', 'btnNueva'].forEach(function (i) { ver(i, false); });
    ver('vIngreso', true);
    pestanaIngreso('ingresar');
    ['fIngresar', 'fCrear', 'fOlvido'].forEach(function (i) { mensaje($(i), ''); });
    var a = $('avisoIngreso');
    a.textContent = aviso || '';
    a.className = 'msg' + (aviso ? ' err' : '');
  }

  function limpiarPortal() {
    usuario = null; perfil = null; solicitudes = [];
    ['tSolicitudes', 'tPolizas', 'tConversaciones'].forEach(function (i) { $(i).innerHTML = ''; });
    ['fDatos', 'fClave'].forEach(function (i) { $(i).reset(); });
  }

  function mostrarNuevaClave() {
    ['vPortal', 'vIngreso'].forEach(function (i) { ver(i, false); });
    ver('vNuevaClave', true);
  }

  // ---------- Ingreso, registro y recuperación ----------
  function enlazarIngreso() {
    document.querySelectorAll('#pestIngreso button').forEach(function (b) { b.addEventListener('click', function () { pestanaIngreso(b.getAttribute('data-p')); }); });
    $('btnOlvido').addEventListener('click', function () { pestanaIngreso('olvido'); });
    document.querySelectorAll('[data-volver]').forEach(function (b) { b.addEventListener('click', function () { pestanaIngreso('ingresar'); }); });
    $('waClave').href = 'https://wa.me/' + C.whatsapp + '?text=' + encodeURIComponent('Hola, necesito restablecer la contraseña de mi cuenta en laprimajusta.co.');

    $('fIngresar').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      var correo = f.correo.value.trim().toLowerCase(), clave = f.clave.value;
      if (!correoValido(correo) || !clave) return mensaje(f, 'Escriba su correo y su contraseña.');
      b.disabled = true; mensaje(f, '');
      try { usuario = await L.ingresar(correo, clave); f.reset(); await mostrarPortal(); }
      catch (e) { mensaje(f, L.error(e)); }
      b.disabled = false;
    });

    $('fCrear').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      var d = { nombre: f.nombre.value.trim(), celular: f.celular.value.trim(), correo: f.correo.value.trim().toLowerCase() };
      if (!d.nombre) return mensaje(f, 'Escriba su nombre.');
      if (d.celular.replace(/\D/g, '').length < 7) return mensaje(f, 'Revise el celular.');
      if (!correoValido(d.correo)) return mensaje(f, 'Revise el correo.');
      if (f.clave.value.length < 8) return mensaje(f, 'La contraseña debe tener al menos 8 caracteres.');
      if (!f.autoriza.checked) return mensaje(f, 'Debe autorizar el tratamiento de datos.');
      b.disabled = true; mensaje(f, '');
      try {
        var r = await L.registrar(d.correo, f.clave.value, { nombre: d.nombre, celular: d.celular, autoriza: 'true' });
        if (r.requiereConfirmar) { f.reset(); mensaje(f, 'Le enviamos un correo para confirmar su cuenta. Ábralo y luego ingrese aquí.', true); }
        else {
          usuario = r.usuario;
          try { await L.completarPerfil({ nombre: d.nombre, celular: d.celular }); } catch (e) { /* se completa después en Mis datos */ }
          f.reset();
          await mostrarPortal();
        }
      } catch (e) { mensaje(f, L.error(e)); }
      b.disabled = false;
    });

    $('fOlvido').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]'), correo = f.correo.value.trim().toLowerCase();
      if (!correoValido(correo)) return mensaje(f, 'Revise el correo.');
      b.disabled = true;
      try { await L.recuperarClave(correo); mensaje(f, 'Si el correo tiene cuenta, le llegará un enlace en unos minutos. Revise también el correo no deseado.', true); }
      catch (e) { mensaje(f, L.error(e)); }
      b.disabled = false;
    });

    $('fNuevaClave').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      if (f.clave.value.length < 8) return mensaje(f, 'La contraseña debe tener al menos 8 caracteres.');
      b.disabled = true;
      try {
        await L.cambiarClave(f.clave.value);
        usuario = await L.usuario();
        f.reset();
        await mostrarPortal();
      } catch (e) { mensaje(f, L.error(e)); }
      b.disabled = false;
    });
  }

  // ---------- Portal ----------
  function enlazarPortal() {
    $('btnSalir').addEventListener('click', async function () {
      saliendo = true;
      await L.salir();
      saliendo = false;
      history.replaceState(null, '', location.pathname);
      limpiarPortal();
      mostrarIngreso('');
    });
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-t');
        if (t === 'solicitudes' && /^#s=/.test(location.hash)) { location.hash = ''; return; }
        pestanaPortal(t);
        if (t === 'solicitudes') pintarLista();
      });
    });
    window.addEventListener('hashchange', function () { if (usuario && !$('vPortal').classList.contains('oculto')) rutear(); });

    $('fDatos').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      if (!f.nombre.value.trim()) return mensaje(f, 'Escriba su nombre.');
      b.disabled = true;
      try {
        await L.guardarPerfil({ empresa: f.empresa.value.trim(), nit: f.nit.value.trim(), celular: f.celular.value.trim(), nombre: f.nombre.value.trim() });
        perfil = await L.perfil();
        mensaje(f, 'Datos guardados.', true);
        pintarSaludo();
      } catch (e) { mensaje(f, L.error(e)); }
      b.disabled = false;
    });
    $('fClave').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      if (f.clave.value.length < 8) return mensaje(f, 'La contraseña debe tener al menos 8 caracteres.');
      b.disabled = true;
      try { await L.cambiarClave(f.clave.value); f.reset(); mensaje(f, 'Contraseña cambiada.', true); }
      catch (e) { mensaje(f, L.error(e)); }
      b.disabled = false;
    });
  }

  function pestanaPortal(t) {
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('act', b.getAttribute('data-t') === t); });
    ver('tSolicitudes', t === 'solicitudes'); ver('tPolizas', t === 'polizas');
    ver('tConversaciones', t === 'conversaciones'); ver('tDatos', t === 'datos');
    if (t === 'polizas') pintarPolizas();
    if (t === 'conversaciones') pintarConversaciones();
    if (t === 'datos') llenarDatos();
  }

  function pintarSaludo() {
    var nombre = perfil && perfil.nombre ? perfil.nombre.split(' ')[0] : '';
    $('hola').textContent = 'Hola' + (nombre ? ', ' + nombre : '');
    $('holaSub').textContent = (perfil && perfil.empresa ? perfil.empresa + ' · ' : '') + usuario.email;
  }

  async function mostrarPortal() {
    ['vIngreso', 'vNuevaClave'].forEach(function (i) { ver(i, false); });
    ['vPortal', 'btnSalir', 'btnNueva'].forEach(function (i) { ver(i, true); });
    try { perfil = await L.perfil(); } catch (e) { perfil = null; }
    pintarSaludo();
    var pendiente = null;
    try { pendiente = await L.enviarPendiente(); } catch (e) { pendiente = null; }
    await cargarSolicitudes();
    if (pendiente && !/^#s=/.test(location.hash)) history.replaceState(null, '', '#s=' + pendiente.id);
    rutear();
  }

  async function cargarSolicitudes() {
    try { solicitudes = await L.misSolicitudes(); errorCarga = ''; } catch (e) { solicitudes = []; errorCarga = L.error(e); }
  }

  function rutear() {
    var m = location.hash.match(/^#s=([0-9a-f-]{36})$/);
    pestanaPortal('solicitudes');
    if (m) abrirSolicitud(m[1]); else pintarLista();
  }

  function itemSolicitud(s) {
    return '<button type="button" class="item-sol" data-id="' + E(s.id) + '">' +
      '<span class="item-num">#' + E(s.numero) + '</span>' +
      '<span class="item-txt"><strong>' + E(L.TIPOS_SOLICITUD[s.tipo] || s.tipo) + (s.empresa ? ' · ' + E(s.empresa) : '') + '</strong>' +
      '<span>Actualizada el ' + L.fecha(s.actualizado) + '</span></span>' +
      '<span class="badge est-' + E(s.estado) + '">' + E(L.ESTADOS[s.estado] || s.estado) + '</span></button>';
  }

  function pintarLista() {
    var t = $('tSolicitudes');
    if (errorCarga) {
      t.innerHTML = '<div class="vacio">No pudimos cargar sus solicitudes. ' + E(errorCarga) + '<br><button type="button" class="btn btn-s" id="reintentar">Reintentar</button></div>';
      $('reintentar').addEventListener('click', async function () { t.innerHTML = '<p class="nada">Cargando…</p>'; await cargarSolicitudes(); pintarLista(); });
      return;
    }
    if (!solicitudes.length) {
      t.innerHTML = '<div class="vacio">Aún no tiene solicitudes.<br><a class="btn btn-p" href="./#cotizar">Cotizar o mejorar mi póliza PYME</a></div>';
      return;
    }
    t.innerHTML = '<div class="lista-sol">' + solicitudes.map(itemSolicitud).join('') + '</div>';
    t.querySelectorAll('.item-sol').forEach(function (b) {
      b.addEventListener('click', function () { location.hash = 's=' + b.getAttribute('data-id'); });
    });
  }

  // ---------- Detalle de solicitud ----------
  function barraAvance(estado) {
    var idx = -1;
    L.ETAPAS.forEach(function (e, i) { if (e.incluye.indexOf(estado) >= 0) idx = i; });
    return '<div class="avance" aria-label="Avance de la solicitud">' + L.ETAPAS.map(function (e, i) {
      return '<div class="' + (i < idx ? 'hecho' : i === idx ? 'hecho actual' : '') + '">' + E(e.txt) + '</div>';
    }).join('') + '</div>';
  }

  function listaDocs(archivos) {
    if (!archivos.length) return '<p class="nada">Todavía no hay documentos.</p>';
    return '<ul class="docs">' + archivos.map(function (a) {
      return '<li><span>' + E(a.nombre) + '<small>' + E(L.TIPOS_ARCHIVO[a.tipo] || a.tipo) + ' · ' + (a.subido_por === 'asesor' ? 'Su asesor' : 'Usted') + ' · ' + L.fecha(a.creado) + '</small></span>' +
        '<button type="button" class="btn btn-s" data-ruta="' + E(a.ruta) + '">Ver</button></li>';
    }).join('') + '</ul>';
  }

  function historial(eventos) {
    var autor = { cliente: 'Usted', asesor: 'Su asesor', sistema: 'Sistema' };
    return '<ul class="hist">' + eventos.slice().reverse().map(function (e) {
      return '<li><b>' + E(L.ESTADOS[e.estado] || e.estado) + '</b><small>' + L.fecha(e.creado, true) + ' · ' + (autor[e.autor] || '') + '</small>' + (e.nota ? '<p>' + E(e.nota) + '</p>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function charla(mensajes) {
    if (!mensajes.length) return '<p class="nada">Sin mensajes.</p>';
    var cls = { cliente: 'cli', asistente: 'asi', asesor: 'ase' };
    return '<div class="charla">' + mensajes.map(function (m) {
      return '<div class="' + (cls[m.rol] || 'asi') + '">' + (m.rol === 'asesor' ? '<small>Su asesor · ' + L.fecha(m.creado) + '</small>' : '') + E(m.texto) + '</div>';
    }).join('') + '</div>';
  }

  function botonesPorEstado(estado) {
    var b = [];
    if (estado === 'cotizada') b.push(['emision', 'Solicitar emisión', 'p'], ['ajuste', 'Pedir ajustes', 's']);
    if (estado === 'recibida' || estado === 'en_analisis' || estado === 'ajustes_solicitados') b.push(['ajuste', 'Pedir un cambio', 's']);
    if (estado === 'pago_pendiente') b.push(['pago', 'Ya pagué', 'p']);
    if (estado !== 'cancelada') {
      if (estado !== 'vigente') b.push(['documento', 'Subir documentos', 's']);
      b.push(['mensaje', 'Escribir a mi asesor', 's']);
    }
    return b;
  }

  async function abrirSolicitud(id) {
    var t = $('tSolicitudes');
    t.innerHTML = '<p class="nada">Cargando…</p>';
    var d;
    try { d = await L.solicitud(id); } catch (e) {
      t.innerHTML = '<div class="vacio">No encontramos esa solicitud en su cuenta.<br><button type="button" class="btn btn-s" id="volver">Ver mis solicitudes</button></div>';
      $('volver').addEventListener('click', function () { location.hash = ''; });
      return;
    }
    var s = d.solicitud;
    var sig = SIGUIENTE[s.estado] || ['', ''];
    var html = '<button type="button" class="volver" id="volver">‹ Todas mis solicitudes</button>' +
      '<div class="det-cab"><div><h2>#' + E(s.numero) + ' · ' + E(L.TIPOS_SOLICITUD[s.tipo] || s.tipo) + '</h2><p>' + E(s.empresa || '') + ' · Creada el ' + L.fecha(s.creado) + '</p></div>' +
      '<span class="badge est-' + E(s.estado) + '">' + E(L.ESTADOS[s.estado] || s.estado) + '</span></div>' +
      (s.estado === 'cancelada' ? '' : barraAvance(s.estado));

    if ((s.estado === 'pago_pendiente' || s.estado === 'pago_reportado') && (s.link_pago || s.referencia_pago)) {
      html += '<div class="pago"><strong>Información de pago</strong>' +
        (s.referencia_pago ? '<p>Referencia: <b>' + E(s.referencia_pago) + '</b></p>' : '') +
        (s.link_pago && /^https?:\/\//i.test(s.link_pago) ? '<a class="btn btn-p" href="' + E(s.link_pago) + '" target="_blank" rel="noopener noreferrer">Ir a pagar</a>' : '') +
        '<p class="pago-nota">El pago se hace directamente a la aseguradora. Si su asesor adjuntó el recibo, lo encuentra en Documentos.</p></div>';
    }

    html += '<div class="siguiente"><strong>' + E(sig[0]) + '</strong><p>' + E(sig[1]) + '</p><div class="acciones">' +
      botonesPorEstado(s.estado).map(function (b) { return '<button type="button" class="btn btn-' + b[2] + '" data-acc="' + b[0] + '">' + b[1] + '</button>'; }).join('') +
      '</div><div id="zonaAccion"></div></div>';

    html += '<div class="grid2"><div>' +
      '<div class="tarjeta"><h3>Documentos</h3>' + listaDocs(d.archivos) + '</div>' +
      '<div class="tarjeta"><h3>Datos de la solicitud</h3><dl class="kv">' + L.filasDatos(s.datos).map(function (r) { return '<dt>' + E(r[0]) + '</dt><dd>' + E(r[1]) + '</dd>'; }).join('') + '</dl>' +
      (s.ajustes && s.ajustes.length ? '<h3 class="sub">Cambios pedidos</h3><ul class="hist">' + s.ajustes.map(function (a) { return '<li><small>' + L.fecha(a.fecha, true) + '</small><p>' + E(a.texto) + '</p></li>'; }).join('') + '</ul>' : '') +
      (s.opcion_elegida ? '<p class="elegida">Opción elegida para emitir: <b>' + E(s.opcion_elegida) + '</b></p>' : '') +
      '</div></div><div>' +
      '<div class="tarjeta"><h3>Historial</h3>' + historial(d.eventos) + '</div>' +
      '<div class="tarjeta"><h3>Conversación</h3>' + charla(d.mensajes) + '</div>' +
      '</div></div>';
    if (['recibida', 'en_analisis', 'cotizada', 'ajustes_solicitados', 'emision_solicitada'].indexOf(s.estado) >= 0) {
      html += '<p class="pie-det"><button type="button" class="enlace" id="btnCancelar">Cancelar esta solicitud</button></p>';
    }
    t.innerHTML = html;

    $('volver').addEventListener('click', function () { location.hash = ''; });
    t.querySelectorAll('[data-ruta]').forEach(function (b) { b.addEventListener('click', function () { L.abrirArchivo(b.getAttribute('data-ruta')); }); });
    t.querySelectorAll('[data-acc]').forEach(function (b) { b.addEventListener('click', function () { prepararAccion(s, b.getAttribute('data-acc')); }); });
    var charlaEl = t.querySelector('.charla');
    if (charlaEl) charlaEl.scrollTop = charlaEl.scrollHeight;
    var bc = $('btnCancelar');
    if (bc) bc.addEventListener('click', async function () {
      if (!window.confirm('¿Seguro que quiere cancelar esta solicitud?')) return;
      bc.disabled = true;
      try {
        await L.accionCliente(s.id, 'cancelar', '');
        await avisar(s, 'Solicitud cancelada por el cliente', '—', []);
      } catch (e) { window.alert(L.error(e)); }
      await cargarSolicitudes();
      abrirSolicitud(s.id);
    });
  }

  function avisar(s, titulo, texto, subidos) {
    return L.avisarAsesor(titulo + ' — #' + s.numero + ' ' + (s.empresa || ''), {
      _replyto: usuario.email,
      Solicitud: '#' + s.numero + ' · ' + (L.TIPOS_SOLICITUD[s.tipo] || s.tipo),
      Empresa: s.empresa || '—',
      Cliente: (perfil && perfil.nombre ? perfil.nombre + ' · ' : '') + usuario.email + (perfil && perfil.celular ? ' · ' + perfil.celular : ''),
      Detalle: texto || '—',
      Archivos: subidos.length ? subidos.join(', ') : 'Ninguno',
      'Gestionar en el panel': C.sitio + '/asesor.html#s=' + s.id
    });
  }

  function prepararAccion(s, acc) {
    var conf = ACCIONES[acc];
    var z = $('zonaAccion');
    z.innerHTML = '<form class="form subform" id="fAccion" novalidate>' +
      (conf.texto ? '<label>' + E(conf.etiqueta) + '<textarea name="texto" maxlength="2000"></textarea></label>' : '') +
      '<label>' + (conf.texto ? 'Adjuntar archivos (opcional)' : E(conf.etiqueta)) + L.campoArchivo(true) + '</label>' +
      (conf.ayuda ? '<p class="ayuda">' + E(conf.ayuda) + '</p>' : '') +
      '<div class="msg" role="alert"></div><div class="acciones"><button class="btn btn-p" type="submit">' + E(conf.boton) + '</button>' +
      '<button class="btn btn-t" type="button" id="cerrarAccion">Cerrar</button></div></form>';
    var f = $('fAccion');
    $('cerrarAccion').addEventListener('click', function () { z.innerHTML = ''; });
    f.querySelector(conf.texto ? 'textarea' : 'input').focus();
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var b = f.querySelector('[type=submit]');
      if (b.disabled) return;
      var texto = f.texto ? f.texto.value.trim() : '';
      var archivos = Array.prototype.slice.call(f.archivo.files || []);
      if (conf.texto === 'obligatorio' && !texto) return mensaje(f, acc === 'emision' ? 'Escriba qué opción eligió.' : 'Escriba el texto antes de enviar.');
      if (acc === 'documento' && !archivos.length) return mensaje(f, 'Elija al menos un archivo.');
      if (archivos.length > 8) return mensaje(f, 'Puede adjuntar máximo 8 archivos a la vez.');
      var problema = archivos.map(L.problemaArchivo).filter(Boolean)[0];
      if (problema) return mensaje(f, problema);
      b.disabled = true; mensaje(f, archivos.length ? 'Subiendo archivos…' : 'Enviando…', true);
      var subidos = [];
      try {
        for (var i = 0; i < archivos.length; i++) {
          await L.subirArchivo(archivos[i], { solicitudId: s.id, tipo: conf.archivo });
          subidos.push(archivos[i].name);
        }
        if (acc === 'documento') await L.accionCliente(s.id, 'documento', subidos.join(', '));
        else {
          await L.accionCliente(s.id, acc, texto);
          if (subidos.length) await L.accionCliente(s.id, 'documento', subidos.join(', '));
        }
      } catch (e) { b.disabled = false; return mensaje(f, L.error(e)); }
      await avisar(s, conf.titulo, texto, subidos);
      await cargarSolicitudes();
      abrirSolicitud(s.id);
    });
  }

  // ---------- Pólizas ----------
  async function pintarPolizas() {
    var t = $('tPolizas');
    t.innerHTML = '<p class="nada">Cargando…</p>';
    var ps;
    try { ps = await L.misPolizas(); } catch (e) { t.innerHTML = '<div class="vacio">' + E(L.error(e)) + '</div>'; return; }
    if (!ps.length) { t.innerHTML = '<div class="vacio">Aquí aparecerán las pólizas que emita con nosotros.</div>'; return; }
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    t.innerHTML = '<div class="polizas">' + ps.map(function (p) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.vigencia_hasta || '');
      var dias = m ? Math.round((new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - hoy) / 86400000) : null;
      return '<div class="tarjeta poliza"><h4>' + E(p.ramo) + ' · ' + E(p.aseguradora) + '</h4>' +
        (dias !== null && dias >= 0 && dias <= 45 ? '<span class="aviso-vence">Vence en ' + dias + ' días</span>' : '') +
        (dias !== null && dias < 0 ? '<span class="aviso-vence">Vencida</span>' : '') +
        '<dl class="kv"><dt>Número</dt><dd>' + E(p.numero || '—') + '</dd><dt>Vigencia</dt><dd>' + L.fecha(p.vigencia_desde) + ' – ' + L.fecha(p.vigencia_hasta) + '</dd><dt>Prima anual</dt><dd>' + L.pesos(p.prima) + '</dd></dl>' +
        '<div class="acciones">' + (p.archivo_ruta ? '<button type="button" class="btn btn-s" data-ruta="' + E(p.archivo_ruta) + '">Ver póliza</button>' : '') +
        '<a class="btn btn-s" href="./#cotizar">Renovar o mejorar</a></div></div>';
    }).join('') + '</div>';
    t.querySelectorAll('[data-ruta]').forEach(function (b) { b.addEventListener('click', function () { L.abrirArchivo(b.getAttribute('data-ruta')); }); });
  }

  // ---------- Conversaciones ----------
  async function pintarConversaciones() {
    var t = $('tConversaciones');
    t.innerHTML = '<p class="nada">Cargando…</p>';
    var ms;
    try { ms = await L.misMensajes(); } catch (e) { t.innerHTML = '<div class="vacio">' + E(L.error(e)) + '</div>'; return; }
    if (!ms.length) { t.innerHTML = '<div class="vacio">Sus conversaciones con el asistente y con su asesor aparecerán aquí.</div>'; return; }
    var grupos = {}, orden = [];
    ms.forEach(function (m) {
      var k = m.solicitud_id || 'general';
      if (!grupos[k]) { grupos[k] = []; orden.push(k); }
      grupos[k].push(m);
    });
    var porId = {};
    solicitudes.forEach(function (s) { porId[s.id] = s; });
    t.innerHTML = orden.reverse().map(function (k) {
      var s = porId[k];
      var titulo = s ? 'Solicitud #' + s.numero + ' · ' + (L.TIPOS_SOLICITUD[s.tipo] || '') : 'Preguntas generales';
      return '<div class="tarjeta"><h3>' + E(titulo) + '</h3><p class="fecha-charla">Desde el ' + L.fecha(grupos[k][0].creado, true) + '</p>' + charla(grupos[k]) +
        (s ? '<p class="pie-det"><button type="button" class="enlace" data-ir="' + E(s.id) + '">Ver la solicitud</button></p>' : '') + '</div>';
    }).join('');
    t.querySelectorAll('[data-ir]').forEach(function (b) { b.addEventListener('click', function () { location.hash = 's=' + b.getAttribute('data-ir'); }); });
  }

  function llenarDatos() {
    var f = $('fDatos');
    f.correo.value = usuario.email;
    f.empresa.value = (perfil && perfil.empresa) || '';
    f.nit.value = (perfil && perfil.nit) || '';
    f.celular.value = (perfil && perfil.celular) || '';
    f.nombre.value = (perfil && perfil.nombre) || '';
    mensaje(f, '');
    mensaje($('fClave'), '');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
