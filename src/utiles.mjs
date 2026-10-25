/**
 * Utilidades compartidas por todos los endpoints.
 * No usa ninguna dependencia externa: funciona igual en Node, Vercel y Render.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const CREADOR = 'Velirius';
export const VERSION = '1.0.0';

/* ------------------------------------------------------------------ */
/* Respuestas                                                          */
/* ------------------------------------------------------------------ */

export function json(datos, estado = 200, cabeceras = {}) {
  return {
    estado,
    cabeceras: { 'Content-Type': 'application/json; charset=utf-8', ...cabeceras },
    cuerpo: JSON.stringify(datos),
  };
}

export function texto(cuerpo, tipo = 'text/plain; charset=utf-8', estado = 200, cabeceras = {}) {
  return { estado, cabeceras: { 'Content-Type': tipo, ...cabeceras }, cuerpo };
}

export function binario(cuerpo, tipo, estado = 200, cabeceras = {}) {
  return { estado, cabeceras: { 'Content-Type': tipo, ...cabeceras }, cuerpo };
}

export function redireccion(url, estado = 302) {
  return { estado, cabeceras: { Location: url }, cuerpo: '' };
}

export class ErrorHttp extends Error {
  constructor(mensaje, estado = 400, detalles = {}) {
    super(mensaje);
    this.nombre = 'ErrorHttp';
    this.estado = estado;
    this.detalles = detalles;
  }
}

export function fallo(mensaje, estado = 400, detalles = {}) {
  return json(
    {
      ok: false,
      status: false,
      creator: CREADOR,
      error: mensaje,
      ...detalles,
    },
    estado
  );
}

/* ------------------------------------------------------------------ */
/* Petición / parámetros                                               */
/* ------------------------------------------------------------------ */

const MAX_CUERPO = 1024 * 1024; // 1 MB

export async function leerCuerpo(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    const crudo = typeof req.body === 'string' ? req.body : req.body.toString('utf8');
    return interpretarCuerpo(crudo, req.headers?.['content-type'] || '');
  }
  if (typeof req.on !== 'function') return {};
  return await new Promise((resolve) => {
    let datos = '';
    let terminado = false;
    const fin = (valor) => {
      if (terminado) return;
      terminado = true;
      resolve(valor);
    };
    req.on('data', (trozo) => {
      datos += trozo.toString('utf8');
      if (datos.length > MAX_CUERPO) fin({});
    });
    req.on('end', () => fin(interpretarCuerpo(datos, req.headers?.['content-type'] || '')));
    req.on('error', () => fin({}));
  });
}

function interpretarCuerpo(crudo, tipo) {
  if (!crudo) return {};
  try {
    if (tipo.includes('application/json') || crudo.trim().startsWith('{')) {
      const valor = JSON.parse(crudo);
      return valor && typeof valor === 'object' ? valor : {};
    }
    return Object.fromEntries(new URLSearchParams(crudo));
  } catch {
    return {};
  }
}

