#!/usr/bin/env node
/**
 * Suite de integración: levanta el MISMO servidor que usa Render, recorre los
 * 100 endpoints del catálogo y comprueba que todos responden de verdad.
 *
 *   npm test
 *
 * Para que sea rápida y determinista usa MODO_OFFLINE=1 (simula un despliegue
 * sin salida a internet) y un pequeño servidor mock en 127.0.0.1 que permite
 * probar los resolvers de descarga con HTML real.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as espera } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pasadas = 0;
let fallidas = 0;
const fallos = [];

function afirmar(condicion, mensaje) {
  if (condicion) {
    pasadas += 1;
  } else {
    fallidas += 1;
    fallos.push(mensaje);
    console.log(`  ✗ ${mensaje}`);
  }
}

async function puertoLibre() {
  const s = createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const puerto = s.address().port;
  await new Promise((r) => s.close(r));
  return puerto;
}

const IMAGEN_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

async function crearMock() {
  const pagina = `<!doctype html><html><head>
    <title>Página de prueba</title>
    <meta property="og:title" content="Video de prueba &amp; Velirius" />
    <meta property="og:description" content="Descripcion de prueba" />
    <meta property="og:image" content="http://127.0.0.1:PUERTO/foto.png" />
    <meta property="og:video" content="http://127.0.0.1:PUERTO/video.mp4" />
    </head><body><video><source src="/video.mp4" type="video/mp4"></video></body></html>`;
  let puerto;
  const servidor = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/pagina') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pagina.replaceAll('PUERTO', String(puerto)));
    } else if (url.pathname === '/archivo.txt') {
      const cuerpo = Buffer.from('velirius-api\n');
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': String(cuerpo.length) });
      res.end(cuerpo);
    } else if (url.pathname === '/foto.png') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(IMAGEN_1X1.length) });
      res.end(IMAGEN_1X1);
    } else {
      res.writeHead(404).end('no');
    }
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  puerto = servidor.address().port;
  return { servidor, puerto };
}

async function pedir(url, opciones = {}) {
  return fetch(url, { signal: AbortSignal.timeout(9000), ...opciones });
}

async function main() {
  const mock = await crearMock();
  const puerto = await puertoLibre();
  const base = `http://127.0.0.1:${puerto}`;
  const proceso = spawn(process.execPath, ['server.mjs'], {
    cwd: RAIZ,
    env: {
      ...process.env,
      PORT: String(puerto),
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      MODO_OFFLINE: '1',
      PERMITIR_PRIVADOS: '1',
      PERMITIR_HOSTS: '127.0.0.1,localhost',
      LIMITE_POR_MINUTO: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const registro = [];
  proceso.stdout.on('data', (d) => registro.push(String(d)));
  proceso.stderr.on('data', (d) => registro.push(String(d)));

  let listo = false;
  for (let i = 0; i < 50; i += 1) {
    try {
      const r = await pedir(`${base}/api/health`);
      if (r.ok) { listo = true; break; }
    } catch { /* todavía arrancando */ }
    await espera(120);
  }
  if (!listo) {
    console.error('El servidor no arrancó:\n' + registro.join(''));
    proceso.kill();
    mock.servidor.close();
    process.exit(1);
  }

  console.log(`\n  Servidor de pruebas en ${base}\n`);

  /* --- 1. Catálogo y salud ---------------------------------------- */
  const salud = await (await pedir(`${base}/api/health`)).json();
  afirmar(salud.estado === 'online', '/api/health responde online');
  const indice = await (await pedir(`${base}/api`)).json();
  afirmar(indice.routers >= 8, '/api informa de los routers');
  const catalogo = await (await pedir(`${base}/api/endpoints`)).json();
  afirmar(catalogo.total >= 100, `/api/endpoints devuelve >= 100 endpoints (${catalogo.total})`);
  const spec = await (await pedir(`${base}/api/openapi.json`)).json();
  afirmar(spec.openapi?.startsWith('3.') && Object.keys(spec.paths).length >= 100, 'OpenAPI 3.1 generado desde el catálogo');

  /* --- 2. TODOS los endpoints del catálogo ----------------------- */
  console.log('  Recorriendo el catálogo completo…');
  let imagenes = 0;
  for (const e of catalogo.endpoints) {
    const url = base + e.ejemplo;
    try {
      const r = await pedir(url);
      const tipo = r.headers.get('content-type') || '';
      const externo = e.categoria === 'download' && !e.ruta.endsWith('/download');
      if (e.tipo === 'imagen') {
        const cuerpo = await r.text();
        const esImagen = r.status === 200 && /^image\//.test(tipo) && /<svg|^\x89PNG/.test(cuerpo);
        afirmar(esImagen, `${e.ruta} devuelve una imagen real`);
        imagenes += esImagen ? 1 : 0;
      } else if (externo) {
        const datos = await r.json().catch(() => ({}));
        // En modo offline se acepta un 502 ESTRUCTURADO, nunca un 500 o un HTML.
        afirmar(
          (r.status === 200 && datos.ok === true) || ([400, 502].includes(r.status) && datos.ok === false),
          `${e.ruta} responde JSON estructurado (HTTP ${r.status})`
        );
      } else if (e.ruta === '/api/openapi.json') {
        const datos = await r.json().catch(() => ({}));
        afirmar(r.status === 200 && datos.openapi?.startsWith('3.'), '/api/openapi.json es un documento OpenAPI válido');
      } else {
        const datos = await r.json().catch(() => ({}));
        afirmar(r.status === 200 && datos.ok === true, `${e.ruta} responde ok:true (HTTP ${r.status})`);
      }
    } catch (error) {
      afirmar(false, `${e.ruta} falló: ${error.message}`);
    }
  }

  /* --- 3. Comportamiento concreto --------------------------------- */
  const morse = await (await pedir(`${base}/api/tools/morse?texto=SOS`)).json();
  afirmar(morse.resultado === '... --- ...', 'Morse codifica SOS');
  const morseVuelta = await (await pedir(`${base}/api/tools/morse?texto=${encodeURIComponent(morse.resultado)}&accion=decodificar`)).json();
  afirmar(morseVuelta.resultado === 'SOS', 'Morse decodifica de vuelta');
  const calc = await (await pedir(`${base}/api/tools/calculadora?expresion=${encodeURIComponent('2^8+min(3,9)')}`)).json();
  afirmar(calc.resultado === 259, 'Calculadora evalúa funciones y potencias');
  const calcMala = await pedir(`${base}/api/tools/calculadora?expresion=${encodeURIComponent('2+__import')}`);
  afirmar(calcMala.status === 400, 'Calculadora rechaza código/identificadores desconocidos');
  const trad = await (await pedir(`${base}/api/tools/traductor?texto=hello%20world&destino=es`)).json();
  afirmar(trad.traduccion.toLowerCase().includes('hola'), 'Traductor usa el diccionario local sin red');
  const gacha = await (await pedir(`${base}/api/anime/gacha?semilla=abc&tiradas=5`)).json();
  const gacha2 = await (await pedir(`${base}/api/anime/gacha?semilla=abc&tiradas=5`)).json();
  afirmar(JSON.stringify(gacha.resultados) === JSON.stringify(gacha2.resultados), 'Gacha es reproducible por semilla');
  const iaDemo = await (await pedir(`${base}/api/ia/gemini?texto=hola`)).json();
  afirmar(iaDemo.modo === 'demo' && iaDemo.respuesta.length > 10, 'IA responde en modo demo sin clave');
  const iaPost = await pedir(`${base}/api/ia/chatgpt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: '¿qué es una api?' }),
  });
  const iaPostDatos = await iaPost.json();
  afirmar(iaPost.status === 200 && iaPostDatos.respuesta.includes('API'), 'POST funciona en los endpoints de IA');

  const png = await pedir(`${base}/api/canvas/brat?text=Hola&formato=png`);
  const pngBuffer = Buffer.from(await png.arrayBuffer());
  afirmar(
    png.headers.get('content-type') === 'image/png' && pngBuffer.subarray(0, 4).toString('hex') === '89504e47',
    'Canvas rasteriza a PNG real con sharp'
  );
  const svg = await (await pedir(`${base}/api/canvas/brat?text=Hola&formato=svg`)).text();
  afirmar(svg.includes('<svg') && svg.includes('Hola'), 'Canvas devuelve SVG con el texto del usuario');
  const avatarRemoto = await (await pedir(`${base}/api/canvas/quotly?username=Test&text=Ok&image=${encodeURIComponent(`http://127.0.0.1:${mock.puerto}/foto.png`)}`)).text();
  afirmar(avatarRemoto.includes('data:image/png;base64'), 'Canvas incrusta imágenes remotas en la composición');

  const reaccion = await (await pedir(`${base}/api/reactions/slap`)).json();
  afirmar(reaccion.url.endsWith('/api/reactions/slap.svg'), 'Reactions devuelve URL de animación');
  const reaccionSvg = await pedir(`${base}/api/reactions/slap.svg`);
  afirmar(reaccionSvg.status === 200 && /image\/svg/.test(reaccionSvg.headers.get('content-type')), 'Las reacciones .svg existen para todos los nombres');

  /* --- 4. Descargas contra el mock local -------------------------- */
  const paginaUrl = encodeURIComponent(`http://127.0.0.1:${mock.puerto}/pagina`);
  const resuelta = await (await pedir(`${base}/api/download/instagram?url=${paginaUrl}`)).json();
  afirmar(resuelta.titulo?.includes('Velirius') && resuelta.enlaces.length > 0, 'Download extrae OpenGraph y enlaces reales');
  const directo = await pedir(`${base}/api/download/direct?url=${encodeURIComponent(`http://127.0.0.1:${mock.puerto}/archivo.txt`)}`);
  afirmar(directo.status === 200 && (await directo.text()).trim() === 'velirius-api', 'Download/direct hace proxy del archivo con CORS');
  const mediafire = await (await pedir(`${base}/api/download/mediafire?url=${paginaUrl}`)).json();
  afirmar(mediafire.miniatura?.includes('foto.png'), 'Download resuelve miniaturas absolutas');

  /* --- 5. Middleware, errores y estáticos ------------------------- */
  const preflight = await pedir(`${base}/api/health`, { method: 'OPTIONS' });
  afirmar(preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === '*', 'CORS/OPTIONS configurado');
  const noExiste = await (await pedir(`${base}/api/no-existe`)).json();
  afirmar(noExiste.ok === false && Array.isArray(noExiste.sugerencias), '404 devuelve JSON con sugerencias');
  const faltaParam = await (await pedir(`${base}/api/tools/calculadora`)).json();
  afirmar(faltaParam.ok === false && faltaParam.error.includes('expresion'), 'Parámetros obligatorios se validan');
  const ecoPost = await (await pedir(`${base}/api/echo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hola: 'mundo' }),
  })).json();
  afirmar(ecoPost.cuerpo?.hola === 'mundo', 'POST con cuerpo JSON se procesa');

  for (const ruta of ['/', '/docs', '/assets/api-ui.css', '/assets/api-ui.js', '/assets/canvas/brat.jpg', '/galeria.html', '/api-docs.html']) {
    const r = await pedir(base + ruta);
    afirmar(r.status === 200, `Estático ${ruta} se sirve correctamente`);
  }
  const secreto = await pedir(`${base}/src/app.mjs`);
  afirmar(secreto.status === 404, 'El código fuente no se expone públicamente');

  /* --- Cierre ------------------------------------------------------ */
  proceso.kill('SIGTERM');
  mock.servidor.close();
  console.log(`\n  ${pasadas} comprobaciones OK · ${fallidas} fallos · ${imagenes} imágenes generadas`);
  if (fallidas) {
    console.log('\n  Fallos:\n' + fallos.map((f) => `   - ${f}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('  ✅ Todos los endpoints responden correctamente.\n');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
