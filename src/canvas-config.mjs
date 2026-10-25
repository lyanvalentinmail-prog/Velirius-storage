/**
 * Definición declarativa de los endpoints de canvas.
 *
 * Cada entrada usa una plantilla descargada de la carpeta "CategoriaCanvas" de
 * Google Drive. Las zonas son coordenadas RELATIVAS (0..1) sobre el lienzo:
 * una zona tapa el texto de ejemplo / la pantalla verde de la plantilla y dibuja
 * encima el texto o la imagen que llegue por query string.
 *
 * `tamano` se expresa en píxeles para un lienzo de 736 px de ancho y se escala
 * automáticamente al ancho real de cada plantilla.
 */
const P = (nombre, ejemplo, descripcion = '') => ({ nombre, ejemplo, descripcion });
const TEXTO = P('text', 'Hola desde Velirius', 'Texto principal que se dibuja en la plantilla');
const IMAGEN = P('image', '', 'URL de una imagen/avatar para incrustar (opcional)');
const USUARIO = P('username', 'Velirius', 'Nombre que aparece en la tarjeta');

/** Zona de texto: tapa el ejemplo de la plantilla y escribe encima. */
const z = (x, y, w, h, texto, extra = {}) => ({ x, y, w, h, texto, fondo: '#fff', ...extra });
/** Zona de imagen: recorta una imagen remota en un círculo/rectángulo. */
const zi = (x, y, w, h, imagen, extra = {}) => ({
  x,
  y,
  w,
  h,
  imagen,
  fondo: '#00ff2a',
  forma: 'circulo',
  ...extra,
});