/** Construye el objeto de contexto que recibe cada endpoint. */
export async function crearContexto(req, res, url) {
  const cuerpo = req.method === 'GET' || req.method === 'HEAD' ? {} : await leerCuerpo(req);
  const consultaVercel = req.query && typeof req.query === 'object' ? req.query : {};
  const q = url.searchParams;

  const valor = (nombre) => {
    if (q.has(nombre)) return q.get(nombre);
    if (cuerpo && Object.hasOwn(cuerpo, nombre)) return String(cuerpo[nombre]);
    if (Object.hasOwn(consultaVercel, nombre)) {
      const v = consultaVercel[nombre];
      return Array.isArray(v) ? v.at(-1) : String(v);
    }
    return null;
  };

  const parametro = (nombres, defecto = '') => {
    const lista = Array.isArray(nombres) ? nombres : [nombres];
    for (const nombre of lista) {
      const v = valor(nombre);
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
    return defecto;
  };

  const requerir = (nombres, etiqueta) => {
    const v = parametro(nombres, '');
    if (!v) {
      throw new ErrorHttp(`Falta el parámetro obligatorio "${etiqueta || (Array.isArray(nombres) ? nombres[0] : nombres)}".`, 400, {
        parametro: etiqueta || (Array.isArray(nombres) ? nombres[0] : nombres),
      });
    }
    return v;
  };

  const proto = (req.headers?.['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'localhost';
  const base = process.env.URL_BASE || `${proto}://${host}`;

  return {
    req,
    res,
    url,
    q,
    cuerpo,
    base,
    valor,
    parametro,
    requerir,
    metodo: (req.method || 'GET').toUpperCase(),
    ip:
      (req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'local',
    segmentos: url.pathname.split('/').filter(Boolean),
  };
}

/* ------------------------------------------------------------------ */
/* Red: fetch con límites y protección SSRF                             */
/* ------------------------------------------------------------------ */

function esPrivado(direccion) {
  if (isIP(direccion) === 4) {
    const [a, b] = direccion.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  return /^(::1|fc|fd|fe80|::ffff:127|::ffff:10)/i.test(direccion);
}

/** Hosts explícitamente permitidos (útil para tests locales o servicios propios). */
function hostPermitido(url) {
  return (process.env.PERMITIR_HOSTS || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(url.hostname.toLowerCase());
}

export async function urlSegura(entrada) {
  let url;
  try {
    url = new URL(entrada);
  } catch {
    throw new ErrorHttp('La URL no es válida.', 400);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ErrorHttp('Solo se permiten URLs http(s).', 400);
  }
  if (hostPermitido(url) || process.env.PERMITIR_PRIVADOS === '1') return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const direcciones = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((x) => x.address);
  if (!direcciones.length || direcciones.some(esPrivado)) {
    throw new ErrorHttp('Esa URL apunta a un host no público.', 400);
  }
  return url;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Descarga con timeout, límite de tamaño y cabeceras de navegador.
 * Devuelve { buffer, tipo, estado, urlFinal }.
 */
export async function descargar(entrada, opciones = {}) {
  const {
    tiempo = 9000,
    maximo = 4 * 1024 * 1024,
    cabeceras = {},
    verificar = true,
    redirecciones = 3,
  } = opciones;

  const url = verificar ? await urlSegura(entrada) : new URL(entrada);
  // MODO_OFFLINE=1 simula un despliegue sin salida a internet (tests / CI):
  // los hosts de PERMITIR_HOSTS siguen funcionando para poder usar mocks locales.
  if (process.env.MODO_OFFLINE === '1' && !hostPermitido(url)) {
    throw new Error('MODO_OFFLINE activo: sin salida a internet');
  }
  const respuesta = await fetch(url, {
    method: 'GET',
    redirect: redirecciones > 0 ? 'follow' : 'manual',
    signal: AbortSignal.timeout(tiempo),
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/json,application/xhtml+xml,image/avif,image/webp,*/*',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      ...cabeceras,
    },
  });

  if (redirecciones > 0 && respuesta.status >= 300 && respuesta.status < 400 && respuesta.headers.get('location')) {
    const destino = new URL(respuesta.headers.get('location'), respuesta.url).toString();
    return descargar(destino, { ...opciones, redirecciones: redirecciones - 1 });
  }

  const tipo = (respuesta.headers.get('content-type') || 'application/octet-stream').split(';')[0];
  const declarado = Number(respuesta.headers.get('content-length') || 0);
  if (declarado > maximo) throw new ErrorHttp('El recurso remoto es demasiado grande.', 413);

  if (!respuesta.body) return { buffer: Buffer.alloc(0), tipo, estado: respuesta.status, urlFinal: respuesta.url };

  const partes = [];
  let total = 0;
  const lector = respuesta.body.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.length;
    if (total > maximo) {
      await lector.cancel().catch(() => {});
      throw new ErrorHttp('El recurso remoto supera el límite de tamaño.', 413);
    }
    partes.push(Buffer.from(value));
  }
  return {
    buffer: Buffer.concat(partes),
    tipo,
    estado: respuesta.status,
    urlFinal: respuesta.url,
  };
}

export async function obtenerTexto(entrada, opciones = {}) {
  const { buffer, estado, urlFinal } = await descargar(entrada, opciones);
  return { html: buffer.toString('utf8'), estado, urlFinal };
}

export async function obtenerJson(entrada, opciones = {}) {
  const { buffer, estado } = await descargar(entrada, opciones);
  return { datos: JSON.parse(buffer.toString('utf8')), estado };
}

/* ------------------------------------------------------------------ */
/* Texto / HTML                                                       */
/* ------------------------------------------------------------------ */

const ENTIDADES = {
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lt: '<',
  gt: '>',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

export function decodificarHtml(texto = '') {
  return String(texto)
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (_, n) => ENTIDADES[n.toLowerCase()] || `&${n};`);
}

export function escaparXml(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function limpiar(texto, maximo = 500) {
  return String(texto ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo);
}

export function normalizar(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function limitar(texto, maximo = 200) {
  const t = String(texto ?? '');
  return t.length > maximo ? `${t.slice(0, maximo - 1)}…` : t;
}

export function urlAbsoluta(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** Extrae metadatos OpenGraph / Twitter / JSON-LD de una página. */
export function extraerMeta(html, urlBase = '') {
  const meta = {};
  const etiqueta = /<meta\b[^>]*>/gi;
  for (const etiquetas of html.matchAll(etiqueta)) {
    const tag = etiquetas[0];
    const prop = (tag.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const contenido = tag.match(/content\s*=\s*["']([^"']*)["']/i) || tag.match(/content\s*=\s*([^\s>]+)/i);
    if (prop && contenido) {
      const clave = prop.toLowerCase().replace(/^og:/, '').replace(/^twitter:/, '');
      if (!meta[clave]) meta[clave] = decodificarHtml(contenido[1]);
    }
  }

  const titulo = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const enlaces = [];
  for (const m of html.matchAll(/(?:https?:)?\/\/[^\s"'<>]+\.(?:mp4|webm|m4a|mp3|jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi)) {
    enlaces.push(decodificarHtml(m[0].replace(/&amp;/g, '&')));
  }
  for (const m of html.matchAll(/<source[^>]+src\s*=\s*["']([^"']+)["']/gi)) {
    enlaces.push(urlAbsoluta(urlBase, decodificarHtml(m[1])));
  }

  const jsonLd = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const dato = JSON.parse(m[1]);
      (Array.isArray(dato) ? dato : [dato]).forEach((x) => jsonLd.push(x));
    } catch {
      /* JSON-LD inválido: se ignora */
    }
  }

  const absoluta = (v) => (v ? urlAbsoluta(urlBase, v) : undefined);
  return {
    titulo: meta.title || (titulo ? decodificarHtml(titulo.trim()) : undefined),
    descripcion: meta.description,
    imagen: absoluta(meta.image || meta.image_secure_url),
    video: absoluta(meta.video || meta.video_secure_url || meta['video:url']),
    autor: meta.author || meta['article:author'],
    sitio: meta.site_name,
    tipo: meta.type,
    enlaces: [...new Set(enlaces.map((x) => absoluta(x)))].slice(0, 12),
    jsonLd,
  };
}

/** Divide un texto en líneas que quepan en `ancho` con un tamaño de fuente dado. */
export function envolverTexto(texto, ancho, tamano, maxLineas = 6) {
  const palabras = limpiar(texto, 400).split(' ').filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (prueba.length * tamano * 0.54 > ancho && actual) {
      lineas.push(actual);
      actual = palabra;
      if (lineas.length >= maxLineas) break;
    } else {
      actual = prueba;
    }
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual);
  if (lineas.length === maxLineas && palabras.join(' ').length > lineas.join(' ').length) {
    lineas[maxLineas - 1] = `${lineas[maxLineas - 1].replace(/.$/, '')}…`;
  }
  return lineas;
}

/** Color HSL estable a partir de un texto (para avatares). */
export function colorDe(texto) {
  let hash = 0;
  for (const c of String(texto)) hash = (hash * 31 + c.codePointAt(0)) >>> 0;
  return `hsl(${hash % 360} 62% 58%)`;
}

export function elegir(lista, aleatorio = Math.random) {
  return lista[Math.floor(aleatorio() * lista.length) % lista.length];
}

/** PRNG determinista (mulberry32) para gacha/porcentajes con semilla. */
export function prng(semillaTexto) {
  let h = 1779033703 ^ String(semillaTexto).length;
  for (const c of String(semillaTexto)) {
    h = Math.imul(h ^ c.codePointAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function esUrl(valor) {
  try {
    const u = new URL(valor);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}
