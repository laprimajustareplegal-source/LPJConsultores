/* Panel del asesor — La Prima Justa */
(function () {
  'use strict';
  var C = window.LPJ_CONFIG || {};
  var L = window.LPJ;
  var E = L.escapar;
  var todas = [], perfiles = {}, filtro = 'atender', actual = null, saliendo = false;

  function $(id) { return document.getElementById(id); }
  function ver(id, si) { $(id).classList.toggle('oculto', !si); }
  function mensaje(form, texto, ok) {
    var m = form.querySelector('.msg');
    m.textContent = texto || '';
    m.className = 'msg' + (texto ? (ok ? ' ok' : ' err') : '');
  }
  function celularWa(c) {
    var n = String(c || '').replace(/\D/g, '');
    if (n.length === 10 && n.charAt(0) === '3') n = '57' + n;
    return n.length >= 10 ? n : '';
  }

  async function iniciar() {
    if (!L.configurado) { ver('cargando', false); ver('sinConfig', true); return; }
    $('fIngresar').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      b.disabled = true; mensaje(f, '');
      try { await L.ingresar(f.correo.value.trim().toLowerCase(), f.clave.value); f.reset(); await entrar(); }
      catch (e) { mensaje(f, L.error(e)); }
      b.disabled = false;
    });
    $('btnSalir').addEventListener('click', salir);
    $('btnSalir2').addEventListener('click', salir);
    $('btnRecargar').addEventListener('click', function () { cargar(); });
    $('buscar').addEventListener('input', pintarLista);
    window.addEventListener('hashchange', abrirDesdeHash);
    // Si la sesión se cierra en otra pestaña o vence, el panel vuelve al ingreso.
    L.alCambiarSesion(function (u, evento) {
      if (evento === 'SIGNED_OUT' && !saliendo && !$('vPanel').classList.contains('oculto')) location.reload();
    });
    var sesion = L.usuario();
    var u = await Promise.race([sesion, new Promise(function (r) { setTimeout(function () { r(undefined); }, 8000); })]);
    ver('cargando', false);
    if (u) return entrar();
    ver('vIngreso', true);
    if (u === undefined) {
      mensaje($('fIngresar'), 'No pudimos conectar con el servidor. Intente de nuevo en unos minutos.');
      sesion.then(function (tarde) { if (tarde && $('vPanel').classList.contains('oculto')) entrar(); });
    }
  }

  async function salir() { saliendo = true; await L.salir(); location.reload(); }

  // Cada minuto y medio se refresca la lista (no el detalle, para no interrumpir lo que se esté escribiendo).
  async function refrescarLista() {
    if (document.hidden || $('vPanel').classList.contains('oculto')) return;
    try { todas = await L.todasSolicitudes(); } catch (e) { return; }
    var faltan = todas.map(function (s) { return s.usuario_id; }).filter(function (v, i, a) { return a.indexOf(v) === i && !perfiles[v]; });
    if (faltan.length) { try { (await L.perfiles(faltan)).forEach(function (p) { perfiles[p.id] = p; }); } catch (e) { /* sin perfiles */ } }
    pintarContadores();
    pintarLista();
  }

  async function entrar() {
    ver('vIngreso', false);
    if (!(await L.esAsesor())) { ver('vSinPermiso', true); ver('btnSalir', true); return; }
    ['vPanel', 'btnSalir', 'btnRecargar'].forEach(function (i) { ver(i, true); });
    await cargar();
    window.setInterval(refrescarLista, 90000);
  }

  async function cargar() {
    try { todas = await L.todasSolicitudes(); } catch (e) { $('lista').innerHTML = '<div class="vacio">' + E(L.error(e)) + '</div>'; return; }
    var ids = todas.map(function (s) { return s.usuario_id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    try { (await L.perfiles(ids)).forEach(function (p) { perfiles[p.id] = p; }); } catch (e) { /* sigue sin perfiles */ }
    pintarContadores();
    pintarFiltros();
    pintarLista();
    abrirDesdeHash();
  }

  function abierta(s) { return s.estado !== 'vigente' && s.estado !== 'cancelada'; }

  function pintarContadores() {
    var n = function (fn) { return todas.filter(fn).length; };
    $('contadores').innerHTML =
      '<div class="contador"><b>' + n(function (s) { return s.atencion; }) + '</b>Por atender</div>' +
      '<div class="contador"><b>' + n(function (s) { return abierta(s) && !s.atencion; }) + '</b>Esperando al cliente</div>' +
      '<div class="contador"><b>' + n(function (s) { return s.estado === 'pago_pendiente'; }) + '</b>Pago pendiente</div>' +
      '<div class="contador"><b>' + n(function (s) { return s.estado === 'vigente'; }) + '</b>Vigentes</div>';
  }

  function pintarFiltros() {
    var ops = [['atender', 'Por atender'], ['abiertas', 'Abiertas'], ['todas', 'Todas']].concat(Object.keys(L.ESTADOS).map(function (k) { return [k, L.ESTADOS[k]]; }));
    $('filtros').innerHTML = ops.map(function (o) {
      return '<button type="button" data-f="' + o[0] + '" class="' + (filtro === o[0] ? 'act' : '') + '">' + E(o[1]) + '</button>';
    }).join('');
    $('filtros').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { filtro = b.getAttribute('data-f'); pintarFiltros(); pintarLista(); });
    });
  }

  function pintarLista() {
    var q = $('buscar').value.trim().toLowerCase();
    var lista = todas.filter(function (s) {
      if (filtro === 'atender' && !s.atencion) return false;
      if (filtro === 'abiertas' && !abierta(s)) return false;
      if (L.ESTADOS[filtro] && s.estado !== filtro) return false;
      if (!q) return true;
      var p = perfiles[s.usuario_id] || {};
      return ['#' + s.numero, s.empresa, p.correo, p.nombre, p.celular, p.empresa].join(' ').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (b.atencion ? 1 : 0) - (a.atencion ? 1 : 0) || (a.actualizado < b.actualizado ? 1 : -1); });
    if (!lista.length) {
      $('lista').innerHTML = '<div class="vacio">' + (filtro === 'atender' && !q ? 'No hay solicitudes por atender.' : 'No hay solicitudes en este filtro.') + '</div>';
      return;
    }
    $('lista').innerHTML = lista.map(function (s) {
      var p = perfiles[s.usuario_id] || {};
      return '<button type="button" class="item-sol' + (actual && actual.id === s.id ? ' act' : '') + '" data-id="' + E(s.id) + '">' +
        '<span class="item-num">' + (s.atencion ? '<i class="punto" title="Por atender"></i>' : '') + '#' + E(s.numero) + '</span>' +
        '<span class="item-txt"><strong>' + E(s.empresa || p.empresa || '—') + '</strong><span>' + E(L.TIPOS_SOLICITUD[s.tipo] || s.tipo) + ' · ' + E(p.nombre || p.correo || '') + ' · ' + L.fecha(s.actualizado) + '</span></span>' +
        '<span class="badge est-' + E(s.estado) + '">' + E(L.ESTADOS[s.estado] || s.estado) + '</span></button>';
    }).join('');
    $('lista').querySelectorAll('.item-sol').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id');
        if (location.hash === '#s=' + id) abrir(id); else location.hash = 's=' + id;
      });
    });
  }

  function abrirDesdeHash() {
    var m = location.hash.match(/^#s=([0-9a-f-]{36})$/);
    if (m && !$('vPanel').classList.contains('oculto')) abrir(m[1]);
  }

  function docs(archivos) {
    if (!archivos.length) return '<p class="nada">Sin documentos.</p>';
    return '<ul class="docs">' + archivos.map(function (a) {
      return '<li><span>' + E(a.nombre) + '<small>' + E(L.TIPOS_ARCHIVO[a.tipo] || a.tipo) + ' · ' + (a.subido_por === 'asesor' ? 'Asesor' : 'Cliente') + ' · ' + L.fecha(a.creado, true) + '</small></span>' +
        '<button type="button" class="btn btn-s" data-ruta="' + E(a.ruta) + '">Ver</button></li>';
    }).join('') + '</ul>';
  }

  function historial(eventos) {
    var autor = { cliente: 'Cliente', asesor: 'Asesor', sistema: 'Sistema' };
    return '<ul class="hist">' + eventos.slice().reverse().map(function (e) {
      return '<li><b>' + E(L.ESTADOS[e.estado] || e.estado) + '</b><small>' + L.fecha(e.creado, true) + ' · ' + (autor[e.autor] || '') + '</small>' + (e.nota ? '<p>' + E(e.nota) + '</p>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function charla(ms) {
    if (!ms.length) return '<p class="nada">Sin conversación guardada.</p>';
    var cls = { cliente: 'cli', asistente: 'asi', asesor: 'ase' };
    return '<div class="charla">' + ms.map(function (m) {
      return '<div class="' + (cls[m.rol] || 'asi') + '">' + (m.rol === 'asesor' ? '<small>Asesor · ' + L.fecha(m.creado) + '</small>' : '') + E(m.texto) + '</div>';
    }).join('') + '</div>';
  }

  function textoAviso(s, nota) {
    var p = perfiles[s.usuario_id] || {};
    var l = ['Hola' + (p.nombre ? ' ' + p.nombre.split(' ')[0] : '') + ',', '',
      'Su solicitud #' + s.numero + (s.empresa ? ' (' + s.empresa + ')' : '') + ' está en estado: ' + L.ESTADOS[s.estado] + '.'];
    if (nota) l.push('', nota);
    if (s.estado === 'pago_pendiente') {
      l.push('');
      if (s.link_pago) l.push('Link de pago: ' + s.link_pago);
      if (s.referencia_pago) l.push('Referencia: ' + s.referencia_pago);
    }
    l.push('', 'Puede ver el detalle y los documentos en: ' + C.sitio + '/mi-cuenta.html#s=' + s.id, '', 'Cordial saludo,', C.nombreAsesor, 'La Prima Justa · ' + C.whatsappVisible);
    return l.join('\n');
  }

  function archivosDe(input) {
    var lista = Array.prototype.slice.call(input.files || []);
    var problema = lista.map(L.problemaArchivo).filter(Boolean)[0];
    if (problema) throw new Error(problema);
    return lista;
  }

  async function abrir(id) {
    var z = $('detalle');
    z.innerHTML = '<p class="nada">Cargando…</p>';
    var d, polizas = [];
    try { d = await L.solicitud(id); } catch (e) { actual = null; z.innerHTML = '<div class="vacio">No se encontró la solicitud.</div>'; return; }
    var s = d.solicitud;
    actual = s;
    if (!perfiles[s.usuario_id]) { try { (await L.perfiles([s.usuario_id])).forEach(function (x) { perfiles[x.id] = x; }); } catch (e) { /* sin perfil */ } }
    var i0 = todas.findIndex(function (x) { return x.id === s.id; });
    if (i0 >= 0) todas[i0] = s; else todas.unshift(s);
    pintarContadores();
    pintarLista();
    var p = perfiles[s.usuario_id] || {};
    var cel = celularWa(p.celular);
    try { polizas = await L.polizasDe(s.usuario_id); } catch (e) { polizas = []; }

    z.innerHTML =
      '<div class="det-cab"><div><h2>#' + E(s.numero) + ' · ' + E(s.empresa || p.empresa || '—') + '</h2><p>' + E(L.TIPOS_SOLICITUD[s.tipo] || s.tipo) + ' · Creada el ' + L.fecha(s.creado, true) + ' · Actualizada el ' + L.fecha(s.actualizado, true) + '</p></div>' +
      '<span class="badge est-' + E(s.estado) + '">' + E(L.ESTADOS[s.estado] || s.estado) + '</span></div>' +
      (s.atencion ? '<div class="aviso-atencion"><span>' + (s.estado === 'cancelada' ? 'El cliente canceló esta solicitud.' : 'El cliente está esperando su respuesta.') + '</span><button type="button" class="enlace" id="btnAtendida">Marcar como atendida</button></div>' : '') +

      '<div class="tarjeta"><h3>Cliente</h3><dl class="kv">' +
      '<dt>Nombre</dt><dd>' + E(p.nombre || '—') + '</dd>' +
      '<dt>Empresa</dt><dd>' + E(p.empresa || '—') + (p.nit ? ' · NIT ' + E(p.nit) : '') + '</dd>' +
      '<dt>Correo</dt><dd>' + (p.correo ? '<a href="mailto:' + encodeURIComponent(p.correo).replace(/%40/g, '@') + '">' + E(p.correo) + '</a>' : '—') + '</dd>' +
      '<dt>Celular</dt><dd>' + (cel ? '<a href="https://wa.me/' + cel + '" target="_blank" rel="noopener">' + E(p.celular) + '</a>' : E(p.celular || '—')) + '</dd>' +
      '<dt>Autorizó tratamiento de datos</dt><dd>' + (p.autoriza_datos ? L.fecha(p.autoriza_datos, true) : 'No registra') + '</dd></dl></div>' +

      '<div class="tarjeta"><h3>Responder y actualizar</h3><form class="form" id="fActualizar" novalidate>' +
      '<label>Estado<select name="estado">' + Object.keys(L.ESTADOS).map(function (k) { return '<option value="' + k + '"' + (k === s.estado ? ' selected' : '') + '>' + E(L.ESTADOS[k]) + '</option>'; }).join('') + '</select></label>' +
      '<label>Nota para el cliente (la verá en su cuenta)<textarea name="nota" maxlength="2000" placeholder="Ej.: Le enviamos 3 opciones; la de AXA Colpatria mejora la RC y baja la prima."></textarea></label>' +
      '<div class="fila2"><label>Link de pago de la aseguradora<input type="url" name="link" placeholder="https://…" value="' + E(s.link_pago || '') + '"></label>' +
      '<label>Referencia de pago<input type="text" name="ref" maxlength="120" value="' + E(s.referencia_pago || '') + '"></label></div>' +
      '<div class="fila2"><label>Adjuntar archivos<input type="file" name="archivo" multiple accept="' + L.ACEPTA + '"></label>' +
      '<label>Tipo de archivo<select name="tipo"><option value="cotizacion">Cotización</option><option value="poliza_emitida">Póliza emitida</option><option value="recibo_pago">Recibo de pago</option><option value="otro">Otro</option></select></label></div>' +
      '<div class="msg" role="alert"></div><button class="btn btn-p" type="submit">Guardar</button></form>' +
      '<div id="avisar" class="acciones oculto"></div></div>' +

      '<div class="grid2"><div>' +
      '<div class="tarjeta"><h3>Datos de la solicitud</h3><dl class="kv">' + L.filasDatos(s.datos).map(function (r) { return '<dt>' + E(r[0]) + '</dt><dd>' + E(r[1]) + '</dd>'; }).join('') + '</dl>' +
      (s.ajustes && s.ajustes.length ? '<h3 class="sub">Ajustes pedidos</h3><ul class="hist">' + s.ajustes.map(function (a) { return '<li><small>' + L.fecha(a.fecha, true) + '</small><p>' + E(a.texto) + '</p></li>'; }).join('') + '</ul>' : '') +
      (s.opcion_elegida ? '<p class="elegida">Opción elegida para emitir: <b>' + E(s.opcion_elegida) + '</b></p>' : '') + '</div>' +
      '<div class="tarjeta"><h3>Documentos</h3>' + docs(d.archivos) + '</div>' +
      '<div class="tarjeta"><h3>Registrar póliza emitida</h3><form class="form" id="fPoliza" novalidate>' +
      '<div class="fila2"><label>Aseguradora<input type="text" name="aseguradora" list="aseguradoras" maxlength="80"></label><label>Número de póliza<input type="text" name="numero" maxlength="60"></label></div>' +
      '<div class="fila2"><label>Vigencia desde<input type="date" name="desde"></label><label>Vigencia hasta<input type="date" name="hasta"></label></div>' +
      '<div class="fila2"><label>Prima anual (COP)<input type="text" name="prima" inputmode="numeric" maxlength="20"></label><label>PDF de la póliza<input type="file" name="archivo" accept="' + L.ACEPTA + '"></label></div>' +
      '<label class="check"><input type="checkbox" name="vigente" checked> Marcar la solicitud como Póliza vigente</label>' +
      '<datalist id="aseguradoras"><option>AXA Colpatria</option><option>SURA</option><option>Allianz</option><option>Mapfre</option><option>HDI</option><option>Liberty</option><option>Seguros Bolívar</option><option>Seguros del Estado</option><option>La Equidad</option></datalist>' +
      '<div class="msg" role="alert"></div><button class="btn btn-s" type="submit">Registrar póliza</button></form>' +
      (polizas.length ? '<h3 class="sub">Pólizas de este cliente</h3><ul class="docs">' + polizas.map(function (x) { return '<li><span>' + E(x.aseguradora) + ' · ' + E(x.numero || 's/n') + '<small>' + L.fecha(x.vigencia_desde) + ' – ' + L.fecha(x.vigencia_hasta) + ' · ' + L.pesos(x.prima) + '</small></span>' + (x.archivo_ruta ? '<button type="button" class="btn btn-s" data-ruta="' + E(x.archivo_ruta) + '">Ver</button>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      '</div></div><div>' +
      '<div class="tarjeta"><h3>Historial</h3>' + historial(d.eventos) + '</div>' +
      '<div class="tarjeta"><h3>Conversación</h3>' + charla(d.mensajes) + '</div>' +
      '</div></div>';

    z.querySelectorAll('[data-ruta]').forEach(function (b) { b.addEventListener('click', function () { L.abrirArchivo(b.getAttribute('data-ruta')); }); });
    var ba = $('btnAtendida');
    if (ba) ba.addEventListener('click', async function () {
      ba.disabled = true;
      try { await L.actualizarSolicitud(s.id, s.estado); await abrir(s.id); }
      catch (e) { ba.disabled = false; window.alert(L.error(e)); }
    });
    var charlaEl = z.querySelector('.charla');
    if (charlaEl) charlaEl.scrollTop = charlaEl.scrollHeight;

    $('fActualizar').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      if (b.disabled) return;
      var link = f.link.value.trim(), ref = f.ref.value.trim(), nota = f.nota.value.trim(), archivos;
      if (link && !/^https?:\/\//i.test(link)) return mensaje(f, 'El link de pago debe empezar por https://');
      if (f.estado.value === 'pago_pendiente' && !link && !ref) return mensaje(f, 'Para "Pago pendiente" escriba el link o la referencia de pago.');
      try { archivos = archivosDe(f.archivo); } catch (e) { return mensaje(f, e.message); }
      if (f.estado.value === s.estado && !nota && !archivos.length && link === (s.link_pago || '') && ref === (s.referencia_pago || '')) return mensaje(f, 'No hay cambios para guardar.');
      b.disabled = true; mensaje(f, archivos.length ? 'Subiendo archivos…' : 'Guardando…', true);
      try {
        for (var i = 0; i < archivos.length; i++) {
          await L.subirArchivo(archivos[i], { usuarioId: s.usuario_id, solicitudId: s.id, tipo: f.tipo.value, subidoPor: 'asesor' });
        }
        if (archivos.length && !nota) nota = 'Se adjuntó: ' + archivos.map(function (a) { return a.name; }).join(', ');
        var nueva = await L.actualizarSolicitud(s.id, f.estado.value, nota, link, ref);
        var i2 = todas.findIndex(function (x) { return x.id === s.id; });
        if (i2 >= 0) todas[i2] = nueva;
        actual = nueva;
        pintarContadores();
        pintarLista();
        f.querySelectorAll('input, select, textarea, button').forEach(function (c) { c.disabled = true; });
        var insignia = z.querySelector('.det-cab .badge'), aviso = z.querySelector('.aviso-atencion');
        if (insignia) { insignia.textContent = L.ESTADOS[nueva.estado] || nueva.estado; insignia.className = 'badge est-' + nueva.estado; }
        if (aviso) aviso.remove();
        mensaje(f, 'Guardado. El cliente ya lo ve en su cuenta. Avísele:', true);
        mostrarAvisos(nueva, nota);
      } catch (e) { mensaje(f, L.error(e)); b.disabled = false; }
    });

    $('fPoliza').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      if (b.disabled) return;
      var aseg = f.aseguradora.value.trim(), archivos;
      if (!aseg) return mensaje(f, 'Escriba la aseguradora.');
      if (f.desde.value && f.hasta.value && f.hasta.value < f.desde.value) return mensaje(f, 'La vigencia termina antes de empezar. Revise las fechas.');
      try { archivos = archivosDe(f.archivo); } catch (e) { return mensaje(f, e.message); }
      b.disabled = true; mensaje(f, 'Guardando…', true);
      try {
        var ruta = null;
        if (archivos[0]) ruta = (await L.subirArchivo(archivos[0], { usuarioId: s.usuario_id, solicitudId: s.id, tipo: 'poliza_emitida', subidoPor: 'asesor' })).ruta;
        var prima = f.prima.value.replace(/\D/g, '');
        await L.registrarPoliza({
          usuario_id: s.usuario_id, solicitud_id: s.id, aseguradora: aseg,
          numero: f.numero.value.trim() || null, vigencia_desde: f.desde.value || null, vigencia_hasta: f.hasta.value || null,
          prima: prima ? Number(prima) : null, archivo_ruta: ruta
        });
        var nota = 'Su póliza de ' + aseg + (f.numero.value.trim() ? ' N.º ' + f.numero.value.trim() : '') + ' quedó registrada. La encuentra en Mi cuenta, pestaña Pólizas.';
        var nueva = await L.actualizarSolicitud(s.id, f.vigente.checked ? 'vigente' : s.estado, nota);
        await abrir(s.id);
        mostrarAvisos(nueva, nota);
      } catch (e) { mensaje(f, L.error(e)); b.disabled = false; }
    });
  }

  function mostrarAvisos(s, nota) {
    var z = $('avisar');
    if (!z) return;
    var p = perfiles[s.usuario_id] || {};
    var cuerpo = textoAviso(s, nota);
    var asunto = 'Su solicitud #' + s.numero + ' — ' + L.ESTADOS[s.estado];
    var cel = celularWa(p.celular);
    z.innerHTML =
      (p.correo ? '<a class="btn btn-p" id="avisoCorreo" href="mailto:' + encodeURIComponent(p.correo).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo) + '">Avisar por correo</a>' : '') +
      (cel ? '<a class="btn btn-v" id="avisoWa" target="_blank" rel="noopener" href="https://wa.me/' + cel + '?text=' + encodeURIComponent(cuerpo) + '">Avisar por WhatsApp</a>' : '') +
      '<button type="button" class="btn btn-t" id="btnReabrir">Listo, ver la solicitud</button>';
    z.classList.remove('oculto');
    $('btnReabrir').addEventListener('click', function () { abrir(s.id); });
    z.scrollIntoView({ block: 'nearest' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
