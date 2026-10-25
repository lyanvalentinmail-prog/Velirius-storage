# ⚡ Velirius API

Web de documentación + **API REST con 100 endpoints funcionales**, construida con lo que había en la
carpeta **“Velirius api” de Google Drive**:

| Material en Drive | Uso en el proyecto |
| --- | --- |
| Documento **“Categorias”** | Define los 7 routers y sus endpoints (Anime, Canvas, Download, IA, Reactions, Search, Tools). Se añadió `sistema` para health/catálogo/OpenAPI. |
| **CategoriaEjemplo.jpg** y **CategoriasEjemplo.jpg** | Referencia visual de la web: fondo de puntos, tarjeta redondeada, barra `STATUS / NET`, botones `VIEW` y `RUN`. Guardadas en `docs/`. |
| Carpeta **CategoriaCanvas** (33 imágenes) | Plantillas reales de los endpoints `/api/canvas/*`, optimizadas en `assets/canvas/`. |
| **Banners/banner.jpg** | Imagen OpenGraph del sitio. |

Todo funciona **sin base de datos, sin claves obligatorias y sin framework**: Node puro.
El mismo manejador HTTP corre como función serverless en **Vercel** y como servicio en **Render**.

```
8 routers · 100 endpoints · 33 imágenes generadas en las pruebas · 132 comprobaciones OK
```

---

## 1. Inicio rápido

```bash
npm install          # sharp es opcional (solo para exportar PNG)
npm run dev          # http://localhost:3000
npm test             # 132 comprobaciones sobre TODOS los endpoints
npm run build        # genera galeria.json, datos/ y src/plantillas.mjs
```

- Web: `http://localhost:3000/#/home`
- Índice del API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- OpenAPI 3.1: `http://localhost:3000/api/openapi.json`

> `npm run dev` y `npm start` ejecutan `server.mjs`, **el mismo servidor que Render**.
> No hace falta `npm install` para que arranque: solo `sharp` (opcional) es una dependencia.

---

## 2. Despliegue

### Vercel (recomendado)

