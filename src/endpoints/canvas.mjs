/**
 * Endpoints de canvas.
 *
 * Cada plantilla de assets/canvas/ (descargada de Google Drive) se sirve como
 * imagen compuesta en SVG: se tapan las zonas de ejemplo de la plantilla y se
 * dibuja el texto / la imagen que llegue por query string. Con `?formato=png`
 * (o un cliente que acepte PNG) se rasteriza con sharp si está disponible.
 */
import { PLANTILLAS } from '../plantillas.mjs';
import { CANVAS, CANVAS_POR_NOMBRE, ALIASES } from '../canvas-config.mjs';
import { imagen, imagenComoDato } from '../imagen.mjs';
import {
  json,
  ErrorHttp,
  escaparXml,
  envolverTexto,
  prng,
  limpiar,
  colorDe,
  descargar,
} from '../utiles.mjs';

const cacheImagenes = new Map();

async function datoImagen(url, porDefecto) {
  if (!url) return porDefecto || '';
  if (cacheImagenes.has(url)) return cacheImagenes.get(url);
  const dato = await imagenComoDato(url, { descargar, porDefecto });
  if (cacheImagenes.size > 60) cacheImagenes.clear();
  cacheImagenes.set(url, dato);
  return dato;
}

/** Avatar SVG generado cuando el usuario no manda una imagen. */
function avatarPorDefecto(nombre, color) {
  const letras = escaparXml(
    String(nombre || 'V')
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase() || '')
      .join('') || 'V'
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${
    color || colorDe(nombre)
  }"/><text x="150" y="190" text-anchor="middle" font-family="Courier New, monospace" font-size="130" font-weight="bold" fill="#fff">${letras}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function valorDe(ctx, config, nombre) {
  const ejemplo = config.params.find((p) => p.nombre === nombre)?.ejemplo || '';
  return ctx.parametro(ALIASES[nombre] || [nombre], ejemplo);
}

/* ------------------------------------------------------------------ */
/* Formas y zonas                                                      */
/* ------------------------------------------------------------------ */

function forma(zona, id, px, escala) {
  const { x, y, w, h } = px;
  const radio = Math.min(w, h) * 0.5;
  if (zona.forma === 'circulo' || zona.forma === 'elipse') {
    return `<ellipse id="${id}" cx="${x + w / 2}" cy="${y + h / 2}" rx="${zona.forma === 'circulo' ? radio : w / 2}" ry="${
      zona.forma === 'circulo' ? radio : h / 2
    }"/>`;
  }
  return `<rect id="${id}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${8 * escala}"/>`;
}

function zonaSvg(zona, indice, ctx2, valores) {
  const { W, H, escala } = ctx2;
  const px = {
    x: zona.x * W,
    y: zona.y * H,
    w: zona.w * W,
    h: zona.h * H,
  };
  const id = `z${indice}`;
  const clip = `clip${indice}`;
  const piezas = [];

  const relleno = ctx2.fondo || zona.fondo || '#ffffff';
  piezas.push(`<clipPath id="${clip}">${forma(zona, id, px, escala)}</clipPath>`);
  piezas.push(
    `<g clip-path="url(#${clip})"><rect x="${px.x}" y="${px.y}" width="${px.w}" height="${px.h}" fill="${escaparXml(
      relleno
    )}"/>`
  );

  const dato = zona.imagen ? valores[`__img_${zona.imagen}`] : '';
  if (dato) {
    piezas.push(
      `<image href="${dato}" x="${px.x}" y="${px.y}" width="${px.w}" height="${px.h}" preserveAspectRatio="xMidYMid slice"/>`
    );
  }

  if (zona.texto && (!dato || ctx2.forzarTexto)) {
    const texto = limpiar(valores[zona.texto] || '', 220);
    if (texto) {
      const tamanoBase = (zona.tamano || 32) * escala;
      let tamano = tamanoBase;
      let lineas = [];
      for (let intento = 0; intento < 12; intento += 1) {
        const maxLineas = Math.max(1, Math.floor(px.h / (tamano * 1.18)));
        lineas = envolverTexto(texto, px.w - 18 * escala, tamano, maxLineas);
        if (lineas.join(' ').length >= texto.length - 2 && lineas.length <= maxLineas) break;
        tamano *= 0.86;
      }
      const altoLinea = tamano * 1.18;
      const inicio = px.y + px.h / 2 - ((lineas.length - 1) * altoLinea) / 2 + tamano * 0.34;
      const alineado = zona.alineacion === 'izquierda';
      const xTexto = alineado ? px.x + 10 * escala : px.x + px.w / 2;
      const ancla = alineado ? 'start' : 'middle';
      const animacion =
        ctx2.efecto === 'parpadeo'
          ? `<animate attributeName="opacity" values="1;0.45;1" dur="0.9s" repeatCount="indefinite"/>`
          : '';
      piezas.push(
        `<text x="${xTexto}" y="${inicio}" text-anchor="${ancla}" font-family="Courier New, DejaVu Sans Mono, monospace" font-size="${tamano}" font-weight="${
          zona.peso || '600'
        }" fill="${escaparXml(zona.color || '#111111')}" stroke="none">${animacion}${lineas
          .map((linea, i) => `<tspan x="${xTexto}" dy="${i === 0 ? 0 : altoLinea}">${escaparXml(linea)}</tspan>`)
          .join('')}</text>`
      );
    }
  }

  piezas.push('</g>');
  return piezas.join('');
}

