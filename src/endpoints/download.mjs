/**
 * Router Download.
 *
 * Resuelve metadatos y enlaces de descarga de páginas públicas. No usa claves:
 * OpenGraph/oEmbed, APIs públicas (Aptoide, lyrics.ovh, Piped) y un proxy
 * directo con CORS para archivos remotos. Todas las descargas pasan por
 * urlSegura() (anti-SSRF) y tienen límite de tamaño y timeout.
 */
import {
  json,
  binario,
  ErrorHttp,
  descargar,
  obtenerTexto,
  obtenerJson,
  extraerMeta,
  limpiar,
  esUrl,
} from '../utiles.mjs';
import { SERVICIOS_DESCARGA } from '../datasets.mjs';

function idYoutube(entrada) {
  const patrones = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]{11})/i,
    /^[\w-]{11}$/,
  ];
  for (const re of patrones) {
    const m = entrada.match(re);
    if (m) return m[1] || m[0];
  }
  return null;
}

function salida(ctx, servicio, datos, extra = {}) {
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    servicio,
    ...datos,
    ...extra,
  });
}

function errorRemoto(servicio, error) {
  throw new ErrorHttp(`No se pudo consultar ${servicio}: ${error?.message || 'servicio no disponible'}.`, 502, {
    servicio,
    sugerencia: 'Comprueba que la URL sea pública y que el despliegue tenga salida a internet.',
  });
}

/** Extrae metadatos de cualquier página pública. */
async function resolverPagina(ctx, servicio, url) {
  let html, urlFinal;
  try {
    ({ html, urlFinal } = await obtenerTexto(url, { tiempo: 9000, maximo: 3 * 1024 * 1024 }));
  } catch (error) {
    errorRemoto(servicio, error);
  }
  const meta = extraerMeta(html, urlFinal || url);
  const candidatos = new Set();
  if (meta.video) candidatos.add(meta.video);
  for (const enlace of meta.enlaces || []) candidatos.add(enlace);

  // Mediafire: el enlace directo suele estar en el HTML.
  if (servicio === 'mediafire') {
    for (const m of html.matchAll(/https?:\/\/download\d*\.mediafire\.com\/[^"'\s<>]+/gi)) {
      candidatos.add(decodificar(m[0]));
    }
    for (const m of html.matchAll(/href="(https?:\/\/[^"']*mediafire[^"']*download[^"']*)"/gi)) {
      candidatos.add(decodificar(m[1]));
    }
  }

  const enlaces = [...candidatos]
    .filter((x) => esUrl(x))
    .slice(0, 8)
    .map((x) => ({
      url: x,
      directo: `${ctx.base}/api/download/direct?url=${encodeURIComponent(x)}`,
      tipo: /\.(mp4|webm|mov|m4v)(\?|$)/i.test(x) ? 'video' : /\.(mp3|m4a|ogg|wav)(\?|$)/i.test(x) ? 'audio' : 'archivo',
    }));

  return salida(ctx, servicio, {
    url,
    urlFinal: urlFinal || url,
    titulo: meta.titulo,
    descripcion: meta.descripcion,
    autor: meta.autor,
    miniatura: meta.imagen,
    sitio: meta.sitio,
    enlaces,
    descargable: enlaces.length > 0,
    ...(enlaces.length
      ? {}
      : { aviso: 'La página no expone un enlace directo; se devuelven sus metadatos públicos.' }),
  });
}

function decodificar(valor) {
  return valor.replace(/&amp;/g, '&').replace(/%3A/gi, ':').replace(/%2F/gi, '/');
}

async function youtube(ctx, url, q) {
  let id = url ? idYoutube(url) : null;
  if (!id && q) {
    try {
      const { html } = await obtenerTexto(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
        tiempo: 7000,
        maximo: 3 * 1024 * 1024,
      });
      id = (html.match(/"videoId":"([\w-]{11})"/) || [])[1] || null;
    } catch { /* sin búsqueda */ }
  }
  if (!id) throw new ErrorHttp('No se pudo obtener el ID del vídeo. Pasa una URL de YouTube válida.', 400);

  const datos = {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    miniatura: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    miniaturas: ['maxresdefault', 'hqdefault', 'mqdefault'].map((x) => `https://i.ytimg.com/vi/${id}/${x}.jpg`),
    formatos: [],
  };

  try {
    const { datos: oembed } = await obtenerJson(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(datos.url)}&format=json`,
      { tiempo: 6000 }
    );
    datos.titulo = oembed.title;
    datos.autor = oembed.author_name;
  } catch { /* oEmbed bloqueado: seguimos con lo que tenemos */ }

  // Piped es una API pública sin clave que expone los streams directos.
  try {
    const { datos: piped } = await obtenerJson(`https://pipedapi.kavin.rocks/streams/${id}`, { tiempo: 8000 });
    datos.titulo = datos.titulo || piped.title;
    datos.duracion = piped.duration;
    datos.formatos = (piped.videoStreams || [])
      .filter((x) => x.url)
      .slice(0, 6)
      .map((x) => ({
        calidad: x.quality || x.resolution,
        tipo: x.format || x.mimeType,
        url: x.url,
        directo: `${ctx.base}/api/download/direct?url=${encodeURIComponent(x.url)}`,
      }));
  } catch { /* Piped no disponible: devolvemos metadatos y miniaturas */ }

  return salida(ctx, 'youtube', {
    ...datos,
    descargable: datos.formatos.length > 0,
    ...(datos.formatos.length ? {} : { aviso: 'El proveedor de streams no respondió; se devuelven metadatos y miniaturas.' }),
  });
}

async function tiktok(ctx, url) {
  try {
    const { datos } = await obtenerJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { tiempo: 7000 });
    return salida(ctx, 'tiktok', {
      url,
      titulo: datos.title,
      autor: datos.author_name || datos.author_unique_id,
      miniatura: datos.thumbnail_url,
      html: datos.html,
      enlaces: datos.thumbnail_url
        ? [{ url: datos.thumbnail_url, directo: `${ctx.base}/api/download/direct?url=${encodeURIComponent(datos.thumbnail_url)}`, tipo: 'imagen' }]
        : [],
      descargable: Boolean(datos.thumbnail_url),
    });
  } catch {
    return resolverPagina(ctx, 'tiktok', url);
  }
}

