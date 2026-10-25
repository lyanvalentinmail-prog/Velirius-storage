/**
 * Velirius · galería
 * Lee el manifiesto generado en `galeria.json` y pinta la galería y el visor.
 * Sin dependencias.
 */

const $ = (selector, raiz = document) => raiz.querySelector(selector);
const TODOS = '__todos__';

const estado = {
  config: {},
  fotos: [],
  visibles: [],
  album: TODOS,
  consulta: '',
  indice: -1,
};

const el = {
  marca: $('#marca-texto'),
  titulo: $('#titulo-sitio'),
  etiqueta: $('#portada-etiqueta'),
  subtitulo: $('#subtitulo-sitio'),
  contador: $('#contador'),
  filtros: $('#filtros'),
  galeria: $('#galeria'),
  cargando: $('#cargando'),
  vacio: $('#vacio'),
  vacioTitulo: $('#vacio-titulo'),
  vacioTexto: $('#vacio-texto'),
  buscador: $('#buscador'),
  botonTema: $('#boton-tema'),
  visor: $('#visor'),
  visorImagen: $('#visor-imagen'),
  visorTitulo: $('#visor-titulo'),
  visorDescripcion: $('#visor-descripcion'),
  visorAlbum: $('#visor-album'),
  visorContador: $('#visor-contador'),
  visorDescargar: $('#visor-descargar'),
  visorCerrar: $('#visor-cerrar'),
  visorAnterior: $('#visor-anterior'),
  visorSiguiente: $('#visor-siguiente'),
  ayuda: $('#ayuda'),
  ayudaCerrar: $('#ayuda-cerrar'),
  ayudaRuta: $('#ayuda-ruta'),
  ayudaSubir: $('#ayuda-subir'),
  ayudaCopiar: $('#ayuda-copiar'),
  pieAutor: $('#pie-autor'),
  pieRepo: $('#pie-repo'),
  pieEnlace: $('#pie-enlace'),
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const normalizar = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const plural = (numero, singular, pluralTexto) => `${numero} ${numero === 1 ? singular : pluralTexto}`;

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */
async function iniciar() {
  conectarTema();
  conectarAyuda();
  conectarVisor();

  try {
    const respuesta = await fetch('galeria.json', { cache: 'no-cache' });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const datos = await respuesta.json();
    estado.config = datos.config || {};
    estado.fotos = Array.isArray(datos.fotos) ? datos.fotos : [];
    aplicarConfig(datos);
  } catch (error) {
    console.error('No se pudo cargar galeria.json', error);
    estado.fotos = [];
    el.cargando.hidden = true;
    el.vacio.hidden = false;
    el.vacioTitulo.textContent = 'No se pudo cargar la galería';
    el.vacioTexto.innerHTML =
      'Falta el archivo <code>galeria.json</code>. Ejecuta <code>npm run dev</code> en local o despliega en Vercel: el manifiesto se genera automáticamente al construir.';
    el.contador.textContent = 'Sin datos';
    return;
  }

  construirFiltros();
  renderizar();
}

function aplicarConfig(datos) {
  const { config } = estado;
  const titulo = config.titulo || 'Galería';
  const subtitulo = config.subtitulo || '';

  document.title = titulo;
  el.marca.textContent = titulo;
  el.titulo.textContent = titulo;
  el.subtitulo.textContent = subtitulo;
  el.subtitulo.hidden = !subtitulo;
  el.etiqueta.textContent = config.repositorio ? 'Archivo fotográfico' : 'Galería';

  const descripcion = config.descripcion || subtitulo;
  if (descripcion) {
    document.querySelector('meta[name="description"]')?.setAttribute('content', descripcion);
    document.querySelector('#og-descripcion')?.setAttribute('content', descripcion);
  }
  document.querySelector('#og-titulo')?.setAttribute('content', titulo);

  // Vista previa al compartir: la primera foto disponible
  const primera = estado.fotos[0];
  if (primera) {
    const ogImagen = document.createElement('meta');
    ogImagen.setAttribute('property', 'og:image');
    ogImagen.setAttribute('content', new URL(primera.ruta, location.href).href);
    document.head.append(ogImagen);
  }

  const total = estado.fotos.length;
  const albumes = (datos.albumes || []).length;
  el.contador.textContent =
    total === 0 ? 'Sin fotos todavía' : `${plural(total, 'foto', 'fotos')} · ${plural(albumes, 'álbum', 'álbumes')}`;

  // Pie
  el.pieAutor.textContent = config.autor || '';

  if (config.repositorio) {
    el.pieRepo.href = `https://github.com/${config.repositorio}`;
    el.pieRepo.hidden = false;
    el.ayudaSubir.href = `https://github.com/${config.repositorio}/upload/${config.rama || 'main'}/${config.carpetaFotos || 'fotos'}`;
    el.ayudaSubir.textContent = 'Subir fotos a GitHub';
  } else {
    el.pieRepo.hidden = true;
  }

  if (config.enlace) {
    el.pieEnlace.href = config.enlace;
    el.pieEnlace.textContent = config.textoEnlace || 'Enlace';
    el.pieEnlace.hidden = false;
  }

  el.ayudaRuta.textContent = `${config.carpetaFotos || 'fotos'}/`;
}

/* ------------------------------------------------------------------ */
/* Filtros y búsqueda                                                  */
/* ------------------------------------------------------------------ */
function construirFiltros() {
  const albumes = new Map();
  for (const foto of estado.fotos) {
    albumes.set(foto.album, (albumes.get(foto.album) || 0) + 1);
  }

  el.filtros.replaceChildren();

  if (albumes.size < 2) {
    el.filtros.hidden = true;
    return;
  }

  el.filtros.hidden = false;
  const opciones = [{ nombre: 'Todas', clave: TODOS, total: estado.fotos.length }];
  for (const [nombre, total] of [...albumes.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
    opciones.push({ nombre, clave: nombre, total });
  }

  for (const opcion of opciones) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'filtro';
    boton.dataset.album = opcion.clave;
    boton.setAttribute('aria-pressed', String(opcion.clave === estado.album));
    boton.innerHTML = `<span>${escapar(opcion.nombre)}</span><span class="filtro__total">${opcion.total}</span>`;
    boton.addEventListener('click', () => {
      estado.album = opcion.clave;
      for (const otro of el.filtros.querySelectorAll('.filtro')) {
        otro.setAttribute('aria-pressed', String(otro.dataset.album === estado.album));
      }
      renderizar();
    });
    el.filtros.append(boton);
  }
}

function filtrar() {
  const consulta = normalizar(estado.consulta);
  return estado.fotos.filter((foto) => {
    if (estado.album !== TODOS && foto.album !== estado.album) return false;
    if (!consulta) return true;
    return normalizar(foto.buscar || `${foto.titulo} ${foto.album} ${foto.archivo}`).includes(consulta);
  });
}

/* ------------------------------------------------------------------ */
/* Render de la galería                                               */
/* ------------------------------------------------------------------ */
let observador = null;

function renderizar() {
  el.cargando.hidden = true;
  estado.visibles = filtrar();
  el.galeria.replaceChildren();

  const hayFotos = estado.fotos.length > 0;
  const hayResultados = estado.visibles.length > 0;

  if (!hayFotos) {
    el.vacio.hidden = false;
    el.vacioTitulo.textContent = 'Todavía no hay fotos';
    el.vacioTexto.innerHTML =
      'Añade imágenes dentro de la carpeta <code>fotos/</code> de tu repositorio y haz <em>push</em>. Vercel reconstruye la galería automáticamente.';
    return;
  }

  el.vacio.hidden = hayResultados;
  if (!hayResultados) {
    el.vacioTitulo.textContent = 'Sin resultados';
    el.vacioTexto.textContent = 'Prueba con otra búsqueda o selecciona otro álbum.';
    return;
  }

  if (observador) observador.disconnect();
  observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('foto--visible');
          observador.unobserve(entrada.target);
        }
      }
    },
    { rootMargin: '120px 0px' }
  );

  const fragmento = document.createDocumentFragment();
  estado.visibles.forEach((foto, indice) => {
    fragmento.append(crearTarjeta(foto, indice));
  });
  el.galeria.append(fragmento);
}

