/**
 * Documentación viva del API: lee los endpoints reales del despliegue
 * y muestra ejemplos con los datos de verdad (nombres de álbum, etiquetas, URLs).
 */

const $ = (selector) => document.querySelector(selector);
const base = location.origin;

/* ------------------------------------------------------------------ */
/* Tema                                                               */
/* ------------------------------------------------------------------ */
function conectarTema() {
  const boton = $('#boton-tema');
  const aplicar = (tema) => {
    document.documentElement.dataset.tema = tema;
    boton.setAttribute('aria-label', tema === 'oscuro' ? 'Activar tema claro' : 'Activar tema oscuro');
  };
  aplicar(document.documentElement.dataset.tema || 'claro');
  boton.addEventListener('click', () => {
    const nuevo = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
    aplicar(nuevo);
    try {
      localStorage.setItem('tema', nuevo);
    } catch {
      /* modo privado */
    }
  });
}

/* ------------------------------------------------------------------ */
/* Copiar                                                             */
/* ------------------------------------------------------------------ */
async function copiar(texto, boton, etiquetaOriginal) {
  try {
    await navigator.clipboard.writeText(texto);
    boton.textContent = '¡Copiado!';
  } catch {
    boton.textContent = 'No se pudo copiar';
  }
  setTimeout(() => (boton.textContent = etiquetaOriginal), 2000);
}

/* ------------------------------------------------------------------ */
/* Fragmentos de código, con los datos reales del sitio                */
/* ------------------------------------------------------------------ */
function plantillas({ album, etiqueta, imagen }) {
  return {
    js: `const base = '${base}';

const { fotos } = await fetch(base + '/datos/fotos.json')
  .then((r) => r.json());

// fotos[0] => { id, titulo, album, imagen, etiquetas, ancho, alto, … }
<img src={base + fotos[0].imagen} alt={fotos[0].titulo} />`,

    curl: `curl ${base}/datos/fotos.json
curl ${base}/datos/albumes.json
curl ${base}/datos/albumes/${album.slug}.json`,

    filtros: `const { fotos } = await fetch('${base}/datos/fotos.json')
  .then((r) => r.json());

const porAlbum   = fotos.filter((f) => f.album === '${album.nombre}');
const porEtiqueta = fotos.filter((f) => f.etiquetas.includes('${etiqueta}'));
const destacadas  = fotos.filter((f) => f.destacada);
const conFecha    = fotos
  .filter((f) => f.fecha)
  .sort((a, b) => b.fecha.localeCompare(a.fecha));`,

    og: `<meta property="og:image"
      content="${base}${imagen}" />
<meta property="og:image:width" content="1600" />`,
  };
}

function pintarSnippets(datos) {
  const textos = plantillas(datos);

  // Sustituye el contenido de cada bloque de código que tenga botón "Copiar"
  document.querySelectorAll('.doc-copiar').forEach((boton) => {
    const clave = boton.dataset.copiar;
    const bloque = boton.parentElement.querySelector('code');
    if (!textos[clave] || !bloque) return;
    bloque.textContent = textos[clave];

    boton.onclick = () => copiar(bloque.textContent, boton, 'Copiar');
  });
}

/* ------------------------------------------------------------------ */
/* Resaltado mínimo de JSON                                           */
/* ------------------------------------------------------------------ */
function resaltar(json) {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"(\s*:)?/g, (coincidencia, texto, dosPuntos) =>
      dosPuntos
        ? `<span class="json-clave">"${texto}"</span>${dosPuntos}`
        : `<span class="json-texto">"${texto}"</span>`
    )
    .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="json-numero">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="json-bool">$1</span>');
}

/* ------------------------------------------------------------------ */
/* Carga                                                              */
/* ------------------------------------------------------------------ */
async function cargar() {
  $('#url-base').textContent = base;
  $('#copiar-base').addEventListener('click', (evento) =>
    copiar(base, evento.currentTarget, 'Copiar')
  );

  const porDefecto = {
    album: { nombre: 'Viajes', slug: 'viajes' },
    etiqueta: 'mar',
    imagen: '/fotos/01-dunas-al-amanecer.jpg',
    foto: null,
    albumes: [],
    total: 0,
  };

  let datos = { ...porDefecto };
  let indice = null;

  try {
    [indice, datos.fotosJson] = await Promise.all([
      fetch('datos/albumes.json', { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch('datos/fotos.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
  } catch (error) {
    $('#resumen-api').textContent = 'API no disponible todavía';
    console.error('No se pudo leer /datos/albumes.json', error);
    pintarSnippets(datos);
    return;
  }

  const albumes = Array.isArray(indice.albumes) ? indice.albumes : [];
  const fotos = Array.isArray(datos.fotosJson?.fotos) ? datos.fotosJson.fotos : [];

  $('#marca-texto').textContent = indice.sitio?.titulo || 'Galería';
  document.title = `API · ${indice.sitio?.titulo || 'Galería'}`;
  $('#resumen-api').textContent = `${indice.total} fotos · ${albumes.length} álbumes`;

  // Enlaces a cada endpoint de álbum
  const contenedor = $('#doc-albumes');
  contenedor.replaceChildren();
  for (const album of albumes) {
    const enlace = document.createElement('a');
    enlace.className = 'chip-api';
    enlace.href = `datos/albumes/${album.slug}.json`;
    enlace.target = '_blank';
    enlace.rel = 'noopener';
    const ruta = document.createElement('code');
    ruta.textContent = `/datos/albumes/${album.slug}.json`;
    const detalle = document.createElement('span');
    detalle.textContent = `${album.nombre} · ${album.total}`;
    enlace.append(ruta, detalle);
    contenedor.append(enlace);
  }

  // Ejemplo con la primera foto real
  const ejemplo = fotos[0] || null;
  $('#ejemplo-json').innerHTML = `<code>${resaltar(
    JSON.stringify(ejemplo || porDefecto.foto || { id: 'viajes/lisboa.jpg', album: 'Viajes', imagen: '/fotos/viajes/lisboa.jpg' }, null, 2)
  )}</code>`;

  const album = albumes.find((a) => a.total > 0) || albumes[0] || porDefecto.album;
  const conEtiquetas = fotos.find((f) => f.etiquetas?.length);
  pintarSnippets({
    album,
    etiqueta: conEtiquetas?.etiquetas[0] || porDefecto.etiqueta,
    imagen: ejemplo?.imagen || porDefecto.imagen,
  });
}

conectarTema();
cargar();