async function lyric(ctx) {
  const artista = ctx.parametro(['artista', 'artist', 'autor'], '');
  const cancion = ctx.parametro(['cancion', 'title', 'canción', 'song'], '');
  const q = ctx.parametro(['q', 'texto', 'buscar'], '');
  if (artista && cancion) {
    try {
      const { datos } = await obtenerJson(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artista)}/${encodeURIComponent(cancion)}`,
        { tiempo: 8000 }
      );
      return salida(ctx, 'lyric', { artista, cancion, letra: datos.lyrics, fuente: 'lyrics.ovh' });
    } catch {
      // Buscamos sugerencias para dar una respuesta útil igualmente.
    }
  }
  const termino = q || `${artista} ${cancion}`.trim();
  if (!termino) throw new ErrorHttp('Pasa "artista" + "cancion", o "q" para buscar.', 400);
  try {
    const { datos } = await obtenerJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(termino)}`, { tiempo: 8000 });
    return salida(ctx, 'lyric', {
      consulta: termino,
      sugerencias: (datos.data || []).slice(0, 10).map((x) => ({
        artista: x.artist?.name,
        cancion: x.title,
        letra: `${ctx.base}/api/download/lyric?artista=${encodeURIComponent(x.artist?.name || '')}&cancion=${encodeURIComponent(x.title || '')}`,
      })),
      fuente: 'lyrics.ovh/suggest',
    });
  } catch (error) {
    errorRemoto('lyric', error);
  }
}

