#!/usr/bin/env node
/**
 * Servidor Node para Render (y para `npm run dev` en local).
 *
 * Sirve la web estática y delega TODO /api/* al mismo manejador que Vercel.
 * Cero frameworks, cero dependencias obligatorias: basta con Node >= 20.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import manejador from './src/app.mjs';
import { VERSION } from './src/utiles.mjs';
import { TOTAL_ENDPOINTS, TOTAL_ROUTERS } from './src/catalogo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const PUERTO = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const ARCHIVOS_PERMITIDOS = new Set([
  'index.html',
  'galeria.html',
  'api-docs.html',
  '404.html',
  'robots.txt',
  'galeria.json',
  'favicon.svg',
]);
const CARPETAS_PERMITIDAS = ['assets', 'fotos', 'datos', 'docs'];
const RUTAS_SPA = new Set([
  'home', 'docs', 'anime', 'canvas', 'download', 'ia', 'reactions',
  'search', 'tools', 'sistema', 'galeria', 'api-docs',
]);

function esRutaPublica(relativa) {
  if (ARCHIVOS_PERMITIDOS.has(relativa)) return true;
  return CARPETAS_PERMITIDAS.some((carpeta) => relativa.startsWith(`${carpeta}/`));
}

async function servirEstatico(req, res, url) {
  let relativa;
  try {
    relativa = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    res.writeHead(400).end('Ruta no válida');
    return;
  }
  if (!relativa || relativa.endsWith('/')) relativa = `${relativa}index.html`;

  const destino = path.resolve(RAIZ, relativa);
  if (destino !== RAIZ && !destino.startsWith(`${RAIZ}${path.sep}`)) {
    res.writeHead(403).end('Prohibido');
    return;
  }

  let info = await stat(destino).catch(() => null);
  let archivo = destino;
  if (!info && !path.extname(destino)) {
    // /ruta-limpia -> /ruta-limpia.html
    archivo = `${destino}.html`;
    info = await stat(archivo).catch(() => null);
  }

  let permitido = esRutaPublica(relativa);
  const esSPA = !path.extname(relativa) && RUTAS_SPA.has(relativa.split('/')[0]);
  if ((!info || !info.isFile()) && esSPA) {
    // Rutas limpias del SPA (/home, /canvas, /docs…) -> index.html
    archivo = path.join(RAIZ, 'index.html');
    info = await stat(archivo).catch(() => null);
    permitido = true;
  }

  if (!info || !info.isFile() || !permitido) {
    const pagina = await readFile(path.join(RAIZ, '404.html')).catch(() => Buffer.from('<h1>404</h1>'));
    res.writeHead(404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(pagina);
    return;
  }

  const extension = path.extname(archivo).toLowerCase();
  const tipo = MIME[extension] || 'application/octet-stream';
  const cabeceras = {
    'Content-Type': tipo,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
  };

  // Soporte básico de Range para los vídeos de assets/canvas.
  const rango = req.headers.range;
  if (rango && /^bytes=\d*-\d*$/.test(rango)) {
    const [inicioTexto, finTexto] = rango.replace('bytes=', '').split('-');
    const inicio = inicioTexto ? Number(inicioTexto) : 0;
    const fin = finTexto ? Math.min(Number(finTexto), info.size - 1) : info.size - 1;
    if (inicio <= fin && inicio < info.size) {
      const datos = await readFile(archivo);
      res.writeHead(206, {
        ...cabeceras,
        'Content-Range': `bytes ${inicio}-${fin}/${info.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(fin - inicio + 1),
      });
      res.end(datos.subarray(inicio, fin + 1));
      return;
    }
  }

  const datos = await readFile(archivo);
  res.writeHead(200, { ...cabeceras, 'Accept-Ranges': 'bytes', 'Content-Length': String(datos.length) });
  res.end(req.method === 'HEAD' ? undefined : datos);
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      await manejador(req, res);
    } else {
      await servirEstatico(req, res, url);
    }
  } catch (error) {
    console.error('[servidor]', error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Error interno del servidor' }));
  }
});

servidor.listen(PUERTO, HOST, () => {
  console.log(`\n  ⚡ Velirius API v${VERSION}`);
  console.log(`  → http://localhost:${PUERTO}`);
  console.log(`  → ${TOTAL_ROUTERS} routers · ${TOTAL_ENDPOINTS} endpoints · /api/health\n`);
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => servidor.close(() => process.exit(0)));
}
