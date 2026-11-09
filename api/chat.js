// Función de Vercel: responde preguntas sobre la póliza PYME con Claude Haiku.
// La clave se configura en Vercel como variable de entorno ANTHROPIC_API_KEY (nunca en el código).
const fs = require('fs');
const path = require('path');

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const MAX_TOKENS_RESPUESTA = 500;
const MAX_MENSAJES_HISTORIAL = 12;   // solo se envían los últimos mensajes
const MAX_PREGUNTAS_CONVERSACION = 20;
const MAX_CARACTERES_MENSAJE = 1000;
const ORIGENES = [
  'https://laprimajusta.co',
  'https://www.laprimajusta.co',
  'http://localhost:8000',
];

let conocimiento = '';
try {
  conocimiento = fs.readFileSync(path.join(process.cwd(), 'conocimiento', 'pyme.md'), 'utf8');
} catch (e) {
  conocimiento = 'Base de conocimiento no disponible.';
}

const INSTRUCCIONES = `Eres el asistente PYME de La Prima Justa, una agencia de seguros en Colombia.
Atiendes a dueños y administradores de pequeñas y medianas empresas que quieren cotizar o entender una póliza PYME.

Reglas:
- Responde en español de Colombia, trato de "usted", claro y cercano. Respuestas cortas: máximo 4 a 6 líneas, sin tablas.
- Usa SOLO la información de la base de conocimiento. Si algo no está ahí o depende del condicionado de una aseguradora, dilo y explica que el asesor lo confirma en la cotización formal.
- Nunca inventes precios, tasas, deducibles, sublímites ni condiciones de una aseguradora específica. No prometas que algo está cubierto: di "normalmente" o "según la aseguradora".
- Solo hablas de seguros para empresas y de La Prima Justa. Si preguntan otra cosa, redirige amablemente.
- Si el cliente pide cambiar coberturas o límites, confirma el cambio en una frase y dile que quedará en su solicitud para el asesor.
- Cuando ayude, invítalo a continuar la cotización en el chat.
- No pidas datos sensibles (contraseñas, números de tarjeta o cuentas).

Base de conocimiento:
`;

const contadorIp = new Map(); // límite simple por IP (se reinicia con cada arranque de la función)

function permitirOrigen(req, res) {
  const origen = req.headers.origin || '';
  const ok = ORIGENES.includes(origen) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origen);
  if (ok) res.setHeader('Access-Control-Allow-Origin', origen);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return ok;
}

module.exports = async function handler(req, res) {
  const origenOk = permitirOrigen(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!origenOk) return res.status(403).json({ error: 'Origen no permitido' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'IA no configurada' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida';
  const hora = Math.floor(Date.now() / 3600000);
  const clave = ip + ':' + hora;
  const usados = (contadorIp.get(clave) || 0) + 1;
  contadorIp.set(clave, usados);
  if (contadorIp.size > 5000) contadorIp.clear();
  if (usados > 40) return res.status(429).json({ error: 'Demasiadas preguntas, intente más tarde' });

  const cuerpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const mensajes = Array.isArray(cuerpo.mensajes) ? cuerpo.mensajes : [];
  const preguntas = mensajes.filter(m => m && m.role === 'user').length;
  if (preguntas === 0) return res.status(400).json({ error: 'Sin mensaje' });
  if (preguntas > MAX_PREGUNTAS_CONVERSACION) {
    return res.status(200).json({ respuesta: 'Hemos hablado bastante. Para seguir, un asesor le atiende directamente por WhatsApp al 314 422 0945.' });
  }

  const historial = mensajes
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MENSAJES_HISTORIAL)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CARACTERES_MENSAJE) }));
  while (historial.length && historial[0].role !== 'user') historial.shift();

  const contexto = cuerpo.contexto ? JSON.stringify(cuerpo.contexto).slice(0, 1500) : '';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS_RESPUESTA,
        system: [
          // Bloque fijo y en caché: se cobra al precio reducido en cada pregunta.
          { type: 'text', text: INSTRUCCIONES + conocimiento, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: contexto ? 'Datos que el cliente ya dio en el chat: ' + contexto : 'El cliente aún no ha dado datos de su empresa.' },
        ],
        messages: historial,
      }),
    });
    const datos = await r.json();
    if (!r.ok) {
      console.error('Error Anthropic', r.status, JSON.stringify(datos).slice(0, 500));
      return res.status(502).json({ error: 'La IA no respondió' });
    }
    const texto = (datos.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return res.status(200).json({ respuesta: texto || 'No tengo esa información; su asesor se la confirma.' });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'La IA no respondió' });
  }
};
