/* Panel del asesor — LPJ */
(function () {
  'use strict';
  var C = window.LPJ_CONFIG || {};
  var L = window.LPJ;
  var E = L.escapar;
  var todas = [], perfiles = {}, filtro = 'atender', actual = null, saliendo = false;
  var aliados = {};   // usuario_id -> fila de aliados

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
    $('btnAliados').addEventListener('click', verAliados);
    $('btnVolverPanel').addEventListener('click', function () { ver('vAliados', false); ver('vPanel', true); });
    $('fNuevoAliado').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]'), correo = f.correo.value.trim().toLowerCase();
      var pct = f.pct.value.replace(',', '.').trim();
      if (!correo) return mensaje(f, 'Escriba el correo de la cuenta.');
      if (!(Number(pct) > 0 && Number(pct) <= 100)) return mensaje(f, 'El porcentaje va de 1 a 100.');
      b.disabled = true; mensaje(f, '');
      try {
        var p = await L.perfilPorCorreo(correo);
        if (!p) { mensaje(f, 'No hay una cuenta con ese correo. Primero debe crearla en laprimajusta.co.'); }
        else { await L.hacerAliado(p.id, p.empresa || p.nombre || '', Number(pct)); f.correo.value = ''; f.pct.value = '60'; mensaje(f, 'Listo, quedó como aliado.', true); await pintarAliados(); }
      } catch (e) { mensaje(f, L.error(e)); }
      b.disabled = false;
    });
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
    ['vPanel', 'btnSalir', 'btnRecargar', 'btnAliados'].forEach(function (i) { ver(i, true); });
    await cargar();
    window.setInterval(refrescarLista, 90000);
  }

  async function verAliados() {
    ver('vPanel', false); ver('vAliados', true);
    await pintarAliados();
  }

  async function pintarAliados() {
    var cont = $('listaAliados');
    cont.innerHTML = '<p class="nada">Cargando…</p>';
    await cargarAliados();
    var ids = Object.keys(aliados), faltan = ids.filter(function (id) { return !perfiles[id]; });
    if (faltan.length) { try { (await L.perfiles(faltan)).forEach(function (p) { perfiles[p.id] = p; }); } catch (e) { /* sin perfiles */ } }
    if (!ids.length) { cont.innerHTML = '<div class="vacio">Todavía no hay aliados.</div>'; return; }
    ids.sort(function (a, b) { return String(aliados[a].nombre || '').localeCompare(String(aliados[b].nombre || '')); });
    cont.innerHTML = ids.map(function (id) {
      var a = aliados[id], p = perfiles[id] || {};
      return '<div class="tarjeta"><form class="form" data-id="' + E(id) + '" novalidate>' +
        '<p class="ayuda">' + E(p.correo || '') + (p.celular ? ' · ' + E(p.celular) : '') + ' · desde ' + E(L.fecha(a.creado)) + '</p>' +
        '<div class="fila2"><label>Nombre del aliado<input type="text" name="nombre" maxlength="120" value="' + E(a.nombre || p.nombre || '') + '"></label>' +
        '<label>% de comisión<input type="text" name="porcentaje" inputmode="decimal" maxlength="6" value="' + E(a.porcentaje == null ? '' : String(a.porcentaje)) + '"></label></div>' +
        '<div class="acciones"><button class="btn btn-s" type="submit">Guardar</button><button class="btn btn-t" type="button" data-quitar="1">Ya no es aliado</button></div><div class="msg"></div></form></div>';
    }).join('');
    cont.querySelectorAll('form').forEach(function (f) {
      var id = f.getAttribute('data-id');
      f.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var pct = f.porcentaje.value.replace(',', '.').trim();
        if (!(Number(pct) > 0 && Number(pct) <= 100)) return mensaje(f, 'El porcentaje va de 1 a 100.');
        try { await L.hacerAliado(id, f.nombre.value.trim(), Number(pct)); aliados[id].porcentaje = Number(pct); mensaje(f, 'Guardado.', true); }
        catch (e) { mensaje(f, L.error(e)); }
      });
      f.querySelector('[data-quitar]').addEventListener('click', async function () {
        if (!window.confirm('¿Quitar esta cuenta como aliado? Sus clientes y negocios no se borran.')) return;
        try { await L.quitarAliado(id); await pintarAliados(); } catch (e) { mensaje(f, L.error(e)); }
      });
    });
  }

  async function cargarAliados() {
    try { aliados = {}; (await L.aliados()).forEach(function (a) { aliados[a.usuario_id] = a; }); } catch (e) { /* sin aliados */ }
  }

  async function cargar() {
    await cargarAliados();
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
      return ['#' + s.numero, s.empresa, s.cliente_nit, p.correo, p.nombre, p.celular, p.empresa, aliados[s.usuario_id] ? 'aliado ' + (aliados[s.usuario_id].nombre || '') : ''].join(' ').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (b.atencion ? 1 : 0) - (a.atencion ? 1 : 0) || (a.actualizado < b.actualizado ? 1 : -1); });
    if (!lista.length) {
      $('lista').innerHTML = '<div class="vacio">' + (filtro === 'atender' && !q ? 'No hay solicitudes por atender.' : 'No hay solicitudes en este filtro.') + '</div>';
      return;
    }
    $('lista').innerHTML = lista.map(function (s) {
      var p = perfiles[s.usuario_id] || {};
      return '<button type="button" class="item-sol' + (actual && actual.id === s.id ? ' act' : '') + '" data-id="' + E(s.id) + '">' +
        '<span class="item-num">' + (s.atencion ? '<i class="punto" title="Por atender"></i>' : '') + '#' + E(s.numero) + '</span>' +
        '<span class="item-txt"><strong>' + E(s.empresa || p.empresa || '—') + '</strong><span>' + E(L.TIPOS_SOLICITUD[s.tipo] || s.tipo) + ' · ' + (aliados[s.usuario_id] ? 'Aliado ' + E(aliados[s.usuario_id].nombre || p.nombre || '') : E(p.nombre || p.correo || '')) + ' · ' + L.fecha(s.actualizado) + '</span></span>' +
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
    l.push('', 'Puede ver el detalle y los documentos en: ' + C.sitio + '/mi-cuenta.html#s=' + s.id, '', 'Cordial saludo,', C.nombreAsesor, 'LPJ Consultores · ' + C.whatsappVisible);
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
    var estadoDocs = [];
    var ali = aliados[s.usuario_id] || null;
    var nitCliente = ali ? (s.cliente_nit || '') : '';
    try { polizas = await L.polizasDe(s.usuario_id); } catch (e) { polizas = []; }
    if (ali) polizas = polizas.filter(function (x) { return x.solicitud_id === s.id || (nitCliente && x.cliente_nit === nitCliente); });
    var cuotas = [], comis = [];
    try { cuotas = (await L.carteraDe(s.usuario_id)).filter(function (c) { return polizas.some(function (x) { return x.id === c.poliza_id; }); }); } catch (e) { cuotas = []; }
    if (ali) { try { comis = (await L.comisionesDe(s.usuario_id)).filter(function (c) { return polizas.some(function (x) { return x.id === c.poliza_id; }); }); } catch (e) { comis = []; } }
    try { estadoDocs = L.estadoDocumentos(await L.documentosDe(s.usuario_id, nitCliente || null), { conSarlaft: true, solicitudId: s.id }); } catch (e) { estadoDocs = []; }
    var etq = { al_dia: 'Al día', vencido: 'Vencido', falta: 'Falta' };
    var tarjetaDocs = '<div class="tarjeta"><h3>Documentos para emitir</h3>' + (estadoDocs.length ? '<ul class="docs docs-estado">' + estadoDocs.map(function (x) {
      var det = x.estado === 'falta' ? x.nota : (x.vence ? (x.estado === 'al_dia' ? 'Sirve hasta el ' : 'Venció el ') + L.fecha(x.vence.toISOString()) : 'Subido el ' + L.fecha(x.archivo.creado));
      return '<li><span>' + E(x.nombre) + ' <b class="doc-' + x.estado + '">' + etq[x.estado] + '</b><small>' + E(det) + '</small></span>' +
        (x.archivo ? '<button type="button" class="btn btn-s" data-ruta="' + E(x.archivo.ruta) + '">Ver</button>' : '') + '</li>';
    }).join('') + '</ul><p class="ayuda">Para cargar un documento del cliente use "Adjuntar archivos" y elija su tipo. El SARLAFT cuenta solo si se subió en esta solicitud.</p>' : '<p class="nada">No se pudieron leer.</p>') + '</div>';

    z.innerHTML =
      '<div class="det-cab"><div><h2>#' + E(s.numero) + ' · ' + E(s.empresa || p.empresa || '—') + '</h2><p>' + E(L.TIPOS_SOLICITUD[s.tipo] || s.tipo) + ' · Creada el ' + L.fecha(s.creado, true) + ' · Actualizada el ' + L.fecha(s.actualizado, true) + '</p></div>' +
      '<span class="badge est-' + E(s.estado) + '">' + E(L.ESTADOS[s.estado] || s.estado) + '</span></div>' +
      (s.atencion ? '<div class="aviso-atencion"><span>' + (s.estado === 'cancelada' ? 'El cliente canceló esta solicitud.' : 'El cliente está esperando su respuesta.') + '</span><button type="button" class="enlace" id="btnAtendida">Marcar como atendida</button></div>' : '') +

      (ali ? '<div class="tarjeta"><h3>Cliente del aliado</h3><dl class="kv"><dt>Cliente</dt><dd>' + E(s.empresa || '—') + '</dd><dt>NIT o cédula</dt><dd>' + E(s.cliente_nit || 'No lo escribió') + '</dd></dl>' +
        '<p class="ayuda">El cliente no tiene cuenta: todo lo ve el aliado en su cuenta.</p></div>' : '') +
      '<div class="tarjeta"><h3>' + (ali ? 'Aliado que trajo el negocio' + (ali.porcentaje ? ' · ' + E(String(ali.porcentaje)) + '% de comisión' : '') : 'Cliente') + '</h3><dl class="kv">' +
      '<dt>Nombre</dt><dd>' + E(p.nombre || '—') + '</dd>' +
      '<dt>Empresa</dt><dd>' + E(p.empresa || '—') + (p.nit ? ' · NIT ' + E(p.nit) : '') + '</dd>' +
      '<dt>Correo</dt><dd>' + (p.correo ? '<a href="mailto:' + encodeURIComponent(p.correo).replace(/%40/g, '@') + '">' + E(p.correo) + '</a>' : '—') + '</dd>' +
      '<dt>Celular</dt><dd>' + (cel ? '<a href="https://wa.me/' + cel + '" target="_blank" rel="noopener">' + E(p.celular) + '</a>' : E(p.celular || '—')) + '</dd>' +
      '<dt>Autorizó tratamiento de datos</dt><dd>' + (p.autoriza_datos ? L.fecha(p.autoriza_datos, true) : 'No registra') + '</dd></dl>' +
      '<form class="form form-aliado" id="fAliado" novalidate>' + (ali
        ? '<p class="ayuda">Esta cuenta es de aliado.</p><div class="fila2"><label>Nombre del aliado<input type="text" name="nombre" maxlength="120" value="' + E(ali.nombre || '') + '"></label><label>% de comisión para el aliado<input type="text" name="porcentaje" inputmode="decimal" maxlength="6" value="' + E(ali.porcentaje == null ? '' : String(ali.porcentaje)) + '"></label></div><div class="acciones"><button class="btn btn-s" type="submit">Guardar aliado</button><button class="btn btn-s" type="button" id="btnQuitarAliado">Ya no es aliado</button></div>'
        : '<button class="btn btn-s" type="submit">Marcar esta cuenta como aliado</button>') +
      '<div class="msg" role="alert"></div></form></div>' +

      '<div class="tarjeta"><h3>Responder y actualizar</h3><form class="form" id="fActualizar" novalidate>' +
      '<label>Estado<select name="estado">' + Object.keys(L.ESTADOS).map(function (k) { return '<option value="' + k + '"' + (k === s.estado ? ' selected' : '') + '>' + E(L.ESTADOS[k]) + '</option>'; }).join('') + '</select></label>' +
      '<label>Nota para el cliente (la verá en su cuenta)<textarea name="nota" maxlength="2000" placeholder="Ej.: Le enviamos 3 opciones; la de AXA Colpatria mejora la RC y baja la prima."></textarea></label>' +
      '<div class="fila2"><label>Link de pago de la aseguradora<input type="url" name="link" placeholder="https://…" value="' + E(s.link_pago || '') + '"></label>' +
      '<label>Referencia de pago<input type="text" name="ref" maxlength="120" value="' + E(s.referencia_pago || '') + '"></label></div>' +
      '<div class="fila2"><label>Adjuntar archivos' + L.campoArchivo(true) + '</label>' +
      '<label>Tipo de archivo<select name="tipo"><option value="cotizacion">Cotización</option><option value="poliza_emitida">Póliza emitida</option><option value="recibo_pago">Recibo de pago</option>' +
      L.DOCUMENTOS.map(function (x) { return '<option value="' + x.tipo + '">' + E(x.nombre) + ' (del cliente)</option>'; }).join('') +
      '<option value="otro">Otro</option></select></label></div>' +
      '<div class="msg" role="alert"></div><button class="btn btn-p" type="submit">Guardar</button></form>' +
      '<div id="avisar" class="acciones oculto"></div></div>' +

      '<div class="grid2"><div>' +
      '<div class="tarjeta"><h3>Datos de la solicitud</h3><dl class="kv">' + L.filasDatos(s.datos).map(function (r) { return '<dt>' + E(r[0]) + '</dt><dd>' + E(r[1]) + '</dd>'; }).join('') + '</dl>' +
      (s.ajustes && s.ajustes.length ? '<h3 class="sub">Ajustes pedidos</h3><ul class="hist">' + s.ajustes.map(function (a) { return '<li><small>' + L.fecha(a.fecha, true) + '</small><p>' + E(a.texto) + '</p></li>'; }).join('') + '</ul>' : '') +
      (s.opcion_elegida ? '<p class="elegida">Opción elegida para emitir: <b>' + E(s.opcion_elegida) + '</b></p>' : '') + '</div>' +
      tarjetaDocs +
      '<div class="tarjeta"><h3>Archivos de esta solicitud</h3>' + docs(d.archivos) + '</div>' +
      '<div class="tarjeta"><h3>Registrar póliza emitida</h3><form class="form" id="fPoliza" novalidate>' +
      '<div class="fila2"><label>Aseguradora<input type="text" name="aseguradora" list="aseguradoras" maxlength="80"></label><label>Número de póliza<input type="text" name="numero" maxlength="60"></label></div>' +
      '<div class="fila2"><label>Vigencia desde<input type="date" name="desde"></label><label>Vigencia hasta<input type="date" name="hasta"></label></div>' +
      '<div class="fila2"><label>Prima anual (COP)<input type="text" name="prima" inputmode="numeric" maxlength="20"></label><label>PDF de la póliza' + L.campoArchivo(false) + '</label></div>' +
      '<label class="check"><input type="checkbox" name="vigente" checked> Marcar la solicitud como Póliza vigente</label>' +
      '<datalist id="aseguradoras"><option>AXA Colpatria</option><option>SURA</option><option>Allianz</option><option>Mapfre</option><option>HDI</option><option>Liberty</option><option>Seguros Bolívar</option><option>Seguros del Estado</option><option>La Equidad</option></datalist>' +
      '<div class="msg" role="alert"></div><button class="btn btn-s" type="submit">Registrar póliza</button></form>' +
      (polizas.length ? '<h3 class="sub">Pólizas de este cliente</h3><ul class="docs">' + polizas.map(function (x) { return '<li><span>' + E(x.aseguradora) + ' · ' + E(x.numero || 's/n') + '<small>' + L.fecha(x.vigencia_desde) + ' – ' + L.fecha(x.vigencia_hasta) + ' · ' + L.pesos(x.prima) + '</small></span>' + (x.archivo_ruta ? '<button type="button" class="btn btn-s" data-ruta="' + E(x.archivo_ruta) + '">Ver</button>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      '</div>' + tarjetaPagos(polizas, cuotas, ali, comis) +
      '</div><div>' +
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

    enlazarPagos(s, polizas, ali);
    $('fAliado').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      var pct = f.porcentaje ? f.porcentaje.value.replace(',', '.').trim() : '';
      if (pct && !(Number(pct) > 0 && Number(pct) <= 100)) return mensaje(f, 'El porcentaje va de 1 a 100.');
      b.disabled = true;
      try {
        await L.hacerAliado(s.usuario_id, f.nombre ? f.nombre.value.trim() : (p.empresa || p.nombre || ''), pct ? Number(pct) : (ali ? null : 60));
        await cargarAliados(); await abrir(s.id);
      } catch (e) { b.disabled = false; mensaje(f, L.error(e)); }
    });
    if ($('btnQuitarAliado')) $('btnQuitarAliado').addEventListener('click', async function () {
      this.disabled = true;
      try { await L.quitarAliado(s.usuario_id); await cargarAliados(); await abrir(s.id); } catch (e) { this.disabled = false; mensaje($('fAliado'), L.error(e)); }
    });
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
          await L.subirArchivo(archivos[i], { usuarioId: s.usuario_id, solicitudId: s.id, tipo: f.tipo.value, subidoPor: 'asesor', clienteNit: nitCliente || null });
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
        if (archivos[0]) ruta = (await L.subirArchivo(archivos[0], { usuarioId: s.usuario_id, solicitudId: s.id, tipo: 'poliza_emitida', subidoPor: 'asesor', clienteNit: nitCliente || null })).ruta;
        var prima = f.prima.value.replace(/\D/g, '');
        await L.registrarPoliza({
          usuario_id: s.usuario_id, solicitud_id: s.id, aseguradora: aseg,
          numero: f.numero.value.trim() || null, vigencia_desde: f.desde.value || null, vigencia_hasta: f.hasta.value || null,
          prima: prima ? Number(prima) : null, archivo_ruta: ruta,
          cliente: ali ? (s.empresa || null) : null, cliente_nit: nitCliente || null
        });
        var nota = 'Su póliza de ' + aseg + (f.numero.value.trim() ? ' N.º ' + f.numero.value.trim() : '') + ' quedó registrada. La encuentra en Mi cuenta, pestaña Pólizas.';
        var nueva = await L.actualizarSolicitud(s.id, f.vigente.checked ? 'vigente' : s.estado, nota);
        await abrir(s.id);
        mostrarAvisos(nueva, nota);
      } catch (e) { mensaje(f, L.error(e)); b.disabled = false; }
    });
  }

  // ---------- Pagos (cartera) y comisiones de las pólizas de esta solicitud ----------
  function opcionesPoliza(polizas) {
    return polizas.map(function (x) {
      return '<option value="' + E(x.id) + '">' + E(x.aseguradora + ' · ' + (x.numero || 's/n') + ' · ' + L.pesos(x.prima)) + '</option>';
    }).join('');
  }

  function tarjetaPagos(polizas, cuotas, ali, comis) {
    if (!polizas.length) return '<div class="tarjeta"><h3>Pagos' + (ali ? ' y comisión' : '') + '</h3><p class="nada">Registre primero la póliza emitida.</p></div>';
    var etq = { pagada: 'Pagada', vencida: 'Vencida', por_vencer: 'Por vencer', pendiente: 'Pendiente' };
    var h = '<div class="tarjeta"><h3>Pagos del cliente</h3>' +
      (cuotas.length ? '<ul class="docs">' + cuotas.map(function (c) {
        var e = L.estadoCuota(c);
        return '<li><span>' + E(c.concepto) + ' · ' + L.pesos(c.valor) + ' <b class="badge cuota-b-' + e + '">' + etq[e] + '</b><small>' +
          (e === 'pagada' ? 'Pagada el ' + L.fecha(c.fecha_pago) : 'Pagar antes del ' + L.fecha(c.fecha_limite)) + (c.medio ? ' · ' + E(c.medio) : '') + '</small></span>' +
          '<span class="acciones">' + (e === 'pagada'
            ? '<button type="button" class="btn btn-s" data-cuota="' + E(c.id) + '" data-hacer="pendiente">Deshacer</button>'
            : '<button type="button" class="btn btn-s" data-cuota="' + E(c.id) + '" data-hacer="pagada">Marcar pagada</button>') +
          '<button type="button" class="btn btn-s" data-cuota="' + E(c.id) + '" data-hacer="anulada">Anular</button></span></li>';
      }).join('') + '</ul>' : '<p class="nada">Sin cuotas registradas.</p>') +
      '<form class="form" id="fCuota" novalidate><h3 class="sub">Registrar cuota o pago</h3>' +
      '<label>Póliza<select name="poliza">' + opcionesPoliza(polizas) + '</select></label>' +
      '<div class="fila2"><label>Concepto<input type="text" name="concepto" maxlength="200" placeholder="Contado · Financiada con Finesa"></label><label>Valor de cada cuota (COP)<input type="text" name="valor" inputmode="numeric" maxlength="20"></label></div>' +
      '<div class="fila2"><label>Pagar antes del<input type="date" name="limite"></label><label>Medio de pago<input type="text" name="medio" maxlength="200" placeholder="Link AXA, PSE, financiera…"></label></div>' +
      '<div class="fila2"><label>Número de cuotas mensuales<input type="number" name="n" min="1" max="12" value="1"></label><label class="check"><input type="checkbox" name="pagada"> La primera ya está pagada</label></div>' +
      '<div class="msg" role="alert"></div><button class="btn btn-s" type="submit">Guardar</button></form></div>';
    if (!ali) return h;
    var etc = { causada: 'Esperando pago de la aseguradora', recibida: 'Recibida, por girar', girada: 'Girada al aliado' };
    h += '<div class="tarjeta"><h3>Comisión del aliado</h3>' +
      (comis.length ? '<ul class="docs">' + comis.map(function (c) {
        var sig = c.estado === 'causada' ? ['recibida', 'La aseguradora pagó'] : c.estado === 'recibida' ? ['girada', 'Marcar girada'] : null;
        return '<li><span>' + E(c.aseguradora || '') + ' · ' + L.pesos(c.valor) + (c.porcentaje ? ' (' + E(String(c.porcentaje)) + '%)' : '') +
          ' <b class="badge com-' + E(c.estado) + '">' + etc[c.estado] + '</b>' + (c.fecha_girada ? '<small>Girada el ' + L.fecha(c.fecha_girada) + '</small>' : '') + '</span>' +
          (sig ? '<span class="acciones"><button type="button" class="btn btn-s" data-comision="' + E(c.id) + '" data-hacer="' + sig[0] + '">' + sig[1] + '</button></span>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="nada">Sin comisión registrada.</p>') +
      '<form class="form" id="fComision" novalidate><h3 class="sub">Registrar comisión</h3>' +
      '<label>Póliza<select name="poliza">' + opcionesPoliza(polizas) + '</select></label>' +
      '<div class="fila2"><label>Comisión que paga la aseguradora a LPJ (COP)<input type="text" name="base" inputmode="numeric" maxlength="20"></label><label>% para el aliado<input type="text" name="pct" inputmode="decimal" maxlength="6" value="' + E(ali.porcentaje == null ? '' : String(ali.porcentaje)) + '"></label></div>' +
      '<div class="fila2"><label>Valor para el aliado (COP)<input type="text" name="valor" inputmode="numeric" maxlength="20"></label><label>Nota<input type="text" name="nota" maxlength="200"></label></div>' +
      '<div class="msg" role="alert"></div><button class="btn btn-s" type="submit">Guardar comisión</button></form></div>';
    return h;
  }

  function sumarMeses(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1 + n, Number(m[3]));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function enlazarPagos(s, polizas, ali) {
    var z = $('detalle');
    z.querySelectorAll('[data-cuota]').forEach(function (b) {
      b.addEventListener('click', async function () {
        b.disabled = true;
        var hacer = b.getAttribute('data-hacer');
        try {
          await L.guardarCartera({ id: b.getAttribute('data-cuota'), estado: hacer, fecha_pago: hacer === 'pagada' ? hoyIso() : null });
          await abrir(s.id);
        } catch (e) { b.disabled = false; window.alert(L.error(e)); }
      });
    });
    z.querySelectorAll('[data-comision]').forEach(function (b) {
      b.addEventListener('click', async function () {
        b.disabled = true;
        var hacer = b.getAttribute('data-hacer'), fila = { id: b.getAttribute('data-comision'), estado: hacer };
        if (hacer === 'girada') fila.fecha_girada = hoyIso();
        try { await L.guardarComision(fila); await abrir(s.id); } catch (e) { b.disabled = false; window.alert(L.error(e)); }
      });
    });
    var fc = $('fCuota');
    if (fc) fc.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var f = ev.target, b = f.querySelector('[type=submit]');
      var valor = Number(f.valor.value.replace(/\D/g, '')), n = Math.max(1, Math.min(12, Number(f.n.value) || 1));
      if (!f.concepto.value.trim()) return mensaje(f, 'Escriba el concepto (ej.: Contado, Financiada con Finesa).');
      if (!valor) return mensaje(f, 'Escriba el valor.');
      if (n > 1 && !f.limite.value) return mensaje(f, 'Para varias cuotas ponga la fecha de la primera.');
      var pol = polizas.filter(function (x) { return x.id === f.poliza.value; })[0];
      b.disabled = true; mensaje(f, 'Guardando…', true);
      try {
        for (var i = 0; i < n; i++) {
          var pagada = f.pagada.checked && i === 0;
          await L.guardarCartera({
            usuario_id: s.usuario_id, poliza_id: f.poliza.value, cliente: ali ? (pol && pol.cliente) || s.empresa || null : null,
            concepto: n > 1 ? f.concepto.value.trim() + ' — cuota ' + (i + 1) + ' de ' + n : f.concepto.value.trim(),
            valor: valor, fecha_limite: f.limite.value ? sumarMeses(f.limite.value, i) : null, medio: f.medio.value.trim() || null,
            estado: pagada ? 'pagada' : 'pendiente', fecha_pago: pagada ? hoyIso() : null
          });
        }
        await abrir(s.id);
      } catch (e) { b.disabled = false; mensaje(f, L.error(e)); }
    });
    var fm = $('fComision');
    if (fm) {
      var calc = function () {
        var base = Number(fm.base.value.replace(/\D/g, '')), pct = Number(fm.pct.value.replace(',', '.'));
        if (base && pct) fm.valor.value = String(Math.round(base * pct / 100));
      };
      fm.base.addEventListener('input', calc); fm.pct.addEventListener('input', calc);
      fm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var f = ev.target, b = f.querySelector('[type=submit]');
        var valor = Number(f.valor.value.replace(/\D/g, ''));
        if (!valor) return mensaje(f, 'Escriba el valor para el aliado.');
        var pol = polizas.filter(function (x) { return x.id === f.poliza.value; })[0] || {};
        var pct = Number(f.pct.value.replace(',', '.'));
        b.disabled = true; mensaje(f, 'Guardando…', true);
        try {
          await L.guardarComision({
            aliado_id: s.usuario_id, poliza_id: pol.id || null, cliente: pol.cliente || s.empresa || null, aseguradora: pol.aseguradora || null,
            prima: pol.prima || null, porcentaje: pct || null, valor: valor, estado: 'causada', nota: f.nota.value.trim() || null
          });
          await abrir(s.id);
        } catch (e) { b.disabled = false; mensaje(f, L.error(e)); }
      });
    }
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
