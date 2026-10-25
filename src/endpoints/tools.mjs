import { randomUUID, randomInt } from 'node:crypto';
import { json, ErrorHttp, obtenerJson, limpiar } from '../utiles.mjs';

/* ------------------------------------------------------------------ */
/* Morse                                                              */
/* ------------------------------------------------------------------ */
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-',
  ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '@': '.--.-.',
  '-': '-....-', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '_': '..--.-', '"': '.-..-.',
  '$': '...-..-', "'": '.----.', 'Á': '.--.-', 'É': '..-..', 'Ñ': '--.--', 'Ü': '..--',
};
const INVERSO = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

function codificar(texto) {
  return limpiar(texto, 600)
    .toUpperCase()
    .split('')
    .map((c) => (c === ' ' ? '/' : MORSE[c] || ''))
    .filter(Boolean)
    .join(' ');
}

function decodificar(texto) {
  return limpiar(texto, 1200)
    .split(/\s*\/\s*|\s{2,}/)
    .map((palabra) =>
      palabra
        .trim()
        .split(/\s+/)
        .map((c) => INVERSO[c] || '')
        .join('')
    )
    .join(' ')
    .trim();
}

export function morse(ctx) {
  const texto = ctx.parametro(['texto', 'text', 'q', 'mensaje'], '');
  if (!texto) throw new ErrorHttp('Falta el parámetro "texto".', 400);
  let accion = ctx.parametro(['accion', 'action', 'modo'], 'auto').toLowerCase();
  if (accion === 'auto') accion = /^[.\-/\s]+$/.test(texto) ? 'decodificar' : 'codificar';
  if (!['codificar', 'decodificar', 'encode', 'decode'].includes(accion)) {
    throw new ErrorHttp('"accion" debe ser codificar o decodificar.', 400);
  }
  const esDecode = accion.startsWith('decode') || accion === 'decodificar';
  const resultado = esDecode ? decodificar(texto) : codificar(texto);
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    accion: esDecode ? 'decodificar' : 'codificar',
    original: texto,
    resultado,
  });
}

/* ------------------------------------------------------------------ */
/* Traductor                                                           */
/* ------------------------------------------------------------------ */
const DICCIONARIO = {
  hello: 'hola', hi: 'hola', hey: 'hola', world: 'mundo', goodbye: 'adiós', bye: 'adiós',
  good: 'bueno', bad: 'malo', morning: 'mañana', night: 'noche', day: 'día',
  thanks: 'gracias', thank: 'gracias', please: 'por favor', sorry: 'perdón',
  yes: 'sí', no: 'no', love: 'amor', friend: 'amigo', friends: 'amigos',
  cat: 'gato', dog: 'perro', house: 'casa', water: 'agua', food: 'comida',
  api: 'api', code: 'código', free: 'gratis', public: 'público', welcome: 'bienvenido',
  how: 'cómo', are: 'estás', you: 'tú', i: 'yo', am: 'soy', is: 'es', the: 'el',
  a: 'un', an: 'un', and: 'y', or: 'o', to: 'a', of: 'de', in: 'en', for: 'para',
  this: 'esto', that: 'eso', with: 'con', my: 'mi', your: 'tu', we: 'nosotros',
  hola: 'hello', mundo: 'world', gracias: 'thanks', adiós: 'goodbye', bueno: 'good',
  buenos: 'good', días: 'days', noches: 'nights', amor: 'love', amigo: 'friend',
  gato: 'cat', perro: 'dog', casa: 'house', agua: 'water', comida: 'food',
  código: 'code', gratis: 'free', bienvenido: 'welcome', público: 'public',
};

function traduccionLocal(texto, destino) {
  const palabras = texto.split(/(\s+|[.,!?¡¿])/g);
  let aciertos = 0;
  const salida = palabras.map((parte) => {
    const limpia = parte.toLowerCase().replace(/[.,!?¡¿]/g, '');
    if (!limpia) return parte;
    const traduccion = DICCIONARIO[limpia];
    if (traduccion) {
      aciertos += 1;
      return parte[0] === parte[0]?.toUpperCase() && /[a-z]/i.test(parte[0])
        ? traduccion[0].toUpperCase() + traduccion.slice(1)
        : traduccion;
    }
    return parte;
  });
  return { texto: salida.join(''), aciertos };
}