function crearTarjeta(foto, indice) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'foto';
  boton.dataset.indice = String(indice);
  boton.setAttribute('aria-label', `Abrir ${foto.titulo}`);

  const img = document.createElement('img');
  img.src = foto.ruta;
  img.alt = foto.descripcion || foto.titulo || 'Foto';
  img.loading = indice < 6 ? 'eager' : 'lazy';
  img.decoding = 'async';
  if (indice < 6) img.fetchPriority = 'high';
  if (foto.ancho && foto.alto) {
    img.width = foto.ancho;
    img.height = foto.alto;
    boton.style.setProperty('--ratio', `${foto.ancho} / ${foto.alto}`);
  }
  img.addEventListener('error', () => boton.remove());

  const velo = document.createElement('span');
  velo.className = 'foto__velo';
  const titulo = document.createElement('span');
  titulo.className = 'foto__titulo';
  titulo.textContent = foto.titulo;
  const album = document.createElement('span');
  album.className = 'foto__album';
  album.textContent = foto.album;
  velo.append(titulo, album);

  boton.append(img, velo);

  if (foto.album) {
    const insignia = document.createElement('span');
    insignia.className = 'foto__insignia';
    insignia.textContent = foto.album;
    boton.append(insignia);
  }

  boton.addEventListener('click', () => abrirVisor(indice));
  observador.observe(boton);
  return boton;
}

