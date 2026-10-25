#!/usr/bin/env node
/**
 * Genera src/plantillas.mjs a partir de las imágenes optimizadas de assets/canvas/.
 *
 * ¿Por qué incrustar las imágenes en base64 dentro de un módulo JS?
 * En Vercel cada función serverless se empaqueta sola: leer archivos con fs en
 * tiempo de ejecución es frágil porque el bundler sólo incluye lo que puede
 * rastrear estáticamente. Un `import` de este módulo garantiza que las
 * plantillas viajen dentro de la función, en Vercel, Render y en local.
 *
 * Uso:  npm run plantillas   (se ejecuta también dentro de `npm run build`)
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'assets', 'canvas');
const DESTINO = path.join(RAIZ, 'src', 'plantillas.mjs');
const EXCLUIDOS = new Set(['banner.jpg']);

/** Lee las dimensiones de un JPEG buscando un marcador SOF (Start Of Frame). */
function dimensionesJpeg(buffer) {
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marcador = buffer[i + 1];
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return { alto: buffer.readUInt16BE(i + 5), ancho: buffer.readUInt16BE(i + 7) };
    }
    const longitud = buffer.readUInt16BE(i + 2);
    if (longitud < 2) break;
    i += 2 + longitud;
  }
  throw new Error('JPEG sin marcador SOF');
}

function dimensionesPng(buffer) {
  return { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20) };
}

function dimensiones(buffer, extension) {
  if (extension === '.png') return dimensionesPng(buffer);
  if (extension === '.webp') {
    // Para WEBP simple (VP8X) las dimensiones están en el bloque RIFF.
    if (buffer.toString('ascii', 12, 16) === 'VP8X') {
      return {
        ancho: 1 + buffer.readUIntLE(24, 3),
        alto: 1 + buffer.readUIntLE(27, 3),
      };
    }
    return { ancho: 512, alto: 512 };
  }
  return dimensionesJpeg(buffer);
}

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const archivos = (await readdir(CARPETA))
  .filter((nombre) => MIME[path.extname(nombre).toLowerCase()] && !EXCLUIDOS.has(nombre))
  .sort();

const plantillas = {};
for (const nombre of archivos) {
  const buffer = await readFile(path.join(CARPETA, nombre));
  const { ancho, alto } = dimensiones(buffer, path.extname(nombre).toLowerCase());
  const clave = path.basename(nombre, path.extname(nombre));
  const mime = MIME[path.extname(nombre).toLowerCase()];
  plantillas[clave] = {
    archivo: `/assets/canvas/${nombre}`,
    ancho,
    alto,
    mime,
    datos: `data:${mime};base64,${buffer.toString('base64')}`,
  };
}

const salida = `/* GENERADO AUTOMÁTICAMENTE por scripts/importar-plantillas.mjs — no editar a mano.
 * Plantillas de canvas descargadas de Google Drive y optimizadas.
 * ${archivos.length} imágenes · ${(JSON.stringify(plantillas).length / 1024 / 1024).toFixed(2)} MB en base64.
 */
export const PLANTILLAS = ${JSON.stringify(plantillas)};

export const nombresPlantillas = () => Object.keys(PLANTILLAS);
`;

await writeFile(DESTINO, salida);
console.log(
  `[plantillas] ${archivos.length} imágenes → src/plantillas.mjs ` +
    `(${(Buffer.byteLength(salida) / 1024 / 1024).toFixed(2)} MB)`
);