export async function traductor(ctx) {
  const texto = ctx.parametro(['texto', 'text', 'q', 'mensaje'], '');
  if (!texto) throw new ErrorHttp('Falta el parámetro "texto".', 400);
  const destino = ctx.parametro(['destino', 'to', 'tl', 'idioma'], 'es').toLowerCase().slice(0, 5);
  const origen = ctx.parametro(['origen', 'from', 'sl'], 'auto').toLowerCase().slice(0, 5);
  const par = `${origen === 'auto' ? (destino.startsWith('es') ? 'en' : 'es') : origen}|${destino}`;

  // 1) MyMemory (gratis, sin clave)
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto.slice(0, 450))}&langpair=${encodeURIComponent(par)}`;
    const { datos } = await obtenerJson(url, { tiempo: 6000 });
    const traducido = datos?.responseData?.translatedText;
    if (traducido && !/MYMEMORY WARNING|INVALID/i.test(traducido)) {
      return json({
        ok: true, status: true, creator: 'Velirius',
        original: texto, traduccion: traducido, origen, destino, fuente: 'MyMemory',
      });
    }
  } catch { /* pasamos al siguiente proveedor */ }

  // 2) Endpoint público de Google Translate
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${origen}&tl=${destino}&dt=t&q=${encodeURIComponent(texto.slice(0, 450))}`;
    const { datos } = await obtenerJson(url, { tiempo: 6000 });
    const traducido = datos?.[0]?.map((x) => x[0]).filter(Boolean).join('');
    if (traducido) {
      return json({
        ok: true, status: true, creator: 'Velirius',
        original: texto, traduccion: traducido, origen, destino, fuente: 'Google Translate',
      });
    }
  } catch { /* sin conexión */ }

  // 3) Diccionario local: siempre disponible (Vercel/Render sin salida a esos hosts)
  const local = traduccionLocal(texto, destino);
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    original: texto,
    traduccion: local.texto,
    origen,
    destino,
    fuente: 'diccionario-local',
    aviso:
      'Los proveedores online no respondieron: se tradujo con el diccionario local incluido. ' +
      'Configura salida a internet para traducciones completas.',
    palabrasTraducidas: local.aciertos,
  });
}

/* ------------------------------------------------------------------ */
/* Calculadora (parser seguro, sin eval)                               */
/* ------------------------------------------------------------------ */
const FUNCIONES = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, log: Math.log10, ln: Math.log,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc,
  sign: Math.sign, cbrt: Math.cbrt, min: Math.min, max: Math.max, pow: Math.pow,
};
const CONSTANTES = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