/* ------------------------------------------------------------------ */
/* Visor                                                              */
/* ------------------------------------------------------------------ */
function conectarVisor() {
  el.visorCerrar.addEventListener('click', cerrarVisor);
  el.visorAnterior.addEventListener('click', () => navegar(-1));
  el.visorSiguiente.addEventListener('click', () => navegar(1));

  el.visor.addEventListener('click', (evento) => {
    if (evento.target === el.visor) cerrarVisor();
  });

  el.visor.addEventListener('close', () => {
    estado.indice = -1;
    if (location.hash.startsWith('#foto=')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  });

  el.visor.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      navegar(-1);
    } else if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      navegar(1);
    }
  });

  // Deslizar con el dedo
  let inicioX = null;
  let inicioY = null;
  el.visor.addEventListener(
    'touchstart',
    (evento) => {
      if (evento.touches.length !== 1) return;
      inicioX = evento.touches[0].clientX;
      inicioY = evento.touches[0].clientY;
    },
    { passive: true }
  );
  el.visor.addEventListener(
    'touchend',
    (evento) => {
      if (inicioX === null) return;
      const toque = evento.changedTouches[0];
      const dx = toque.clientX - inicioX;
      const dy = toque.clientY - inicioY;
      inicioX = null;
      inicioY = null;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      navegar(dx < 0 ? 1 : -1);
    },
    { passive: true }
  );

  const abrirPorHash = () => {
    const coincidencia = location.hash.match(/^#foto=(.+)$/);
    if (!coincidencia) return;
    let ruta;
    try {
      ruta = decodeURIComponent(coincidencia[1]);
    } catch {
      return;
    }
    const indice = estado.visibles.findIndex((foto) => foto.id === ruta);
    if (indice >= 0) abrirVisor(indice, { actualizarHash: false });
  };

  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#foto=')) abrirPorHash();
    else if (el.visor.open) cerrarVisor();
  });

  el.visor._abrirPorHash = abrirPorHash;
}

