/**
 * Router Search: búsquedas reales en servicios públicos.
 *
 * No requiere claves: usa DuckDuckGo HTML, YouTube, iTunes (para Spotify) y
 * lyrics.ovh. Si el despliegue no tiene salida a esos hosts, el endpoint
 * devuelve resultados REALES del catálogo/local en vez de un error 500.
 */
import {
  json,
  ErrorHttp,
  obtenerTexto,
  obtenerJson,
  decodificarHtml,
  limpiar,
  normalizar,
} from '../utiles.mjs';
import { CATALOGO_PLANO } from '../catalogo.mjs';
import { PERSONAJES, SERVICIOS_BUSQUEDA, SITIOS } from '../datasets.mjs';

function extraerUddg(href) {
  try {
    const u = new URL(href.startsWith('//') ? `https:${href}` : href, 'https://duckduckgo.com');
    return u.searchParams.get('uddg') || u.toString();
  } catch {
    return href;
  }
}

function limpiarEtiquetas(html) {
  return limpiar(decodificarHtml(html.replace(/<[^>]+>/g, '')), 280);
}

async function duckduckgo(consulta, limite) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(consulta)}`;
  const { html } = await obtenerTexto(url, { tiempo: 7000, maximo: 2 * 1024 * 1024 });
  const resultados = [];
  const bloques = html.split(/class="result results_links[^"]*"/).slice(1);
  for (const bloque of bloques) {
    const enlace = bloque.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!enlace) continue;
    const snippet = bloque.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    resultados.push({
      titulo: limpiarEtiquetas(enlace[2]),
      url: extraerUddg(decodificarHtml(enlace[1])),
      descripcion: snippet ? limpiarEtiquetas(snippet[1]) : '',
      fuente: 'duckduckgo',
    });
    if (resultados.length >= limite) break;
  }
  if (!resultados.length) throw new Error('Sin resultados parseables');
  return resultados;
}

async function youtube(q, limite) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const { html } = await obtenerTexto(url, { tiempo: 7000, maximo: 3 * 1024 * 1024 });
    const resultados = [];
    const re = /"videoId":"([\w-]{11})"[^\n]{0,2000}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g;
    for (const m of html.matchAll(re)) {
      const id = m[1];
      if (resultados.some((r) => r.id === id)) continue;
      resultados.push({
        id,
        titulo: decodificarHtml(m[2].replace(/\\u0026/g, '&').replace(/\\"/g, '"')),
        url: `https://www.youtube.com/watch?v=${id}`,
        miniatura: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        fuente: 'youtube',
      });
      if (resultados.length >= limite) break;
    }
    if (resultados.length) return resultados;
  } catch { /* fallback */ }
  return duckduckgo(`site:youtube.com/watch ${q}`, limite);
}

async function spotify(q, limite) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${limite}`;
    const { datos } = await obtenerJson(url, { tiempo: 7000 });
    const resultados = (datos?.results || []).map((x) => ({
      titulo: x.trackName,
      artista: x.artistName,
      album: x.collectionName,
      duracion: x.trackTimeMillis ? `${Math.round(x.trackTimeMillis / 1000)} s` : undefined,
      url: x.trackViewUrl,
      miniatura: x.artworkUrl100?.replace('100x100bb', '300x300bb'),
      preview: x.previewUrl,
      fuente: 'itunes',
    }));
    if (resultados.length) return resultados;
  } catch { /* fallback */ }
  return duckduckgo(`site:open.spotify.com ${q}`, limite);
}

async function lyric(q, limite) {
  try {
    const url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(q)}`;
    const { datos } = await obtenerJson(url, { tiempo: 7000 });
    const resultados = (datos?.data || []).slice(0, limite).map((x) => ({
      titulo: x.title,
      artista: x.artist?.name,
      album: x.album?.title,
      url: x.url || `https://www.letras.com/?q=${encodeURIComponent(`${x.artist?.name} ${x.title}`)}`,
      letra: `${ctxBase()}/api/download/lyric?artista=${encodeURIComponent(x.artist?.name || '')}&cancion=${encodeURIComponent(x.title || '')}`,
      fuente: 'lyrics.ovh',
    }));
    if (resultados.length) return resultados;
  } catch { /* fallback */ }
  return duckduckgo(`site:genius.com ${q} lyrics`, limite);
}