1. Entra en [vercel.com/new](https://vercel.com/new) e importa
   `lyanvalentinmail-prog/Velirius-storage`.
2. No cambies nada: `vercel.json` ya define
   `buildCommand: npm run build`, `installCommand: npm install` y `outputDirectory: .`.
3. Pulsa **Deploy**. Cada push publica automáticamente.

Cómo está resuelto:

- `api/index.mjs` → `/api` (índice).
- `api/[...ruta].mjs` → *catch-all* para `/api/<cualquier>/<ruta>`.
- Ambos importan `src/app.mjs`, que es un manejador `(req, res)` de Node sin framework.
- Las plantillas de canvas se incrustan en `src/plantillas.mjs` (generado en el build), así que
  las funciones serverless **no necesitan leer archivos del disco en tiempo de ejecución**.
- Las rutas limpias (`/home`, `/canvas`, `/docs`…) tienen `rewrites` a `index.html`.

### Render

Hay un **Blueprint** listo en [`render.yaml`](render.yaml):

1. Render → **New → Blueprint** → conecta el repositorio.
2. Render detecta `render.yaml`, instala dependencias, ejecuta `npm run build` y arranca `npm start`.
3. El health check es `/api/health`.

O manualmente, en **New → Web Service**:

| Campo | Valor |
| --- | --- |
| Runtime | Node (22) |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

También hay un [`Dockerfile`](Dockerfile) por si prefieres desplegar como contenedor.
La guía paso a paso con solución de problemas está en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

---

## 3. Los endpoints

Todos responden JSON con `ok`, `status` y `creator`, salvo los de imagen (SVG/PNG) y
`/api/download/direct` (binario). No hace falta token. Hay CORS (`*`), `OPTIONS`, límite por IP
y errores estructurados (`400`, `404`, `413`, `429`, `502`).

| Router | Endpoints | Ejemplo |
| --- | --- | --- |
| **sistema** | 6 | `/api/health`, `/api/categories`, `/api/endpoints`, `/api/openapi.json`, `/api/echo` |
| **anime** | 7 | `/api/anime/character?q=Naruto`, `/api/anime/waifu`, `/api/anime/gacha?semilla=velirius`, `/api/anime/avatar?nombre=Rem` |
| **canvas** | 34 | `/api/canvas/brat?text=Hola`, `/api/canvas/quotly?username=Ana&text=…`, `/api/canvas/ship?username=A&username2=B` |
| **download** | 12 | `/api/download/youtube?url=…`, `/api/download/aptoide?id=com.whatsapp`, `/api/download/lyric?artista=…&cancion=…`, `/api/download/direct?url=…` |
| **ia** | 4 | `/api/ia/chatgpt?texto=Hola`, `/api/ia/gemini`, `/api/ia/deepseek` |
| **reactions** | 19 | `/api/reactions`, `/api/reactions/hug`, `/api/reactions/hug.svg` |
| **search** | 9 | `/api/search?q=…`, `/api/search/youtube?q=…`, `/api/search/spotify?q=…` |
| **tools** | 7 | `/api/tools/morse?texto=SOS`, `/api/tools/traductor?texto=hello`, `/api/tools/calculadora?expresion=2%2B2*sqrt(9)` |

Ejemplos con `curl`:

```bash
curl "https://TU-DOMINIO/api/tools/morse?texto=HOLA%20MUNDO"
# {"ok":true,"accion":"codificar","resultado":".... --- .-.. .- / -- ..- -. -.. ---"}

curl "https://TU-DOMINIO/api/tools/calculadora?expresion=2%5E8%2Bmin(3,9)"
# {"ok":true,"expresion":"2^8+min(3,9)","resultado":259,...}

curl "https://TU-DOMINIO/api/canvas/brat?text=Hola%20mundo&formato=png" -o brat.png
curl "https://TU-DOMINIO/api/anime/gacha?semilla=velirius&tiradas=10"
curl "https://TU-DOMINIO/api/reactions/hug.svg" -o hug.svg
```

### Canvas

Cada endpoint usa una plantilla de Drive y compone un **SVG** con el texto y/o la imagen que le
lleguen por query string. Con `?formato=png` (o un cliente que acepte PNG) se rasteriza con
`sharp`; si `sharp` no está instalado se devuelve el SVG igualmente: el endpoint nunca falla.

Parámetros habituales: `text`, `username`, `username2`, `image` / `image2` (URL de avatar),
`texto2`, `fondo`, `formato`. Todas las entradas se escapan y las imágenes remotas se descargan
con límite de tamaño, timeout y protección anti-SSRF.

### IA (`need api`)

El documento de Drive marca ChatGPT, Gemini y Deepseek con *“need api”*. Con la variable de entorno
correspondiente se llama al proveedor real; **sin clave responden en modo demo local**, para que el
endpoint siga funcionando en cualquier despliegue:

| Endpoint | Variable |
| --- | --- |
| `/api/ia/chatgpt` | `OPENAI_API_KEY` |
| `/api/ia/gemini` | `GEMINI_API_KEY` (+ `GEMINI_MODELO` opcional) |
| `/api/ia/deepseek` | `DEEPSEEK_API_KEY` |

Aceptan `GET ?texto=...` y `POST {"texto":"...","mensajes":[...]}`.

### Search y Download

Usan servicios públicos sin clave: DuckDuckGo HTML, YouTube, iTunes (Spotify), lyrics.ovh,
OpenGraph/oEmbed, TikTok oEmbed, Aptoide, Google Play y Piped. Si el proveedor no responde,
`search` devuelve resultados reales del catálogo local y `download` un `502` **estructurado**
(nunca un 500 ni HTML). `MODO_OFFLINE=1` permite probar ese comportamiento en CI.

---

## 4. Variables de entorno

Ver [`.env.example`](.env.example). Resumen:

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto del servidor Node (Render/Vercel lo asignan). |
| `API_KEY` | — | Si se define, protege todos los `/api/*`. |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` | — | Activan los modelos reales de IA. |
| `LIMITE_POR_MINUTO` | `120` | Peticiones por IP (`0` = sin límite). |
| `URL_BASE` | auto | Dominio para URLs absolutas dentro del JSON. |
| `MODO_OFFLINE` | `0` | Simula falta de internet (tests). |
| `PERMITIR_PRIVADOS`, `PERMITIR_HOSTS` | — | Permiten hosts internos en desarrollo. |

---

## 5. Estructura

```
.
├── index.html                 # web de documentación (SPA, /#/home, /#/canvas…)
├── assets/
│   ├── api-ui.css             # diseño de la web (referencias de Drive)
│   ├── api-ui.js              # catálogo vivo + playground RUN
│   ├── canvas/                # 33 plantillas optimizadas de Drive
│   └── estilos.css, app.js    # galería original
├── galeria.html               # galería de fotos original (antes index.html)
├── api-docs.html              # endpoints JSON de la galería
├── api/
│   ├── index.mjs              # Vercel: /api
│   └── [...ruta].mjs          # Vercel: catch-all /api/*
├── src/
│   ├── app.mjs                # router + CORS + auth + rate limit (Node puro)
│   ├── catalogo.mjs           # fuente única de verdad de routers/endpoints
│   ├── canvas-config.mjs      # zonas y parámetros de cada plantilla
│   ├── datasets.mjs           # personajes, reacciones, servicios
│   ├── plantillas.mjs         # GENERADO: imágenes en base64 para serverless
│   ├── imagen.mjs             # salida SVG / PNG opcional con sharp
│   ├── utiles.mjs             # fetch seguro, OpenGraph, texto, respuestas
│   └── endpoints/             # sistema, tools, anime, canvas, ia, search, download, reactions
├── server.mjs                 # Render / local: estáticos + /api/*
├── scripts/
│   ├── importar-plantillas.mjs# assets/canvas → src/plantillas.mjs
│   ├── pruebas.mjs            # suite de integración (npm test)
│   ├── generar-galeria.mjs    # galería original
│   └── servidor-dev.mjs       # servidor de la galería (legacy)
├── vercel.json · render.yaml · Dockerfile · .env.example
└── docs/DESPLIEGUE.md · docs/referencia-*.jpg
```

---

## 6. Tests

```bash
npm test
```

La suite levanta el mismo `server.mjs` de Render con `MODO_OFFLINE=1`, recorre **los 100 endpoints
del catálogo**, genera 37 imágenes, prueba GET/POST, CORS, errores, PNG, OpenAPI, archivos
estáticos y un servidor mock local para los resolvers de descarga.

---

## 7. Notas

- La galería de fotos original sigue en `/galeria.html` y `/api-docs.html`.
- `npm run plantillas` regenera `src/plantillas.mjs` si añades o cambias imágenes en
  `assets/canvas/`. El build de Vercel y Render lo hace automáticamente.
- Los endpoints que consultan servicios de terceros dependen de que el despliegue tenga salida a
  internet; Vercel y Render la tienen. El resto (tools, anime, canvas, reactions, IA demo) son
  100 % locales.
- Sin `API_KEY` la API es pública, tal como dice la referencia: *(Not Required Token)*.