/* ------------------------------------------------------------------ */
/* Efectos especiales                                                  */
/* ------------------------------------------------------------------ */

function efectoBarras(ctx2, texto) {
  const { W, H, escala } = ctx2;
  const aleatorio = prng(`iqc:${texto}`);
  const corazones = ['❤️', '🔥', '🥰', '👏', '💯'];
  const altoPanel = H * 0.42;
  const y0 = H * 0.55;
  let salida = `<rect x="${W * 0.04}" y="${y0}" width="${W * 0.92}" height="${altoPanel}" rx="${16 * escala}" fill="rgba(0,0,0,0.72)"/>`;
  salida += `<text x="${W * 0.5}" y="${y0 + 34 * escala}" text-anchor="middle" font-family="Courier New, monospace" font-size="${
    24 * escala
  }" font-weight="bold" fill="#fff">${escaparXml(limpiar(texto, 30).toUpperCase() || 'VELIRIUS')}</text>`;
  for (let i = 0; i < 5; i += 1) {
    const porcentaje = Math.round(8 + aleatorio() * 90);
    const y = y0 + (52 + i * 44) * escala;
    const x = W * 0.10;
    const ancho = W * 0.66;
    salida += `<text x="${W * 0.07}" y="${y + 16 * escala}" font-size="${22 * escala}">${corazones[i]}</text>`;
    salida += `<rect x="${x}" y="${y}" width="${ancho}" height="${20 * escala}" rx="${10 * escala}" fill="#ffffff" opacity="0.22"/>`;
    salida += `<rect x="${x}" y="${y}" width="${(ancho * porcentaje) / 100}" height="${20 * escala}" rx="${10 * escala}" fill="${
      ['#ff5c8a', '#ffb35c', '#ffe75c', '#8ce99a', '#74c0fc'][i]
    }"/>`;
    salida += `<text x="${W * 0.92}" y="${y + 16 * escala}" text-anchor="end" font-family="Courier New, monospace" font-size="${
      19 * escala
    }" font-weight="bold" fill="#fff">${porcentaje}%</text>`;
  }
  return salida;
}

function efectoPorcentaje(ctx2, texto) {
  const { W, H, escala } = ctx2;
  const aleatorio = prng(`gay:${texto}`);
  const porcentaje = Math.round(aleatorio() * 100);
  return `
    <circle cx="${W / 2}" cy="${H * 0.48}" r="${H * 0.20}" fill="rgba(255,255,255,0.9)"/>
    <text x="${W / 2}" y="${H * 0.50}" text-anchor="middle" font-family="Courier New, monospace" font-size="${
      58 * escala
    }" font-weight="bold" fill="#111">${porcentaje}%</text>
    <rect x="${W * 0.04}" y="${H * 0.62}" width="${W * 0.92}" height="${H * 0.34}" rx="${12 * escala}" fill="#0d0d0d"/>
    <text x="${W / 2}" y="${H * 0.78}" text-anchor="middle" font-family="Courier New, monospace" font-size="${
      22 * escala
    }" font-weight="bold" fill="#fff">${escaparXml(limpiar(texto, 28).toUpperCase())}</text>
    <text x="${W / 2}" y="${H * 0.90}" text-anchor="middle" font-family="Courier New, monospace" font-size="${
      20 * escala
    }" fill="#8dff6a">~ VELIRIUS ~</text>`;
}

function efectoShip(ctx2, valores) {
  const { W, H, escala } = ctx2;
  const nombre1 = limpiar(valores.username || 'Ana', 24);
  const nombre2 = limpiar(valores.username2 || 'Luis', 24);
  const porcentaje = Math.round(prng(`ship:${nombre1}:${nombre2}`)() * 100);
  const avatar1 = valores.__img_image || avatarPorDefecto(nombre1);
  const avatar2 = valores.__img_image2 || avatarPorDefecto(nombre2, '#5c7cfa');
  const r = H * 0.26;
  return `
    <clipPath id="av1"><circle cx="${W * 0.16}" cy="${H * 0.44}" r="${r}"/></clipPath>
    <clipPath id="av2"><circle cx="${W * 0.84}" cy="${H * 0.44}" r="${r}"/></clipPath>
    <rect x="${W * 0.31}" y="${H * 0.27}" width="${W * 0.38}" height="${H * 0.53}" rx="${14 * escala}" fill="#23272a"/>
    <circle cx="${W * 0.16}" cy="${H * 0.44}" r="${r + 4 * escala}" fill="#fff" opacity="0.85"/>
    <circle cx="${W * 0.84}" cy="${H * 0.44}" r="${r + 4 * escala}" fill="#fff" opacity="0.85"/>
    <image href="${avatar1}" x="${W * 0.16 - r}" y="${H * 0.44 - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#av1)"/>
    <image href="${avatar2}" x="${W * 0.84 - r}" y="${H * 0.44 - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#av2)"/>
    <text x="${W * 0.5}" y="${H * 0.45}" text-anchor="middle" font-size="${46 * escala}">💖</text>
    <text x="${W * 0.5}" y="${H * 0.64}" text-anchor="middle" font-family="Courier New, monospace" font-size="${
      40 * escala
    }" font-weight="bold" fill="#8dff6a">${porcentaje}%</text>
    <rect x="${W * 0.04}" y="${H * 0.80}" width="${W * 0.24}" height="${H * 0.16}" rx="${8 * escala}" fill="rgba(0,0,0,0.72)"/>
    <rect x="${W * 0.72}" y="${H * 0.80}" width="${W * 0.24}" height="${H * 0.16}" rx="${8 * escala}" fill="rgba(0,0,0,0.72)"/>
    <text x="${W * 0.16}" y="${H * 0.90}" text-anchor="middle" font-family="Courier New, monospace" font-size="${
      20 * escala
    }" fill="#fff">${escaparXml(nombre1)}</text>
    <text x="${W * 0.84}" y="${H * 0.90}" text-anchor="middle" font-family="Courier New, monospace" font-size="${
      20 * escala
    }" fill="#fff">${escaparXml(nombre2)}</text>`;
}