// ctxBase se sustituye en cada petición (evita pasar ctx por todas partes).
let BASE = '';
const ctxBase = () => BASE;

async function play(q, limite) {
  try {
    const url = `https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps&hl=es`;
    const { html } = await obtenerTexto(url, { tiempo: 7000, maximo: 3 * 1024 * 1024 });
    const ids = [...new Set([...html.matchAll(/\/store\/apps\/details\?id=([\w.]+)/g)].map((m) => m[1]))];
    const resultados = ids.slice(0, limite).map((id) => ({
      id,
      titulo: id.split('.').at(-1),
      url: `https://play.google.com/store/apps/details?id=${id}`,
      fuente: 'google-play',
    }));
    if (resultados.length) return resultados;
  } catch { /* fallback */ }
  return duckduckgo(`site:play.google.com/store/apps ${q}`, limite);
}

function resultadosLocales(q, limite) {
  const n = normalizar(q);
  const deCatalogo = CATALOGO_PLANO.filter((e) =>
    normalizar(`${e.ruta} ${e.descripcion} ${e.categoria}`).includes(n)
  )
    .slice(0, limite)
    .map((e) => ({
      titulo: e.ruta,
      descripcion: e.descripcion,
      url: `${BASE}${e.ejemplo}`,
      fuente: 'catalogo-velirius',
    }));
  const deAnime = PERSONAJES.filter((p) => normalizar(`${p.nombre} ${p.anime}`).includes(n))
    .slice(0, limite)
    .map((p) => ({
      titulo: `${p.emoji} ${p.nombre}`,
      descripcion: `${p.anime} · ${p.rol}`,
      url: `${BASE}/api/anime/character?q=${encodeURIComponent(p.nombre)}`,
      fuente: 'anime-velirius',
    }));
  return [...deCatalogo, ...deAnime].slice(0, limite);
}

export function indice(ctx) {
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    router: 'search',
    servicios: SERVICIOS_BUSQUEDA,
    endpoints: SERVICIOS_BUSQUEDA.map((s) => `${ctx.base}/api/search/${s}?q=velirius`),
  });
}

export async function buscar(ctx) {
  BASE = ctx.base;
  const q = ctx.parametro(['q', 'query', 'texto', 'consulta', 'buscar'], '');
  if (!q) throw new ErrorHttp('Falta el parámetro "q" con el término a buscar.', 400);
  const limite = Math.min(Math.max(Number(ctx.parametro(['limite', 'limit'], '8')) || 8, 1), 25);
  let servicio = (ctx.parametro(['servicio'], '') || ctx.segmentos.at(-1) || 'web').toLowerCase();
  if (servicio === 'search') servicio = 'web';
  if (![...SERVICIOS_BUSQUEDA, 'web'].includes(servicio)) {
    throw new ErrorHttp(`El servicio "${servicio}" no existe.`, 404, { disponibles: SERVICIOS_BUSQUEDA });
  }

  const sitio = SITIOS[servicio];
  let resultados = [];
  let fuente = '';
  try {
    if (servicio === 'youtube') resultados = await youtube(q, limite);
    else if (servicio === 'spotify') resultados = await spotify(q, limite);
    else if (servicio === 'lyric') resultados = await lyric(q, limite);
    else if (servicio === 'play') resultados = await play(q, limite);
    else resultados = await duckduckgo(sitio ? `site:${sitio} ${q}` : q, limite);
    fuente = resultados[0]?.fuente || 'externo';
  } catch {
    fuente = 'local';
  }

  const locales = resultadosLocales(q, Math.max(2, Math.round(limite / 3)));
  const aviso =
    fuente === 'local'
      ? 'El proveedor externo no respondió: se muestran resultados reales del catálogo local de esta API.'
      : undefined;

  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    servicio,
    consulta: q,
    fuente,
    total: resultados.length + locales.length,
    resultados: [...resultados, ...locales],
    ...(aviso ? { aviso } : {}),
  });
}