function abrirVisor(indice, { actualizarHash = true } = {}) {
  const foto = estado.visibles[indice];
  if (!foto) return;

  estado.indice = indice;
  pintarVisor(foto);

  if (!el.visor.open) el.visor.showModal();
  el.visorCerrar.focus({ preventScroll: true });

  if (actualizarHash) {
    const hash = `#foto=${encodeURIComponent(foto.id)}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  precargar(indice + 1);
  precargar(indice - 1);
}

function pintarVisor(foto) {
  el.visorImagen.classList.remove('visor__imagen--lista');
  el.visorImagen.alt = foto.descripcion || foto.titulo || 'Foto';
  el.visorImagen.src = foto.ruta;
  if (foto.ancho && foto.alto) {
    el.visorImagen.width = foto.ancho;
    el.visorImagen.height = foto.alto;
  }
  const revelar = () => el.visorImagen.classList.add('visor__imagen--lista');
  if (el.visorImagen.complete && el.visorImagen.naturalWidth > 0) revelar();
  else el.visorImagen.addEventListener('load', revelar, { once: true });

  el.visorTitulo.textContent = foto.titulo;
  el.visorDescripcion.textContent = foto.descripcion || '';
  el.visorAlbum.textContent = foto.album || '';
  el.visorContador.textContent = `${estado.indice + 1} / ${estado.visibles.length}`;

  el.visorDescargar.href = foto.ruta;
  el.visorDescargar.setAttribute('download', foto.archivo || '');

  el.visorAnterior.disabled = estado.indice === 0;
  el.visorSiguiente.disabled = estado.indice === estado.visibles.length - 1;
}

function navegar(delta) {
  if (!el.visor.open) return;
  const siguiente = estado.indice + delta;
  if (siguiente < 0 || siguiente >= estado.visibles.length) return;
  const foto = estado.visibles[siguiente];
  estado.indice = siguiente;
  pintarVisor(foto);
  history.replaceState(null, '', `#foto=${encodeURIComponent(foto.id)}`);
  precargar(siguiente + delta);
}

function cerrarVisor() {
  el.visor.close();
}

function precargar(indice) {
  const foto = estado.visibles[indice];
  if (!foto) return;
  const imagen = new Image();
  imagen.decoding = 'async';
  imagen.src = foto.ruta;
}

/* ------------------------------------------------------------------ */
/* Ayuda                                                              */
/* ------------------------------------------------------------------ */
function conectarAyuda() {
  const abrir = () => el.ayuda.showModal();
  $('#boton-ayuda').addEventListener('click', abrir);
  $('#abrir-ayuda').addEventListener('click', abrir);
  $('#vacio-ayuda').addEventListener('click', abrir);
  el.ayudaCerrar.addEventListener('click', () => el.ayuda.close());

  el.ayuda.addEventListener('click', (evento) => {
    if (evento.target === el.ayuda) el.ayuda.close();
  });

  el.ayudaCopiar.addEventListener('click', async () => {
    const carpeta = estado.config.carpetaFotos || 'fotos';
    const texto = [
      'Añadir fotos a la galería:',
      `1. Sube las imágenes a la carpeta ${carpeta}/ del repositorio (puedes crear subcarpetas para álbumes).`,
      '2. En GitHub: Add file → Upload files → suelta las fotos → Commit changes.',
      '3. Vercel reconstruye la web automáticamente en unos segundos.',
      `Opcional: títulos y descripciones en ${carpeta}/info.json.`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      el.ayudaCopiar.textContent = '¡Copiado!';
    } catch {
      el.ayudaCopiar.textContent = 'No se pudo copiar';
    }
    setTimeout(() => (el.ayudaCopiar.textContent = 'Copiar instrucciones'), 2200);
  });
}

/* ------------------------------------------------------------------ */
/* Tema                                                               */
/* ------------------------------------------------------------------ */
function conectarTema() {
  const aplicar = (tema) => {
    document.documentElement.dataset.tema = tema;
    el.botonTema.setAttribute('aria-label', tema === 'oscuro' ? 'Activar tema claro' : 'Activar tema oscuro');
  };

  aplicar(document.documentElement.dataset.tema || 'claro');

  el.botonTema.addEventListener('click', () => {
    const nuevo = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
    aplicar(nuevo);
    try {
      localStorage.setItem('tema', nuevo);
    } catch {
      /* modo privado: seguimos sin persistir */
    }
  });

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener?.('change', (evento) => {
      try {
        if (localStorage.getItem('tema')) return;
      } catch {
        /* ignorado */
      }
      aplicar(evento.matches ? 'oscuro' : 'claro');
    });
}

/* ------------------------------------------------------------------ */
/* Buscador                                                           */
/* ------------------------------------------------------------------ */
let temporizadorBusqueda;
el.buscador.addEventListener('input', (evento) => {
  clearTimeout(temporizadorBusqueda);
  const valor = evento.target.value;
  temporizadorBusqueda = setTimeout(() => {
    estado.consulta = valor;
    renderizar();
  }, 120);
});

document.addEventListener('keydown', (evento) => {
  const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (evento.key === '/' && !enCampo && !el.visor.open && !el.ayuda.open) {
    evento.preventDefault();
    el.buscador.focus();
    el.buscador.select();
  }
  if (evento.key === 'Escape' && document.activeElement === el.buscador) {
    el.buscador.blur();
  }
});

/* ------------------------------------------------------------------ */
function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (caracter) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[caracter];
  });
}

iniciar().then(() => {
  if (typeof el.visor._abrirPorHash === 'function') el.visor._abrirPorHash();
});
