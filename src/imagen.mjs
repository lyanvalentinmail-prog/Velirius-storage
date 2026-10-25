/**
 * Salida de imagen para los endpoints de canvas / reactions / avatares.
 *
 * Los endpoints componen siempre un SVG (sin dependencias). Si `sharp` está
 * instalado (optionalDependency) y el cliente pide PNG, rasterizamos el SVG
 * para devolver un PNG real, que es lo que esperan la mayoría de los bots.
 * Si algo falla, se devuelve el SVG: el endpoint NUNCA deja de funcionar.
 */
import { texto, binario } from './utiles.mjs';

let sharpDisponible;

async function cargarSharp() {
  if (sharpDisponible !== undefined) return sharpDisponible;
  try {
    const modulo = await import('sharp');
    sharpDisponible = modulo.default || modulo;
  } catch {
    sharpDisponible = null;
  }
  return sharpDisponible;
}

export async function imagen(svg, ctx, nombre = 'velirius') {
  const formato = ctx.parametro(['formato', 'format'], '').toLowerCase();
  const acepta = String(ctx.req?.headers?.accept || '');
  const quierePng =
    formato === 'png' ||
    (formato === '' && /image\/png/.test(acepta) && !/image\/svg/.test(acepta));

  if (quierePng) {
    const sharp = await cargarSharp();
    if (sharp) {
      try {
        const png = await sharp(Buffer.from(svg), { density: 120 }).png().toBuffer();
        return binario(png, 'image/png', 200, {
          'Content-Disposition': `inline; filename="${nombre}.png"`,
          'X-Velirius-Formato': 'png',
          'Cache-Control': 'public, max-age=300',
        });
      } catch {
        /* librsvg no pudo rasterizar: devolvemos el SVG original */
      }
    }
  }

  return texto(svg, 'image/svg+xml; charset=utf-8', 200, {
    'Content-Disposition': `inline; filename="${nombre}.svg"`,
    'X-Velirius-Formato': 'svg',
    'Cache-Control': 'public, max-age=300',
  });
}

/** Convierte una URL remota (o data URI) en un data URI listo para incrustar. */
export async function imagenComoDato(entrada, { descargar, porDefecto } = {}) {
  if (!entrada) return porDefecto || '';
  if (entrada.startsWith('data:image/')) return entrada;
  try {
    const { buffer, tipo } = await descargar(entrada, { tiempo: 6000, maximo: 3 * 1024 * 1024 });
    if (!tipo.startsWith('image/')) return porDefecto || '';
    return `data:${tipo};base64,${buffer.toString('base64')}`;
  } catch {
    return porDefecto || '';
  }
}
