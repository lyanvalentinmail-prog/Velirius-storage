/**
 * UI de documentación de Velirius API.
 *
 * Lee el catálogo REAL desde /api/endpoints y /api/categories: lo que ves es
 * exactamente lo que el servidor ejecuta. Cada fila tiene un botón RUN que
 * abre un playground con los parámetros del endpoint y muestra la respuesta.
 */
const $ = (s) => document.querySelector(s);
const contenido = $('#contenido');

const REPO = 'https://github.com/lyanvalentinmail-prog/Velirius-storage';
const RUTAS = ['home', 'docs', 'sistema', 'anime', 'canvas', 'download', 'ia', 'reactions', 'search', 'tools', 'galeria'];

const estado = {
  categorias: [],
  endpoints: [],
  salud: null,
  ruta: 'home',
  filtro: '',
  buscador: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                         */
/* ------------------------------------------------------------------ */
const esc = (v = '') =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const svg = {
  carpeta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5h6l2 2H21v11H3z" stroke-linejoin="round"/></svg>',
  casa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9H4z" stroke-linejoin="round"/><path d="M10 20v-6h4v6"/></svg>',
  externo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v6M19 5l-9 9" stroke-linecap="round"/><path d="M18 14v5H5V6h5" stroke-linejoin="round"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none"><path d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0012 2z"/></svg>',
  rayo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L5 13h6l-1 9 8-11h-6z" stroke-linejoin="round"/></svg>',
  corazon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.5-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.5-7 9-7 9z" stroke-linejoin="round"/></svg>',
};

function rutaActual() {
  const hash = location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase();
  if (RUTAS.includes(hash)) return hash;
  const path = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (RUTAS.includes(path)) return path;
  return 'home';
}

function ir(ruta) {
  if (location.pathname !== '/' && location.pathname !== '/index.html') {
    history.replaceState(null, '', '/');
  }
  location.hash = `#/${ruta}`;
  estado.ruta = ruta;
  estado.filtro = '';
  estado.buscador = false;
  renderizar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function copiar(texto, boton) {
  const original = boton?.textContent;
  try {
    await navigator.clipboard.writeText(texto);
    if (boton) boton.textContent = '¡Copiado!';
  } catch {
    if (boton) boton.textContent = 'Error al copiar';
  }
  if (boton) setTimeout(() => (boton.textContent = original), 1600);
}

/* ------------------------------------------------------------------ */
/* Carga del catálogo                                                 */
/* ------------------------------------------------------------------ */
async function cargar() {
  renderizar();
  try {
    const [salud, categorias, endpoints] = await Promise.all([
      fetch('/api/health').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/endpoints').then((r) => r.json()),
    ]);
    estado.salud = salud;
    estado.categorias = categorias.categorias || [];
    estado.endpoints = endpoints.endpoints || [];
  } catch (error) {
    estado.error = error.message;
  }
  renderizar();
}

/* ------------------------------------------------------------------ */
/* Vistas                                                             */
/* ------------------------------------------------------------------ */
function barra(izquierda, grupos) {
  const online = estado.salud?.estado === 'online';
  return `<div class="barra-estado">
    <span><span class="punto-online" style="background:${online ? '#7dff8a' : '#ff7676'}"></span>${esc(izquierda)}: ${online ? 'ONLINE' : 'OFFLINE'}</span>
    <span class="barra-estado__grupo">${grupos
      .map((g) => `<span><b>${esc(String(g.valor))}</b> ${esc(g.etiqueta)}</span>`)
      .join('')}</span>
  </div>`;
}

function buscador() {
  if (!estado.buscador) return '';
  return `<label class="buscador-caja">
    <span>⌕</span>
    <input id="input-buscar" type="search" placeholder="Buscar endpoints…" value="${esc(estado.filtro)}" autocomplete="off" spellcheck="false" />
    <kbd>ESC</kbd>
  </label>`;
}

function vistaHome() {
  const filtro = estado.filtro.toLowerCase();
  const categorias = estado.categorias.filter((c) =>
    !filtro || `${c.id} ${c.nombre} ${c.descripcion}`.toLowerCase().includes(filtro)
  );
  const coincidencias = filtro
    ? estado.endpoints.filter((e) => `${e.ruta} ${e.descripcion}`.toLowerCase().includes(filtro)).slice(0, 12)
    : [];

  const filas = categorias
    .map(
      (c) => `<div class="fila">
      <span class="fila__icono">${svg.carpeta}</span>
      <div class="fila__texto">
        <div class="fila__titulo">${esc(c.nombre)}</div>
        <div class="fila__detalle">${esc(c.total)} endpoints</div>
      </div>
      <button class="boton boton--negro" data-categoria="${esc(c.id)}">VIEW</button>
    </div>`
    )
    .join('');

  const globales = coincidencias.length
    ? `<div class="fila__detalle" style="margin:14px 0 6px;letter-spacing:.12em">RESULTADOS DIRECTOS</div>` +
      coincidencias.map(filaEndpoint).join('')
    : '';

  return `<section class="portada">
      <h1>VELIRIUS API</h1>
      <p class="portada__sub">SYNC COMPLETE</p>
      <p class="portada__texto">Here are the folders with all the <b>APIS</b> available on this website.<br />
        (Not Required Token) &nbsp;·&nbsp; <a href="${REPO}" target="_blank" rel="noopener">Follow my github account</a></p>
      <div class="iconos-enlace">
        <a href="#/docs" title="Documentación">${svg.rayo}</a>
        <a href="${REPO}" target="_blank" rel="noopener" title="GitHub">${svg.github}</a>
        <a href="#/galeria" title="Galería">${svg.corazon}</a>
        <a href="/api/openapi.json" target="_blank" rel="noopener" title="OpenAPI">${svg.externo}</a>
        <a href="#/docs" title="Despliegue">${svg.casa}</a>
      </div>
    </section>
    ${barra('STATUS', [
      { valor: estado.categorias.length || 8, etiqueta: 'ROUTERS' },
      { valor: estado.endpoints.length || '—', etiqueta: 'ENDPOINTS' },
    ])}
    ${buscador()}
    <div class="lista">${filas || '<p class="vacio">No hay routers que coincidan con la búsqueda.</p>'}${globales}</div>`;
}

function filaEndpoint(e) {
  const params = e.params?.length ? e.params.map((p) => p.nombre).join(', ') : 'sin parámetros';
  return `<div class="fila">
    <span class="fila__icono" style="font-size:9px">■</span>
    <div class="fila__texto">
      <div class="fila__titulo">${esc(e.ruta.split('/').pop().toUpperCase())}</div>
      <div class="fila__detalle fila__detalle--params">${esc(e.metodo)} - ${esc(params)}</div>
    </div>
    <button class="boton boton--negro" data-run="${esc(e.ruta)}">RUN</button>
  </div>`;
}

function vistaCategoria(id) {
  const categoria = estado.categorias.find((c) => c.id === id);
  if (!categoria) return vistaHome();
  const filtro = estado.filtro.toLowerCase();
  const endpoints = estado.endpoints.filter(
    (e) => e.categoria === id && (!filtro || `${e.ruta} ${e.descripcion}`.toLowerCase().includes(filtro))
  );

  return `<section class="categoria-cabecera">
      <div class="nav-iconos">
        <button class="icono" data-ir="home" title="Inicio">${svg.casa}</button>
        <a class="icono" href="/api/openapi.json" target="_blank" rel="noopener" title="OpenAPI">${svg.externo}</a>
        <span class="icono relleno" title="${esc(categoria.icono)}">${esc(categoria.icono)}</span>
        <span class="nav-iconos__espacio"></span>
        <button class="icono" id="boton-buscar-cat" title="Buscar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.6 4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h1>${esc(categoria.nombre)}</h1>
      <p class="portada__sub">DATABASE SYNCED</p>
      <p class="portada__texto">You can do <b>fetching</b> just by clicking on the run.<br />${esc(categoria.descripcion)}</p>
    </section>
    ${barra('NET', [{ valor: endpoints.length, etiqueta: 'LIST' }])}
    ${buscador()}
    <div class="lista">${endpoints.map(filaEndpoint).join('') || '<p class="vacio">Sin endpoints para ese filtro.</p>'}</div>`;
}

function vistaDocs() {
  return `<section class="docs">
    <div class="nav-iconos">
      <button class="icono" data-ir="home" title="Inicio">${svg.casa}</button>
      <span class="nav-iconos__espacio"></span>
      <span class="portada__sub" style="margin:0">DOCUMENTATION</span>
    </div>
    <h2>1 · Ejecutar un endpoint</h2>
    <p>Todos los endpoints son <code>GET</code> (los de IA y tools también aceptan <code>POST</code>) y no requieren token. Pulsa <b>RUN</b> en cualquier fila para probarlos con parámetros reales.</p>
    <pre><code>curl "${location.origin}/api/tools/morse?texto=HOLA"
curl "${location.origin}/api/canvas/brat?text=Hola%20mundo" -o brat.svg
curl "${location.origin}/api/anime/gacha?semilla=velirius"</code></pre>

    <h2>2 · Desplegar en Vercel</h2>
    <p>El repositorio incluye <code>vercel.json</code> y las funciones en <code>api/</code>. En <a href="https://vercel.com/new" target="_blank" rel="noopener">vercel.com/new</a> importa el repo y pulsa <b>Deploy</b> sin cambiar nada.</p>
    <pre><code>Build Command:    npm run build
Install Command:  npm install
Output Directory: .
Functions:        api/index.mjs + api/[...ruta].mjs</code></pre>

    <h2>3 · Desplegar en Render</h2>
    <p>Hay un <b>Blueprint</b> listo: en Render, <b>New → Blueprint</b>, conecta el repositorio y Render leerá <code>render.yaml</code>. Alternativamente crea un <b>Web Service</b> manual:</p>
    <pre><code>Runtime:       Node
Build Command: npm install &amp;&amp; npm run build
Start Command: npm start
Health Check:  /api/health</code></pre>
    <p>También hay un <code>Dockerfile</code> para despliegues como contenedor.</p>

    <h2>4 · Variables de entorno (opcionales)</h2>
    <table>
      <tr><th>Variable</th><th>Para qué sirve</th></tr>
      <tr><td><code>API_KEY</code></td><td>Si se define, protege todos los /api/* con <code>?apikey=</code> o <code>X-API-Key</code>.</td></tr>
      <tr><td><code>OPENAI_API_KEY</code></td><td>Activa el endpoint real <code>/api/ia/chatgpt</code>.</td></tr>
      <tr><td><code>GEMINI_API_KEY</code></td><td>Activa <code>/api/ia/gemini</code>.</td></tr>
      <tr><td><code>DEEPSEEK_API_KEY</code></td><td>Activa <code>/api/ia/deepseek</code>.</td></tr>
      <tr><td><code>LIMITE_POR_MINUTO</code></td><td>Límite de peticiones por IP (por defecto 120; 0 = sin límite).</td></tr>
      <tr><td><code>URL_BASE</code></td><td>Dominio público para las URLs absolutas dentro del JSON.</td></tr>
    </table>
    <p>Sin ninguna clave la API ya funciona: los tres modelos de IA responden en <b>modo demo</b> y el resto de routers son totalmente funcionales.</p>

    <h2>5 · Origen de los datos</h2>
    <p>Las categorías vienen del documento <b>“Categorias”</b> de Google Drive; las plantillas de canvas y el diseño de esta web, de las carpetas <b>CategoriaCanvas</b> y <b>Banners</b>. Las imágenes optimizadas viven en <code>assets/canvas/</code> y se incrustan en las funciones con <code>npm run plantillas</code>.</p>

    <h2>6 · Enlaces útiles</h2>
    <ul>
      <li><a href="/api" target="_blank" rel="noopener">/api</a> — índice del API</li>
      <li><a href="/api/endpoints" target="_blank" rel="noopener">/api/endpoints</a> — catálogo completo</li>
      <li><a href="/api/openapi.json" target="_blank" rel="noopener">/api/openapi.json</a> — especificación OpenAPI 3.1</li>
      <li><a href="/api/health" target="_blank" rel="noopener">/api/health</a> — health check</li>
      <li><a href="/galeria.html">/galeria.html</a> — la galería de fotos original del repositorio</li>
    </ul>
  </section>`;
}

function renderizar() {
  if (estado.error) {
    contenido.innerHTML = `<p class="vacio">No se pudo cargar el catálogo desde <code>/api</code>.<br />
      Comprueba que las funciones serverless estén desplegadas.<br /><br />${esc(estado.error)}</p>`;
    return;
  }
  if (!estado.endpoints.length && !estado.categorias.length) {
    contenido.innerHTML = '<div class="cargando"><span></span><span></span><span></span> sincronizando…</div>';
    return;
  }
  if (estado.ruta === 'home') contenido.innerHTML = vistaHome();
  else if (estado.ruta === 'docs') contenido.innerHTML = vistaDocs();
  else if (estado.ruta === 'galeria') contenido.innerHTML = vistaGaleria();
  else contenido.innerHTML = vistaCategoria(estado.ruta);
  conectarBuscador();
}

function vistaGaleria() {
  return `<section class="categoria-cabecera">
    <div class="nav-iconos"><button class="icono" data-ir="home">${svg.casa}</button></div>
    <h1>GALERÍA</h1><p class="portada__sub">ARCHIVO FOTOGRÁFICO</p>
    <p class="portada__texto">La galería estática original del repositorio sigue disponible, con sus propios endpoints JSON en <code>/datos/*.json</code>.</p>
    <p><a class="boton boton--negro" href="/galeria.html">ABRIR GALERÍA</a> &nbsp; <a class="boton" href="/api-docs.html">SUS ENDPOINTS</a></p>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Playground (modal)                                                 */
/* ------------------------------------------------------------------ */
let endpointActual = null;

function urlDelEndpoint(e, overrides = {}) {
  const url = new URL(e.ruta, location.origin);
  for (const p of e.params || []) {
    const valor = overrides[p.nombre] ?? p.ejemplo ?? '';
    if (valor !== '') url.searchParams.set(p.nombre, valor);
  }
  return url.toString();
}

function abrirModal(ruta) {
  const e = estado.endpoints.find((x) => x.ruta === ruta);
  if (!e) return;
  endpointActual = e;
  $('#modal-categoria').textContent = `${e.categoriaNombre.toUpperCase()} · ${e.metodo} · ${e.tipo.toUpperCase()}`;
  $('#modal-titulo').textContent = e.ruta;
  $('#modal-descripcion').textContent =
    e.descripcion + (e.nota ? ` — ${e.nota}` : '') + '  (Los campos ya traen un ejemplo: pulsa RUN directamente).';
  $('#formulario').innerHTML = (e.params || []).length
    ? e.params
        .map(
          (p) => `<div class="campo ${String(p.ejemplo).length > 34 ? 'campo--ancho' : ''}">
        <label for="p-${esc(p.nombre)}">${esc(p.nombre)}${p.requerido ? ' *' : ''} <span>${esc(p.descripcion)}</span></label>
        <input id="p-${esc(p.nombre)}" name="${esc(p.nombre)}" value="${esc(p.ejemplo)}" placeholder="${esc(p.ejemplo)}" autocomplete="off" />
      </div>`
        )
        .join('')
    : '<p class="sin-parametros">Este endpoint no necesita parámetros.</p>';
  $('#resultado-estado').textContent = 'LISTO';
  $('#resultado-tiempo').textContent = '';
  $('#resultado-cuerpo').textContent = 'Pulsa RUN para ejecutar el endpoint.';
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  $('#modal').hidden = true;
  document.body.style.overflow = '';
  endpointActual = null;
}

async function ejecutar() {
  if (!endpointActual) return;
  const e = endpointActual;
  const valores = Object.fromEntries(
    [...document.querySelectorAll('#formulario input')].map((i) => [i.name, i.value.trim()])
  );
  const url = urlDelEndpoint(e, valores);
  const mostrar = $('#resultado-cuerpo');
  const estadoRes = $('#resultado-estado');
  const tiempo = $('#resultado-tiempo');
  estadoRes.textContent = 'RUNNING…';
  mostrar.textContent = 'Consultando ' + url;
  const inicio = performance.now();
  try {
    const respuesta = await fetch(url);
    const ms = Math.round(performance.now() - inicio);
    const tipo = respuesta.headers.get('content-type') || '';
    tiempo.textContent = `${ms} ms · ${respuesta.headers.get('X-Velirius-Formato') || tipo.split(';')[0]}`;
    estadoRes.textContent = `${respuesta.status} ${respuesta.ok ? 'OK' : 'ERROR'}`;

    if (tipo.includes('image/')) {
      const vista = new URL(url);
      if (!vista.searchParams.has('formato')) vista.searchParams.set('formato', 'svg');
      mostrar.innerHTML = `<img src="${esc(vista.toString())}" alt="Resultado de ${esc(e.ruta)}" />`;
      return;
    }
    if (tipo.includes('video/') || tipo.includes('octet-stream') || tipo.includes('audio/')) {
      mostrar.innerHTML = `Respuesta binaria (<a href="${esc(url)}" target="_blank" rel="noopener">abrir/descargar</a>).`;
      return;
    }
    const texto = await respuesta.text();
    try {
      mostrar.textContent = JSON.stringify(JSON.parse(texto), null, 2);
    } catch {
      mostrar.textContent = texto;
    }
  } catch (error) {
    estadoRes.textContent = 'ERROR DE RED';
    mostrar.innerHTML = `<span class="error">${esc(error.message)}</span>`;
  }
}

/* ------------------------------------------------------------------ */
/* Eventos                                                            */
/* ------------------------------------------------------------------ */
function conectarBuscador() {
  const input = $('#input-buscar');
  if (input) {
    input.focus();
    input.addEventListener('input', () => {
      estado.filtro = input.value;
      const pos = input.selectionStart;
      renderizar();
      const nuevo = $('#input-buscar');
      if (nuevo) {
        nuevo.focus();
        nuevo.setSelectionRange(pos, pos);
      }
    });
  }
}

function alternarBuscador() {
  estado.buscador = !estado.buscador;
  if (!estado.buscador) estado.filtro = '';
  renderizar();
}

document.addEventListener('click', (evento) => {
  const objetivo = evento.target;
  const categoria = objetivo.closest('[data-categoria]');
  const irA = objetivo.closest('[data-ir]');
  const run = objetivo.closest('[data-run]');
  if (categoria) return ir(categoria.dataset.categoria);
  if (irA) return ir(irA.dataset.ir);
  if (run) return abrirModal(run.dataset.run);
  if (objetivo.closest('#boton-buscar') || objetivo.closest('#boton-buscar-cat')) return alternarBuscador();
  if (objetivo.closest('[data-cerrar]') || objetivo.closest('#modal-cerrar')) return cerrarModal();
  if (objetivo.closest('#boton-run')) return ejecutar();
  if (objetivo.closest('#boton-copiar') && endpointActual) {
    const valores = Object.fromEntries([...document.querySelectorAll('#formulario input')].map((i) => [i.name, i.value.trim()]));
    return copiar(urlDelEndpoint(endpointActual, valores), objetivo.closest('button'));
  }
  if (objetivo.closest('#boton-curl') && endpointActual) {
    const valores = Object.fromEntries([...document.querySelectorAll('#formulario input')].map((i) => [i.name, i.value.trim()]));
    return copiar(`curl "${urlDelEndpoint(endpointActual, valores)}"`, objetivo.closest('button'));
  }
  if (objetivo.closest('#boton-tema')) {
    const actual = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
    document.documentElement.dataset.tema = actual;
    try { localStorage.setItem('tema-velirius', actual); } catch { /* modo privado */ }
  }
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') {
    if (!$('#modal').hidden) cerrarModal();
    else if (estado.buscador) alternarBuscador();
  }
  if (evento.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    evento.preventDefault();
    if (!estado.buscador) alternarBuscador();
  }
  if (evento.key === 'Enter' && !$('#modal').hidden && document.activeElement?.closest('#formulario')) {
    ejecutar();
  }
});

window.addEventListener('hashchange', () => {
  estado.ruta = rutaActual();
  estado.filtro = '';
  estado.buscador = false;
  renderizar();
});

/* Tema + arranque */
try {
  const guardado = localStorage.getItem('tema-velirius');
  document.documentElement.dataset.tema = guardado || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');
} catch {
  document.documentElement.dataset.tema = 'claro';
}

// Si entramos por /canvas, /docs… normalizamos a una ruta hash sin recargar.
const inicial = rutaActual();
if (location.pathname !== '/' && location.pathname !== '/index.html' && RUTAS.includes(inicial)) {
  history.replaceState(null, '', `/#/${inicial}`);
}
estado.ruta = inicial;
cargar();
