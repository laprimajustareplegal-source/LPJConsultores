/* Chat PYME — La Prima Justa
   Las preguntas de la cotización corren aquí mismo, sin IA (no gastan créditos).
   La IA solo se usa para preguntas libres, a través de la función de Vercel (LPJ_CONFIG.apiChat).
   Si Supabase está configurado, el cliente crea su cuenta y la solicitud, los archivos y la conversación quedan guardados. */
(function () {
  'use strict';

  var CONFIG = window.LPJ_CONFIG || {};
  var LPJ = window.LPJ;
  if (!LPJ) return;

  var COBERTURAS = {
    incendio: 'Incendio, terremoto y AMIT',
    hurto: 'Hurto calificado',
    electronico: 'Equipo electrónico',
    maquinaria: 'Rotura de maquinaria',
    rc: 'Responsabilidad civil',
    lucro: 'Lucro cesante',
    manejo: 'Manejo (empleados)',
    dinero: 'Dinero y valores',
    vidrios: 'Rotura de vidrios'
  };

  var ACTIVIDADES = {
    'Comercio o tienda': ['incendio', 'hurto', 'electronico', 'rc', 'manejo', 'dinero'],
    'Restaurante o cafetería': ['incendio', 'hurto', 'electronico', 'maquinaria', 'rc', 'lucro'],
    'Oficina o servicios profesionales': ['incendio', 'hurto', 'electronico', 'rc'],
    'Consultorio o salud': ['incendio', 'hurto', 'electronico', 'rc'],
    'Taller o manufactura': ['incendio', 'hurto', 'maquinaria', 'electronico', 'rc', 'lucro'],
    'Bodega o logística': ['incendio', 'hurto', 'rc', 'lucro'],
    'Club deportivo o gimnasio': ['incendio', 'hurto', 'electronico', 'rc', 'lucro'],
    'Colegio o educación': ['incendio', 'hurto', 'electronico', 'rc']
  };
  var COBERTURAS_BASE = ['incendio', 'hurto', 'electronico', 'rc'];

  // Respuestas rápidas sin IA (se usan si la IA no está configurada o no responde).
  var RESPUESTAS = [
    { p: ['deducible'], r: 'El deducible es la parte de cada pérdida que asume la empresa. Normalmente es un porcentaje de la pérdida con un mínimo en pesos o en salarios mínimos. Terremoto suele tener un deducible más alto. En la cotización formal le mostramos el deducible de cada aseguradora.' },
    { p: ['lucro', 'utilidad', 'cerrado', 'cierre'], r: 'El lucro cesante paga la utilidad que su negocio deja de ganar y los gastos fijos que debe seguir pagando mientras está cerrado por un daño cubierto, por ejemplo un incendio.' },
    { p: ['responsabilidad', ' rc ', 'tercero', 'se cae', 'se lesion', 'demanda'], r: 'La responsabilidad civil extracontractual protege a su empresa cuando causa daños a terceros en desarrollo de su actividad, por ejemplo un cliente que se lesiona dentro del local. Se puede ampliar a RC de productos, contratistas, patronal o parqueaderos según su negocio.' },
    { p: ['hurto', 'robo', 'roban'], r: 'La cobertura de hurto calificado paga cuando roban con violencia o forzando el acceso al local. El hurto simple, sin señales de fuerza, normalmente no está cubierto o tiene condiciones especiales.' },
    { p: ['terremoto', 'temblor', 'sismo'], r: 'El terremoto se cubre junto con incendio en la póliza PYME. Normalmente tiene un deducible específico, más alto que el de las demás coberturas.' },
    { p: ['contrato', 'me exigen', 'me piden', 'licitacion'], r: 'Si un contrato le exige ciertas pólizas o límites, cuéntenos con la opción "Mejorar mi póliza actual": puede adjuntar el contrato o escribir los requisitos. Su asesor ajusta la póliza para que cumpla exactamente lo que le piden.' },
    { p: ['arrend', 'arriendo', 'alquil', 'no soy dueno', 'no es mio'], r: 'Si el local es arrendado, usted asegura sus contenidos (muebles, equipos, mercancías), las mejoras que haya hecho al local y su responsabilidad civil. El edificio lo asegura el dueño.' },
    { p: ['mejorar', 'bajar', 'mas barat', 'pago mucho', 'renovar', 'renovacion'], r: 'Con gusto revisamos su póliza actual. Use la opción "Mejorar mi póliza actual" y su asesor la compara con otras aseguradoras para bajar la prima o mejorar las coberturas.' },
    { p: ['costo de la asesoria', 'cobra', 'tiene costo', 'costo adicional', 'gratis', 'honorarios'], r: 'Nuestra asesoría no tiene costo adicional para usted: la aseguradora remunera a la agencia.' },
    { p: ['precio', 'cuanto cuesta', 'cuanto vale', 'cuanto pag', 'cuanto sale', 'tarifa', 'que valor', 'valor de la poliza'], r: 'El precio depende de la actividad, la ciudad, los valores asegurados y las coberturas. Complete la cotización aquí en el chat y su asesor le envía la comparación de precios de las aseguradoras en máximo 24 horas hábiles.' },
    { p: ['necesito para cotizar', 'requisitos para cotizar', 'documentos para cotizar', 'piden para cotizar', 'papeles para cotizar'], r: 'Para cotizar no necesita documentos: basta con responder las preguntas del chat sobre su negocio. Los documentos (RUT, cámara de comercio, cédula del representante legal y formulario SARLAFT) se piden solo cuando aprueba la cotización y se va a emitir la póliza.' },
    { p: ['document', 'requisito', 'que necesito', 'emitir', 'expedir', 'emision'], r: 'Para emitir la póliza se necesita el RUT, la cámara de comercio reciente, la cédula del representante legal y el formulario de conocimiento del cliente (SARLAFT). Su asesor se los pide cuando usted aprueba la cotización.' },
    { p: ['pago', 'pagar', 'pse', 'cuotas', 'financ'], r: 'Cuando la póliza esté lista, su asesor le envía el link o la referencia de pago de la aseguradora; el pago se hace directamente a la aseguradora. Algunas permiten pagar en cuotas.' },
    { p: ['en que estado', 'estado de mi', 'como va', 'avance', 'mi solicitud', 'seguimiento'], r: 'El avance de cada solicitud se ve en Mi cuenta: en qué etapa va, las notas de su asesor y los documentos.' },
    { p: ['siniestro', 'reclam', 'me paso', 'se quemo', 'inund'], r: 'Si tuvo un siniestro: proteja los bienes para evitar más daños, guarde fotos y facturas, ponga la denuncia si fue hurto y avísenos de inmediato por WhatsApp al ' + CONFIG.whatsappVisible + '. Nosotros llevamos el trámite con la aseguradora.' },
    { p: ['vigencia', 'cuanto dura', 'dura la poliza', 'por cuanto tiempo'], r: 'La póliza PYME normalmente tiene vigencia de un año y se renueva cada año. Antes del vencimiento, su asesor le presenta las opciones de renovación.' },
    { p: ['se demora', 'demoran', 'tarda', 'me responde', 'me contesta', 'tiempo de respuesta', 'cuando llega la cotizacion', 'cuando tengo la cotizacion', 'cuanto tiempo', 'el tramite'], r: 'Su asesor le responde en máximo 24 horas hábiles después de recibir su solicitud. Si es urgente, escríbale por WhatsApp al ' + CONFIG.whatsappVisible + '.' },
    { p: ['hablar con', 'un asesor', 'mi asesor', 'el asesor', 'con asesor', 'con una persona', 'persona real', 'un humano', 'me llamen', 'me pueden llamar', 'llamenme', 'llamar'], r: 'Claro. Su asesor es ' + CONFIG.nombreAsesor + ': puede escribirle por WhatsApp o llamarlo al ' + CONFIG.whatsappVisible + '. Si antes deja aquí los datos de su empresa, él llega con la cotización adelantada.' },
    { p: ['aseguradora', 'compania', 'con quien', 'trabajan con', ' sura ', ' axa ', 'allianz', 'mapfre', 'bolivar', 'liberty', ' hdi ', 'equidad', 'seguros del estado'], r: 'Trabajamos con más de 15 aseguradoras, entre ellas SURA, AXA Colpatria, Allianz, Mapfre, HDI, Liberty, Seguros Bolívar, Seguros del Estado y La Equidad. Cotizamos con las que mejor se ajustan a su actividad.' },
    { p: ['corredor', 'agencia', 'quienes son', 'la prima justa', ' lpj ', 'confiable'], r: 'La Prima Justa (LPJ Consultores) es una agencia de seguros con sede en Bogotá que atiende empresas en toda Colombia. Analizamos los riesgos de su negocio, comparamos entre más de 15 aseguradoras y lo acompañamos en la contratación y en los siniestros.' },
    { p: ['valor asegurado', 'por cuanto aseguro', 'infraseguro'], r: 'Cada bien debe asegurarse por su valor de reposición, es decir, lo que cuesta reponerlo nuevo. Si se asegura por menos, en un siniestro la indemnización puede reducirse en proporción (infraseguro).' },
    { p: ['electr', 'computador', ' pos ', 'datafono'], r: 'La cobertura de equipo electrónico protege computadores, datáfonos, impresoras y equipos de comunicación frente a daños internos y accidentales.' },
    { p: ['maquinaria', 'maquina', 'nevera', 'horno'], r: 'La rotura de maquinaria cubre el daño súbito e imprevisto de máquinas en funcionamiento, por falla eléctrica o mecánica o por error de operación.' },
    { p: ['manejo', 'empleado roba', 'fraude', 'infidelidad'], r: 'La cobertura de manejo protege a la empresa frente a pérdidas por hurto, abuso de confianza o fraude cometido por sus empleados.' },
    { p: ['subir mi poliza', 'subir la poliza', 'subir un archivo', 'subir archivos', 'subir documentos', 'subir el pdf', 'subir una foto', 'adjuntar', 'adjunto', 'cargar mi poliza', 'cargar la poliza', 'enviar mi poliza', 'enviar la poliza', 'mandar mi poliza', 'mandar la poliza', 'enviarles mi poliza', ' pdf '], r: LPJ.configurado
      ? 'Sí. Con la opción "Mejorar mi póliza actual" del menú inicial puede adjuntar el PDF o fotos de su póliza, y el contrato si le exigen coberturas. Su asesor la revisa y busca bajar la prima o mejorar las coberturas.'
      : 'Con la opción "Mejorar mi póliza actual" del menú inicial me cuenta lo básico de su póliza, y al terminar le envía el PDF a su asesor por WhatsApp al ' + CONFIG.whatsappVisible + '.' },
    { p: ['seguro de carro', 'seguro para carro', 'seguro de auto', 'seguro para auto', 'seguro de moto', 'seguro para moto', 'seguro de vehiculo', 'seguro para vehiculo', 'todo riesgo', 'soat', 'seguro de vida', 'seguros de vida', 'poliza de vida', 'seguro de salud', 'poliza de salud', 'medicina prepagada', 'seguro de hogar', 'seguro para mi casa', 'poliza de cumplimiento', 'seguro de cumplimiento', ' arl ', 'seguro de transporte', 'seguro de viaje', 'seguro exequial', 'otros seguros', 'que seguros'], r: 'En este chat cotizo la póliza PYME, que protege los bienes y la responsabilidad de su empresa. La agencia también maneja otros seguros (autos, vida, salud, cumplimiento, transporte y ARL, entre otros): escríbale a su asesor por WhatsApp al ' + CONFIG.whatsappVisible + ' y él se los cotiza.' },
    { p: ['contrasena', 'mi cuenta', 'crear cuenta', 'una cuenta', 'usuario', 'registr'], r: 'En Mi cuenta quedan guardadas sus solicitudes, pólizas, documentos y conversaciones. Se entra con su correo y una contraseña.' },
    { p: ['donde', 'direccion', 'oficina', 'telefono', 'contacto'], r: 'Estamos en la Calle 96 # 45A-31, Oficina 200, Bogotá, y atendemos empresas en toda Colombia. WhatsApp y llamadas: ' + CONFIG.whatsappVisible + '. Correo: info@laprimajusta.co.' },
    { p: ['poliza pyme', 'multirriesgo', 'que cubre', 'para que sirve'], r: 'La póliza PYME es un seguro empaquetado para pequeñas y medianas empresas: en una sola póliza se protegen los bienes del negocio (local, muebles, maquinaria, mercancías y equipos) y su responsabilidad frente a terceros. Cada aseguradora tiene su propia versión, por eso cotizamos con varias.' },
    { p: ['como cotiz', 'como funciona', 'como hago', 'como es el proceso', 'que debo hacer', 'como empiezo', 'como inicio', 'cuales son los pasos'], r: 'Es sencillo: toque "Cotizar mi póliza PYME", responda unas preguntas sobre su negocio (actividad, ciudad, valores a asegurar y coberturas) y deje sus datos. Su asesor compara las aseguradoras y le envía la cotización en máximo 24 horas hábiles.' }
  ];

  var ACTIVIDAD = { id: 'actividad', texto: '¿A qué se dedica su empresa?', tipo: 'opciones', opciones: Object.keys(ACTIVIDADES).concat(['Otra actividad']) };
  var ACTIVIDAD_OTRA = { id: 'actividadOtra', texto: 'Cuénteme en pocas palabras a qué se dedica su empresa.', tipo: 'texto', si: function (e) { return e.actividad === 'Otra actividad' && !e.actividadOtra; } };

  var PASOS_COTIZAR = [
    ACTIVIDAD, ACTIVIDAD_OTRA,
    { id: 'ciudad', texto: '¿En qué ciudad está el negocio? Puede escribirla.', tipo: 'texto', opciones: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla'] },
    { id: 'inmueble', texto: 'El local o la sede, ¿es propio o arrendado?', tipo: 'opciones', opciones: ['Propio', 'Arrendado'] },
    { id: 'valorEdificio', texto: '¿Cuánto vale la construcción del local (el edificio, sin el lote)? Escriba el valor aproximado, por ejemplo "300 millones".', tipo: 'monto', opciones: ['No sé'], si: function (e) { return e.inmueble === 'Propio'; } },
    { id: 'valorContenidos', texto: '¿Cuánto valen los muebles, la maquinaria y los equipos del negocio? Un valor aproximado está bien.', tipo: 'monto', opciones: ['No sé'] },
    { id: 'valorMercancias', texto: '¿Y el inventario o las mercancías que normalmente tiene en el local?', tipo: 'monto', opciones: ['No manejo inventario', 'No sé'] },
    { id: 'valorElectronico', texto: '¿Cuánto valen los equipos electrónicos (computadores, datáfonos, impresoras)?', tipo: 'monto', opciones: ['No sé'] },
    { id: 'empleados', texto: '¿Cuántas personas trabajan en la empresa?', tipo: 'opciones', opciones: ['1 a 5', '6 a 20', '21 a 50', '51 a 200', 'Más de 200'] },
    { id: 'coberturas', texto: 'Estas son las coberturas que le recomiendo para su actividad. Toque para quitar o agregar, y luego "Continuar".', tipo: 'multi' },
    { id: 'limiteRC', texto: '¿Con qué límite quiere la responsabilidad civil? Es lo máximo que pagaría la aseguradora por daños a terceros.', tipo: 'opciones', abierta: true, opciones: ['100 millones', '300 millones', '500 millones', '1.000 millones', 'No sé, que me recomienden'], si: function (e) { return e.coberturas && e.coberturas.indexOf('rc') >= 0; } },
    { id: 'polizaActual', texto: '¿Hoy tiene una póliza para el negocio?', tipo: 'opciones', opciones: ['No, sería nueva', 'Sí, quiero mejorarla'] },
    { id: 'polizaArchivo', texto: 'Si la tiene a mano, adjúntela (PDF o foto) y la comparamos. También puede escribir con qué aseguradora la tiene y cuándo vence.', textoSinArchivos: '¿Con qué aseguradora la tiene y cuándo vence? Lo que sepa.', tipo: 'archivo', tipoArchivo: 'poliza_actual', opciones: ['Prefiero no decirlo'], si: function (e) { return e.polizaActual === 'Sí, quiero mejorarla'; } },
    { id: 'contacto', texto: 'Ya casi. ¿A quién le enviamos la cotización?', tipo: 'contacto' }
  ];

  // Ramos corporativos: la póliza PYME sigue su flujo detallado; los demás usan un flujo corto
  // con una pregunta propia del ramo. Se activa con window.LPJ_MULTIRAMO.
  var RAMO_PYME = 'Póliza PYME (local, oficina o negocio)';
  var RAMOS = {
    'Responsabilidad civil': '¿Qué necesita cubrir? Por ejemplo: daños a terceros en su operación, RC profesional, o una póliza que le exige un cliente o contrato. Si sabe el límite que necesita, inclúyalo.',
    'Cumplimiento (contratos y licitaciones)': '¿Para qué contrato o licitación la necesita? Cuénteme la entidad o cliente, el valor del contrato y las garantías que le piden (cumplimiento, anticipo, salarios, estabilidad).',
    'ARL': '¿Cuántos trabajadores afiliaría y en qué nivel de riesgo trabajan? Si ya tiene ARL, dígame con cuál y por qué quiere cambiar.',
    'Vida grupo': '¿A cuántas personas quiere asegurar y con qué valor asegurado por persona? Si es por un crédito o un requisito, cuéntemelo.',
    'Salud colectiva': '¿A cuántas personas quiere cubrir (empleados y familiares)? Si ya tiene un plan, dígame con quién y qué quiere mejorar.',
    'Flota de vehículos': '¿Cuántos vehículos son, de qué tipo (particulares, camiones, motos) y para qué los usa?',
    'Transporte de mercancías': '¿Qué mercancía mueve, entre qué ciudades o países, y cuánto vale un despacho o lo que mueve en un año?',
    'Directores y administradores (D&O)': '¿Cuántos ingresos tuvo la empresa el último año y qué límite busca? Si lo pide un inversionista o la junta, cuéntemelo.',
    'Ciberseguridad': '¿Cuántos ingresos tuvo la empresa el último año y qué maneja en línea (datos de clientes, pagos, tienda virtual)?',
    'Todo riesgo construcción o montaje': '¿Qué obra o montaje es, dónde, cuánto vale y cuánto dura?',
    'Otro seguro': 'Cuénteme qué seguro necesita y para qué. Su asesor le busca la mejor opción.'
  };
  var RAMO = { id: 'ramo', texto: '¿Qué seguro necesita para su empresa?', tipo: 'opciones', opciones: [RAMO_PYME].concat(Object.keys(RAMOS)) };
  var PASOS_RAMO = [
    { id: 'empresaQue', texto: '¿A qué se dedica su empresa?', tipo: 'texto', opciones: Object.keys(ACTIVIDADES) },
    { id: 'ciudad', texto: '¿En qué ciudad está la empresa?', tipo: 'texto', opciones: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla'] },
    { id: 'empleados', texto: '¿Cuántas personas trabajan en la empresa?', tipo: 'opciones', opciones: ['1 a 5', '6 a 20', '21 a 50', '51 a 200', 'Más de 200'] },
    { id: 'detalle', texto: '', tipo: 'texto', libre: true },
    { id: 'polizaActual', texto: '¿Hoy tiene este seguro con alguna aseguradora?', tipo: 'opciones', opciones: ['No, sería nuevo', 'Sí, quiero mejorarlo'] },
    { id: 'contacto', texto: 'Ya casi. ¿A quién le enviamos la cotización?', tipo: 'contacto' }
  ];

  var PASOS_MEJORA = [
    { id: 'polizaArchivo', texto: 'Adjunte su póliza actual: el PDF o fotos de la carátula y las condiciones. Su asesor la revisa y busca bajarle la prima o mejorar las coberturas con otras aseguradoras.', textoSinArchivos: 'Cuénteme de su póliza actual: ¿con qué aseguradora la tiene, cuánto paga al año y cuándo vence? Al final podrá enviarnos el PDF por WhatsApp.', tipo: 'archivo', tipoArchivo: 'poliza_actual', opciones: ['No la tengo a mano'] },
    { id: 'polizaDetalle', texto: 'No hay problema. ¿Con qué aseguradora la tiene, cuánto paga al año y cuándo vence? Lo que sepa.', tipo: 'texto', opciones: ['No lo sé'], si: function (e) { return !e.archivos.some(function (a) { return a.tipo === 'poliza_actual'; }) && !e.polizaArchivoTexto; } },
    { id: 'objetivo', texto: '¿Qué busca principalmente?', tipo: 'opciones', opciones: ['Bajar el precio', 'Mejorar coberturas', 'Cumplir lo que pide un contrato', 'Todo lo anterior'] },
    { id: 'contratoArchivo', texto: 'Adjunte el contrato o el documento donde le piden las pólizas, o escriba qué le exigen (coberturas, límites, beneficiario).', textoSinArchivos: 'Escriba qué le exige el contrato (coberturas, límites, beneficiario). El documento lo puede enviar por WhatsApp al final.', tipo: 'archivo', tipoArchivo: 'contrato', opciones: ['Lo envío después'], si: function (e) { return e.objetivo === 'Cumplir lo que pide un contrato' || e.objetivo === 'Todo lo anterior'; } },
    ACTIVIDAD, ACTIVIDAD_OTRA,
    { id: 'ciudad', texto: '¿En qué ciudad está el negocio?', tipo: 'texto', opciones: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla'] },
    { id: 'cambios', texto: '¿Quiere algún cambio específico? Por ejemplo, subir un límite, agregar una cobertura o cambiar el deducible. Escríbalo, o toque "Nada más".', tipo: 'texto', libre: true, opciones: ['Nada más'] },
    { id: 'contacto', texto: 'Perfecto. ¿A quién le enviamos la propuesta de mejora?', tipo: 'contacto' }
  ];

  var el = {};
  var estado, pasos, paso, historialIA, transcripcion, guardadoHasta, ocupado, usuario = null, perfil = null;
  var botPendientes = 0, reintento = null;
  var abiertas = [], huellaCuenta = '';      // solicitudes en curso del cliente (se cargan en segundo plano)

  function $(id) { return document.getElementById(id); }

  async function iniciar() {
    el.mensajes = $('pcMensajes');
    el.input = $('pcInput');
    el.enviar = $('pcEnviar');
    el.cuenta = $('pcCuenta');
    if (CONFIG.apiChat && $('pcNota')) $('pcNota').textContent = 'Asistente con IA. La cotización formal la confirma su asesor.';
    if (!el.mensajes) return;
    $('pcForm').addEventListener('submit', function (ev) { ev.preventDefault(); alEscribir(); });
    $('pcReiniciar').addEventListener('click', reiniciar);
    if (LPJ.configurado) {
      // La sesión se lee del navegador; si hubiera que renovarla y el servidor tarda, el chat no espera.
      var sesion = LPJ.usuario();
      usuario = await Promise.race([sesion, new Promise(function (r) { setTimeout(function () { r(null); }, 2500); })]);
      sesion.then(function (u) { if (u && !usuario) { usuario = u; pintarCuenta(); cargarCuenta(); } });
      LPJ.alCambiarSesion(function (u) {
        usuario = u;
        if (!u) { perfil = null; abiertas = []; huellaCuenta = ''; }
        pintarCuenta();
      });
    }
    pintarCuenta();
    reiniciar();
  }

  // Trae en segundo plano el perfil y las solicitudes en curso. Si el cliente aún no ha tocado nada,
  // vuelve a pintar el saludo con su nombre y sus solicitudes.
  async function cargarCuenta() {
    if (!LPJ.configurado || !usuario) return;
    try { perfil = await LPJ.perfil(); } catch (e) { /* se conserva lo que había */ }
    try { await LPJ.enviarPendiente(); } catch (e) { /* no bloquea */ }
    try {
      abiertas = (await LPJ.misSolicitudes()).filter(function (s) { return s.estado !== 'vigente' && s.estado !== 'cancelada'; });
    } catch (e) { /* se conserva lo que había */ }
    var huella = ((perfil && perfil.nombre) || '') + '|' + abiertas.map(function (s) { return s.id + s.estado; }).join(',');
    if (huella === huellaCuenta) return;
    huellaCuenta = huella;
    if (!estado.tocado) reiniciar(true);
  }

  function pintarCuenta() {
    if (!el.cuenta) return;
    if (!LPJ.configurado) { el.cuenta.style.display = 'none'; return; }
    el.cuenta.style.display = '';
    el.cuenta.textContent = usuario ? 'Mi cuenta' : 'Ingresar';
  }

  function reiniciar(sinRecargar) {
    estado = { ajustes: [], preguntas: [], archivos: [] };
    pasos = null;
    paso = -1;
    historialIA = [];
    transcripcion = [];
    guardadoHasta = 0;
    ocupado = false;
    clearTimeout(reintento);
    el.enviar.disabled = false;
    el.mensajes.innerHTML = '';
    var nombre = perfil && perfil.nombre ? ', ' + perfil.nombre.split(' ')[0] : '';
    var saludo = 'Hola' + nombre + '. ' + (window.LPJ_SALUDO || 'Soy el asistente PYME de La Prima Justa. Le ayudo a cotizar o mejorar el seguro de su empresa y resuelvo sus dudas.');
    var mias = usuario ? abiertas : [];
    bot(saludo, function () {
      if (!mias.length) return menuInicio();
      mostrarEstados(mias);
      var lista = mias.filter(function (s) { return s.estado === 'cotizada' || s.estado === 'pago_pendiente'; });
      if (!lista.length) return menuInicio();
      bot(lista[0].estado === 'cotizada'
        ? 'Su solicitud #' + lista[0].numero + ' ya tiene cotización. Tóquela para revisarla, pedir ajustes o solicitar la emisión.'
        : 'Su solicitud #' + lista[0].numero + ' está lista para pago. Tóquela para ver la información de pago.', menuInicio);
    });
    if (sinRecargar !== true) cargarCuenta();
  }

  function menuInicio() {
    var ops = [window.LPJ_MULTIRAMO ? 'Cotizar un seguro para mi empresa' : 'Cotizar mi póliza PYME', 'Mejorar mi póliza actual', 'Tengo una pregunta'];
    if (LPJ.configurado) ops.push('Ver mis solicitudes');
    opciones(ops, function (v) {
      if (v === 'Tengo una pregunta') {
        bot('Claro, escríbala abajo. Por ejemplo: "¿qué cubre el lucro cesante?" o "mi cliente me exige una póliza de RC, ¿qué hago?"');
        el.input.focus();
      } else if (v === 'Ver mis solicitudes') {
        window.location.href = 'mi-cuenta.html';
      } else if (v === 'Cotizar un seguro para mi empresa') {
        elegirRamo();
      } else {
        empezar(v === 'Mejorar mi póliza actual' ? 'mejora' : 'cotizacion');
      }
    });
  }

  function elegirRamo() {
    bot(RAMO.texto, function () {
      opciones(RAMO.opciones, function (v) {
        estado.ramo = v;
        if (v === RAMO_PYME) return empezar('cotizacion');
        estado.tipo = 'cotizacion';
        PASOS_RAMO[3].texto = RAMOS[v];
        pasos = PASOS_RAMO;
        paso = -1;
        siguiente();
      });
    });
  }

  function esRamo() { return estado.ramo && estado.ramo !== RAMO_PYME; }

  function empezar(tipo) {
    estado.tipo = tipo;
    pasos = tipo === 'mejora' ? PASOS_MEJORA : PASOS_COTIZAR;
    paso = -1;
    siguiente();
  }

  function mostrarEstados(lista) {
    var d = document.createElement('div');
    d.className = 'pc-resumen';
    var h = document.createElement('h4');
    h.textContent = 'Sus solicitudes en curso';
    d.appendChild(h);
    lista.slice(0, 5).forEach(function (s) {
      var a = document.createElement('a');
      a.className = 'pc-estado';
      a.href = 'mi-cuenta.html#s=' + s.id;
      var t = document.createElement('span');
      t.textContent = '#' + s.numero + ' · ' + (LPJ.TIPOS_SOLICITUD[s.tipo] || s.tipo) + (s.empresa ? ' · ' + s.empresa : '');
      var b = document.createElement('span');
      b.className = 'pc-badge est-' + s.estado;
      b.textContent = LPJ.ESTADOS[s.estado] || s.estado;
      a.appendChild(t); a.appendChild(b);
      d.appendChild(a);
    });
    agregar(d);
  }

  // ---------- Mensajes ----------
  function bajar() { el.mensajes.scrollTop = el.mensajes.scrollHeight; }
  function agregar(nodo) { el.mensajes.appendChild(nodo); bajar(); return nodo; }

  function burbuja(texto, clase, sinGuardar) {
    var d = document.createElement('div');
    d.className = 'pc-msg ' + clase;
    d.textContent = texto;
    if (!sinGuardar) transcripcion.push({ rol: clase === 'pc-user' ? 'cliente' : 'asistente', texto: texto });
    return agregar(d);
  }

  // Agrega un bloque alto (formulario) dejando visible su comienzo.
  function agregarArriba(nodo) {
    el.mensajes.appendChild(nodo);
    var arriba = nodo.getBoundingClientRect().top - el.mensajes.getBoundingClientRect().top + el.mensajes.scrollTop;
    el.mensajes.scrollTop = Math.max(0, arriba - 10);
    return nodo;
  }

  function usuarioDice(texto) { burbuja(texto, 'pc-user'); }

  function escribiendo() {
    var d = document.createElement('div');
    d.className = 'pc-escribiendo';
    d.innerHTML = '<i></i><i></i><i></i>';
    return agregar(d);
  }

  function bot(texto, luego) {
    var charla = estado;
    botPendientes++;
    var t = escribiendo();
    setTimeout(function () {
      botPendientes--;
      if (charla !== estado) return;          // la conversación se reinició mientras tanto
      t.remove();
      burbuja(texto, 'pc-bot');
      if (luego) luego();
    }, Math.min(400 + texto.length * 6, 1100));
  }

  // Bloquea la entrada mientras se espera al servidor. Devuelve la función que la libera.
  function ocupar() {
    ocupado = true;
    el.enviar.disabled = true;
    var t = escribiendo();
    return function () { t.remove(); ocupado = false; el.enviar.disabled = false; };
  }

  function quitarOpciones() {
    var viejas = el.mensajes.querySelectorAll('.pc-opciones, .pc-archivo');
    for (var i = 0; i < viejas.length; i++) viejas[i].remove();
  }

  function opciones(lista, alElegir, principal) {
    quitarOpciones();
    var c = document.createElement('div');
    c.className = 'pc-opciones';
    lista.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pc-chip' + (principal === v ? ' principal' : '');
      b.textContent = v;
      b.addEventListener('click', function () {
        estado.tocado = true;
        c.remove();
        usuarioDice(v);
        alElegir(v);
      });
      c.appendChild(b);
    });
    agregar(c);
    return c;
  }

  function enlaceChip(texto, href, principal) {
    var a = document.createElement('a');
    a.className = 'pc-chip' + (principal ? ' principal' : '');
    a.href = href;
    a.textContent = texto;
    if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  // ---------- Flujo ----------
  function pasoActual() { return pasos && paso >= 0 && paso < pasos.length ? pasos[paso] : null; }

  function siguiente() {
    paso++;
    while (paso < pasos.length && pasos[paso].si && !pasos[paso].si(estado)) paso++;
    if (paso >= pasos.length) return mostrarResumen();
    preguntar(pasos[paso]);
  }

  function mostrarControles(p) {
    if (p.tipo === 'opciones') {
      opciones(p.opciones, function (v) { guardar(p, v); });
    } else if (p.tipo === 'texto' || p.tipo === 'monto') {
      if (p.opciones) opciones(p.opciones, function (v) { guardar(p, v); });
      el.input.focus();
    } else if (p.tipo === 'archivo') {
      mostrarSubida(p);
    } else if (p.tipo === 'multi') {
      mostrarCoberturas();
    } else if (p.tipo === 'contacto') {
      mostrarContacto();
    }
  }

  function preguntar(p) {
    bot((!LPJ.configurado && p.textoSinArchivos) || p.texto, function () { mostrarControles(p); });
  }

  function guardar(p, valor) {
    if (p.id === 'cambios') {
      if (valor !== 'Nada más') estado.ajustes.push(valor);
    } else {
      estado[p.id] = valor;
    }
    if (p.id === 'actividad') estado.recomendadas = (ACTIVIDADES[valor] || COBERTURAS_BASE).slice();
    siguiente();
  }

  function mostrarSubida(p) {
    quitarOpciones();
    var c = document.createElement('div');
    c.className = 'pc-archivo';
    var nota = document.createElement('span');
    nota.className = 'pc-archivo-nota';
    if (LPJ.configurado) {
      var lab = document.createElement('label');
      lab.className = 'pc-chip principal';
      lab.textContent = 'Elegir archivo';
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = true;
      inp.accept = LPJ.ACEPTA;
      inp.hidden = true;
      lab.appendChild(inp);
      c.appendChild(lab);
      nota.textContent = 'PDF, foto, Word o Excel. Máximo 15 MB por archivo.';
      inp.addEventListener('change', function () {
        var archivos = Array.prototype.slice.call(inp.files || []);
        if (!archivos.length) return;
        var problema = archivos.map(LPJ.problemaArchivo).filter(Boolean)[0];
        if (problema || archivos.length + estado.archivos.length > 8) {
          nota.textContent = problema || 'Puede adjuntar máximo 8 archivos.';
          nota.classList.add('error');
          inp.value = '';
          return;
        }
        c.remove();
        archivos.forEach(function (f) { estado.archivos.push({ archivo: f, tipo: p.tipoArchivo }); });
        usuarioDice('Archivo: ' + archivos.map(function (f) { return f.name; }).join(', '));
        siguiente();
      });
    }
    (p.opciones || []).forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pc-chip';
      b.textContent = v;
      b.addEventListener('click', function () { c.remove(); usuarioDice(v); siguiente(); });
      c.appendChild(b);
    });
    if (nota.textContent) c.appendChild(nota);
    agregar(c);
    if (!LPJ.configurado) el.input.focus();
  }

  function mostrarCoberturas() {
    quitarOpciones();
    var elegidas = (estado.coberturas || estado.recomendadas || COBERTURAS_BASE).slice();
    var c = document.createElement('div');
    c.className = 'pc-opciones';
    Object.keys(COBERTURAS).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pc-chip' + (elegidas.indexOf(k) >= 0 ? ' sel' : '');
      b.setAttribute('aria-pressed', elegidas.indexOf(k) >= 0 ? 'true' : 'false');
      b.textContent = COBERTURAS[k];
      b.addEventListener('click', function () {
        var i = elegidas.indexOf(k);
        if (i >= 0) elegidas.splice(i, 1); else elegidas.push(k);
        b.classList.toggle('sel', i < 0);
        b.setAttribute('aria-pressed', i < 0 ? 'true' : 'false');
        estado.coberturas = elegidas.slice();
      });
      c.appendChild(b);
    });
    var ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'pc-chip principal';
    ok.textContent = 'Continuar';
    ok.addEventListener('click', function () {
      if (!elegidas.length) { bot('Elija al menos una cobertura para continuar.'); return; }
      c.remove();
      usuarioDice(elegidas.map(function (k) { return COBERTURAS[k]; }).join(', '));
      estado.coberturas = elegidas.slice();
      siguiente();
    });
    c.appendChild(ok);
    agregar(c);
  }

  // ---------- Contacto y cuenta ----------
  function campo(etiqueta, nombre, tipo, extra) {
    extra = extra || {};
    return '<label' + (extra.ancho ? ' class="ancho"' : '') + '>' + etiqueta +
      '<input type="' + tipo + '" name="' + nombre + '"' + (extra.auto ? ' autocomplete="' + extra.auto + '"' : '') +
      (extra.modo ? ' inputmode="' + extra.modo + '"' : '') + ' maxlength="' + (extra.max || 120) + '"></label>';
  }

  // modoPedido: 'nuevo' (crear cuenta) o 'ingresar'. Si ya hay sesión se usa 'sesion'; sin Supabase, 'simple'.
  function mostrarContacto(modoPedido) {
    quitarOpciones();
    var viejo = el.mensajes.querySelector('.pc-form');
    if (viejo) viejo.remove();
    var modo = !LPJ.configurado ? 'simple' : (usuario ? 'sesion' : (modoPedido || 'nuevo'));
    var f = document.createElement('form');
    f.className = 'pc-form';
    f.noValidate = true;
    var autoriza = '<label class="pc-check"><input type="checkbox" name="autoriza"> Autorizo a La Prima Justa Ltda. a tratar mis datos para cotizar y contactarme, según la Ley 1581 de 2012.</label>';
    var html = '';
    if (modo === 'sesion') {
      html = '<p class="pc-form-titulo">Enviaremos la solicitud desde su cuenta (' + LPJ.escapar(usuario.email) + ').</p>' +
        campo('Empresa a asegurar', 'empresa', 'text', { ancho: true, auto: 'organization' }) +
        campo('Su nombre', 'nombre', 'text', { auto: 'name' }) +
        campo('Celular', 'celular', 'tel', { auto: 'tel', modo: 'tel', max: 20 }) +
        (perfil && perfil.autoriza_datos ? '' : autoriza);
    } else if (modo === 'ingresar') {
      html = '<p class="pc-form-titulo">Ingrese a su cuenta</p>' +
        campo('Correo', 'correo', 'email', { auto: 'email' }) +
        campo('Contraseña', 'clave', 'password', { auto: 'current-password' }) +
        campo('Empresa a asegurar (si es otra)', 'empresa', 'text', { ancho: true, auto: 'organization' });
    } else {
      html = (modo === 'nuevo' ? '<p class="pc-form-titulo">Cree su cuenta para enviar la solicitud y seguir su avance.</p>' : '') +
        campo('Nombre de la empresa', 'empresa', 'text', { ancho: true, auto: 'organization' }) +
        campo('Su nombre', 'nombre', 'text', { auto: 'name' }) +
        campo('Celular', 'celular', 'tel', { auto: 'tel', modo: 'tel', max: 20 }) +
        campo('Correo', 'correo', 'email', { auto: 'email', ancho: modo !== 'nuevo' }) +
        (modo === 'nuevo' ? campo('Cree una contraseña (mín. 8)', 'clave', 'password', { auto: 'new-password' }) : '') +
        autoriza;
    }
    html += '<div class="pc-error" role="alert"></div><button type="submit" class="pc-chip principal">' + (modo === 'ingresar' ? 'Ingresar y ver resumen' : 'Ver resumen') + '</button>';
    if (modo === 'nuevo') html += '<button type="button" class="pc-link" data-modo="ingresar">Ya tengo cuenta: ingresar</button>';
    if (modo === 'ingresar') html += '<button type="button" class="pc-link" data-modo="nuevo">No tengo cuenta: crearla</button>';
    f.innerHTML = html;

    if (modo === 'sesion' && perfil) {
      f.elements.empresa.value = perfil.empresa || '';
      f.elements.nombre.value = perfil.nombre || '';
      f.elements.celular.value = perfil.celular || '';
    }
    var cambio = f.querySelector('.pc-link');
    if (cambio) cambio.addEventListener('click', function () { mostrarContacto(cambio.getAttribute('data-modo')); });
    f.addEventListener('submit', function (ev) { ev.preventDefault(); enviarContacto(f, modo); });
    agregarArriba(f);
  }

  async function enviarContacto(f, modo) {
    var e = f.querySelector('.pc-error');
    function falla(m) { e.textContent = m; e.style.display = 'block'; bajar(); }
    var v = function (n) { return f.elements[n] ? f.elements[n].value.trim() : ''; };
    var d = { empresa: v('empresa'), nit: v('nit'), nombre: v('nombre'), celular: v('celular'), correo: v('correo').toLowerCase() };
    var boton = f.querySelector('button[type=submit]');
    if (boton.disabled) return;

    if (modo === 'ingresar') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo) || !v('clave')) return falla('Escriba su correo y su contraseña.');
      boton.disabled = true;
      var listo = ocupar();
      try {
        usuario = await LPJ.ingresar(d.correo, v('clave'));
      } catch (err) { listo(); boton.disabled = false; return falla(LPJ.error(err)); }
      try { perfil = await LPJ.perfil(); } catch (err) { perfil = null; }
      listo();
      pintarCuenta();
      var empresa = d.empresa || (perfil && perfil.empresa) || '';
      if (!perfil || !empresa || !perfil.nombre || !perfil.celular || !perfil.autoriza_datos) return mostrarContacto();
      estado.contacto = { empresa: empresa, nit: perfil.nit || '', nombre: perfil.nombre, celular: perfil.celular, correo: usuario.email };
      f.remove();
      usuarioDice('Ingresé como ' + usuario.email);
      return siguiente();
    }

    if (!d.empresa || !d.nombre) return falla('Escriba el nombre de la empresa y su nombre.');
    if (d.celular.replace(/\D/g, '').length < 7) return falla('Revise el número de celular.');

    if (modo === 'sesion') {
      d.correo = usuario.email;
      d.nit = (perfil && perfil.nit) || '';
      var casilla = f.elements.autoriza;
      if (casilla && !casilla.checked) return falla('Para continuar debe autorizar el tratamiento de datos.');
      f.remove();
      usuarioDice(d.empresa + ' · ' + d.nombre + ' · ' + d.celular);
      estado.contacto = d;
      var cambios = { nombre: d.nombre, celular: d.celular };
      if (!perfil || !perfil.empresa) cambios.empresa = d.empresa;
      LPJ.guardarPerfil(cambios).then(function () { return casilla ? LPJ.autorizarDatos() : LPJ.perfil(); })
        .then(function (p) { if (p) perfil = p; }).catch(function () { /* no bloquea */ });
      return siguiente();
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) return falla('Revise el correo.');
    if (modo === 'nuevo' && f.elements.clave.value.length < 8) return falla('La contraseña debe tener al menos 8 caracteres.');
    if (!f.elements.autoriza.checked) return falla('Para continuar debe autorizar el tratamiento de datos.');

    if (modo === 'nuevo') {
      boton.disabled = true;
      var fin = ocupar();
      try {
        var r = await LPJ.registrar(d.correo, f.elements.clave.value, { nombre: d.nombre, celular: d.celular, empresa: d.empresa, autoriza: 'true' });
        if (r.requiereConfirmar) {
          estado.sinConfirmar = true;
        } else {
          usuario = r.usuario;
          try { perfil = await LPJ.completarPerfil({ nombre: d.nombre, celular: d.celular, empresa: d.empresa }); } catch (err) { perfil = null; }
          pintarCuenta();
        }
      } catch (err) {
        if (!err.noDisponible) { boton.disabled = false; return falla(LPJ.error(err)); }
        estado.sinCuenta = true;       // el servicio de cuentas no respondió: la solicitud sigue por correo
      } finally { fin(); }
    }
    f.remove();
    usuarioDice(d.empresa + ' · ' + d.nombre + ' · ' + d.celular + ' · ' + d.correo);
    estado.contacto = d;
    siguiente();
  }

  // ---------- Montos ----------
  function leerMonto(texto) {
    var t = texto.toLowerCase().replace(/\$/g, '').replace(/cop|pesos/g, '').trim();
    var m = t.match(/\d[\d.,]*/);
    if (!m) return null;
    var num = m[0].replace(/[.,]+$/, '');
    var factor = 1;
    if (/mil\s*millones|\bmm\b|millardo/.test(t)) factor = 1e9;
    else if (/mill|\bm\b|\d\s*m$/.test(t)) factor = 1e6;
    else if (/\bmil\b|\bk\b|\d\s*k$/.test(t)) factor = 1e3;
    var decimal = /^\d{1,3}[.,]\d{1,2}$/.test(num);          // "1,5" o "1.5"
    if (decimal) num = num.replace(',', '.');
    else if (factor > 1) num = num.replace(/\./g, '').replace(',', '.');
    else num = num.replace(/[.,]/g, '');
    var v = parseFloat(num) * factor;
    if (!isFinite(v) || v <= 0) return null;
    if (factor === 1 && v < 1000) v = v * 1e6;               // "300" se entiende como 300 millones
    return Math.round(v);
  }

  function pesos(v) {
    if (typeof v !== 'number') return v || 'Por definir';
    return '$' + v.toLocaleString('es-CO');
  }

  // ---------- Entrada libre ----------
  function normalizar(t) {
    return ' ' + String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:"]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  }

  function esPregunta(texto, libre) {
    if (texto.indexOf('?') >= 0) return true;
    if (libre) return false;
    return /^ (que|como|cual|cuales|cuanto|cuanta|cuantos|cuantas|donde|cuando|por que|para que|quien|puedo|se puede|me cubre|cubre|incluye|es obligatori|sirve|tienen|ustedes) /.test(normalizar(texto));
  }

  function coincideOpcion(p, texto) {
    var t = normalizar(texto).trim();
    if (p.id === 'empleados') {
      var n = parseInt(texto.replace(/\D/g, ''), 10);
      if (n > 0) return n <= 5 ? '1 a 5' : n <= 20 ? '6 a 20' : n <= 50 ? '21 a 50' : n <= 200 ? '51 a 200' : 'Más de 200';
    }
    if (t.length < 2) return null;
    var hallados = p.opciones.filter(function (o) { return normalizar(o).indexOf(' ' + t) >= 0; });
    if (hallados.length === 1) return hallados[0];
    var frase = ' ' + t + ' ';
    hallados = p.opciones.filter(function (o) {
      return normalizar(o).trim().split(' ').some(function (w) { return w.length >= 5 && frase.indexOf(' ' + w) >= 0; });
    });
    return hallados.length === 1 ? hallados[0] : null;
  }

  function alEscribir() {
    var texto = el.input.value.trim();
    if (!texto || ocupado) return;
    if (botPendientes > 0) {
      // El asistente aún está "escribiendo": se espera a que termine para no cruzar los mensajes.
      clearTimeout(reintento);
      reintento = setTimeout(alEscribir, 200);
      return;
    }
    el.input.value = '';
    estado.tocado = true;
    var p = pasoActual();

    if (estado.esperandoAjuste || (estado.enResumen && !esPregunta(texto, true))) {
      usuarioDice(texto);
      estado.esperandoAjuste = false;
      estado.ajustes.push(texto);
      return responderAjuste(texto);
    }
    if (p && !esPregunta(texto, p.libre)) {
      if (p.tipo === 'texto') { quitarOpciones(); usuarioDice(texto); return guardar(p, texto); }
      if (p.tipo === 'monto') { quitarOpciones(); usuarioDice(texto); return guardar(p, leerMonto(texto) || texto); }
      if (p.tipo === 'archivo') { quitarOpciones(); usuarioDice(texto); estado[p.id + 'Texto'] = texto; return siguiente(); }
      if (p.tipo === 'multi') {
        usuarioDice(texto);
        estado.ajustes.push(texto);
        return bot('Anotado: se lo paso a su asesor como ajuste. Cuando termine de elegir, toque "Continuar".', function () { mostrarCoberturas(); });
      }
      if (p.tipo === 'opciones') {
        var op = coincideOpcion(p, texto);
        quitarOpciones();
        usuarioDice(texto);
        if (p.id === 'actividad' && op !== 'Otra actividad') {
          // Se conserva la descripción del cliente; si encaja en una categoría, se usan sus coberturas recomendadas.
          if (!op || normalizar(op).trim() !== normalizar(texto).trim()) estado.actividadOtra = texto;
          return guardar(p, op || 'Otra actividad');
        }
        if (op) return guardar(p, op);
        if (p.abierta) return guardar(p, texto);
        return bot('Para continuar, elija una de las opciones.', function () { mostrarControles(p); });
      }
      if (p.tipo === 'contacto') {
        usuarioDice(texto);
        var f = el.mensajes.querySelector('.pc-form');
        return bot('Para continuar, complete sus datos en el formulario.', function () { if (f) agregarArriba(f); else mostrarContacto(); });
      }
    }
    usuarioDice(texto);
    responderPregunta(texto);
  }

  function respuestaRapida(texto) {
    var t = normalizar(texto);
    for (var i = 0; i < RESPUESTAS.length; i++) {
      for (var j = 0; j < RESPUESTAS[i].p.length; j++) {
        var clave = RESPUESTAS[i].p[j];
        var buscado = clave.charAt(0) === ' ' ? ' ' + normalizar(clave).trim() + ' ' : normalizar(clave).trim();
        if (t.indexOf(buscado) >= 0) return RESPUESTAS[i].r;
      }
    }
    return null;
  }

  // Intención de cotizar o descripción del negocio, cuando todavía no ha empezado una solicitud.
  function respuestaInicio(texto) {
    var t = normalizar(texto);
    var quiere = / (cotizar|cotizarme|cotizacion|cotice|coticen|cotizo) /.test(t)
      || / (necesito|quiero|busco|requiero|me interesa) (cotizar |adquirir |comprar |tomar |sacar )?(un |el |una |la )?(seguro|poliza) /.test(t)
      || / (asegurar|proteger) (mi|mis|el|la|un|una|nuestro|nuestra) /.test(t)
      || / (seguro|poliza) para (mi|mis|el|la|un|una|nuestro|nuestra) /.test(t);
    var negocio = texto.indexOf('?') < 0 && / (tengo|tenemos|somos|soy|mi|nuestro|nuestra) (un |una |el |la |dueno de |duena de )?[a-z ]{0,40}(empresa|negocio|local|tienda|restaurante|ferreteria|bodega|oficina|taller|fabrica|almacen|consultorio|panaderia|cafeteria|hotel|gimnasio|drogueria|papeleria|peluqueria|clinica|colegio|pyme) /.test(t);
    if (!quiere && !negocio) return null;
    return 'Con gusto. Toque "Cotizar mi póliza PYME" y en unos 3 minutos dejamos lista su solicitud. Si ya tiene póliza y quiere mejorarla, toque "Mejorar mi póliza actual".';
  }

  // Saludos, "tengo una pregunta" y agradecimientos.
  var PALABRA_CORTES = /^(gracias|muchas|mil|muy|amable|perfecto|listo|ok|okay|vale|de|acuerdo|entendido|bueno|bien|super|genial|excelente|por|ahora|eso|es|todo|si|no|claro)$/;
  var PALABRA_CIERRE = /^(gracias|perfecto|listo|ok|okay|vale|acuerdo|entendido|amable|genial|excelente)$/;
  function respuestaCortesia(texto) {
    var t = normalizar(texto).trim();
    var palabras = t.split(' ');
    if (palabras.length <= 4 && /^(hola|holi|buenas|buenos dias|buen dia|buenas tardes|buenas noches|hey|saludos|que tal)( |$)/.test(t)) {
      return 'Hola. Le ayudo a cotizar o mejorar el seguro de su empresa. Elija una opción o escriba su pregunta.';
    }
    if (texto.indexOf('?') >= 0) return null;
    if (palabras.length <= 7 && /(^| )(pregunta|preguntas|duda|dudas|consulta|inquietud)( |$)/.test(t)) {
      return 'Claro, escríbala y le respondo.';
    }
    if (palabras.length <= 6 && palabras.every(function (w) { return PALABRA_CORTES.test(w); }) && palabras.some(function (w) { return PALABRA_CIERRE.test(w); })) {
      return 'Con gusto. Aquí estoy si necesita algo más.';
    }
    return null;
  }

  function contextoIA() {
    var c = {};
    ['tipo', 'actividad', 'actividadOtra', 'ciudad', 'inmueble', 'valorEdificio', 'valorContenidos', 'valorMercancias', 'valorElectronico', 'empleados', 'limiteRC', 'objetivo'].forEach(function (k) {
      if (estado[k] !== undefined) c[k] = estado[k];
    });
    if (estado.coberturas) c.coberturas = estado.coberturas.map(function (k) { return COBERTURAS[k]; });
    if (estado.ajustes.length) c.ajustesPedidos = estado.ajustes;
    if (estado.archivos.length) c.archivosAdjuntos = estado.archivos.map(function (a) { return a.tipo; });
    if (estado.enviado) c.solicitudEnviada = true;
    return c;
  }

  function preguntarIA(texto, alResponder) {
    historialIA.push({ role: 'user', content: texto });
    if (!CONFIG.apiChat) return alResponder(null);
    var controlador = window.AbortController ? new AbortController() : null;
    var reloj = setTimeout(function () { if (controlador) controlador.abort(); }, 20000);
    fetch(CONFIG.apiChat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensajes: historialIA, contexto: contextoIA() }),
      signal: controlador ? controlador.signal : undefined
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { clearTimeout(reloj); alResponder(d && d.respuesta ? d.respuesta : null); })
      .catch(function () { clearTimeout(reloj); alResponder(null); });
  }

  function guardarConversacion() {
    // Con sesión iniciada, las preguntas fuera de un trámite también quedan guardadas en Mi cuenta.
    if (!usuario || !LPJ.configurado) return;
    var nuevos = transcripcion.slice(guardadoHasta);
    guardadoHasta = transcripcion.length;
    LPJ.guardarMensajes(nuevos, estado.solicitudId || null).catch(function () { /* no bloquea */ });
  }

  function responderPregunta(texto) {
    ocupado = true;
    el.enviar.disabled = true;
    var t = escribiendo();
    preguntarIA(texto, async function (resp) {
      if (!resp) resp = respuestaRapida(texto);
      if (!resp && !pasos) resp = respuestaInicio(texto);
      if (!resp) resp = respuestaCortesia(texto);
      if (!resp) {
        if (estado.enviado && estado.solicitudId) {
          // La solicitud ya se envió: el mensaje se le pasa al asesor.
          try {
            await LPJ.accionCliente(estado.solicitudId, 'mensaje', texto);
            guardadoHasta = transcripcion.length;
            LPJ.avisarAsesor('Mensaje del cliente — #' + estado.numero + ' ' + estado.contacto.empresa, {
              _replyto: estado.contacto.correo, Solicitud: '#' + estado.numero, Empresa: estado.contacto.empresa, Mensaje: texto,
              'Gestionar en el panel': CONFIG.sitio + '/asesor.html#s=' + estado.solicitudId
            });
            resp = 'Le pasé su mensaje a su asesor. Le responderá pronto; lo verá en Mi cuenta.';
          } catch (e) {
            resp = 'No pude enviarle su mensaje a su asesor. Escríbale por WhatsApp al ' + CONFIG.whatsappVisible + '.';
          }
        } else if (pasos && !estado.enviado) {
          estado.preguntas.push(texto);
          resp = 'Buena pregunta. La dejo anotada para su asesor, que se la responde junto con la cotización.';
        } else {
          resp = esPregunta(texto)
            ? 'No tengo esa respuesta a la mano. Su asesor se la resuelve por WhatsApp al ' + CONFIG.whatsappVisible + ', o puede dejarla en su solicitud al cotizar.'
            : 'No estoy seguro de haberle entendido. Puede elegir una de las opciones, escribir su pregunta o hablar con su asesor por WhatsApp al ' + CONFIG.whatsappVisible + '.';
        }
      }
      t.remove();
      ocupado = false;
      el.enviar.disabled = false;
      historialIA.push({ role: 'assistant', content: resp });
      burbuja(resp, 'pc-bot');
      if (!pasos || estado.enviado) guardarConversacion();
      retomar();
    });
  }

  function retomar() {
    var p = pasoActual();
    if (estado.enviado) {
      opcionesFinales();
    } else if (estado.enResumen) {
      opcionesResumen();
    } else if (!p) {
      menuInicio();
    } else if (p.tipo === 'contacto') {
      var f = el.mensajes.querySelector('.pc-form');
      bot('Cuando quiera, complete sus datos para enviar la solicitud.', function () { if (f) agregarArriba(f); else mostrarContacto(); });
    } else {
      bot('Sigamos con su solicitud. ' + ((!LPJ.configurado && p.textoSinArchivos) || p.texto), function () { mostrarControles(p); });
    }
  }

  // ---------- Resumen, ajustes y envío ----------
  function num(v) { return typeof v === 'number' ? v : 0; }

  function precioOrientativo() {
    var t = CONFIG.tarifas;
    if (!t || !t.tasas || estado.tipo !== 'cotizacion' || esRamo()) return null;
    var base = 0;
    var valores = {
      incendio: num(estado.valorEdificio) + num(estado.valorContenidos) + num(estado.valorMercancias),
      hurto: num(estado.valorContenidos) + num(estado.valorMercancias),
      electronico: num(estado.valorElectronico),
      maquinaria: num(estado.valorContenidos)
    };
    (estado.coberturas || []).forEach(function (k) {
      if (t.tasas[k] && valores[k]) base += valores[k] * t.tasas[k] / 1000;
      else if (t.fijas && t.fijas[k]) base += t.fijas[k];
    });
    if (!base) return null;
    base = Math.max(base, t.minima || 0);
    return { desde: Math.round(base * 0.85 / 1000) * 1000, hasta: Math.round(base * 1.2 / 1000) * 1000 };
  }

  function filasResumen() {
    var e = estado;
    var f = [['Solicitud', e.tipo === 'mejora' ? 'Mejorar póliza actual' : 'Cotización nueva']];
    if (esRamo()) {
      f.push(['Seguro', e.ramo], ['Actividad', e.empresaQue], ['Ciudad', e.ciudad], ['Empleados', e.empleados], ['Detalle', e.detalle], ['Tiene el seguro hoy', e.polizaActual]);
      return f;
    }
    if (e.ramo) f.push(['Seguro', 'Póliza PYME']);
    if (e.objetivo) f.push(['Objetivo', e.objetivo]);
    f.push(['Actividad', e.actividadOtra && e.actividad !== 'Otra actividad' ? e.actividad + ' (' + e.actividadOtra + ')' : (e.actividadOtra || e.actividad)]);
    f.push(['Ciudad', e.ciudad]);
    if (e.tipo === 'cotizacion') {
      f.push(['Local', e.inmueble]);
      if (e.inmueble === 'Propio') f.push(['Edificio', pesos(e.valorEdificio)]);
      f.push(['Muebles y equipos', pesos(e.valorContenidos)]);
      f.push(['Mercancías', pesos(e.valorMercancias)]);
      f.push(['Equipo electrónico', pesos(e.valorElectronico)]);
      f.push(['Empleados', e.empleados]);
      f.push(['Coberturas', (e.coberturas || []).map(function (k) { return COBERTURAS[k]; }).join(', ')]);
      if (e.limiteRC) f.push(['Límite RC', e.limiteRC]);
      f.push(['Tiene póliza hoy', e.polizaActual]);
    }
    if (e.polizaDetalle) f.push(['Póliza actual', e.polizaDetalle]);
    if (e.polizaArchivoTexto) f.push(['Póliza actual', e.polizaArchivoTexto]);
    if (e.contratoArchivoTexto) f.push(['Requisitos del contrato', e.contratoArchivoTexto]);
    if (e.archivos.length) f.push(['Archivos', e.archivos.map(function (a) { return a.archivo.name; }).join(', ')]);
    return f;
  }

  // Lista de pares [campo, valor]: así se conserva el orden al guardarla en la base.
  function datosParaGuardar() {
    var o = filasResumen().map(function (r) { return [r[0], r[1] || '—']; });
    if (estado.precio) o.push(['Precio orientativo mostrado', estado.precio]);
    if (estado.preguntas.length) o.push(['Preguntas pendientes', estado.preguntas.join(' | ')]);
    o.push(['Contacto', estado.contacto.nombre + ' · ' + estado.contacto.celular + ' · ' + estado.contacto.correo]);
    if (estado.contacto.nit) o.push(['NIT', estado.contacto.nit]);
    return o;
  }

  function mostrarResumen() {
    estado.enResumen = true;
    bot('Este es el resumen de su solicitud:', function () {
      var d = document.createElement('div');
      d.className = 'pc-resumen';
      var h = document.createElement('h4');
      h.textContent = estado.contacto.empresa;
      d.appendChild(h);
      var dl = document.createElement('dl');
      filasResumen().forEach(function (r) {
        var dt = document.createElement('dt'); dt.textContent = r[0];
        var dd = document.createElement('dd'); dd.textContent = r[1] || '—';
        dl.appendChild(dt); dl.appendChild(dd);
      });
      d.appendChild(dl);
      if (estado.ajustes.length) {
        var aj = document.createElement('p');
        aj.className = 'pc-resumen-ajustes';
        aj.textContent = 'Cambios pedidos: ' + estado.ajustes.join(' · ');
        d.appendChild(aj);
      }
      var pr = document.createElement('div');
      pr.className = 'pc-precio';
      var po = precioOrientativo();
      if (po) {
        estado.precio = pesos(po.desde) + ' a ' + pesos(po.hasta);
        pr.innerHTML = 'Precio orientativo anual<strong></strong>Valor de referencia. Su asesor le envía el precio exacto de cada aseguradora.';
        pr.querySelector('strong').textContent = estado.precio;
      } else {
        pr.textContent = estado.tipo === 'mejora'
          ? 'Su asesor revisa su póliza y le envía en máximo 24 horas hábiles las opciones para bajar la prima o mejorar las coberturas.'
          : 'Su asesor le envía la comparación de precios de las aseguradoras en máximo 24 horas hábiles.';
      }
      d.appendChild(pr);
      agregar(d);
      bot('¿Está todo como lo quiere? Si quiere cambiar algo (un límite, agregar o quitar una cobertura, algo que le pida un contrato), escríbalo antes de enviar.', opcionesResumen);
    });
  }

  function opcionesResumen() {
    opciones(['Enviar solicitud', 'Quiero ajustar algo'], function (v) {
      if (v === 'Enviar solicitud') enviarSolicitud();
      else pedirAjuste();
    }, 'Enviar solicitud');
  }

  function pedirAjuste() {
    estado.esperandoAjuste = true;
    bot('Escriba qué quiere cambiar. Por ejemplo: "subir la responsabilidad civil a 1.000 millones", "quitar rotura de maquinaria" o "el contrato me pide RC con mi cliente como beneficiario".');
    el.input.focus();
  }

  function responderAjuste(texto) {
    ocupado = true;
    el.enviar.disabled = true;
    var t = escribiendo();
    preguntarIA('El cliente pide este ajuste a las coberturas de su solicitud: "' + texto + '". Confírmalo en una o dos frases y, si aplica, explica brevemente qué implica.', function (resp) {
      t.remove();
      ocupado = false;
      el.enviar.disabled = false;
      resp = resp || 'Anotado. Su asesor incluirá ese ajuste en la cotización.';
      historialIA.push({ role: 'assistant', content: resp });
      burbuja(resp, 'pc-bot');
      opciones(['Enviar solicitud', 'Agregar otro ajuste'], function (v) {
        if (v === 'Enviar solicitud') enviarSolicitud(); else pedirAjuste();
      }, 'Enviar solicitud');
    });
  }

  function textoSolicitud() {
    var c = estado.contacto;
    var l = [(esRamo() ? 'Solicitud ' + estado.ramo : 'Solicitud PYME') + (estado.numero ? ' #' + estado.numero : '') + ' — laprimajusta.co', '',
      'Empresa: ' + c.empresa + (c.nit ? ' (NIT ' + c.nit + ')' : ''),
      'Contacto: ' + c.nombre, 'Celular: ' + c.celular, 'Correo: ' + c.correo, ''];
    filasResumen().forEach(function (r) { l.push(r[0] + ': ' + (r[1] || '—')); });
    if (estado.precio) l.push('Precio orientativo mostrado: ' + estado.precio);
    if (estado.ajustes.length) { l.push('', 'Ajustes pedidos:'); estado.ajustes.forEach(function (a) { l.push('- ' + a); }); }
    if (estado.preguntas.length) { l.push('', 'Preguntas pendientes:'); estado.preguntas.forEach(function (a) { l.push('- ' + a); }); }
    return l.join('\n');
  }

  function conversacionTexto() {
    return transcripcion.map(function (m) { return (m.rol === 'cliente' ? 'Cliente: ' : 'Asistente: ') + m.texto; }).join('\n');
  }

  async function enviarSolicitud() {
    if (ocupado) return;
    estado.enResumen = false;
    estado.esperandoAjuste = false;
    ocupado = true;
    el.enviar.disabled = true;
    var c = estado.contacto;
    var n = estado.archivos.length;
    var conCuenta = LPJ.configurado && usuario;
    var t = escribiendo();
    if (conCuenta && n) { t.remove(); burbuja('Enviando su solicitud y subiendo ' + (n === 1 ? 'el archivo' : 'los ' + n + ' archivos') + '. Puede tardar un momento…', 'pc-bot', true); t = escribiendo(); }
    var guardada = false;
    var errorArchivos = [];

    if (conCuenta) {
      try {
        var s = await LPJ.crearSolicitud(estado.tipo, c.empresa, datosParaGuardar(), estado.ajustes);
        estado.solicitudId = s.id;
        estado.numero = s.numero;
        guardada = true;
        for (var i = 0; i < n; i++) {
          try { await LPJ.subirArchivo(estado.archivos[i].archivo, { solicitudId: s.id, tipo: estado.archivos[i].tipo }); }
          catch (err) { errorArchivos.push(estado.archivos[i].archivo.name); }
        }
        try { await LPJ.guardarMensajes(transcripcion.slice(guardadoHasta), s.id); guardadoHasta = transcripcion.length; } catch (err) { /* no bloquea */ }
      } catch (err) {
        guardada = false;
      }
    } else if (LPJ.configurado && estado.sinConfirmar) {
      // La cuenta está pendiente de confirmar por correo: la solicitud se registra cuando el cliente ingrese por primera vez.
      LPJ.guardarPendiente({ correo: c.correo, tipo: estado.tipo, empresa: c.empresa, datos: datosParaGuardar(), ajustes: estado.ajustes, mensajes: transcripcion.slice() });
    }

    var campos = {
      _replyto: c.correo,
      'Solicitud': (estado.numero ? '#' + estado.numero + ' · ' : '') + (estado.tipo === 'mejora' ? 'Mejora de póliza' : 'Cotización nueva'),
      Empresa: c.empresa, NIT: c.nit || '—', Contacto: c.nombre, Celular: c.celular, Correo: c.correo
    };
    filasResumen().forEach(function (r) { campos[r[0]] = r[1] || '—'; });
    if (estado.precio) campos['Precio orientativo mostrado'] = estado.precio;
    campos['Ajustes pedidos'] = estado.ajustes.length ? estado.ajustes.join(' | ') : 'Ninguno';
    campos['Preguntas pendientes'] = estado.preguntas.length ? estado.preguntas.join(' | ') : 'Ninguna';
    if (guardada) campos['Gestionar en el panel'] = CONFIG.sitio + '/asesor.html#s=' + estado.solicitudId;
    else if (LPJ.configurado && !estado.sinConfirmar) campos['Aviso'] = 'La solicitud NO quedó en el panel porque el portal no respondió. Atiéndala por correo o WhatsApp.';
    if (!guardada && n) campos['Archivos pendientes'] = 'El cliente quiso adjuntar ' + n + ' archivo(s) que no quedaron guardados: pídale que los envíe por WhatsApp.';
    if (errorArchivos.length) campos['Archivos que no subieron'] = errorArchivos.join(' | ');
    campos['Conversación'] = conversacionTexto();
    var avisado = await LPJ.avisarAsesor((estado.tipo === 'mejora' ? 'Mejora de póliza PYME' : esRamo() ? 'Cotización ' + estado.ramo : 'Cotización PYME') + (estado.numero ? ' #' + estado.numero : '') + ' — ' + c.empresa, campos);

    t.remove();
    ocupado = false;
    el.enviar.disabled = false;
    if (!guardada && !avisado) {
      // Nada salió: se vuelve al resumen para que el cliente pueda reintentar o usar WhatsApp.
      estado.enResumen = true;
      burbuja('No pude enviar la solicitud. Revise su conexión e intente de nuevo, o envíela por WhatsApp.', 'pc-bot');
      var cont = opciones(['Enviar solicitud', 'Quiero ajustar algo'], function (v) { if (v === 'Enviar solicitud') enviarSolicitud(); else pedirAjuste(); }, 'Enviar solicitud');
      cont.appendChild(enlaceChip('Enviar por WhatsApp', enlaceWhatsApp()));
      return;
    }
    estado.enviado = true;
    if (guardada) {
      burbuja('Listo. Su solicitud #' + estado.numero + ' quedó registrada y ' + CONFIG.nombreAsesor + ', su asesor, ya fue avisado. Le responderá en máximo 24 horas hábiles.\n\nEn Mi cuenta puede ver en qué etapa va, subir documentos, pedir ajustes y, cuando esté lista, solicitar la emisión y ver la información de pago.' +
        (errorArchivos.length ? '\n\nNo pude subir: ' + errorArchivos.join(', ') + '. Puede intentarlo de nuevo desde Mi cuenta.' : ''), 'pc-bot');
    } else {
      burbuja('Listo. Su solicitud le llegó a ' + CONFIG.nombreAsesor + ', su asesor. Le escribirá en máximo 24 horas hábiles.' +
        (estado.sinConfirmar ? '\n\nLe enviamos un correo para confirmar su cuenta. Cuando la confirme, verá aquí el avance de su solicitud.'
          : LPJ.configurado ? '\n\nEn este momento no pudimos registrarla en su cuenta, pero su asesor ya la tiene.' : '') +
        (n ? '\n\nSus archivos no quedaron guardados: envíelos por WhatsApp con el botón de abajo.' : '\n\nSi quiere agilizar, envíele también el resumen por WhatsApp.'), 'pc-bot');
    }
    opcionesFinales();
  }

  function enlaceWhatsApp() {
    return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(estado.contacto ? textoSolicitud() : 'Hola, quiero cotizar una póliza PYME para mi empresa.');
  }

  function opcionesFinales() {
    quitarOpciones();
    var c = document.createElement('div');
    c.className = 'pc-opciones';
    if (estado.solicitudId) c.appendChild(enlaceChip('Ver mi solicitud', 'mi-cuenta.html#s=' + estado.solicitudId, true));
    c.appendChild(enlaceChip('Escribir por WhatsApp', enlaceWhatsApp(), !estado.solicitudId));
    var n = document.createElement('button');
    n.type = 'button';
    n.className = 'pc-chip';
    n.textContent = 'Nueva solicitud';
    n.addEventListener('click', reiniciar);
    c.appendChild(n);
    agregar(c);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
