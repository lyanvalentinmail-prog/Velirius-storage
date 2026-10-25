/**
 * Catálogo único de endpoints.
 *
 * Es la fuente de verdad que usan: el router, la web de documentación,
 * /api/categories, /api/endpoints y /api/openapi.json. Así la documentación
 * nunca miente: si aparece en la web, existe una ruta que lo ejecuta.
 */
import { CANVAS } from './canvas-config.mjs';
import { REACCIONES, SERVICIOS_DESCARGA, SERVICIOS_BUSQUEDA } from './datasets.mjs';
import { VERSION } from './utiles.mjs';

const p = (nombre, ejemplo, descripcion = '', requerido = false) => ({
  nombre,
  ejemplo: String(ejemplo),
  descripcion,
  requerido,
});

function ep(ruta, descripcion, params = [], extra = {}) {
  const ejemplo = params.filter((x) => x.ejemplo !== '').length
    ? `${ruta}?${params
        .filter((x) => x.ejemplo !== '')
        .map((x) => `${encodeURIComponent(x.nombre)}=${encodeURIComponent(x.ejemplo)}`)
        .join('&')}`
    : ruta;
  return {
    ruta,
    metodo: 'GET',
    descripcion,
    params,
    tipo: 'json',
    ejemplo,
    ...extra,
  };
}

const TEXTO = p('texto', 'Hola mundo', 'Texto de entrada');
const Q = p('q', 'velirius', 'Término de búsqueda');

/* ------------------------------------------------------------------ */

const sistema = {
  id: 'sistema',
  nombre: 'Sistema',
  icono: '⚡',
  descripcion: 'Estado del servicio, catálogo de routers y especificación OpenAPI.',
  endpoints: [
    ep('/api', 'Información general: versión, routers, endpoints y enlaces.'),
    ep('/api/health', 'Comprobación de salud para Vercel / Render (health check).'),
    ep('/api/categories', 'Lista de routers/categorías con el número de endpoints.'),
    ep('/api/endpoints', 'Catálogo completo: cada ruta, método, parámetros y ejemplo.'),
    ep('/api/openapi.json', 'Especificación OpenAPI 3.1 generada desde el catálogo real.'),
    ep('/api/echo', 'Devuelve los parámetros recibidos. Sirve para probar GET y POST.', [p('mensaje', 'ping', 'Cualquier valor')], { metodo: 'GET, POST' }),
  ],
};

const anime = {
  id: 'anime',
  nombre: 'Anime',
  icono: '🌸',
  descripcion: 'Personajes, gacha y avatares. Funciona con datos locales y Jikan online.',
  endpoints: [
    ep('/api/anime', 'Índice del router Anime.'),
    ep('/api/anime/character', 'Busca personajes por nombre o serie.', [p('q', 'Naruto', 'Nombre o anime'), p('limite', '5', 'Máximo de resultados')]),
    ep('/api/anime/waifu', 'Devuelve un personaje femenino aleatorio.'),
    ep('/api/anime/maid', 'Devuelve una maid aleatoria.'),
    ep('/api/anime/gacha', 'Tirada de gacha con 10 personajes y rarezas.', [p('semilla', '', 'Semilla opcional para resultados reproducibles'), p('tiradas', '10', 'Número de tiradas (1-20)')]),
    ep('/api/anime/random', 'Personaje aleatorio de la base de datos.'),
    ep('/api/anime/avatar', 'Genera un avatar SVG para un nombre.', [p('nombre', 'Velirius', 'Nombre del avatar'), p('formato', '', 'png para rasterizar con sharp')], { tipo: 'imagen' }),
  ],
};

const canvas = {
  id: 'canvas',
  nombre: 'Canvas',
  icono: '🖼️',
  descripcion: 'Plantillas de imagen de Google Drive con texto y avatares personalizables.',
  endpoints: [
    ep('/api/canvas', 'Lista de todas las plantillas y sus parámetros.'),
    ...CANVAS.map((c) =>
      ep(`/api/canvas/${c.nombre}`, c.descripcion, c.params.map((x) => p(x.nombre, x.ejemplo, x.descripcion)), {
        tipo: 'imagen',
        nota: 'Devuelve image/svg+xml (o image/png con ?formato=png si sharp está disponible).',
      })
    ),
  ],
};

