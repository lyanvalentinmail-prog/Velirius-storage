/**
 * Router IA: ChatGPT / Gemini / Deepseek.
 *
 * El documento de Google Drive marca estos tres endpoints con "need api".
 * Con la variable de entorno correspondiente se llama al proveedor real;
 * sin clave se responde con un asistente local en "modo demo" para que el
 * endpoint siga siendo funcional en cualquier despliegue.
 */
import { json, ErrorHttp, limpiar, normalizar } from '../utiles.mjs';

const MODELOS = {
  chatgpt: { clave: 'OPENAI_API_KEY', proveedor: 'OpenAI', modelo: 'gpt-4o-mini' },
  gemini: { clave: 'GEMINI_API_KEY', proveedor: 'Google', modelo: process.env.GEMINI_MODELO || 'gemini-2.0-flash' },
  deepseek: { clave: 'DEEPSEEK_API_KEY', proveedor: 'DeepSeek', modelo: 'deepseek-chat' },
};

async function postJson(url, cuerpo, cabeceras, tiempo = 20000) {
  const respuesta = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(tiempo),
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body: JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    datos = { raw: texto.slice(0, 500) };
  }
  if (!respuesta.ok) {
    throw new Error(`${respuesta.status}: ${datos?.error?.message || datos?.raw || 'error del proveedor'}`);
  }
  return datos;
}

function respuestaDemo(texto, modelo) {
  const t = normalizar(texto);
  const hora = new Date();
  if (/^(hola|hi|hello|buenas|hey|que tal)/.test(t)) {
    return `¡Hola! Soy el asistente de demostración de ${modelo}. Configura la clave del proveedor para hablar con el modelo real.`;
  }
  if (/(hora|fecha|time|date|dia de hoy)/.test(t)) {
    return `En UTC son las ${hora.toISOString().slice(11, 19)} del ${hora.toISOString().slice(0, 10)}.`;
  }
  if (/(que es una api|qué es una api|what is an api)/.test(t)) {
    return 'Una API es un conjunto de rutas HTTP que un programa expone para que otros programas puedan pedirle datos o acciones. Esta web, por ejemplo, expone /api/tools/morse, /api/canvas/brat, etc.';
  }
  if (/(adios|chau|bye)/.test(t)) return '¡Hasta luego! 👋';
  if (/(gracias|thanks)/.test(t)) return '¡De nada! ✨';
  if (/(quien eres|who are you|como te llamas)/.test(t)) {
    return `Soy el modo demo de ${modelo} dentro de Velirius API. No uso red ni claves: soy un asistente local de respaldo.`;
  }
  return `Recibí tu mensaje: "${limpiar(texto, 180)}". Este es el modo demo de ${modelo}: para respuestas del modelo real, define la variable de entorno ${MODELOS[Object.keys(MODELOS).find((k) => MODELOS[k].modelo === modelo)]?.clave || 'del proveedor'} en Vercel o Render.`;
}

export function indice(ctx) {
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    router: 'ia',
    descripcion: 'Con clave se usa el proveedor real; sin clave, modo demo local.',
    modelos: Object.entries(MODELOS).map(([nombre, m]) => ({
      nombre,
      proveedor: m.proveedor,
      modelo: m.modelo,
      variable: m.clave,
      configurado: Boolean(process.env[m.clave]),
      url: `${ctx.base}/api/ia/${nombre}?texto=Hola`,
    })),
  });
}

export async function consultar(ctx) {
  const nombre = (ctx.parametro(['modelo', 'ia'], '') || ctx.segmentos.at(-1) || 'chatgpt').toLowerCase();
  const config = MODELOS[nombre];
  if (!config) {
    throw new ErrorHttp(`El modelo "${nombre}" no existe.`, 404, { disponibles: Object.keys(MODELOS) });
  }

  const texto = ctx.parametro(['texto', 'text', 'q', 'pregunta', 'mensaje', 'prompt'], '');
  const historial = Array.isArray(ctx.cuerpo?.mensajes) ? ctx.cuerpo.mensajes : null;
  if (!texto && !historial) throw new ErrorHttp('Falta el parámetro "texto" (o "mensajes" en POST).', 400);
  const sistema = ctx.parametro(['sistema', 'system'], 'Eres un asistente útil y breve de Velirius API.');
  const temperatura = Math.min(Math.max(Number(ctx.parametro(['temperatura'], '0.7')) || 0.7, 0), 2);
  const clave = process.env[config.clave];

  if (!clave) {
    return json({
      ok: true,
      status: true,
      creator: 'Velirius',
      modelo: config.modelo,
      proveedor: config.proveedor,
      modo: 'demo',
      entrada: texto,
      respuesta: respuestaDemo(texto, config.modelo),
      aviso: `Define ${config.clave} en el panel de Vercel/Render para usar ${config.proveedor} real.`,
    });
  }

  const mensajes = historial || [
    ...(sistema ? [{ role: 'system', content: sistema }] : []),
    { role: 'user', content: texto },
  ];

  let respuesta;
  let uso = null;
  try {
    if (nombre === 'chatgpt' || nombre === 'deepseek') {
      const base = nombre === 'chatgpt' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
      const datos = await postJson(
        base,
        { model: config.modelo, messages: mensajes, temperature: temperatura, max_tokens: 700 },
        { Authorization: `Bearer ${clave}` }
      );
      respuesta = datos?.choices?.[0]?.message?.content;
      uso = datos?.usage || null;
    } else {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.modelo)}:generateContent?key=${encodeURIComponent(clave)}`;
      const datos = await postJson(url, {
        systemInstruction: { parts: [{ text: sistema }] },
        contents: (historial || [{ role: 'user', parts: [{ text: texto }] }]).map((m) => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content || m.parts?.[0]?.text || String(m) }],
        })),
        generationConfig: { temperature: temperatura, maxOutputTokens: 700 },
      });
      respuesta = datos?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n');
      uso = datos?.usageMetadata || null;
    }
    if (!respuesta) throw new Error('El proveedor no devolvió texto');
  } catch (error) {
    throw new ErrorHttp(`El proveedor ${config.proveedor} falló: ${error.message}`, 502, {
      modelo: config.modelo,
      demo: `${ctx.base}/api/ia/${nombre}?texto=${encodeURIComponent(texto)}`,
    });
  }

  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    modelo: config.modelo,
    proveedor: config.proveedor,
    modo: 'api',
    entrada: texto,
    respuesta,
    uso,
  });
}