/* ------------------------------------------------------------------ */
/* Render principal                                                    */
/* ------------------------------------------------------------------ */

async function renderizar(ctx, config) {
  const plantilla = PLANTILLAS[config.plantilla];
  if (!plantilla) throw new ErrorHttp(`La plantilla "${config.plantilla}" no está disponible.`, 500);

  const W = config.lienzo?.ancho || plantilla.ancho;
  const H = config.lienzo?.alto || plantilla.alto;
  const escala = W / 736;
  const nombresParametros = [...new Set(config.params.map((p) => p.nombre))];
  const valores = {};
  for (const nombre of nombresParametros) valores[nombre] = valorDe(ctx, config, nombre);

  // Resuelve en paralelo las imágenes remotas de todas las zonas.
  const imagenes = nombresParametros.filter((n) => n.startsWith('image') && valores[n]);
  await Promise.all(
    imagenes.map(async (nombre) => {
      valores[`__img_${nombre}`] = await datoImagen(valores[nombre], '');
    })
  );
  // Efectos ship necesitan avatares por defecto si no hay URL.
  if (config.efecto === 'ship') {
    valores.__img_image = valores.__img_image || avatarPorDefecto(valores.username || 'Ana');
    valores.__img_image2 = valores.__img_image2 || avatarPorDefecto(valores.username2 || 'Luis', '#5c7cfa');
  }

  const ctx2 = {
    W,
    H,
    escala,
    efecto: config.efecto,
    fondo: ctx.parametro(['fondo', 'background'], ''),
    forzarTexto: ctx.parametro(['forzarTexto'], '0') === '1',
  };

  const fondoGirado = config.efecto === 'girar';
  const imagenFondo = `<image href="${plantilla.datos}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="${
    config.lienzo ? 'none' : 'xMidYMid slice'
  }"${fondoGirado ? ` transform="rotate(180 ${W / 2} ${H / 2})"` : ''}/>`;

  let extras = '';
  if (config.efecto === 'barras') extras = efectoBarras(ctx2, valores.text || '');
  if (config.efecto === 'porcentaje') extras = efectoPorcentaje(ctx2, valores.text || '');
  if (config.efecto === 'ship') extras = efectoShip(ctx2, valores);

  const zonas = config.zonas.map((zona, i) => zonaSvg(zona, i, ctx2, valores)).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="invertir"><feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter>
  </defs>
  ${imagenFondo}
  ${extras}
  ${zonas}
</svg>`;

  return imagen(svg, ctx, `canvas-${config.nombre}`);
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

export function indice(ctx) {
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    router: 'canvas',
    total: CANVAS.length,
    formatos: ['svg', 'png (si sharp está instalado)'],
    plantillas: Object.keys(PLANTILLAS).length,
    endpoints: CANVAS.map((c) => ({
      nombre: c.nombre,
      descripcion: c.descripcion,
      url: `${ctx.base}/api/canvas/${c.nombre}`,
      ejemplo: `${ctx.base}/api/canvas/${c.nombre}?text=${encodeURIComponent('Hola Velirius')}`,
      parametros: c.params.map((p) => p.nombre),
      plantilla: `${ctx.base}${PLANTILLAS[c.plantilla]?.archivo || ''}`,
    })),
  });
}

export function ejecutar(ctx) {
  const nombre = (ctx.parametro(['nombre', 'tipo', 'plantilla'], '') || ctx.segmentos.at(-1) || '').toLowerCase();
  const config = CANVAS_POR_NOMBRE[nombre];
  if (!config) {
    throw new ErrorHttp(`El endpoint de canvas "${nombre}" no existe.`, 404, {
      disponibles: CANVAS.map((c) => c.nombre),
    });
  }
  return renderizar(ctx, config);
}
