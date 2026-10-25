/**
 * Núcleo HTTP de Velirius API.
 *
 * Es un manejador (req, res) de Node puro, sin framework. Eso permite que el
 * MISMO código se ejecute como:
 *   · función serverless en Vercel  (api/index.mjs y api/[...ruta].mjs)
 *   · servicio Node en Render      (server.mjs)
 *   · servidor local               (npm run dev)
 */
import { crearContexto, fallo, ErrorHttp, VERSION } from './utiles.mjs';
import { CATALOGO_PLANO, CATEGORIAS, TOTAL_ENDPOINTS } from './catalogo.mjs';
import * as sistema from './endpoints/sistema.mjs';
import * as tools from './endpoints/tools.mjs';
import * as anime from './endpoints/anime.mjs';
import * as reactions from './endpoints/reactions.mjs';
import * as canvas from './endpoints/canvas.mjs';
import * as ia from './endpoints/ia.mjs';
import * as search from './endpoints/search.mjs';
import * as download from './endpoints/download.mjs';

/* ------------------------------------------------------------------ */
/* Tabla de rutas (generada desde el catálogo)                          */
/* ------------------------------------------------------------------ */

const rutas = new Map();
const registrar = (ruta, manejador) => rutas.set(ruta.toLowerCase(), manejador);

function manejadorDe(ruta) {
  if (ruta === '/api') return sistema.info;
  if (ruta.startsWith('/api/tools/morse')) return tools.morse;
  if (ruta.startsWith('/api/tools/traductor')) return tools.traductor;
  if (ruta.startsWith('/api/tools/calculadora')) return tools.calculadora;
  if (ruta.startsWith('/api/tools/base64')) return tools.base64;
  if (ruta.startsWith('/api/tools/uuid')) return tools.uuid;
  if (ruta.startsWith('/api/tools/password')) return tools.password;
  if (ruta === '/api/tools') return tools.indice;
  if (ruta.startsWith('/api/anime/character')) return anime.character;
  if (ruta.startsWith('/api/anime/waifu')) return anime.waifu;
  if (ruta.startsWith('/api/anime/maid')) return anime.maid;
  if (ruta.startsWith('/api/anime/gacha')) return anime.gacha;
  if (ruta.startsWith('/api/anime/avatar')) return anime.avatar;
  if (ruta.startsWith('/api/anime/random')) return anime.random;
  if (ruta === '/api/anime') return anime.indice;
  if (ruta.startsWith('/api/canvas/')) return canvas.ejecutar;
  if (ruta === '/api/canvas') return canvas.indice;
  if (ruta === '/api/download') return download.indice;
  if (ruta.startsWith('/api/download/')) return download.resolver;
  if (ruta === '/api/ia') return ia.indice;
  if (ruta.startsWith('/api/ia/')) return ia.consultar;
  if (ruta === '/api/reactions') return reactions.indice;
  if (ruta.startsWith('/api/reactions/') && ruta.endsWith('.svg')) return reactions.svgDirecto;
  if (ruta.startsWith('/api/reactions/random')) return reactions.random;
  if (ruta.startsWith('/api/reactions/')) return reactions.porNombre;
  if (ruta === '/api/search') return search.buscar;
  if (ruta.startsWith('/api/search/')) return search.buscar;
  if (ruta === '/api/health' || ruta === '/api/status') return sistema.salud;
  if (ruta === '/api/categories') return sistema.categorias;
  if (ruta.startsWith('/api/categories/')) return sistema.categoriaDetalle;
  if (ruta === '/api/endpoints' || ruta === '/api/catalog' || ruta === '/api/routes') return sistema.catalogo;
  if (ruta === '/api/openapi.json' || ruta === '/api/openapi') return sistema.especificacion;
  if (ruta === '/api/echo') return sistema.echo;
  return null;
}

for (const endpoint of CATALOGO_PLANO) {
  const manejador = manejadorDe(endpoint.ruta);
  if (manejador) registrar(endpoint.ruta, manejador);
}

// Alias cómodos que no aparecen en el catálogo principal.
registrar('/api/status', sistema.salud);
registrar('/api/ping', sistema.salud);
registrar('/api/catalog', sistema.catalogo);
registrar('/api/routes', sistema.catalogo);
registrar('/api/openapi', sistema.especificacion);
registrar('/api/tools/translate', tools.traductor);
registrar('/api/tools/calc', tools.calculadora);
registrar('/api/download/playstore', download.resolver);
registrar('/api/download/play', download.resolver);
registrar('/api/search/general', search.buscar);
for (const c of CATEGORIAS) registrar(`/api/categories/${c.id}`, sistema.categoriaDetalle);

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

const CABECERAS_BASE = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Expose-Headers': 'X-Velirius-Formato, Content-Disposition',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Powered-By': `Velirius API v${VERSION}`,
};