async function aptoide(ctx) {
  const id = ctx.parametro(['id', 'package', 'paquete', 'q'], '');
  if (!id) throw new ErrorHttp('Falta el parámetro "id" (package name).', 400);
  try {
    const { datos } = await obtenerJson(
      `https://ws75.aptoide.com/api/7/app/getMeta/package_name=${encodeURIComponent(id)}`,
      { tiempo: 9000 }
    );
    const app = datos?.data;
    if (!app) throw new Error('app no encontrada');
    const apk = app.file?.path_alt || app.file?.path;
    return salida(ctx, 'aptoide', {
      id,
      nombre: app.name,
      paquete: app.package,
      version: app.version?.name || app.file?.vername,
      tamano: app.size || app.file?.filesize,
      desarrollador: app.developer?.name,
      descripcion: limpiar(app.media?.description || '', 500),
      icono: app.icon,
      miniatura: app.graphic,
      descarga: apk,
      directo: apk ? `${ctx.base}/api/download/direct?url=${encodeURIComponent(apk)}` : undefined,
      url: app.urls?.w || `https://${id}.en.aptoide.com/app`,
      fuente: 'aptoide-api',
      descargable: Boolean(apk),
    });
  } catch (error) {
    errorRemoto('aptoide', error);
  }
}

async function playstore(ctx) {
  const id = ctx.parametro(['id', 'package', 'paquete', 'q'], '');
  if (!id) throw new ErrorHttp('Falta el parámetro "id" (package name).', 400);
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}&hl=es`;
  try {
    const { html } = await obtenerTexto(url, { tiempo: 9000, maximo: 3 * 1024 * 1024 });
    const meta = extraerMeta(html, url);
    const version = (html.match(/\[\[\["([\d.]+)"\]\]/) || [])[1];
    return salida(ctx, 'playstore', {
      id,
      nombre: meta.titulo?.replace(/\s*-\s*Aplicaciones en Google Play.*$/i, '').trim(),
      descripcion: meta.descripcion,
      version,
      icono: meta.imagen,
      miniatura: meta.imagen,
      url,
      enlaces: [{ url, directo: url, tipo: 'tienda' }],
      fuente: 'google-play',
      descargable: false,
      aviso: 'Google Play no publica un APK directo: se devuelven los metadatos y el enlace a la ficha.',
    });
  } catch (error) {
    errorRemoto('playstore', error);
  }
}

async function directo(ctx) {
  const url = ctx.parametro(['url', 'link', 'enlace'], '');
  if (!url || !esUrl(url)) throw new ErrorHttp('Falta el parámetro "url" con un enlace directo http(s).', 400);
  let buffer, tipo;
  try {
    // Vercel limita el cuerpo de una función a ~4.5 MB; Render no tiene ese límite.
    const maximo = process.env.VERCEL ? 4 * 1024 * 1024 : 25 * 1024 * 1024;
    ({ buffer, tipo } = await descargar(url, { tiempo: 20000, maximo }));
  } catch (error) {
    errorRemoto('direct', error);
  }
  const nombre = (url.split('?')[0].split('/').pop() || 'archivo').replace(/[^\w.\-]/g, '_');
  return binario(buffer, tipo, 200, {
    'Content-Disposition': `attachment; filename="${nombre}"`,
    'Content-Length': String(buffer.length),
    'Cache-Control': 'public, max-age=3600',
  });
}

export function indice(ctx) {
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    router: 'download',
    servicios: SERVICIOS_DESCARGA,
    endpoints: SERVICIOS_DESCARGA.map((s) => `${ctx.base}/api/download/${s}`),
    nota: 'Los servicios externos necesitan salida a internet desde Vercel/Render.',
  });
}

export async function resolver(ctx) {
  const servicio = (ctx.parametro(['servicio'], '') || ctx.segmentos.at(-1) || '').toLowerCase();
  if (!SERVICIOS_DESCARGA.includes(servicio)) {
    throw new ErrorHttp(`El servicio "${servicio}" no existe.`, 404, { disponibles: SERVICIOS_DESCARGA });
  }
  if (servicio === 'direct') return directo(ctx);
  if (servicio === 'lyric') return lyric(ctx);
  if (servicio === 'aptoide') return aptoide(ctx);
  if (servicio === 'playstore' || servicio === 'play') return playstore(ctx);

  const url = ctx.parametro(['url', 'link', 'enlace'], '');
  const q = ctx.parametro(['q', 'texto'], '');
  if (servicio === 'youtube') return youtube(ctx, url, q);
  if (!url || !esUrl(url)) {
    throw new ErrorHttp(`Falta el parámetro "url" con un enlace de ${servicio}.`, 400, { ejemplo: `https://www.${servicio}.com/...` });
  }
  if (servicio === 'tiktok') return tiktok(ctx, url);
  return resolverPagina(ctx, servicio, url);
}
