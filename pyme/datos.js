/* Capa de datos del portal PYME: todas las llamadas a Supabase y los avisos al asesor pasan por aquí. */
(function () {
  'use strict';
  var C = window.LPJ_CONFIG || {};
  // Se guarda antes de crear el cliente, porque Supabase borra el fragmento de la dirección al leer la sesión.
  var hashInicial = window.location.hash || '';
  var sb = null;
  if (C.supabaseUrl && C.supabaseKey && window.supabase && window.supabase.createClient) {
    try {
      sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } catch (e) { sb = null; }
  }

  var ESTADOS = {
    recibida: 'Recibida',
    en_analisis: 'En análisis',
    cotizada: 'Cotización enviada',
    ajustes_solicitados: 'Ajustes solicitados',
    emision_solicitada: 'Emisión solicitada',
    en_emision: 'En emisión',
    pago_pendiente: 'Pago pendiente',
    pago_reportado: 'Pago reportado',
    vigente: 'Póliza vigente',
    cancelada: 'Cancelada'
  };
  // Etapas que se muestran en la barra de avance del cliente.
  var ETAPAS = [
    { id: 'recibida', txt: 'Recibida', incluye: ['recibida'] },
    { id: 'en_analisis', txt: 'En análisis', incluye: ['en_analisis'] },
    { id: 'cotizada', txt: 'Cotización', incluye: ['cotizada', 'ajustes_solicitados'] },
    { id: 'emision', txt: 'Emisión', incluye: ['emision_solicitada', 'en_emision'] },
    { id: 'pago', txt: 'Pago', incluye: ['pago_pendiente', 'pago_reportado'] },
    { id: 'vigente', txt: 'Vigente', incluye: ['vigente'] }
  ];
  var TIPOS_ARCHIVO = {
    poliza_actual: 'Póliza actual',
    contrato: 'Contrato o requisitos',
    cotizacion: 'Cotización',
    poliza_emitida: 'Póliza emitida',
    recibo_pago: 'Recibo de pago',
    comprobante_pago: 'Comprobante de pago',
    documento_cliente: 'Documento del cliente',
    rut: 'RUT',
    camara_comercio: 'Cámara de Comercio',
    cedula_rl: 'Cédula del representante legal',
    estados_financieros: 'Estados financieros',
    declaracion_renta: 'Declaración de renta',
    sarlaft: 'Formulario SARLAFT',
    otro: 'Otro'
  };
  // Documentos que piden las aseguradoras para emitir. dias = cuánto tiempo sirve desde que se subió (null = no vence).
  // El SARLAFT es de cada aseguradora: se pide por solicitud, cuando el cliente elige la opción a emitir.
  var DOCUMENTOS = [
    { tipo: 'rut', nombre: 'RUT', dias: 365, nota: 'actualizado' },
    { tipo: 'camara_comercio', nombre: 'Cámara de Comercio', dias: 30, nota: 'no mayor a 30 días' },
    { tipo: 'cedula_rl', nombre: 'Cédula del representante legal', dias: null, nota: 'por ambas caras' },
    { tipo: 'estados_financieros', nombre: 'Estados financieros', dias: 365, nota: 'del último cierre' },
    { tipo: 'declaracion_renta', nombre: 'Declaración de renta', dias: 365, nota: 'la última presentada' },
    { tipo: 'sarlaft', nombre: 'Formulario SARLAFT', dias: 365, nota: 'de la aseguradora elegida; su asesor se lo envía', porSolicitud: true }
  ];
  var TIPOS_SOLICITUD = { cotizacion: 'Cotización PYME', mejora: 'Mejora de póliza', renovacion: 'Renovación', otra: 'Otra' };
  var MIME = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    heic: 'image/heic', heif: 'image/heif', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  var MAX_ARCHIVO = 15 * 1024 * 1024;
  var CLAVE_PENDIENTE = 'lpj_solicitud_pendiente';

  function error(e, estado) {
    var m = (e && (e.message || e.msg || e.error_description)) || String(e || 'Error');
    estado = estado || (e && e.status) || 0;
    if (estado >= 500 || /AuthRetryableFetchError/.test((e && e.name) || '')) return 'El servicio no está disponible en este momento. Intente de nuevo en unos minutos.';
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme su correo con el enlace que le enviamos antes de ingresar.';
    if (/already registered|already been registered|user already exists/i.test(m)) return 'Ese correo ya tiene cuenta. Ingrese con su contraseña.';
    if (/Password should be|weak.?password/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.';
    if (/should be different from the old password/i.test(m)) return 'La contraseña nueva debe ser distinta de la anterior.';
    if (/rate limit|too many requests/i.test(m)) return 'Demasiados intentos. Espere unos minutos e intente de nuevo.';
    if (/email address.*not authorized/i.test(m)) return 'Por ahora no podemos enviarle ese correo. Escríbanos por WhatsApp al ' + (C.whatsappVisible || '') + ' y le ayudamos.';
    if (/invalid.*email|email.*invalid/i.test(m)) return 'Revise el correo: no parece válido.';
    if (/mime type|not supported/i.test(m)) return 'Ese tipo de archivo no se permite. Use PDF, foto, Word o Excel.';
    if (/maximum allowed size|Payload too large/i.test(m)) return 'El archivo supera 15 MB.';
    if (/resource already exists|duplicate/i.test(m)) return 'Ya existe un archivo con ese nombre. Intente de nuevo.';
    if (/row-level security|permission denied/i.test(m)) return 'No tiene permiso para esta acción.';
    if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(m)) return 'No hay conexión con el servidor. Revise su internet e intente de nuevo.';
    if (/JWT|session.*missing|not authenticated/i.test(m)) return 'Su sesión venció. Ingrese de nuevo.';
    return m;
  }
  function revisar(r) { if (r.error) throw new Error(error(r.error, r.status)); return r.data; }
  function exigir() { if (!sb) throw new Error('El portal aún no está conectado a la base de datos.'); }

  function extension(nombre) { var m = /\.([A-Za-z0-9]+)$/.exec(nombre || ''); return m ? m[1].toLowerCase() : ''; }
  function limpiarNombre(n) {
    return (n || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+/, '').slice(-80) || 'archivo';
  }

  var ACEPTA = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx';
  var SIN_ARCHIVO = 'Ningún archivo elegido';
  // Muestra junto al botón los nombres de los archivos elegidos.
  document.addEventListener('change', function (ev) {
    var inp = ev.target;
    var caja = inp && inp.type === 'file' ? inp.parentNode : null;
    if (!caja || !caja.classList || !caja.classList.contains('arch')) return;
    var nom = caja.querySelector('.arch-nom');
    if (!nom) return;
    var lista = Array.prototype.slice.call(inp.files || []).map(function (f) { return f.name; });
    nom.textContent = !lista.length ? SIN_ARCHIVO : lista.length === 1 ? lista[0] : lista.length + ' archivos: ' + lista.join(', ');
    caja.classList.toggle('con', lista.length > 0);
  });

  var LPJ = {
    configurado: !!sb,
    cliente: sb,
    hashInicial: hashInicial,
    ESTADOS: ESTADOS,
    ETAPAS: ETAPAS,
    TIPOS_ARCHIVO: TIPOS_ARCHIVO,
    DOCUMENTOS: DOCUMENTOS,
    TIPOS_SOLICITUD: TIPOS_SOLICITUD,
    ACEPTA: ACEPTA,
    error: error,

    // Campo para elegir archivos con los textos en español (el control del navegador sale en el idioma del equipo).
    campoArchivo: function (varios) {
      return '<span class="arch"><input type="file" name="archivo" title=""' + (varios ? ' multiple' : '') + ' accept="' + ACEPTA + '">' +
        '<span class="arch-btn">' + (varios ? 'Elegir archivos' : 'Elegir archivo') + '</span>' +
        '<span class="arch-nom">' + SIN_ARCHIVO + '</span></span>';
    },

    // Devuelve un texto con el problema del archivo, o '' si se puede subir.
    problemaArchivo: function (archivo) {
      if (!MIME[extension(archivo.name)]) return '"' + archivo.name + '" no es PDF, foto, Word ni Excel.';
      if (archivo.size > MAX_ARCHIVO) return '"' + archivo.name + '" supera 15 MB.';
      if (archivo.size === 0) return '"' + archivo.name + '" está vacío.';
      return '';
    },

    // ---------- Sesión ----------
    usuario: async function () {
      if (!sb) return null;
      try {
        var r = await sb.auth.getSession();
        return r.data && r.data.session ? r.data.session.user : null;
      } catch (e) { return null; }
    },
    alCambiarSesion: function (fn) { if (sb) sb.auth.onAuthStateChange(function (ev, s) { fn(s ? s.user : null, ev); }); },
    // Si falla por algo que el cliente puede corregir (correo repetido, contraseña débil) lanza un error normal.
    // Si falla porque el servicio de cuentas no responde, el error lleva noDisponible = true para que la
    // solicitud pueda seguir su camino por correo sin cuenta.
    registrar: async function (correo, clave, perfil) {
      exigir();
      var r;
      try {
        r = await sb.auth.signUp({ email: correo, password: clave, options: { data: perfil, emailRedirectTo: C.sitio + '/mi-cuenta.html' } });
      } catch (e) { r = { error: e }; }
      if (r.error) {
        var texto = String(r.error.message || r.error.msg || '') + ' ' + String(r.error.code || '');
        var fallo = new Error(error(r.error));
        fallo.noDisponible = !/already registered|already been registered|user.already.exists|email.exists|password|validate email|invalid format|email.address.invalid|invalid.{0,12}email/i.test(texto);
        throw fallo;
      }
      var d = r.data || {};
      // Si el correo ya existía y Supabase exige confirmar correos, devuelve un usuario sin identidades.
      if (d.user && Array.isArray(d.user.identities) && d.user.identities.length === 0) {
        throw new Error('Ese correo ya tiene cuenta. Ingrese con su contraseña.');
      }
      return { usuario: d.user, requiereConfirmar: !d.session };
    },
    ingresar: async function (correo, clave) {
      exigir();
      return revisar(await sb.auth.signInWithPassword({ email: correo, password: clave })).user;
    },
    salir: async function () { if (sb) { try { await sb.auth.signOut(); } catch (e) { /* la sesión local se borra igual */ } } },
    recuperarClave: async function (correo) {
      exigir();
      revisar(await sb.auth.resetPasswordForEmail(correo, { redirectTo: C.sitio + '/mi-cuenta.html' }));
    },
    cambiarClave: async function (clave) { exigir(); revisar(await sb.auth.updateUser({ password: clave })); },

    // ---------- Perfil ----------
    perfil: async function () {
      exigir();
      if (!(await LPJ.usuario())) return null;
      return revisar(await sb.rpc('mi_perfil', { p_autoriza: false }));
    },
    autorizarDatos: async function () {
      exigir();
      return revisar(await sb.rpc('mi_perfil', { p_autoriza: true }));
    },
    // Después de registrarse: devuelve el perfil y, si llegó sin datos, lo completa con los del formulario.
    completarPerfil: async function (datos) {
      var p = await LPJ.perfil();
      if (p && !p.nombre && datos && datos.nombre) {
        await LPJ.guardarPerfil(datos);
        p = await LPJ.autorizarDatos();
      }
      return p;
    },
    guardarPerfil: async function (cambios) {
      exigir();
      var u = await LPJ.usuario();
      var limpio = {};
      ['nombre', 'celular', 'empresa', 'nit'].forEach(function (k) { if (cambios[k] !== undefined) limpio[k] = String(cambios[k]).slice(0, 200); });
      if (!Object.keys(limpio).length) return;
      revisar(await sb.from('perfiles').update(limpio).eq('id', u.id));
    },

    // ---------- Solicitudes ----------
    crearSolicitud: async function (tipo, empresa, datos, ajustes, clienteNit) {
      exigir();
      var u = await LPJ.usuario();
      if (!u) throw new Error('Su sesión venció. Ingrese de nuevo.');
      var fila = {
        usuario_id: u.id, tipo: tipo, empresa: String(empresa || '').slice(0, 200), datos: datos || [],
        ajustes: (ajustes || []).map(function (t) { return { texto: String(t).slice(0, 2000), fecha: new Date().toISOString() }; })
      };
      if (clienteNit) fila.cliente_nit = String(clienteNit).slice(0, 40);
      return revisar(await sb.from('solicitudes').insert(fila).select().single());
    },
    misSolicitudes: async function () {
      exigir();
      var u = await LPJ.usuario();
      if (!u) return [];
      return revisar(await sb.from('solicitudes').select('*').eq('usuario_id', u.id).order('creado', { ascending: false }));
    },
    solicitud: async function (id) {
      exigir();
      var s = revisar(await sb.from('solicitudes').select('*').eq('id', id).single());
      var r = await Promise.all([
        sb.from('eventos').select('*').eq('solicitud_id', id).order('creado').order('id'),
        sb.from('archivos').select('*').eq('solicitud_id', id).order('creado'),
        sb.from('mensajes').select('*').eq('solicitud_id', id).order('creado').order('id')
      ]);
      return { solicitud: s, eventos: revisar(r[0]), archivos: revisar(r[1]), mensajes: revisar(r[2]) };
    },
    accionCliente: async function (id, accion, texto) {
      exigir();
      return revisar(await sb.rpc('accion_cliente', { p_solicitud: id, p_accion: accion, p_texto: texto || null }));
    },

    // ---------- Archivos ----------
    subirArchivo: async function (archivo, opciones) {
      exigir();
      var problema = LPJ.problemaArchivo(archivo);
      if (problema) throw new Error(problema);
      var u = await LPJ.usuario();
      if (!u) throw new Error('Su sesión venció. Ingrese de nuevo.');
      var duenio = opciones.usuarioId || u.id;
      var tipoMime = MIME[extension(archivo.name)];
      var cuerpo = archivo.type === tipoMime ? archivo : new Blob([archivo], { type: tipoMime });
      var ruta = duenio + '/' + (opciones.solicitudId || 'general') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '-' + limpiarNombre(archivo.name);
      revisar(await sb.storage.from('documentos').upload(ruta, cuerpo, { contentType: tipoMime, upsert: false }));
      return revisar(await sb.from('archivos').insert(Object.assign({
        usuario_id: duenio, solicitud_id: opciones.solicitudId || null, ruta: ruta,
        nombre: String(archivo.name).slice(0, 300), tipo: opciones.tipo || 'otro', subido_por: opciones.subidoPor || 'cliente'
      }, opciones.clienteNit ? { cliente_nit: String(opciones.clienteNit).slice(0, 40) } : {})).select().single());
    },
    // Documentos para emitir que el cliente ya tiene en su cuenta (de cualquier solicitud).
    // Con clienteNit (aliados) solo cuenta lo de ese cliente.
    documentosDe: async function (usuarioId, clienteNit) {
      exigir();
      var id = usuarioId || (await LPJ.usuario() || {}).id;
      if (!id) return [];
      var q = sb.from('archivos').select('*').eq('usuario_id', id).in('tipo', DOCUMENTOS.map(function (d) { return d.tipo; }));
      if (clienteNit) q = q.eq('cliente_nit', String(clienteNit));
      return revisar(await q.order('creado', { ascending: false }));
    },
    // Estado de cada documento: 'al_dia', 'vencido' o 'falta'. Con solicitudId, el SARLAFT cuenta solo si es de esa solicitud.
    estadoDocumentos: function (archivos, opciones) {
      opciones = opciones || {};
      var ahora = Date.now();
      return DOCUMENTOS.filter(function (d) { return !d.porSolicitud || opciones.conSarlaft; }).map(function (d) {
        var suyos = (archivos || []).filter(function (a) {
          return a.tipo === d.tipo && (!d.porSolicitud || a.solicitud_id === opciones.solicitudId);
        }).sort(function (a, b) { return a.creado < b.creado ? 1 : -1; });
        var ult = suyos[0] || null;
        var estado = 'falta', vence = null;
        if (ult) {
          if (d.dias === null) estado = 'al_dia';
          else {
            vence = new Date(new Date(ult.creado).getTime() + d.dias * 86400000);
            estado = vence.getTime() >= ahora ? 'al_dia' : 'vencido';
          }
        }
        return { tipo: d.tipo, nombre: d.nombre, nota: d.nota, estado: estado, archivo: ult, vence: vence };
      });
    },
    enlaceArchivo: async function (ruta) {
      exigir();
      return revisar(await sb.storage.from('documentos').createSignedUrl(ruta, 600)).signedUrl;
    },
    // Abre un archivo en una pestaña nueva (la pestaña se abre antes de pedir el enlace para que el navegador no la bloquee).
    abrirArchivo: async function (ruta) {
      var w = window.open('', '_blank');
      try {
        var url = await LPJ.enlaceArchivo(ruta);
        if (w) w.location = url; else window.location.href = url;
      } catch (e) {
        if (w) w.close();
        window.alert(error(e));
      }
    },

    // ---------- Conversaciones y pólizas ----------
    guardarMensajes: async function (lista, solicitudId) {
      if (!sb || !lista || !lista.length) return;
      var u = await LPJ.usuario();
      if (!u) return;
      revisar(await sb.from('mensajes').insert(lista.map(function (m) {
        return { usuario_id: u.id, solicitud_id: solicitudId || null, rol: m.rol === 'cliente' ? 'cliente' : 'asistente', texto: String(m.texto).slice(0, 8000) };
      })));
    },
    misMensajes: async function () {
      exigir();
      var u = await LPJ.usuario();
      if (!u) return [];
      return revisar(await sb.from('mensajes').select('*').eq('usuario_id', u.id).order('creado', { ascending: false }).order('id', { ascending: false }).limit(400)).reverse();
    },
    misPolizas: async function () {
      exigir();
      var u = await LPJ.usuario();
      if (!u) return [];
      return revisar(await sb.from('polizas').select('*').eq('usuario_id', u.id).order('vigencia_hasta', { ascending: false }));
    },

    // ---------- Solicitud pendiente (solo si Supabase exige confirmar el correo antes de ingresar) ----------
    guardarPendiente: function (p) {
      try { p.fecha = Date.now(); window.localStorage.setItem(CLAVE_PENDIENTE, JSON.stringify(p)); } catch (e) { /* sin almacenamiento */ }
    },
    enviarPendiente: async function () {
      if (!sb) return null;
      var crudo = null, p = null;
      // Se toma y se retira en el mismo instante, para que dos pestañas no la registren dos veces.
      try { crudo = window.localStorage.getItem(CLAVE_PENDIENTE); if (crudo) window.localStorage.removeItem(CLAVE_PENDIENTE); } catch (e) { return null; }
      if (!crudo) return null;
      function devolver() { try { window.localStorage.setItem(CLAVE_PENDIENTE, crudo); } catch (e) { /* nada */ } }
      try { p = JSON.parse(crudo); } catch (e) { p = null; }
      if (!p || !p.fecha || Date.now() - p.fecha > 30 * 86400000) return null;       // dañada o muy vieja: se descarta
      var u = await LPJ.usuario();
      if (!u || String(p.correo || '').toLowerCase() !== String(u.email || '').toLowerCase()) { devolver(); return null; }
      try {
        var s = await LPJ.crearSolicitud(p.tipo, p.empresa, p.datos, p.ajustes);
        try { await LPJ.guardarMensajes(p.mensajes || [], s.id); } catch (e) { /* no bloquea */ }
        LPJ.avisarAsesor('Cuenta confirmada — solicitud #' + s.numero + ' ' + (p.empresa || ''), {
          Solicitud: '#' + s.numero + ' · ' + (TIPOS_SOLICITUD[s.tipo] || s.tipo),
          Empresa: p.empresa || '—', Cliente: u.email,
          Nota: 'El cliente confirmó su cuenta. La solicitud que ya le había llegado por correo quedó registrada en el panel.',
          'Gestionar en el panel': C.sitio + '/asesor.html#s=' + s.id
        });
        return s;
      } catch (e) {
        devolver();
        return null;
      }
    },

    // ---------- Aliados, cartera y comisiones ----------
    esAliado: async function () {
      if (!sb) return false;
      var r = await sb.rpc('es_aliado');
      return !r.error && r.data === true;
    },
    carteraDe: async function (usuarioId) {
      exigir();
      var id = usuarioId || (await LPJ.usuario() || {}).id;
      if (!id) return [];
      return revisar(await sb.from('cartera').select('*').eq('usuario_id', id).neq('estado', 'anulada').order('fecha_limite', { ascending: true, nullsFirst: false }));
    },
    comisionesDe: async function (aliadoId) {
      exigir();
      var id = aliadoId || (await LPJ.usuario() || {}).id;
      if (!id) return [];
      return revisar(await sb.from('comisiones').select('*').eq('aliado_id', id).order('creado', { ascending: false }));
    },
    // Solo asesor
    aliados: async function () { exigir(); return revisar(await sb.from('aliados').select('*')); },
    hacerAliado: async function (usuarioId, nombre, porcentaje) {
      exigir();
      return revisar(await sb.from('aliados').upsert({ usuario_id: usuarioId, nombre: nombre || null, porcentaje: porcentaje || null }).select().single());
    },
    // Inscripción desde el Portal de aliados: queda como aliado con 60 % (lo hace la base de datos).
    registrarmeAliado: async function () { exigir(); var r = await sb.rpc('registrarme_aliado'); if (r.error) throw r.error; return true; },
    perfilPorCorreo: async function (correo) { exigir(); var r = revisar(await sb.from('perfiles').select('*').ilike('correo', correo).limit(1)); return r[0] || null; },
    quitarAliado: async function (usuarioId) { exigir(); revisar(await sb.from('aliados').delete().eq('usuario_id', usuarioId)); },
    guardarCartera: async function (fila) {
      exigir();
      if (fila.id) { var id = fila.id; delete fila.id; return revisar(await sb.from('cartera').update(fila).eq('id', id).select().single()); }
      return revisar(await sb.from('cartera').insert(fila).select().single());
    },
    guardarComision: async function (fila) {
      exigir();
      if (fila.id) { var id = fila.id; delete fila.id; return revisar(await sb.from('comisiones').update(fila).eq('id', id).select().single()); }
      return revisar(await sb.from('comisiones').insert(fila).select().single());
    },
    // Estado de una cuota: 'pagada', 'vencida' (pasó la fecha), 'por_vencer' (7 días o menos) o 'pendiente'.
    estadoCuota: function (c) {
      if (c.estado === 'pagada') return 'pagada';
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.fecha_limite || '');
      if (!m) return 'pendiente';
      var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      var dias = Math.round((new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - hoy) / 86400000);
      return dias < 0 ? 'vencida' : dias <= 7 ? 'por_vencer' : 'pendiente';
    },

    // ---------- Asesor ----------
    esAsesor: async function () {
      if (!sb) return false;
      var r = await sb.rpc('es_asesor');
      return !r.error && r.data === true;
    },
    // ---------- Copia de LevelUp (solo lectura; cada quien ve lo suyo por las reglas de la base) ----------
    luPolizas: async function () {
      exigir();
      try { return revisar(await sb.from('lu_polizas').select('id_poliza,numero,aseguradora,ramo,tomador,asegurado,identificacion,desde,hasta,placa,prima,comision,aliado').eq('vigente_en_levelup', true).order('hasta').limit(2000)); }
      catch (e) { return []; }
    },
    luCartera: async function () {
      exigir();
      try { return revisar(await sb.from('lu_cartera').select('id_produccion,numero_poliza,aseguradora,ramo,tomador,cuota,fecha_max_pago,total,pagado,saldo,saldo_comision,aliado').order('fecha_max_pago').limit(2000)); }
      catch (e) { return []; }
    },
    luReclamos: async function () {
      exigir();
      try { return revisar(await sb.from('lu_reclamos').select('*').order('fecha_suceso', { ascending: false }).limit(500)); } catch (e) { return []; }
    },
    luResumen: async function () { exigir(); var r = await sb.rpc('resumen_levelup'); if (r.error) throw r.error; return r.data || {}; },
    luBuscarClientes: async function (q) {
      exigir();
      var s = String(q || '').replace(/[%,()]/g, ' ').trim();
      if (s.length < 3) return [];
      return revisar(await sb.from('lu_clientes').select('id_cliente,identificacion,nombre,aliado,estado').or('nombre.ilike.%' + s + '%,identificacion.ilike.%' + s + '%').limit(15));
    },
    luVinculo: async function (usuarioId) {
      exigir();
      var r = revisar(await sb.from('cuentas_levelup').select('id_cliente').eq('usuario_id', usuarioId).limit(1));
      if (!r[0]) return null;
      var c = revisar(await sb.from('lu_clientes').select('id_cliente,identificacion,nombre').eq('id_cliente', r[0].id_cliente).limit(1));
      return c[0] || { id_cliente: r[0].id_cliente };
    },
    luVincular: async function (usuarioId, idCliente) {
      exigir();
      var u = await LPJ.usuario();
      return revisar(await sb.from('cuentas_levelup').upsert({ usuario_id: usuarioId, id_cliente: idCliente, vinculado_por: u ? u.id : null }).select().single());
    },
    luDesvincular: async function (usuarioId) { exigir(); revisar(await sb.from('cuentas_levelup').delete().eq('usuario_id', usuarioId)); },
    aliadoLevelup: async function (usuarioId, nombre) { exigir(); revisar(await sb.from('aliados').update({ levelup_nombre: nombre || null }).eq('usuario_id', usuarioId)); },
    luAliadosNombres: async function () {
      exigir();
      try { var r = revisar(await sb.from('lu_clientes').select('aliado').not('aliado', 'is', null).limit(5000)); return r.map(function (x) { return x.aliado; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort(); }
      catch (e) { return []; }
    },
    esAdmin: async function () {
      if (!sb) return false;
      var r = await sb.rpc('es_admin');
      return !r.error && r.data === true;
    },
    resumenAdmin: async function () { exigir(); var r = await sb.rpc('resumen_admin'); if (r.error) throw r.error; return r.data || {}; },
    chats: async function (limite) {
      exigir();
      return revisar(await sb.from('chat_sesiones').select('*').order('actualizado', { ascending: false }).limit(limite || 60));
    },
    equipo: async function () { exigir(); return revisar(await sb.from('asesores').select('*')); },
    agregarEquipo: async function (usuarioId, nombre, rol) {
      exigir();
      return revisar(await sb.from('asesores').upsert({ usuario_id: usuarioId, nombre: nombre || null, rol: rol === 'admin' ? 'admin' : 'empleado' }).select().single());
    },
    quitarEquipo: async function (usuarioId) { exigir(); revisar(await sb.from('asesores').delete().eq('usuario_id', usuarioId)); },
    // Guarda la conversación del chat de la página (con o sin cuenta). Nunca bloquea el chat.
    registrarChat: async function (id, mensajes, tema) {
      if (!sb || !id) return;
      try { await sb.rpc('registrar_chat', { p_id: id, p_mensajes: mensajes, p_pagina: location.pathname, p_tema: tema || null }); } catch (e) { /* sin registro */ }
    },
    todasSolicitudes: async function () {
      exigir();
      return revisar(await sb.from('solicitudes').select('*').order('actualizado', { ascending: false }).limit(500));
    },
    perfiles: async function (ids) {
      exigir();
      if (!ids.length) return [];
      return revisar(await sb.from('perfiles').select('*').in('id', ids));
    },
    actualizarSolicitud: async function (id, estado, nota, linkPago, referencia) {
      exigir();
      return revisar(await sb.rpc('actualizar_solicitud', {
        p_solicitud: id, p_estado: estado, p_nota: nota || null, p_link_pago: linkPago || null, p_referencia: referencia || null
      }));
    },
    registrarPoliza: async function (datos) {
      exigir();
      return revisar(await sb.from('polizas').insert(datos).select().single());
    },
    polizasDe: async function (usuarioId) {
      exigir();
      return revisar(await sb.from('polizas').select('*').eq('usuario_id', usuarioId).order('creado', { ascending: false }));
    },

    // ---------- Aviso al asesor por correo ----------
    avisarAsesor: async function (asunto, campos) {
      var datos = { _subject: asunto, _template: 'box', _captcha: 'false' };
      Object.keys(campos).forEach(function (k) { datos[k] = campos[k]; });
      try {
        var r = await fetch('https://formsubmit.co/ajax/' + C.correoAsesor, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(datos)
        });
        var j = await r.json().catch(function () { return {}; });
        return r.ok && String(j.success) !== 'false';
      } catch (e) { return false; }
    },

    // ---------- Utilidades de presentación ----------
    // Los datos de una solicitud se guardan como lista de pares [campo, valor].
    filasDatos: function (d) {
      if (Array.isArray(d)) return d.filter(function (r) { return Array.isArray(r) && r.length >= 2; });
      return Object.keys(d || {}).map(function (k) { return [k, d[k]]; });
    },
    fecha: function (iso, conHora) {
      if (!iso) return '—';
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      var d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
      if (isNaN(d.getTime())) return '—';
      var o = { day: 'numeric', month: 'short', year: 'numeric' };
      if (conHora && !m) { o.hour = '2-digit'; o.minute = '2-digit'; }
      return d.toLocaleString('es-CO', o);
    },
    pesos: function (v) { return v == null || v === '' ? '—' : '$' + Number(v).toLocaleString('es-CO'); },
    escapar: function (t) {
      return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
  };

  window.LPJ = LPJ;
})();