function tokenizar(entrada) {
  const tokens = [];
  const re = /\s*([0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|[a-zA-Z_][a-zA-Z_0-9]*|\*\*|\^|\+|\-|\*|\/|%|\(|\)|,)/y;
  let i = 0;
  while (i < entrada.length) {
    re.lastIndex = i;
    const m = re.exec(entrada);
    if (!m) throw new Error(`Carácter no válido en la posición ${i + 1}: "${entrada[i]}"`);
    tokens.push(m[1]);
    i = re.lastIndex;
  }
  return tokens;
}

function evaluar(entrada) {
  // La coma es SIEMPRE separador de argumentos (min(3,9)); los decimales usan punto.
  const tokens = tokenizar(entrada);
  let pos = 0;
  const actual = () => tokens[pos];
  const comer = (t) => {
    if (actual() === t) { pos += 1; return true; }
    return false;
  };

  function expresion() {
    let valor = termino();
    while (actual() === '+' || actual() === '-') {
      const op = tokens[pos++];
      const derecho = termino();
      valor = op === '+' ? valor + derecho : valor - derecho;
    }
    return valor;
  }
  function termino() {
    let valor = potencia();
    while (['*', '/', '%'].includes(actual())) {
      const op = tokens[pos++];
      const derecho = potencia();
      if ((op === '/' || op === '%') && derecho === 0) throw new Error('División por cero');
      valor = op === '*' ? valor * derecho : op === '/' ? valor / derecho : valor % derecho;
    }
    return valor;
  }
  function potencia() {
    const base = unario();
    if (actual() === '^' || actual() === '**') {
      pos += 1;
      return Math.pow(base, potencia());
    }
    return base;
  }
  function unario() {
    if (comer('+')) return unario();
    if (comer('-')) return -unario();
    return primario();
  }
  function primario() {
    const t = actual();
    if (t === undefined) throw new Error('Expresión incompleta');
    if (t === '(') {
      pos += 1;
      const valor = expresion();
      if (!comer(')')) throw new Error('Falta un paréntesis de cierre');
      return valor;
    }
    if (/^[0-9]/.test(t)) {
      pos += 1;
      return Number(t);
    }
    if (/^[a-zA-Z_]/.test(t)) {
      pos += 1;
      const nombre = t.toLowerCase();
      if (comer('(')) {
        const args = [];
        if (actual() !== ')') {
          do { args.push(expresion()); } while (comer(','));
        }
        if (!comer(')')) throw new Error('Falta un paréntesis de cierre');
        if (!(nombre in FUNCIONES)) throw new Error(`Función desconocida: ${t}`);
        return FUNCIONES[nombre](...args);
      }
      if (nombre in CONSTANTES) return CONSTANTES[nombre];
      throw new Error(`Constante desconocida: ${t}`);
    }
    throw new Error(`Token inesperado: ${t}`);
  }

  const resultado = expresion();
  if (pos < tokens.length) throw new Error(`Sobra: "${tokens.slice(pos).join(' ')}"`);
  if (!Number.isFinite(resultado)) throw new Error('El resultado no es un número finito');
  return Math.round(resultado * 1e12) / 1e12;
}

export function calculadora(ctx) {
  const expresion = ctx.parametro(['expresion', 'expr', 'texto', 'q', 'calculo'], '');
  if (!expresion) throw new ErrorHttp('Falta el parámetro "expresion".', 400);
  if (expresion.length > 300) throw new ErrorHttp('La expresión es demasiado larga.', 400);
  try {
    return json({
      ok: true,
      status: true,
      creator: 'Velirius',
      expresion,
      resultado: evaluar(expresion),
      funciones: Object.keys(FUNCIONES),
    });
  } catch (error) {
    throw new ErrorHttp(`No se pudo evaluar: ${error.message}`, 400, { expresion });
  }
}

/* ------------------------------------------------------------------ */
/* Otras utilidades                                                    */
/* ------------------------------------------------------------------ */
export function base64(ctx) {
  const texto = ctx.parametro(['texto', 'text', 'q'], '');
  if (!texto) throw new ErrorHttp('Falta el parámetro "texto".', 400);
  const accion = ctx.parametro(['accion', 'action', 'modo'], 'codificar').toLowerCase();
  if (accion.startsWith('decode') || accion === 'decodificar') {
    try {
      const salida = Buffer.from(texto, 'base64').toString('utf8');
      return json({ ok: true, status: true, creator: 'Velirius', accion: 'decodificar', original: texto, resultado: salida });
    } catch {
      throw new ErrorHttp('El texto no es Base64 válido.', 400);
    }
  }
  return json({
    ok: true, status: true, creator: 'Velirius', accion: 'codificar',
    original: texto, resultado: Buffer.from(texto, 'utf8').toString('base64'),
  });
}

export function uuid(ctx) {
  const cantidad = Math.min(Math.max(Number(ctx.parametro(['cantidad', 'n'], '1')) || 1, 1), 20);
  const lista = Array.from({ length: cantidad }, () => randomUUID());
  return json({ ok: true, status: true, creator: 'Velirius', cantidad, resultado: cantidad === 1 ? lista[0] : lista });
}

export function password(ctx) {
  const longitud = Math.min(Math.max(Number(ctx.parametro(['longitud', 'length'], '16')) || 16, 8), 64);
  const cantidad = Math.min(Math.max(Number(ctx.parametro(['cantidad', 'n'], '1')) || 1, 1), 10);
  const minus = 'abcdefghijkmnopqrstuvwxyz';
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '23456789';
  const simbolos = '!@#$%&*+-_?';
  const todo = minus + mayus + nums + simbolos;
  const elegir = (cadena) => cadena[randomInt(0, cadena.length)];
  const generar = () => {
    const chars = [elegir(minus), elegir(mayus), elegir(nums), elegir(simbolos)];
    while (chars.length < longitud) chars.push(elegir(todo));
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = randomInt(0, i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  };
  const lista = Array.from({ length: cantidad }, generar);
  return json({
    ok: true, status: true, creator: 'Velirius', longitud, cantidad,
    resultado: cantidad === 1 ? lista[0] : lista,
    entropia: Math.round(longitud * Math.log2(todo.length)) + ' bits',
  });
}

export function indice(ctx) {
  return json({
    ok: true,
    status: true,
    creator: 'Velirius',
    router: 'tools',
    endpoints: ['/api/tools/morse', '/api/tools/traductor', '/api/tools/calculadora', '/api/tools/base64', '/api/tools/uuid', '/api/tools/password'],
    catalogo: `${ctx.base}/api/categories/tools`,
  });
}
