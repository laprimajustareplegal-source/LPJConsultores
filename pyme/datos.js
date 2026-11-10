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
    otro: 'Otro'
  };
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

  var LPJ = {
    configurado: !!sb,
    cliente: sb,
    hashInicial: hashInicial,
    ESTADOS: ESTADOS,
    ETAPAS: ETAPAS,
    TIPOS_ARCHIVO: TIPOS_ARCHIVO,
    TIPOS_SOLICITUD: TIPOS_SOLICITUD,
    ACEPTA: '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx',
    error: error,

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
    crearSolicitud: async function (tipo, empresa, datos, ajustes) {
      exigir();
      var u = await LPJ.usuario();
      if (!u) throw new Error('Su sesión venció. Ingrese de nuevo.');
      return revisar(await sb.from('solicitudes').insert({
        usuario_id: u.id, tipo: tipo, empresa: String(empresa || '').slice(0, 200), datos: datos || [],
        ajustes: (ajustes || []).map(function (t) { return { texto: String(t).slice(0, 2000), fecha: new Date().toISOString() }; })
      }).select().single());
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
      return revisar(await sb.from('archivos').insert({
        usuario_id: duenio, solicitud_id: opciones.solicitudId || null, ruta: ruta,
        nombre: String(archivo.name).slice(0, 300), tipo: opciones.tipo || 'otro', subido_por: opciones.subidoPor || 'cliente'
      }).select().single());
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

    // ---------- Asesor ----------
    esAsesor: async function () {
      if (!sb) return false;
      var r = await sb.rpc('es_asesor');
      return !r.error && r.data === true;
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
