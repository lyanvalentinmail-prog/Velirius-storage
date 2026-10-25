import {
  json,
  VERSION,
  CREADOR,
  ErrorHttp,
} from '../utiles.mjs';
import {
  CATEGORIAS,
  CATALOGO_PLANO,
  TOTAL_ENDPOINTS,
  TOTAL_ROUTERS,
  resumenCategorias,
  openapi,
} from '../catalogo.mjs';

export function info(ctx) {
  return json({
    ok: true,
    status: true,
    creator: CREADOR,
    nombre: 'Velirius API',
    version: VERSION,
    descripcion:
      'API REST pública con endpoints funcionales. Categorías definidas en el documento "Categorias" de Google Drive.',
    routers: TOTAL_ROUTERS,
    endpoints: TOTAL_ENDPOINTS,
    documentacion: `${ctx.base}/#/home`,
    openapi: `${ctx.base}/api/openapi.json`,
    categorias: resumenCategorias(ctx.base),
    hora: new Date().toISOString(),
  });
}

export function salud() {
  return json({
    ok: true,
    status: true,
    servicio: 'Velirius API',
    estado: 'online',
    version: VERSION,
    node: process.version,
    arriba: Math.round(process.uptime()),
    memoria: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
    hora: new Date().toISOString(),
  });
}

export function categorias(ctx) {
  return json({
    ok: true,
    status: true,
    creator: CREADOR,
    total: TOTAL_ROUTERS,
    categorias: resumenCategorias(ctx.base),
  });
}

export function categoriaDetalle(ctx) {
  const id = (ctx.parametro(['id', 'categoria'], '') || ctx.segmentos.at(-1) || '').toLowerCase();
  const categoria = CATEGORIAS.find((c) => c.id === id);
  if (!categoria) {
    throw new ErrorHttp(`La categoría "${id}" no existe.`, 404, {
      disponibles: CATEGORIAS.map((c) => c.id),
    });
  }
  return json({
    ok: true,
    status: true,
    creator: CREADOR,
    ...categoria,
    total: categoria.endpoints.length,
    endpoints: categoria.endpoints,
  });
}

export function catalogo(ctx) {
  return json({
    ok: true,
    status: true,
    creator: CREADOR,
    version: VERSION,
    total: CATALOGO_PLANO.length,
    endpoints: CATALOGO_PLANO,
  });
}

export function especificacion(ctx) {
  return json(openapi(ctx.base));
}

export function echo(ctx) {
  const consulta = Object.fromEntries(ctx.q.entries());
  return json({
    ok: true,
    status: true,
    creator: CREADOR,
    metodo: ctx.metodo,
    consulta,
    cuerpo: ctx.cuerpo || {},
    headers: {
      'user-agent': ctx.req.headers?.['user-agent'],
      'content-type': ctx.req.headers?.['content-type'],
    },
    hora: new Date().toISOString(),
  });
}