const download = {
  id: 'download',
  nombre: 'Download',
  icono: '⬇️',
  descripcion: 'Resuelve metadatos y enlaces de descarga de páginas públicas.',
  endpoints: [
    ep('/api/download', 'Índice del router Download.'),
    ...SERVICIOS_DESCARGA.map((s) =>
      ep(
        `/api/download/${s}`,
        s === 'direct'
          ? 'Proxy directo: reenvía el archivo remoto con CORS (binario).'
          : s === 'lyric'
            ? 'Busca la letra de una canción (artist/title o texto libre).'
            : s === 'aptoide'
              ? 'Metadatos y APK de una app por package name (API pública de Aptoide).'
              : s === 'playstore'
                ? 'Metadatos de una app de Google Play por package name.'
                : `Resuelve metadatos (título, miniatura, autor, enlaces) de ${s}.`,
        s === 'direct'
          ? [p('url', 'https://ejemplo.com/archivo.mp4', 'URL directa del archivo', true)]
          : s === 'lyric'
            ? [p('artista', 'Coldplay', 'Artista'), p('cancion', 'Yellow', 'Canción'), p('q', '', 'Búsqueda libre alternativa')]
            : s === 'aptoide' || s === 'playstore'
              ? [p('id', 'com.whatsapp', 'Package name de la app', true)]
              : [p('url', `https://www.${s}.com/`, 'URL del contenido', true), p('q', '', 'Búsqueda alternativa')],
        { tipo: s === 'direct' ? 'binario' : 'json' }
      )
    ),
  ],
};

const ia = {
  id: 'ia',
  nombre: 'IA',
  icono: '🧠',
  descripcion: 'ChatGPT, Gemini y Deepseek. Sin clave responden en modo demo local.',
  endpoints: [
    ep('/api/ia', 'Índice del router IA y estado de las claves configuradas.'),
    ...[
      ['chatgpt', 'OpenAI (gpt-4o-mini)', 'OPENAI_API_KEY'],
      ['gemini', 'Google Gemini (gemini-2.0-flash)', 'GEMINI_API_KEY'],
      ['deepseek', 'DeepSeek (deepseek-chat)', 'DEEPSEEK_API_KEY'],
    ].map(([nombre, modelo, clave]) =>
      ep(`/api/ia/${nombre}`, `Consulta ${modelo}. Requiere ${clave}; sin ella responde en modo demo.`, [
        p('texto', 'Explícame qué es una API en una frase', 'Pregunta o instrucción', true),
        p('sistema', '', 'Instrucción de sistema opcional'),
      ], { metodo: 'GET, POST', nota: `Variable de entorno: ${clave}` })
    ),
  ],
};

const reactions = {
  id: 'reactions',
  nombre: 'Reactions',
  icono: '💫',
  descripcion: 'Reacciones anime animadas (SVG con movimiento, sin archivos externos).',
  endpoints: [
    ep('/api/reactions', 'Lista de reacciones disponibles.'),
    ep('/api/reactions/random', 'Reacción aleatoria en JSON.'),
    ...REACCIONES.map((r) =>
      ep(`/api/reactions/${r.nombre}`, `${r.emoji} ${r.texto}: devuelve JSON con la URL de la animación.`, [p('formato', '', 'png para PNG estático')], { tipo: 'json' })
    ),
    ep('/api/reactions/hug.svg', 'Ejemplo de animación SVG directa (funciona con cualquier nombre).', [p('texto', '', 'Texto opcional')], { tipo: 'imagen' }),
  ],
};

