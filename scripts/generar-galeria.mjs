#!/usr/bin/env node
/**
 * Genera `galeria.json` a partir de las imágenes que hay en `fotos/`.
 *
 * - Cada subcarpeta de `fotos/` se convierte en un álbum.
 * - El título de cada foto se deduce del nombre del archivo.
 * - Puedes personalizar títulos, descripciones, etiquetas, fechas y orden
 *   en `fotos/info.json` (opcional).
 *
 * Uso:  node scripts/generar-galeria.mjs
 * Sin dependencias externas.
 */
import { readdir, readFile, writeFile, stat, open, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp']);
const MAX_CABECERA = 512 * 1024; // bytes que leemos para deducir las dimensiones

const log = (...args) => console.log('[galería]', ...args);

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */
async function leerConfig() {
  const porDefecto = {
    titulo: 'Galería',
    subtitulo: '',
    descripcion: '',
    autor: '',
    repositorio: '',
    rama: 'main',
    carpetaFotos: 'fotos',
    enlace: '',
    textoEnlace: '',
  };
  try {
    const crudo = await readFile(path.join(RAIZ, 'galeria.config.json'), 'utf8');
    return { ...porDefecto, ...JSON.parse(crudo) };
  } catch (error) {
    if (error.code !== 'ENOENT') log('aviso: galeria.config.json no es válido, uso valores por defecto');
    return porDefecto;
  }
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const normalizar = (texto) =>
  String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Prettifica un nombre de archivo o carpeta: "01-atardecer_en_el-mar" -> "Atardecer en el mar" */
function prettificar(nombre) {
  return nombre
    .replace(/^[\d\s._-]+(?=\D)/, '') // quita el prefijo numérico de orden
    .replace(/\.[^.]+$/, '') // extensión
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\p{Ll}/u, (letra) => letra.toUpperCase());
}

/** URL segura conservando las barras. */
const aUrl = (ruta) => ruta.split('/').map(encodeURIComponent).join('/');

/** Convierte un texto en un nombre de archivo/URL: "Playa 2026" -> "playa-2026" */
const aSlug = (texto) =>
  normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'album';

async function listarArchivos(dir, base = '') {
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const salida = [];
  for (const entrada of entradas) {
    if (entrada.name.startsWith('.')) continue;
    const relativa = base ? `${base}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) {
      salida.push(...(await listarArchivos(path.join(dir, entrada.name), relativa)));
    } else if (EXTENSIONES.has(path.extname(entrada.name).toLowerCase())) {
      salida.push(relativa);
    }
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/* Lectura de dimensiones (JPEG, PNG, GIF, WebP) sin dependencias      */
/* ------------------------------------------------------------------ */
async function leerCabecera(ruta) {
  const fh = await open(ruta, 'r');
  try {
    const buffer = Buffer.alloc(MAX_CABECERA);
    const { bytesRead } = await fh.read(buffer, 0, MAX_CABECERA, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

function dimensiones(buf) {
  if (!buf || buf.length < 24) return null;

  // PNG: firma 89 50 4E 47, IHDR en el byte 16
  if (buf.readUInt32BE(0) === 0x89504e47) {
    return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
  }

  // GIF: "GIF8"
  if (buf.readUInt16BE(0) === 0x4749) {
    return { ancho: buf.readUInt16LE(6), alto: buf.readUInt16LE(8) };
  }

  // WebP: "RIFF....WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const formato = buf.toString('ascii', 12, 16);
    if (formato === 'VP8X') {
      return { ancho: buf.readUIntLE(24, 3) + 1, alto: buf.readUIntLE(27, 3) + 1 };
    }
    if (formato === 'VP8 ') {
      const inicio = buf.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
      if (inicio > 0) {
        return {
          ancho: buf.readUInt16LE(inicio + 3) & 0x3fff,
          alto: buf.readUInt16LE(inicio + 5) & 0x3fff,
        };
      }
    }
    if (formato === 'VP8L' && buf[20] === 0x2f) {
      const bits = buf.readUInt32LE(21);
      return { ancho: (bits & 0x3fff) + 1, alto: ((bits >> 14) & 0x3fff) + 1 };
    }
  }

  // JPEG: busca el marcador SOF (inicio del marco)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marcador = buf[offset + 1];
      if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
        offset += 2;
        continue;
      }
      const longitud = buf.readUInt16BE(offset + 2);
      const esSOF =
        marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador);
      if (esSOF) {
        return { ancho: buf.readUInt16BE(offset + 7), alto: buf.readUInt16BE(offset + 5) };
      }
      offset += 2 + longitud;
    }
  }

  return null;
}

async function medir(rutaAbsoluta) {
  try {
    const buf = await leerCabecera(rutaAbsoluta);
    const medidas = dimensiones(buf);
    if (medidas && medidas.ancho > 0 && medidas.alto > 0) return medidas;
  } catch {
    /* ignoramos: se usará una proporción por defecto */
  }
  return { ancho: 0, alto: 0 };
}

/* ------------------------------------------------------------------ */
/* API JSON estática (endpoints sin servidor)                          */
/* ------------------------------------------------------------------ */

/** Ruta pública de una foto: "/fotos/x.jpg" o absoluta si hay `urlBase`. */
function rutaPublica(ruta, config) {
  const limpia = `/${String(ruta).replace(/^\/+/, '')}`;
  const base = String(config.urlBase || '').replace(/\/+$/, '');
  return base ? `${base}${encodeURI(limpia)}` : encodeURI(limpia);
}

/** Objeto de foto tal y como se publica en la API. */
function fotoApi(foto, config) {
  return {
    id: foto.id,
    titulo: foto.titulo,
    descripcion: foto.descripcion || null,
    album: foto.album,
    etiquetas: foto.etiquetas,
    fecha: foto.fecha || null,
    archivo: foto.archivo,
    imagen: rutaPublica(foto.ruta, config),
    ancho: foto.ancho || null,
    alto: foto.alto || null,
    peso: foto.peso,
    destacada: foto.destacada,
  };
}

/**
 * Escribe los endpoints estáticos en /datos:
 *   datos/fotos.json          · todas las fotos
 *   datos/albumes.json        · índice de álbumes
 *   datos/albumes/<slug>.json · fotos de un álbum
 *
 * Son archivos JSON servidos desde el CDN: sin funciones ni cold starts.
 * Importante: NO se usa /api porque Vercel reserva esa carpeta en la raíz
 * para funciones serverless y los archivos estáticos de dentro no se sirven.
 */
async function escribirApi(salida, config) {
  const dir = path.join(RAIZ, 'datos');
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, 'albumes'), { recursive: true });

  const fotos = salida.fotos.map((foto) => fotoApi(foto, config));
  const generado = salida.generado;

  const slugsUsados = new Set();
  const albumes = salida.albumes.map((album) => {
    const base = aSlug(album.nombre);
    let slug = base;
    let intento = 2;
    while (slugsUsados.has(slug)) slug = `${base}-${intento++}`;
    slugsUsados.add(slug);
    return { ...album, slug };
  });

  const escribir = async (ruta, datos) => {
    await writeFile(path.join(RAIZ, ruta), `${JSON.stringify(datos, null, 2)}\n`);
  };

  await escribir('datos/fotos.json', { generado, total: fotos.length, albumes, fotos });
  await escribir('datos/albumes.json', {
    generado,
    sitio: {
      titulo: config.titulo,
      autor: config.autor || null,
      repositorio: config.repositorio || null,
    },
    total: fotos.length,
    albumes,
    endpoints: {
      fotos: '/datos/fotos.json',
      albumes: '/datos/albumes.json',
      album: '/datos/albumes/{slug}.json',
    },
  });

  for (const album of albumes) {
    const delAlbum = fotos.filter((foto) => foto.album === album.nombre);
    await escribir(`datos/albumes/${album.slug}.json`, {
      generado,
      album: { nombre: album.nombre, slug: album.slug },
      total: delAlbum.length,
      fotos: delAlbum,
    });
  }

  return { total: fotos.length, albumes: albumes.length };
}

/* ------------------------------------------------------------------ */
/* Programa principal                                                  */
/* ------------------------------------------------------------------ */
async function main() {
  const config = await leerConfig();
  const dirFotos = path.join(RAIZ, config.carpetaFotos || 'fotos');

  let info = {};
  try {
    info = JSON.parse(await readFile(path.join(dirFotos, 'info.json'), 'utf8'));
    if (info.__info) delete info.__info; // permite dejar comentarios en el JSON
  } catch (error) {
    if (error.code !== 'ENOENT') log('aviso: fotos/info.json no es válido, se ignora');
  }

  const archivos = (await listarArchivos(dirFotos)).sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
  );

  const fotos = [];
  for (const relativa of archivos) {
    const absoluta = path.join(dirFotos, relativa);
    const { size } = await stat(absoluta);
    const { ancho, alto } = await medir(absoluta);
    const partes = relativa.split('/');
    const carpeta = partes.length > 1 ? partes[0] : '';
    const datos = info[relativa] || info[relativa.normalize('NFC')] || {};
    const album = datos.album || (carpeta ? prettificar(carpeta) : 'General');
    const titulo = datos.titulo || prettificar(partes[partes.length - 1]);

    fotos.push({
      id: aUrl(relativa),
      ruta: `${config.carpetaFotos || 'fotos'}/${aUrl(relativa)}`,
      archivo: partes[partes.length - 1],
      album,
      carpeta,
      titulo,
      descripcion: datos.descripcion || '',
      etiquetas: Array.isArray(datos.etiquetas) ? datos.etiquetas : [],
      fecha: datos.fecha || '',
      ancho,
      alto,
      peso: size,
      orden: Number.isFinite(datos.orden) ? datos.orden : null,
      destacada: Boolean(datos.destacada),
      buscar: normalizar(
        [titulo, album, partes[partes.length - 1], ...(datos.etiquetas || [])].join(' ')
      ),
    });
  }

  // Orden: primero las que tienen `orden` explícito, luego por álbum y nombre.
  fotos.sort((a, b) => {
    if (a.orden !== null || b.orden !== null) {
      if (a.orden === null) return 1;
      if (b.orden === null) return -1;
      if (a.orden !== b.orden) return a.orden - b.orden;
    }
    if (a.carpeta !== b.carpeta) return a.carpeta.localeCompare(b.carpeta, 'es');
    return a.archivo.localeCompare(b.archivo, 'es', { numeric: true, sensitivity: 'base' });
  });

  const albumes = [...new Set(fotos.map((foto) => foto.album))].map((nombre) => ({
    nombre,
    total: fotos.filter((foto) => foto.album === nombre).length,
  }));

  const salida = {
    generado: new Date().toISOString(),
    config: {
      titulo: config.titulo,
      subtitulo: config.subtitulo,
      descripcion: config.descripcion,
      autor: config.autor,
      repositorio: config.repositorio,
      rama: config.rama,
      carpetaFotos: config.carpetaFotos || 'fotos',
      enlace: config.enlace,
      textoEnlace: config.textoEnlace,
    },
    total: fotos.length,
    albumes,
    fotos,
  };

  await writeFile(path.join(RAIZ, 'galeria.json'), `${JSON.stringify(salida, null, 2)}\n`);

  const api = await escribirApi(salida, config);

  const detalle = albumes.map((album) => `${album.nombre} (${album.total})`).join(', ');
  log(
    fotos.length === 0
      ? 'no hay fotos todavía: añade imágenes dentro de fotos/ y vuelve a ejecutar'
      : `${fotos.length} foto(s) · ${albumes.length} álbum(es)${detalle ? `: ${detalle}` : ''}`
  );
  log('escrito galeria.json');
  log(`escrita API: ${api.total} foto(s) y ${api.albumes} endpoint(s) de álbum en /datos`);
}

main().catch((error) => {
  console.error('[galería] error:', error);
  process.exit(1);
});
