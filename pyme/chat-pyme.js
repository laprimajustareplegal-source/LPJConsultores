/* Chat PYME — La Prima Justa
   Las preguntas de la cotización corren aquí mismo, sin IA (no gastan créditos).
   La IA solo se usa para preguntas libres, a través de la función de Vercel (CONFIG.apiChat). */
(function () {
  'use strict';

  var CONFIG = {
    // Dirección de la función de IA en Vercel, por ejemplo 'https://lpj-consultores.vercel.app/api/chat'.
    // Mientras esté vacía, el chat responde con las respuestas rápidas de abajo y anota la pregunta para el asesor.
    apiChat: '',
    correoAsesor: 'luis.pinilla@laprimajusta.co',
    nombreAsesor: 'Luis Felipe Pinilla',
    whatsapp: '573144220945',
    whatsappVisible: '314 422 0945',
    // Tarifas para el precio orientativo. Mientras sea null, el chat no muestra precio.
    // Formato: { minima: 450000, tasas: { incendio: 1.2, hurto: 0.8, ... } }  (tasas por mil sobre el valor asegurado)
    tarifas: null
  };

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

  // Respuestas rápidas sin IA (se usan si la IA no está configurada o no responde).
  var RESPUESTAS = [
    { p: ['deducible'], r: 'El deducible es la parte de cada pérdida que asume la empresa. Normalmente es un porcentaje de la pérdida con un mínimo en pesos o en salarios mínimos. Terremoto suele tener un deducible más alto. En la cotización formal le mostramos el deducible de cada aseguradora.' },
    { p: ['lucro', 'utilidad', 'cerrado', 'cierre'], r: 'El lucro cesante paga la utilidad que su negocio deja de ganar y los gastos fijos que debe seguir pagando mientras está cerrado por un daño cubierto, por ejemplo un incendio.' },
    { p: ['responsabilidad', ' rc ', 'tercero', 'cliente se cae', 'demanda'], r: 'La responsabilidad civil extracontractual protege a su empresa cuando causa daños a terceros en desarrollo de su actividad, por ejemplo un cliente que se lesiona dentro del local. Se puede ampliar a RC de productos, contratistas, patronal o parqueaderos según su negocio.' },
    { p: ['hurto', 'robo', 'roban'], r: 'La cobertura de hurto calificado paga cuando roban con violencia o forzando el acceso al local. El hurto simple, sin señales de fuerza, normalmente no está cubierto o tiene condiciones especiales.' },
    { p: ['terremoto', 'temblor', 'sismo'], r: 'El terremoto se cubre junto con incendio en la póliza PYME. Normalmente tiene un deducible específico, más alto que el de las demás coberturas.' },
    { p: ['arrend', 'arriendo', 'no soy dueño', 'no es mio', 'no es mío'], r: 'Si el local es arrendado, usted asegura sus contenidos (muebles, equipos, mercancías), las mejoras que haya hecho al local y su responsabilidad civil. El edificio lo asegura el dueño.' },
    { p: ['precio', 'cuanto cuesta', 'cuánto cuesta', 'valor de la poliza', 'valor de la póliza', 'cuanto vale', 'cuánto vale', 'prima'], r: 'El precio depende de la actividad, la ciudad, los valores asegurados y las coberturas. Complete la cotización aquí en el chat y su asesor le envía la comparación de precios de las aseguradoras en máximo 24 horas hábiles.' },
    { p: ['document', 'requisito', 'que necesito', 'qué necesito'], r: 'Para emitir la póliza se necesita el RUT, la cámara de comercio reciente, la cédula del representante legal y el formulario de conocimiento del cliente (SARLAFT). Según el valor, la aseguradora puede pedir fotos o una inspección del predio.' },
    { p: ['siniestro', 'reclam', 'me pasó', 'me paso', 'se quemó', 'se quemo', 'inund'], r: 'Si tuvo un siniestro: proteja los bienes para evitar más daños, guarde fotos y facturas, ponga la denuncia si fue hurto y avísenos de inmediato por WhatsApp al ' + CONFIG.whatsappVisible + '. Nosotros llevamos el trámite con la aseguradora.' },
    { p: ['aseguradora', 'compañía', 'compania', 'con quien', 'con quién'], r: 'Trabajamos con más de 15 aseguradoras, entre ellas SURA, AXA Colpatria, Allianz, Mapfre, HDI, Liberty, Seguros Bolívar, Seguros del Estado y La Equidad. Cotizamos con las que mejor se ajustan a su actividad.' },
    { p: ['valor asegurado', 'por cuanto aseguro', 'por cuánto aseguro', 'infraseguro'], r: 'Cada bien debe asegurarse por su valor de reposición, es decir, lo que cuesta reponerlo nuevo. Si se asegura por menos, en un siniestro la indemnización puede reducirse en proporción (infraseguro).' },
    { p: ['electr', 'computador', 'pos', 'datafono', 'datáfono'], r: 'La cobertura de equipo electrónico protege computadores, datáfonos, impresoras y equipos de comunicación frente a daños internos y accidentales.' },
    { p: ['maquinaria', 'máquina', 'maquina', 'nevera', 'horno'], r: 'La rotura de maquinaria cubre el daño súbito e imprevisto de máquinas en funcionamiento, por falla eléctrica o mecánica o por error de operación.' },
    { p: ['manejo', 'empleado roba', 'fraude', 'infidelidad'], r: 'La cobertura de manejo protege a la empresa frente a pérdidas por hurto, abuso de confianza o fraude cometido por sus empleados.' },
    { p: ['costo de la asesoria', 'costo de la asesoría', 'cobran', 'cuanto cobran', 'cuánto cobran'], r: 'Nuestra asesoría no tiene costo adicional para usted: la aseguradora remunera a la agencia.' },
    { p: ['donde', 'dónde', 'direccion', 'dirección', 'oficina', 'telefono', 'teléfono', 'contacto'], r: 'Estamos en la Calle 96 # 45A-31, Oficina 200, Bogotá, y atendemos empresas en toda Colombia. WhatsApp y llamadas: ' + CONFIG.whatsappVisible + '. Correo: info@laprimajusta.co.' },
    { p: ['poliza pyme', 'multirriesgo', 'que cubre', 'para que sirve'], r: 'La póliza PYME es un seguro empaquetado para pequeñas y medianas empresas: en una sola póliza se protegen los bienes del negocio (local, muebles, maquinaria, mercancías y equipos) y su responsabilidad frente a terceros. Cada aseguradora tiene su propia versión, por eso cotizamos con varias.' }
  ];

  var el = {};
  var estado, paso, historialIA, ocupado;

  var PASOS = [
    { id: 'actividad', texto: '¿A qué se dedica su empresa?', tipo: 'opciones', opciones: Object.keys(ACTIVIDADES).concat(['Otra actividad']) },
    { id: 'actividadOtra', texto: 'Cuénteme en pocas palabras a qué se dedica su empresa.', tipo: 'texto', si: function (e) { return e.actividad === 'Otra actividad'; } },
    { id: 'ciudad', texto: '¿En qué ciudad está el negocio? Puede escribirla.', tipo: 'texto', opciones: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla'] },
    { id: 'inmueble', texto: 'El local o la sede, ¿es propio o arrendado?', tipo: 'opciones', opciones: ['Propio', 'Arrendado'] },
    { id: 'valorEdificio', texto: '¿Cuánto vale la construcción del local (el edificio, sin el lote)? Escriba el valor aproximado, por ejemplo "300 millones".', tipo: 'monto', opciones: ['No sé'], si: function (e) { return e.inmueble === 'Propio'; } },
    { id: 'valorContenidos', texto: '¿Cuánto valen los muebles, la maquinaria y los equipos del negocio? Un valor aproximado está bien.', tipo: 'monto', opciones: ['No sé'] },
    { id: 'valorMercancias', texto: '¿Y el inventario o las mercancías que normalmente tiene en el local?', tipo: 'monto', opciones: ['No manejo inventario', 'No sé'] },
    { id: 'valorElectronico', texto: '¿Cuánto valen los equipos electrónicos (computadores, datáfonos, impresoras)?', tipo: 'monto', opciones: ['No sé'] },
    { id: 'empleados', texto: '¿Cuántas personas trabajan en la empresa?', tipo: 'opciones', opciones: ['1 a 5', '6 a 20', '21 a 50', '51 a 200', 'Más de 200'] },
    { id: 'coberturas', texto: 'Estas son las coberturas que le recomiendo para su actividad. Toque para quitar o agregar, y luego "Continuar".', tipo: 'multi' },
    { id: 'limiteRC', texto: '¿Con qué límite quiere la responsabilidad civil? Es lo máximo que pagaría la aseguradora por daños a terceros.', tipo: 'opciones', opciones: ['100 millones', '300 millones', '500 millones', '1.000 millones', 'No sé, que me recomienden'], si: function (e) { return e.coberturas && e.coberturas.indexOf('rc') >= 0; } },
    { id: 'polizaActual', texto: '¿Hoy tiene una póliza para el negocio?', tipo: 'opciones', opciones: ['No, sería nueva', 'Sí, quiero mejorarla'] },
    { id: 'polizaActualDetalle', texto: '¿Con qué aseguradora la tiene y cuándo vence?', tipo: 'texto', opciones: ['Prefiero no decir'], si: function (e) { return e.polizaActual === 'Sí, quiero mejorarla'; } },
    { id: 'contacto', texto: 'Ya casi. ¿A quién le enviamos la cotización?', tipo: 'form' }
  ];

  function $(id) { return document.getElementById(id); }

  function iniciar() {
    el.mensajes = $('pcMensajes');
    el.input = $('pcInput');
    el.enviar = $('pcEnviar');
    if (!el.mensajes) return;
    $('pcForm').addEventListener('submit', function (ev) { ev.preventDefault(); alEscribir(); });
    $('pcReiniciar').addEventListener('click', reiniciar);
    reiniciar();
  }

  function reiniciar() {
    estado = { ajustes: [], preguntas: [] };
    paso = -1;
    historialIA = [];
    ocupado = false;
    el.mensajes.innerHTML = '';
    bot('Hola, soy el asistente PYME de La Prima Justa. Le ayudo a cotizar el seguro de su empresa en unos 3 minutos.\n\nTambién puede escribirme cualquier pregunta sobre la póliza PYME.', function () {
      opciones(['Cotizar mi póliza PYME', 'Tengo una pregunta'], function (v) {
        if (v === 'Tengo una pregunta') {
          bot('Claro, escríbala abajo. Por ejemplo: "¿qué cubre el lucro cesante?" o "¿qué pasa si el local es arrendado?"');
          el.input.focus();
        } else {
          siguiente();
        }
      });
    });
  }

  // ---------- Mensajes ----------
  function bajar() { el.mensajes.scrollTop = el.mensajes.scrollHeight; }

  function agregar(nodo) { el.mensajes.appendChild(nodo); bajar(); return nodo; }

  function burbuja(texto, clase) {
    var d = document.createElement('div');
    d.className = 'pc-msg ' + clase;
    d.textContent = texto;
    return agregar(d);
  }

  function usuario(texto) { burbuja(texto, 'pc-user'); }

  function escribiendo() {
    var d = document.createElement('div');
    d.className = 'pc-escribiendo';
    d.innerHTML = '<i></i><i></i><i></i>';
    return agregar(d);
  }

  function bot(texto, luego) {
    var t = escribiendo();
    setTimeout(function () {
      t.remove();
      burbuja(texto, 'pc-bot');
      if (luego) luego();
    }, Math.min(400 + texto.length * 6, 1100));
  }

  function quitarOpciones() {
    var viejas = el.mensajes.querySelectorAll('.pc-opciones');
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
        c.remove();
        usuario(v);
        alElegir(v);
      });
      c.appendChild(b);
    });
    agregar(c);
  }

  // ---------- Flujo de cotización ----------
  function pasoActual() { return paso >= 0 && paso < PASOS.length ? PASOS[paso] : null; }

  function siguiente() {
    paso++;
    while (paso < PASOS.length && PASOS[paso].si && !PASOS[paso].si(estado)) paso++;
    if (paso >= PASOS.length) return mostrarResumen();
    preguntar(PASOS[paso]);
  }

  function preguntar(p) {
    bot(p.texto, function () {
      if (p.tipo === 'opciones') {
        opciones(p.opciones, function (v) { guardar(p, v); });
      } else if (p.tipo === 'texto' || p.tipo === 'monto') {
        if (p.opciones) opciones(p.opciones, function (v) { guardar(p, v); });
        el.input.focus();
      } else if (p.tipo === 'multi') {
        mostrarCoberturas(p);
      } else if (p.tipo === 'form') {
        mostrarFormulario(p);
      }
    });
  }

  function guardar(p, valor) {
    estado[p.id] = valor;
    if (p.id === 'actividad' && ACTIVIDADES[valor]) estado.recomendadas = ACTIVIDADES[valor].slice();
    if (p.id === 'actividadOtra') estado.recomendadas = ['incendio', 'hurto', 'electronico', 'rc'];
    siguiente();
  }

  function mostrarCoberturas(p) {
    quitarOpciones();
    var elegidas = (estado.recomendadas || ['incendio', 'hurto', 'electronico', 'rc']).slice();
    var c = document.createElement('div');
    c.className = 'pc-opciones';
    Object.keys(COBERTURAS).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pc-chip' + (elegidas.indexOf(k) >= 0 ? ' sel' : '');
      b.textContent = COBERTURAS[k];
      b.addEventListener('click', function () {
        var i = elegidas.indexOf(k);
        if (i >= 0) { elegidas.splice(i, 1); b.classList.remove('sel'); } else { elegidas.push(k); b.classList.add('sel'); }
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
      usuario(elegidas.map(function (k) { return COBERTURAS[k]; }).join(', '));
      estado.coberturas = elegidas;
      siguiente();
    });
    c.appendChild(ok);
    agregar(c);
  }

  function mostrarFormulario(p) {
    quitarOpciones();
    var f = document.createElement('form');
    f.className = 'pc-form';
    f.noValidate = true;
    f.innerHTML =
      '<label class="ancho">Nombre de la empresa<input type="text" name="empresa" autocomplete="organization" required></label>' +
      '<label>NIT (opcional)<input type="text" name="nit" inputmode="numeric"></label>' +
      '<label>Su nombre<input type="text" name="nombre" autocomplete="name" required></label>' +
      '<label>Celular<input type="tel" name="celular" autocomplete="tel" inputmode="tel" required></label>' +
      '<label>Correo<input type="email" name="correo" autocomplete="email" required></label>' +
      '<label class="pc-check"><input type="checkbox" name="autoriza" required> Autorizo a La Prima Justa Ltda. a tratar mis datos para cotizar y contactarme, según la Ley 1581 de 2012.</label>' +
      '<div class="pc-error"></div>' +
      '<button type="submit" class="pc-chip principal">Ver resumen</button>';
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var d = {
        empresa: f.empresa.value.trim(), nit: f.nit.value.trim(), nombre: f.nombre.value.trim(),
        celular: f.celular.value.trim(), correo: f.correo.value.trim()
      };
      var err = '';
      if (!d.empresa || !d.nombre) err = 'Escriba el nombre de la empresa y su nombre.';
      else if (d.celular.replace(/\D/g, '').length < 7) err = 'Revise el número de celular.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) err = 'Revise el correo.';
      else if (!f.autoriza.checked) err = 'Para continuar debe autorizar el tratamiento de datos.';
      var e = f.querySelector('.pc-error');
      if (err) { e.textContent = err; e.style.display = 'block'; return; }
      f.remove();
      usuario(d.empresa + ' · ' + d.nombre + ' · ' + d.celular + ' · ' + d.correo);
      estado.contacto = d;
      siguiente();
    });
    agregar(f);
    f.empresa.focus();
  }

  // ---------- Montos ----------
  function leerMonto(texto) {
    var t = texto.toLowerCase().replace(/\$/g, '').replace(/cop|pesos/g, '').trim();
    var m = t.match(/[\d.,]+/);
    if (!m) return null;
    var num = m[0];
    var factor = 1;
    if (/mil\s*millones|mm\b|millardo/.test(t)) factor = 1e9;
    else if (/mill|\bm\b|\d\s*m$/.test(t)) factor = 1e6;
    else if (/\bmil\b|\bk\b|\d\s*k$/.test(t)) factor = 1e3;
    if (factor > 1) num = num.replace(/\./g, '').replace(',', '.');
    else num = num.replace(/[.,]/g, '');
    var v = parseFloat(num) * factor;
    if (!isFinite(v) || v <= 0) return null;
    if (factor === 1 && v < 1000) v = v * 1e6; // "300" se entiende como 300 millones
    return Math.round(v);
  }

  function pesos(v) {
    if (typeof v !== 'number') return v || 'Por definir';
    return '$' + v.toLocaleString('es-CO');
  }

  // ---------- Entrada libre ----------
  function alEscribir() {
    var texto = el.input.value.trim();
    if (!texto || ocupado) return;
    el.input.value = '';
    var p = pasoActual();

    if (estado.esperandoAjuste) {
      usuario(texto);
      estado.esperandoAjuste = false;
      estado.ajustes.push(texto);
      responderAjuste(texto);
      return;
    }
    if (p && p.tipo === 'texto' && texto.indexOf('?') < 0) {
      quitarOpciones();
      usuario(texto);
      guardar(p, texto);
      return;
    }
    if (p && p.tipo === 'monto') {
      var v = leerMonto(texto);
      if (v) {
        quitarOpciones();
        usuario(texto);
        guardar(p, v);
        return;
      }
    }
    usuario(texto);
    responderPregunta(texto);
  }

  function normalizar(t) {
    return ' ' + t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:]/g, ' ') + ' ';
  }

  function respuestaRapida(texto) {
    var t = normalizar(texto);
    for (var i = 0; i < RESPUESTAS.length; i++) {
      for (var j = 0; j < RESPUESTAS[i].p.length; j++) {
        if (t.indexOf(normalizar(RESPUESTAS[i].p[j]).slice(1, -1)) >= 0) return RESPUESTAS[i].r;
      }
    }
    return null;
  }

  function contextoIA() {
    var c = {};
    ['actividad', 'actividadOtra', 'ciudad', 'inmueble', 'valorEdificio', 'valorContenidos', 'valorMercancias', 'valorElectronico', 'empleados', 'limiteRC'].forEach(function (k) {
      if (estado[k] !== undefined) c[k] = estado[k];
    });
    if (estado.coberturas) c.coberturas = estado.coberturas.map(function (k) { return COBERTURAS[k]; });
    if (estado.ajustes.length) c.ajustesPedidos = estado.ajustes;
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

  function responderPregunta(texto) {
    ocupado = true;
    el.enviar.disabled = true;
    var t = escribiendo();
    preguntarIA(texto, function (resp) {
      t.remove();
      ocupado = false;
      el.enviar.disabled = false;
      if (!resp) {
        resp = respuestaRapida(texto);
        if (!resp) {
          estado.preguntas.push(texto);
          resp = 'Buena pregunta. La dejo anotada para su asesor, que le responde con el detalle de cada aseguradora junto con la cotización.';
        }
      }
      historialIA.push({ role: 'assistant', content: resp });
      burbuja(resp, 'pc-bot');
      retomar();
    });
  }

  function retomar() {
    var p = pasoActual();
    if (estado.enviado) {
      opciones(['Escribir por WhatsApp'], function () { abrirWhatsApp(); });
    } else if (estado.enResumen) {
      opcionesResumen();
    } else if (!p) {
      opciones(['Cotizar mi póliza PYME'], function () { siguiente(); });
    } else if (p.tipo === 'form') {
      var f = el.mensajes.querySelector('.pc-form');
      bot('Cuando quiera, complete sus datos para enviarle la cotización.', function () { if (f) agregar(f); else preguntar(p); });
    } else {
      setTimeout(function () { bot('Sigamos con su cotización.', function () { paso--; siguiente(); }); }, 300);
    }
  }

  // ---------- Resumen, ajustes y envío ----------
  function precioOrientativo() {
    var t = CONFIG.tarifas;
    if (!t || !t.tasas) return null;
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

  function num(v) { return typeof v === 'number' ? v : 0; }

  function filasResumen() {
    var e = estado;
    var f = [
      ['Actividad', e.actividadOtra || e.actividad],
      ['Ciudad', e.ciudad],
      ['Local', e.inmueble]
    ];
    if (e.inmueble === 'Propio') f.push(['Edificio', pesos(e.valorEdificio)]);
    f.push(['Muebles y equipos', pesos(e.valorContenidos)]);
    f.push(['Mercancías', pesos(e.valorMercancias)]);
    f.push(['Equipo electrónico', pesos(e.valorElectronico)]);
    f.push(['Empleados', e.empleados]);
    f.push(['Coberturas', (e.coberturas || []).map(function (k) { return COBERTURAS[k]; }).join(', ')]);
    if (e.limiteRC) f.push(['Límite RC', e.limiteRC]);
    f.push(['Póliza actual', e.polizaActualDetalle ? e.polizaActual + ' (' + e.polizaActualDetalle + ')' : e.polizaActual]);
    return f;
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
      var pr = document.createElement('div');
      pr.className = 'pc-precio';
      var po = precioOrientativo();
      if (po) {
        estado.precio = pesos(po.desde) + ' a ' + pesos(po.hasta);
        pr.innerHTML = 'Precio orientativo anual<strong></strong>Valor de referencia. Su asesor le envía el precio exacto de cada aseguradora.';
        pr.querySelector('strong').textContent = estado.precio;
      } else {
        pr.textContent = 'Su asesor le envía la comparación de precios de las aseguradoras en máximo 24 horas hábiles.';
      }
      d.appendChild(pr);
      agregar(d);
      bot('¿Las coberturas están como las quiere? Si quiere cambiar algo (un límite, agregar o quitar una cobertura), dígamelo antes de enviar.', opcionesResumen);
    });
  }

  function opcionesResumen() {
    opciones(['Enviar solicitud', 'Quiero ajustar coberturas'], function (v) {
      if (v === 'Enviar solicitud') enviarSolicitud();
      else {
        estado.esperandoAjuste = true;
        bot('Escriba qué quiere cambiar. Por ejemplo: "subir la responsabilidad civil a 1.000 millones", "quitar rotura de maquinaria" o "agregar transporte de mercancías".');
        el.input.focus();
      }
    }, 'Enviar solicitud');
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
        if (v === 'Enviar solicitud') enviarSolicitud();
        else {
          estado.esperandoAjuste = true;
          bot('Escriba el siguiente ajuste.');
          el.input.focus();
        }
      }, 'Enviar solicitud');
    });
  }

  function textoSolicitud() {
    var c = estado.contacto;
    var l = ['Solicitud de cotización PYME — laprimajusta.co', '',
      'Empresa: ' + c.empresa + (c.nit ? ' (NIT ' + c.nit + ')' : ''),
      'Contacto: ' + c.nombre, 'Celular: ' + c.celular, 'Correo: ' + c.correo, ''];
    filasResumen().forEach(function (r) { l.push(r[0] + ': ' + (r[1] || '—')); });
    if (estado.precio) l.push('Precio orientativo mostrado: ' + estado.precio);
    if (estado.ajustes.length) { l.push('', 'Ajustes pedidos:'); estado.ajustes.forEach(function (a) { l.push('- ' + a); }); }
    if (estado.preguntas.length) { l.push('', 'Preguntas pendientes por responder:'); estado.preguntas.forEach(function (a) { l.push('- ' + a); }); }
    return l.join('\n');
  }

  function conversacion() {
    return historialIA.filter(function (m) { return m.content.indexOf('El cliente pide este ajuste') !== 0; })
      .map(function (m) { return (m.role === 'user' ? 'Cliente: ' : 'Asistente: ') + m.content; }).join('\n\n');
  }

  function enviarSolicitud() {
    estado.enResumen = false;
    var t = escribiendo();
    var c = estado.contacto;
    var datos = {
      _subject: 'Cotización PYME — ' + c.empresa,
      _template: 'box',
      _captcha: 'false',
      _replyto: c.correo,
      Empresa: c.empresa,
      NIT: c.nit || '—',
      Contacto: c.nombre,
      Celular: c.celular,
      Correo: c.correo
    };
    filasResumen().forEach(function (r) { datos[r[0]] = r[1] || '—'; });
    if (estado.precio) datos['Precio orientativo mostrado'] = estado.precio;
    datos['Ajustes pedidos'] = estado.ajustes.length ? estado.ajustes.join(' | ') : 'Ninguno';
    datos['Preguntas pendientes'] = estado.preguntas.length ? estado.preguntas.join(' | ') : 'Ninguna';
    datos['Conversación con el asistente'] = conversacion() || 'Sin preguntas';

    fetch('https://formsubmit.co/ajax/' + CONFIG.correoAsesor, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(datos)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.ok && String(j.success) !== 'false'; }); })
      .catch(function () { return false; })
      .then(function (ok) {
        t.remove();
        estado.enviado = true;
        if (ok) {
          burbuja('Listo. Su solicitud le llegó a ' + CONFIG.nombreAsesor + ', su asesor. Le escribirá en máximo 24 horas hábiles con las opciones de las aseguradoras.\n\nSi quiere agilizar, envíele también el resumen por WhatsApp.', 'pc-bot');
        } else {
          burbuja('No pude enviar la solicitud por correo. Envíela por WhatsApp con el botón de abajo y su asesor la recibe de inmediato.', 'pc-bot');
        }
        opciones(['Escribir por WhatsApp', 'Nueva cotización'], function (v) {
          if (v === 'Nueva cotización') reiniciar(); else { abrirWhatsApp(); retomar(); }
        }, 'Escribir por WhatsApp');
      });
  }

  function abrirWhatsApp() {
    var txt = estado.contacto ? textoSolicitud() : 'Hola, quiero cotizar una póliza PYME para mi empresa.';
    window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
