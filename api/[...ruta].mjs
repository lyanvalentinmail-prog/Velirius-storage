/**
 * Catch-all de Vercel: /api/<cualquier>/<ruta>.
 * Ejemplos: /api/health, /api/canvas/brat, /api/tools/morse, /api/search/youtube
 *
 * El mismo manejador que usa Render (server.mjs). Vercel rellena
 * req.query.ruta con los segmentos; app.mjs también lee req.url, así que
 * funciona igual si Vercel cambia la forma de exponer la ruta.
 */
import manejador from '../src/app.mjs';

export default manejador;

export const config = {
  maxDuration: 30,
};