const search = {
  id: 'search',
  nombre: 'Search',
  icono: '🔎',
  descripcion: 'Búsquedas en servicios externos con respaldo local cuando no hay red.',
  endpoints: [
    ep('/api/search', 'Búsqueda general en todos los servicios y en el catálogo local.', [Q, p('limite', '8', 'Máximo de resultados')]),
    ...SERVICIOS_BUSQUEDA.map((s) =>
      ep(`/api/search/${s}`, `Busca en ${s} (resultados reales vía DuckDuckGo / APIs públicas).`, [Q, p('limite', '8', 'Máximo de resultados')])
    ),
  ],
};

const tools = {
  id: 'tools',
  nombre: 'Tools',
  icono: '🛠️',
  descripcion: 'Utilidades puras: funcionan siempre, sin red ni claves.',
  endpoints: [
    ep('/api/tools', 'Índice del router Tools.'),
    ep('/api/tools/morse', 'Codifica y decodifica código Morse.', [p('texto', 'HOLA MUNDO', 'Texto o Morse'), p('accion', 'codificar', 'codificar | decodificar | auto')], { metodo: 'GET, POST' }),
    ep('/api/tools/traductor', 'Traduce texto (MyMemory/Google, con diccionario local de respaldo).', [p('texto', 'Hello world', 'Texto a traducir', true), p('destino', 'es', 'Idioma destino ISO 639-1'), p('origen', 'auto', 'Idioma origen o auto')], { metodo: 'GET, POST' }),
    ep('/api/tools/calculadora', 'Evalúa expresiones matemáticas de forma segura (sin eval).', [p('expresion', '2+2*sqrt(9)', 'Expresión', true)], { metodo: 'GET, POST' }),
    ep('/api/tools/base64', 'Codifica/decodifica Base64.', [p('texto', 'Velirius', 'Texto o Base64'), p('accion', 'codificar', 'codificar | decodificar')]),
    ep('/api/tools/uuid', 'Genera UUID v4 (o varios).', [p('cantidad', '1', 'Cantidad 1-20')]),
    ep('/api/tools/password', 'Genera contraseñas seguras.', [p('longitud', '16', 'Longitud 8-64'), p('cantidad', '1', 'Cantidad 1-10')]),
  ],
};

export const CATEGORIAS = [sistema, anime, canvas, download, ia, reactions, search, tools];

export const CATALOGO_PLANO = CATEGORIAS.flatMap((c) =>
  c.endpoints.map((e) => ({ ...e, categoria: c.id, categoriaNombre: c.nombre }))
);

export const TOTAL_ENDPOINTS = CATALOGO_PLANO.length;
export const TOTAL_ROUTERS = CATEGORIAS.length;

export function resumenCategorias(base = '') {
  return CATEGORIAS.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    icono: c.icono,
    descripcion: c.descripcion,
    total: c.endpoints.length,
    url: `${base}/api/categories/${c.id}`,
    web: `${base}/#/${c.id}`,
  }));
}

/** Construye un documento OpenAPI 3.1 a partir del catálogo real. */
export function openapi(base = '') {
  const paths = {};
  for (const e of CATALOGO_PLANO) {
    paths[e.ruta] = {
      [e.metodo.includes('POST') ? 'post' : 'get']: {
        tags: [e.categoriaNombre],
        summary: e.descripcion,
        operationId: `${e.categoria}_${e.ruta.split('/').filter(Boolean).join('_')}`,
        parameters: e.params.map((x) => ({
          name: x.nombre,
          in: 'query',
          required: Boolean(x.requerido),
          description: x.descripcion,
          schema: { type: 'string', example: x.ejemplo },
        })),
        responses: {
          200: {
            description: 'Respuesta correcta',
            content: {
              [e.tipo === 'imagen' ? 'image/svg+xml' : 'application/json']: {
                schema: { type: e.tipo === 'imagen' ? 'string' : 'object' },
              },
            },
          },
          400: { description: 'Parámetros incorrectos' },
        },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Velirius API',
      version: VERSION,
      description: 'API REST pública con endpoints funcionales. Categorías tomadas del documento "Categorias" de Google Drive.',
    },
    servers: [{ url: base || '/' }],
    tags: CATEGORIAS.map((c) => ({ name: c.nombre, description: c.descripcion })),
    paths,
  };
}
