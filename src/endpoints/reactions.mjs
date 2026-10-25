import { json, ErrorHttp, elegir, escaparXml, colorDe } from '../utiles.mjs';
import { imagen } from '../imagen.mjs';
import { REACCIONES, REACCION_POR_NOMBRE } from '../datasets.mjs';

/** Genera un SVG animado (sin archivos externos) para una reacción. */
export function svgReaccion(nombre, textoExtra = '') {
  const r = REACCION_POR_NOMBRE[nombre] || REACCIONES[0];
  const texto = escaparXml(textoExtra || r.texto);
  const fondo = colorDe(nombre + 'fondo');
  const ojos = {
    hug: '<path d="M170 225q20-22 40 0M290 225q20-22 40 0" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>',
    pat: '<path d="M170 225q20-22 40 0M290 225q20-22 40 0" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>',
    slap: '<path d="M165 215l45 20M195 215l-45 20M285 215l45 20M335 215l-45 20" stroke="#222" stroke-width="9" stroke-linecap="round"/>',
    kiss: '<circle cx="190" cy="228" r="12" fill="#222"/><circle cx="310" cy="228" r="12" fill="#222"/>',
    blush: '<circle cx="190" cy="228" r="12" fill="#222"/><circle cx="310" cy="228" r="12" fill="#222"/>',
    cry: '<path d="M180 215v28M200 215v28M300 215v28M320 215v28" stroke="#3a6ea5" stroke-width="9" stroke-linecap="round"/>',
    laugh: '<path d="M165 230q25-30 50 0M285 230q25-30 50 0" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>',
    wave: '<circle cx="190" cy="228" r="12" fill="#222"/><circle cx="310" cy="228" r="12" fill="#222"/>',
    dance: '<circle cx="190" cy="228" r="12" fill="#222"/><circle cx="310" cy="228" r="12" fill="#222"/>',
    sleep: '<path d="M165 228h50M285 228h50" stroke="#222" stroke-width="10" stroke-linecap="round"/>',
    angry: '<path d="M165 210l50 18M335 210l-50 18" stroke="#222" stroke-width="10" stroke-linecap="round"/><circle cx="192" cy="235" r="9" fill="#222"/><circle cx="308" cy="235" r="9" fill="#222"/>',
    wink: '<circle cx="190" cy="228" r="12" fill="#222"/><path d="M290 228q20-20 40 0" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>',
    poke: '<circle cx="190" cy="228" r="12" fill="#222"/><circle cx="310" cy="228" r="12" fill="#222"/>',
    cuddle: '<path d="M170 225q20-22 40 0M290 225q20-22 40 0" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>',
    bite: '<path d="M170 225q20-22 40 0M290 225q20-22 40 0" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>',
    smug: '<path d="M165 228q25-14 50 0M285 228q25-14 50 0" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/>',
  }[nombre] || '<circle cx="190" cy="228" r="12" fill="#222"/><circle cx="310" cy="228" r="12" fill="#222"/>';

  const boca = {
    cry: '<path d="M225 305q25-30 50 0" stroke="#222" stroke-width="9" fill="none" stroke-linecap="round"/>',
    angry: '<path d="M225 310q25-18 50 0" stroke="#222" stroke-width="9" fill="none" stroke-linecap="round"/>',
    laugh: '<path d="M215 290q35 55 70 0z" fill="#7a2b3a" stroke="#222" stroke-width="7"/>',
    kiss: '<path d="M240 300l10 10-10 10-10-10z" fill="#e5486b"/>',
    sleep: '<ellipse cx="250" cy="305" rx="14" ry="9" fill="#222"/>',
  }[nombre] || '<path d="M220 292q30 34 60 0" stroke="#222" stroke-width="9" fill="none" stroke-linecap="round"/>';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fondo}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
    <clipPath id="cabeza"><circle cx="250" cy="240" r="150"/></clipPath>
  </defs>
  <style>
    @keyframes flotar { 0%,100% { transform: translate(0,0) rotate(-4deg); } 50% { transform: translate(0,-18px) rotate(4deg); } }
    @keyframes latir { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    @keyframes subir { 0% { opacity:0; transform: translate(0,20px);} 25%,75% {opacity:1;} 100% {opacity:0; transform: translate(0,-60px);} }
    .cara { transform-origin: 250px 240px; animation: flotar 1.6s ease-in-out infinite; }
    .corazon { animation: latir 0.8s ease-in-out infinite; transform-origin: 250px 170px; }
    .emoji { animation: subir 2.2s linear infinite; font-size: 42px; }
  </style>
  <rect width="500" height="500" rx="36" fill="url(#f)"/>
  <g opacity="0.18" fill="#222">
    <circle cx="60" cy="70" r="3"/><circle cx="120" cy="70" r="3"/><circle cx="180" cy="70" r="3"/>
    <circle cx="60" cy="130" r="3"/><circle cx="120" cy="130" r="3"/><circle cx="180" cy="130" r="3"/>
    <circle cx="360" cy="70" r="3"/><circle cx="420" cy="70" r="3"/><circle cx="360" cy="130" r="3"/><circle cx="420" cy="130" r="3"/>
  </g>
  <g class="cara">
    <circle cx="250" cy="240" r="150" fill="#fff8ee" stroke="#222" stroke-width="9"/>
    <g clip-path="url(#cabeza)">
      <path d="M100 130q40-90 150-70t150 90v-60H100z" fill="${r.color}" opacity="0.75"/>
      <circle cx="155" cy="265" r="24" fill="#ff9db0" opacity="0.65"/>
      <circle cx="345" cy="265" r="24" fill="#ff9db0" opacity="0.65"/>
    </g>
    ${ojos}
    ${boca}
    <g class="corazon"><text x="250" y="120" text-anchor="middle" font-size="46">${r.emoji}</text></g>
  </g>
  <text x="40" y="440" class="emoji">${r.emoji}</text>
  <text x="150" y="440" class="emoji" style="animation-delay:.7s">${r.emoji}</text>
  <text x="290" y="440" class="emoji" style="animation-delay:1.4s">${r.emoji}</text>
  <text x="250" y="478" text-anchor="middle" font-family="Courier New, monospace" font-size="26" font-weight="bold" letter-spacing="4" fill="#222">${texto.toUpperCase()}</text>
</svg>`;
}

export function indice(ctx) {
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    router: 'reactions',
    total: REACCIONES.length,
    reacciones: REACCIONES.map((r) => ({
      ...r,
      url: `${ctx.base}/api/reactions/${r.nombre}`,
      svg: `${ctx.base}/api/reactions/${r.nombre}.svg`,
    })),
  });
}

export function random(ctx) {
  return porNombre({ ...ctx, segmentos: [...ctx.segmentos.slice(0, -1), 'random'] }, elegir(REACCIONES).nombre);
}

export function porNombre(ctx, forzado) {
  const nombre = (forzado || ctx.parametro(['tipo', 'nombre', 'reaccion'], '') || ctx.segmentos.at(-1) || '').toLowerCase().replace(/\.svg$/, '');
  if (nombre === 'random' && !forzado) return random(ctx);
  const r = REACCION_POR_NOMBRE[nombre];
  if (!r) {
    throw new ErrorHttp(`La reacción "${nombre}" no existe.`, 404, {
      disponibles: REACCIONES.map((x) => x.nombre),
    });
  }
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    ...r,
    url: `${ctx.base}/api/reactions/${r.nombre}.svg`,
    png: `${ctx.base}/api/reactions/${r.nombre}.svg?formato=png`,
    json: `${ctx.base}/api/reactions/${r.nombre}`,
  });
}

export async function svgDirecto(ctx) {
  const ultimo = ctx.url.pathname.split('/').pop() || '';
  const nombre = ultimo.replace(/\.svg$/i, '').toLowerCase();
  const r = REACCION_POR_NOMBRE[nombre];
  if (!r) throw new ErrorHttp(`La reacción "${nombre}" no existe.`, 404);
  return imagen(svgReaccion(nombre, ctx.parametro(['texto', 'text'], '')), ctx, `reaction-${nombre}`);
}