export const CANVAS = [
  {
    nombre: 'quotly',
    plantilla: 'quotly',
    lienzo: { ancho: 900, alto: 350 },
    descripcion: 'Tarjeta de cita estilo Quotly con avatar, usuario y texto.',
    params: [USUARIO, TEXTO, IMAGEN],
    zonas: [
      z(0, 0, 1, 1, '', { fondo: '#0a0a0a' }),
      zi(0.005, 0.02, 0.21, 0.56, 'image', { fondo: '#ffb648' }),
      z(0.20, 0.06, 0.56, 0.26, 'username', { fondo: '#0a0a0a', tamano: 30, color: '#ffab40', peso: '700', alineacion: 'izquierda' }),
      z(0.19, 0.38, 0.78, 0.42, 'text', { fondo: '#0a0a0a', tamano: 34, color: '#ffffff', alineacion: 'izquierda' }),
    ],
  },
  {
    nombre: 'brat',
    plantilla: 'brat',
    descripcion: 'El clásico cartel BRAT con tu texto.',
    params: [TEXTO],
    zonas: [z(0.04, 0.10, 0.92, 0.84, 'text', { fondo: '#ffffff', tamano: 78, color: '#101010', peso: '700' })],
  },
  {
    nombre: 'bratvideo',
    plantilla: 'brat',
    efecto: 'parpadeo',
    descripcion: 'Versión animada del cartel BRAT (SVG animado / PNG).',
    params: [TEXTO],
    zonas: [z(0.04, 0.10, 0.92, 0.84, 'text', { fondo: '#ffffff', tamano: 78, color: '#101010', peso: '700' })],
  },
  {
    nombre: 'bratestirado',
    plantilla: 'bratestirado',
    descripcion: 'Texto estirado tipo "i <3 money" sobre fondo blanco.',
    params: [TEXTO],
    zonas: [z(0.16, 0.05, 0.68, 0.90, 'text', { fondo: '#ffffff', tamano: 66, color: '#0b0b0b', peso: '700' })],
  },
  {
    nombre: 'ttp',
    plantilla: 'ttp',
    descripcion: 'Logo de texto sobre fondo negro (text-to-picture).',
    params: [P('text', 'Velirius', 'Texto del logo')],
    zonas: [z(0.04, 0.34, 0.92, 0.32, 'text', { fondo: '#000000', tamano: 82, color: '#ffffff', peso: '700' })],
  },
  {
    nombre: 'attp',
    plantilla: 'ttp',
    efecto: 'parpadeo',
    descripcion: 'Igual que ttp pero con el texto animado por colores.',
    params: [P('text', 'Velirius', 'Texto animado')],
    zonas: [z(0.04, 0.34, 0.92, 0.32, 'text', { fondo: '#000000', tamano: 82, color: '#ffffff', peso: '700' })],
  },
  {
    nombre: 'absolutecinema',
    plantilla: 'absolutecinema',
    descripcion: 'Meme "Absolute Cinema" con tu frase.',
    params: [P('text', 'ABSULUTE CINEMA', 'Frase en grande')],
    zonas: [z(0.03, 0.60, 0.94, 0.37, 'text', { fondo: '#0d0d0d', tamano: 50, color: '#ffffff', peso: '700' })],
  },
  {
    nombre: 'bratanime',
    plantilla: 'bratanime',
    descripcion: 'Personaje anime sosteniendo un cartel con tu texto.',
    params: [P('text', 'Welcome to Velirius', 'Texto del cartel')],
    zonas: [z(0.20, 0.46, 0.60, 0.35, 'text', { fondo: '#ffffff', tamano: 34, color: '#111111', peso: '700' })],
  },
  {
    nombre: 'bratcoyote',
    plantilla: 'bratcoyote',
    descripcion: 'Coyote con cartel de bienvenida personalizado.',
    params: [P('text', 'WELCOME TO VELIRIUS', 'Texto del cartel')],
    zonas: [z(0.27, 0.17, 0.42, 0.31, 'text', { fondo: '#f4ead2', tamano: 26, color: '#1b1b1b', peso: '700' })],
  },
  {
    nombre: 'bratpinguino',
    plantilla: 'bratpinguino',
    descripcion: 'Pingüino sujetando una pancarta con tu mensaje.',
    params: [P('text', 'hola :3', 'Texto de la pancarta')],
    zonas: [z(0.23, 0.43, 0.54, 0.25, 'text', { fondo: '#e8ebd0', tamano: 34, color: '#111111', peso: '700' })],
  },
  {
    nombre: 'sebusca',
    plantilla: 'sebusca',
    descripcion: 'Póster de "Se busca" con foto y recompensa.',
    params: [IMAGEN, P('texto2', '$5.000.000', 'Recompensa')],
    zonas: [
      zi(0.25, 0.27, 0.50, 0.38, 'image', { forma: 'rect', fondo: '#ffffff' }),
      z(0.06, 0.665, 0.88, 0.20, 'texto2', { fondo: '#f0e4c3', tamano: 40, color: '#2a1c0c', peso: '700' }),
    ],
  },
  {
    nombre: 'pokemoncard',
    plantilla: 'pokemoncard',
    descripcion: 'Carta coleccionable con imagen y descripción.',
    params: [IMAGEN, P('text', 'Velirius · API', 'Descripción de la carta')],
    zonas: [
      zi(0.14, 0.07, 0.72, 0.44, 'image', { forma: 'rect', fondo: '#ffffff' }),
      z(0.13, 0.60, 0.74, 0.22, 'text', { fondo: '#ffffff', tamano: 28, color: '#222222' }),
    ],
  },
  {
    nombre: 'storyreply',
    plantilla: 'storyreply',
    descripcion: 'Respuesta a una historia de Instagram con avatar y texto.',
    params: [P('text', 'jajaja xd', 'Texto de la respuesta'), IMAGEN],
    zonas: [
      zi(0.07, 0.12, 0.29, 0.58, 'image', { forma: 'rect', fondo: '#1a1a1a' }),
      z(0.05, 0.71, 0.88, 0.17, 'text', { fondo: '#2b2b2b', tamano: 30, color: '#e8e8e8', alineacion: 'izquierda' }),
    ],
  },
  {
    nombre: 'cuentatiktok',
    plantilla: 'cuentatiktok',
    descripcion: 'Tarjeta de cuenta de TikTok con usuario y biografía.',
    params: [USUARIO, P('text', 'api publica y gratis', 'Biografía')],
    zonas: [
      z(0.04, 0.05, 0.92, 0.12, 'username', { fondo: '#1a1a18', tamano: 24, color: '#ffffff', peso: '700', alineacion: 'izquierda' }),
      z(0.04, 0.20, 0.92, 0.28, 'text', { fondo: '#1a1a18', tamano: 22, color: '#d9d9d9', alineacion: 'izquierda' }),
    ],
  },
  {
    nombre: 'iqc',
    plantilla: 'iqc',
    efecto: 'barras',
    descripcion: 'Encuesta de historia con 5 barras de corazones calculadas a partir del texto.',
    params: [P('text', 'Velirius', 'Semilla para calcular los porcentajes')],
    zonas: [],
  },
  {
    nombre: 'gaycard',
    plantilla: 'gaycard',
    efecto: 'porcentaje',
    descripcion: 'Tarjeta de porcentaje gay/ship a partir de un nombre.',
    params: [P('text', 'Velirius', 'Nombre a medir')],
    zonas: [],
  },
  {
    nombre: 'gay',
    plantilla: 'gay',
    descripcion: 'Foto con efecto arcoíris y tu texto.',
    params: [P('text', 'orgullo', 'Texto inferior')],
    zonas: [z(0.05, 0.74, 0.90, 0.20, 'text', { fondo: 'rgba(0,0,0,0.62)', tamano: 30, color: '#ffffff', peso: '700' })],
  },
  {
    nombre: 'ship',
    plantilla: 'ship',
    efecto: 'ship',
    descripcion: 'Calcula la compatibilidad entre dos personas con sus avatares.',
    params: [P('username', 'Velirius', 'Primer nombre'), P('username2', 'Delirius', 'Segundo nombre'), IMAGEN, P('image2', '', 'URL del segundo avatar')],
    zonas: [],
  },
  {
    nombre: 'friendship',
    plantilla: 'friendship',
    efecto: 'ship',
    descripcion: 'Tarjeta "Best Friends" con dos avatares y porcentaje.',
    params: [P('username', 'Ana', 'Primer nombre'), P('username2', 'Luis', 'Segundo nombre'), IMAGEN, P('image2', '', 'URL del segundo avatar')],
    zonas: [],
  },
  {
    nombre: 'invert',
    plantilla: 'invert',
    efecto: 'girar',
    descripcion: 'Gira la imagen 180° y añade tu texto.',
    params: [P('text', 'al revés', 'Texto superior')],
    zonas: [z(0.04, 0.04, 0.92, 0.16, 'text', { fondo: 'rgba(0,0,0,0.62)', tamano: 32, color: '#ffffff', peso: '700' })],
  },
  {
    nombre: 'fotopredeterminada',
    plantilla: 'fotopredeterminada',
    descripcion: 'Foto de perfil por defecto con una frase.',
    params: [P('text', 'tus recuerdos', 'Frase inferior')],
    zonas: [z(0.06, 0.72, 0.88, 0.22, 'text', { fondo: 'rgba(0,0,0,0.55)', tamano: 34, color: '#ffffff' })],
  },
  {
    nombre: 'fotoshipgirlpred',
    plantilla: 'fotoshipgirlpred',
    descripcion: 'Foto para ship con una frase personalizada.',
    params: [P('text', 'juntos para siempre', 'Frase inferior')],
    zonas: [z(0.06, 0.72, 0.88, 0.22, 'text', { fondo: 'rgba(0,0,0,0.55)', tamano: 34, color: '#ffffff' })],
  },
  {
    nombre: 'fotopc',
    plantilla: 'fotopc',
    descripcion: 'Personaje mirando un portátil con tu imagen o texto en la pantalla.',
    params: [IMAGEN, P('text', 'hola', 'Texto alternativo si no hay imagen')],
    zonas: [{ ...zi(0.52, 0.29, 0.48, 0.37, 'image', { forma: 'rect', fondo: '#101820' }), texto: 'text', color: '#ffffff' }],
  },
  {
    nombre: 'canvaimagen',
    plantilla: 'canvaimagen',
    descripcion: 'Plantilla verde con caras y tu texto en el centro.',
    params: [P('text', 'QUE OPINAS?', 'Texto central')],
    zonas: [z(0.28, 0.36, 0.44, 0.28, 'text', { fondo: '#00ff00', tamano: 38, color: '#000000', peso: '700' })],
  },
  {
    nombre: 'canvatextoxd',
    plantilla: 'canvatextoxd',
    descripcion: 'Muñeco sujetando un papel con tu texto.',
    params: [P('text', 'Hola mundo', 'Texto del papel')],
    zonas: [z(0.40, 0.42, 0.50, 0.25, 'text', { fondo: '#ffffff', tamano: 24, color: '#222222' })],
  },
  {
    nombre: 'imagencanba',
    plantilla: 'imagencanba',
    descripcion: 'Lienzo de Paint con tu texto.',
    params: [P('text', 'dibuja algo', 'Texto del lienzo')],
    zonas: [z(0.27, 0.17, 0.66, 0.66, 'text', { fondo: '#ffffff', tamano: 32, color: '#111111' })],
  },
  {
    nombre: 'bobesponja',
    plantilla: 'bobesponja',
    lienzo: { ancho: 640, alto: 754 },
    descripcion: 'Bob Esponja señalando una tarjeta con tu imagen o texto.',
    params: [IMAGEN, P('text', 'atento', 'Texto de la tarjeta')],
    zonas: [{ ...zi(0.45, 0.20, 0.48, 0.31, 'image', { forma: 'rect', fondo: '#ffffff' }), texto: 'text' }],
  },
  {
    nombre: 'bobesponja2',
    plantilla: 'bobesponja2',
    lienzo: { ancho: 640, alto: 750 },
    descripcion: 'Cómic de 4 viñetas de Bob Esponja con tu imagen o texto.',
    params: [IMAGEN, P('text', 'hola', 'Texto de la viñeta')],
    zonas: [{ ...zi(0.06, 0.18, 0.38, 0.25, 'image', { forma: 'rect', fondo: '#ffffff' }), texto: 'text' }],
  },
  {
    nombre: 'bobesponja3',
    plantilla: 'bobesponja3',
    descripcion: 'Bob Esponja mostrando una tarjeta con tu imagen o texto.',
    params: [IMAGEN, P('text', 'mira esto', 'Texto de la tarjeta')],
    zonas: [{ ...zi(0.39, 0.09, 0.46, 0.33, 'image', { forma: 'rect', fondo: '#ffffff' }), texto: 'text' }],
  },
  {
    nombre: 'minions',
    plantilla: 'minions',
    descripcion: 'Dos minions con sus caras personalizables y un texto.',
    params: [IMAGEN, P('image2', '', 'URL de la segunda cara'), P('text', 'banana!', 'Texto inferior')],
    zonas: [
      zi(0.18, 0.34, 0.26, 0.20, 'image', { forma: 'elipse' }),
      zi(0.56, 0.34, 0.26, 0.20, 'image2', { forma: 'elipse' }),
      z(0.05, 0.82, 0.90, 0.14, 'text', { fondo: 'rgba(0,0,0,0.62)', tamano: 30, color: '#ffffff', peso: '700' }),
    ],
  },
  {
    nombre: 'rata',
    plantilla: 'rata',
    lienzo: { ancho: 600, alto: 536 },
    descripcion: 'Rata con la barriga verde: pon tu imagen o texto.',
    params: [IMAGEN, P('text', 'rata', 'Texto alternativo')],
    zonas: [{ ...zi(0.35, 0.32, 0.33, 0.42, 'image', { forma: 'elipse' }), texto: 'text' }],
  },
  {
    nombre: 'galletita',
    plantilla: 'galletita',
    descripcion: 'Galleta con un hueco para tu imagen o texto.',
    params: [IMAGEN, P('text', 'cookie', 'Texto alternativo')],
    zonas: [{ ...zi(0.35, 0.33, 0.33, 0.34, 'image', { forma: 'elipse' }), texto: 'text' }],
  },
  {
    nombre: 'pan',
    plantilla: 'pan',
    descripcion: 'Tostada con un hueco para tu imagen o texto.',
    params: [IMAGEN, P('text', 'toast', 'Texto alternativo')],
    zonas: [{ ...zi(0.35, 0.30, 0.33, 0.34, 'image', { forma: 'elipse' }), texto: 'text' }],
  },
  {
    nombre: 'banana',
    plantilla: 'banana',
    descripcion: 'Banana con un hueco para tu imagen o texto.',
    params: [IMAGEN, P('text', 'banana', 'Texto alternativo')],
    zonas: [{ ...zi(0.38, 0.24, 0.27, 0.38, 'image', { forma: 'elipse' }), texto: 'text' }],
  },
  {
    nombre: 'arandano',
    plantilla: 'arandano',
    descripcion: 'Arándano con un hueco para tu imagen o texto.',
    params: [IMAGEN, P('text', 'berry', 'Texto alternativo')],
    zonas: [{ ...zi(0.36, 0.22, 0.31, 0.44, 'image', { forma: 'elipse' }), texto: 'text' }],
  },
];

export const CANVAS_POR_NOMBRE = Object.fromEntries(CANVAS.map((c) => [c.nombre, c]));

/** Alias de query string → nombre lógico del parámetro. */
export const ALIASES = {
  text: ['text', 'texto', 'q', 'mensaje', 'message', 'consulta'],
  texto2: ['texto2', 'text2', 'subtexto', 'recompensa', 'subtitle'],
  image: ['image', 'imagen', 'url', 'avatar', 'foto', 'img'],
  image2: ['image2', 'imagen2', 'url2', 'avatar2', 'img2'],
  username: ['username', 'usuario', 'nombre', 'name', 'user'],
  username2: ['username2', 'usuario2', 'nombre2', 'name2', 'user2'],
  porcentaje: ['porcentaje', 'percent', 'p', 'valor'],
};