const limites = new Map();
function excedeLimite(ip) {
  const maximo = Number(process.env.LIMITE_POR_MINUTO ?? 120);
  if (!maximo) return false;
  const ahora = Date.now();
  const actual = limites.get(ip);
  if (!actual || ahora > actual.hasta) {
    limites.set(ip, { total: 1, hasta: ahora + 60_000 });
    return false;
  }
  actual.total += 1;
  if (limites.size > 5000) {
    for (const [clave, valor] of limites) if (valor.hasta < ahora) limites.delete(clave);
  }
  return actual.total > maximo;
}

function autorizado(ctx) {
  const clave = process.env.API_KEY;
  if (!clave) return true;
  const recibida =
    ctx.parametro(['apikey', 'api_key', 'key', 'token'], '') ||
    String(ctx.req.headers?.['x-api-key'] || '') ||
    (String(ctx.req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i) || [])[1] ||
    '';
  return recibida === clave;
}

function noEncontrado(ruta) {
  const sugerencias = CATALOGO_PLANO.filter((e) => {
    const base = ruta.split('/').slice(0, 3).join('/');
    return e.ruta.startsWith(base);
  })
    .slice(0, 6)
    .map((e) => e.ruta);
  return fallo(`Endpoint "${ruta}" no encontrado.`, 404, {
    total: TOTAL_ENDPOINTS,
    indice: '/api',
    documentacion: '/#/home',
    sugerencias,
  });
}

function escribir(res, resultado, metodo) {
  const cabeceras = { ...CABECERAS_BASE, ...resultado.cabeceras };
  if (!cabeceras['Content-Type'] && resultado.cuerpo) cabeceras['Content-Type'] = 'application/json; charset=utf-8';
  res.writeHead(resultado.estado || 200, cabeceras);
  if (metodo === 'HEAD') res.end();
  else res.end(resultado.cuerpo ?? '');
}

/** Manejador principal: compatible con Node http y con Vercel Functions. */
export default async function manejador(req, res) {
  const inicio = Date.now();
  try {
    const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
    let ruta = decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase() || '/api';

    // Vercel expone los segmentos del catch-all en req.query.ruta. Si la ruta
    // que llega es la del archivo de la función (o cualquier otra cosa rara),
    // reconstruimos la ruta pública a partir de esos segmentos.
    const dinamico = req.query?.ruta;
    if (dinamico && (!ruta.startsWith('/api/') || ruta.includes('[') || ruta.endsWith('.mjs'))) {
      const partes = (Array.isArray(dinamico) ? dinamico : String(dinamico).split('/'))
        .map((x) => String(x).trim())
        .filter((x) => x && !x.endsWith('.mjs') && !x.endsWith('.js') && !x.startsWith('['));
      ruta = `/api${partes.length ? `/${partes.join('/')}` : ''}`.toLowerCase();
    }
    if (!ruta.startsWith('/api')) ruta = '/api';

    if ((req.method || 'GET').toUpperCase() === 'OPTIONS') {
      return escribir(res, { estado: 204, cabeceras: {}, cuerpo: '' }, req.method);
    }

    const ctx = await crearContexto(req, res, url);
    if (!autorizado(ctx)) {
      return escribir(res, fallo('API key incorrecta o ausente.', 401, { como: '?apikey=... o cabecera X-API-Key' }), req.method);
    }
    if (excedeLimite(ctx.ip)) {
      return escribir(res, fallo('Límite de peticiones por minuto superado.', 429), req.method);
    }

    let manejadorRuta = rutas.get(ruta);
    if (!manejadorRuta && ruta.startsWith('/api/reactions/') && ruta.endsWith('.svg')) manejadorRuta = reactions.svgDirecto;
    if (!manejadorRuta && ruta.startsWith('/api/canvas/')) manejadorRuta = canvas.ejecutar;
    if (!manejadorRuta && ruta.startsWith('/api/search/')) manejadorRuta = search.buscar;
    if (!manejadorRuta && ruta.startsWith('/api/download/')) manejadorRuta = download.resolver;
    if (!manejadorRuta && ruta.startsWith('/api/ia/')) manejadorRuta = ia.consultar;
    if (!manejadorRuta && ruta.startsWith('/api/categories/')) manejadorRuta = sistema.categoriaDetalle;
    if (!manejadorRuta) return escribir(res, noEncontrado(ruta), req.method);

    const resultado = await manejadorRuta(ctx);
    resultado.cabeceras = { ...resultado.cabeceras, 'X-Velirius-Tiempo': `${Date.now() - inicio}ms` };
    return escribir(res, resultado, req.method);
  } catch (error) {
    if (error instanceof ErrorHttp) {
      return escribir(res, fallo(error.message, error.estado, error.detalles), req.method);
    }
    console.error('[velirius] error no controlado:', error);
    return escribir(
      res,
      fallo('Error interno del servidor.', 500, {
        detalle: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
      req.method
    );
  }
}
