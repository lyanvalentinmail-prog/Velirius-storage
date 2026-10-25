#!/usr/bin/env node
/**
 * Servidor local sin dependencias para previsualizar la galería.
 * Regenera galeria.json al arrancar y cada vez que cambia /fotos.
 *
 * Uso:  npm run dev   ->   http://localhost:5173
 */
import { createServer } from 'node:http';
import { readFile, stat, watch } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function generar() {
  return new Promise((resolve) => {
    const proceso = spawn(process.execPath, ['scripts/generar-galeria.mjs'], {
      cwd: RAIZ,
      stdio: 'inherit',
    });
    proceso.on('close', resolve);
    proceso.on('error', (error) => {
      console.error('[dev] no se pudo generar la galería:', error.message);
      resolve();
    });
  });
}

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let rutaRelativa = decodeURIComponent(url.pathname);
    if (rutaRelativa.endsWith('/')) rutaRelativa += 'index.html';

    const destino = path.join(RAIZ, path.normalize(rutaRelativa).replace(/^(\.\.[/\\])+/, ''));
    if (!destino.startsWith(RAIZ)) {
      res.writeHead(403).end('Prohibido');
      return;
    }

    // Resolvemos la ruta: archivo exacto, /ruta -> ruta.html (rutas limpias) o 404.
    let archivo = null;
    let info = await stat(destino).catch(() => null);

    if (info?.isDirectory()) {
      archivo = path.join(destino, 'index.html');
      if (!(await stat(archivo).catch(() => null))) archivo = null;
    } else if (info) {
      archivo = destino;
    } else if (!path.extname(destino)) {
      archivo = `${destino}.html`;
      if (!(await stat(archivo).catch(() => null))) archivo = null;
    }

    if (!archivo) {
      const pagina404 = await readFile(path.join(RAIZ, '404.html')).catch(() => null);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        pagina404 ||
          '<h1>404</h1><p>No encontrado. ¿Está la foto dentro de <code>fotos/</code>?</p>'
      );
      return;
    }

    const contenido = await readFile(archivo);
    const extension = path.extname(archivo).toLowerCase();

    res.writeHead(200, {
      'Content-Type': MIME[extension] || 'application/octet-stream',
      // En desarrollo nunca cacheamos para ver los cambios al instante.
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(contenido);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Error del servidor: ${error.message}`);
  }
});

await generar();

servidor.listen(PUERTO, HOST, () => {
  console.log(`\n  Galería disponible en  http://localhost:${PUERTO}\n`);
});

// Regenera el manifiesto cuando añades o quitas fotos.
let temporizador;
try {
  const observador = watch(path.join(RAIZ, 'fotos'), { recursive: true });
  (async () => {
    for await (const evento of observador) {
      if (!/\.(jpe?g|png|webp|gif|avif|bmp|json)$/i.test(evento.filename || '')) continue;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        console.log('[dev] cambios en fotos/, regenerando galeria.json…');
        generar();
      }, 200);
    }
  })();
} catch {
  console.log('[dev] vigilancia de la carpeta fotos/ no disponible (añade las fotos manualmente)');
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    servidor.close(() => process.exit(0));
  });
}
