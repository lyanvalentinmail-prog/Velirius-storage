import { json, elegir, prng, colorDe, escaparXml, normalizar, obtenerJson, ErrorHttp } from '../utiles.mjs';
import { imagen } from '../imagen.mjs';
import { PERSONAJES } from '../datasets.mjs';

const RAREZAS = [
  { nombre: 'R', peso: 0.55, estrellas: 1 },
  { nombre: 'SR', peso: 0.30, estrellas: 2 },
  { nombre: 'SSR', peso: 0.12, estrellas: 3 },
  { nombre: 'UR', peso: 0.03, estrellas: 4 },
];

function serializar(personaje, ctx, rareza) {
  return {
    ...personaje,
    rareza: rareza || undefined,
    avatar: `${ctx.base}/api/anime/avatar?nombre=${encodeURIComponent(personaje.nombre)}`,
  };
}

export function indice(ctx) {
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    router: 'anime',
    totalPersonajes: PERSONAJES.length,
    endpoints: ['/api/anime/character', '/api/anime/waifu', '/api/anime/maid', '/api/anime/gacha', '/api/anime/random', '/api/anime/avatar'],
    catalogo: `${ctx.base}/api/categories/anime`,
  });
}

export async function character(ctx) {
  const q = ctx.parametro(['q', 'nombre', 'texto', 'consulta'], '');
  const limite = Math.min(Math.max(Number(ctx.parametro(['limite', 'limit'], '5')) || 5, 1), 25);
  const locales = q
    ? PERSONAJES.filter((p) => normalizar(`${p.nombre} ${p.anime} ${p.rol}`).includes(normalizar(q)))
    : PERSONAJES.slice(0, limite);

  // Con red disponible ampliamos con Jikan (API pública de MyAnimeList, sin clave).
  if (q && ctx.parametro(['online'], '1') !== '0') {
    try {
      const url = `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=${limite}`;
      const { datos } = await obtenerJson(url, { tiempo: 4500 });
      const externos = (datos?.data || []).map((x) => ({
        nombre: x.name,
        anime: x.anime?.[0]?.anime?.title || x.manga?.[0]?.manga?.title || 'Desconocido',
        genero: 'desconocido',
        rol: 'personaje',
        emoji: '✨',
        imagen: x.images?.jpg?.image_url,
        malId: x.mal_id,
        fuente: 'jikan',
      }));
      if (externos.length) {
        return json({
          ok: true, status: true, creator: 'Velirius', consulta: q, fuente: 'jikan',
          total: externos.length, resultados: externos, locales: locales.length,
        });
      }
    } catch { /* sin red: usamos la base local */ }
  }

  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    consulta: q,
    fuente: 'local',
    total: locales.length,
    resultados: locales.slice(0, limite).map((p) => serializar(p, ctx)),
  });
}

export function waifu(ctx) {
  const mujeres = PERSONAJES.filter((p) => p.genero === 'mujer');
  const personaje = ctx.parametro(['semilla'], '')
    ? mujeres[Math.floor(prng(ctx.parametro(['semilla']))() * mujeres.length)]
    : elegir(mujeres);
  return json({ ok: true, status: true, creator: 'Velirius', ...serializar(personaje, ctx) });
}

export function maid(ctx) {
  const maids = PERSONAJES.filter((p) => p.maid);
  const personaje = ctx.parametro(['semilla'], '')
    ? maids[Math.floor(prng(ctx.parametro(['semilla']))() * maids.length)]
    : elegir(maids);
  return json({ ok: true, status: true, creator: 'Velirius', ...serializar(personaje, ctx) });
}

export function random(ctx) {
  return json({ ok: true, status: true, creator: 'Velirius', ...serializar(elegir(PERSONAJES), ctx) });
}

export function gacha(ctx) {
  const semilla = ctx.parametro(['semilla', 'seed'], String(Date.now()));
  const tiradas = Math.min(Math.max(Number(ctx.parametro(['tiradas', 'n'], '10')) || 10, 1), 20);
  const aleatorio = prng(semilla);
  const resultados = Array.from({ length: tiradas }, (_, i) => {
    const r = aleatorio();
    let acumulado = 0;
    let rareza = RAREZAS[0];
    for (const opcion of RAREZAS) {
      acumulado += opcion.peso;
      if (r <= acumulado) { rareza = opcion; break; }
    }
    const personaje = PERSONAJES[Math.floor(aleatorio() * PERSONAJES.length)];
    return { tirada: i + 1, rareza: rareza.nombre, estrellas: '★'.repeat(rareza.estrellas), ...serializar(personaje, ctx, rareza.nombre) };
  });
  return json({
    ok: true, status: true, creator: 'Velirius', semilla, tiradas,
    mejor: resultados.reduce((a, b) => (RAREZAS.findIndex((r) => r.nombre === b.rareza) > RAREZAS.findIndex((r) => r.nombre === a.rareza) ? b : a)).rareza,
    resultados,
  });
}

export async function avatar(ctx) {
  const nombre = ctx.parametro(['nombre', 'name', 'texto', 'q'], 'Velirius');
  const limpio = escaparXml(nombre.slice(0, 40));
  const iniciales = limpio
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || '')
    .join('');
  const color = colorDe(nombre);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#151515"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="48" fill="url(#g)"/>
  <circle cx="200" cy="152" r="72" fill="#ffffff" opacity="0.92"/>
  <path d="M70 370c0-80 58-130 130-130s130 50 130 130" fill="#ffffff" opacity="0.92"/>
  <text x="200" y="330" text-anchor="middle" font-family="Courier New, monospace" font-size="82" font-weight="bold" fill="#151515">${iniciales || 'V'}</text>
  <text x="200" y="388" text-anchor="middle" font-family="Courier New, monospace" font-size="20" letter-spacing="3" fill="#ffffff">${limpio.toUpperCase()}</text>
</svg>`;
  return imagen(svg, ctx, `avatar-${normalizar(nombre).replace(/\W+/g, '-') || 'velirius'}`);
}

export function noEncontrado() {
  throw new ErrorHttp('Endpoint de anime desconocido.', 404);
}
