# Guía de despliegue · Vercel y Render

Este repositorio está preparado para publicarse en **Vercel** (funciones serverless) y en
**Render** (servicio Node). En ambos casos se ejecuta exactamente el mismo código:
`src/app.mjs` es un manejador `(req, res)` de Node sin framework.

---

## A. Antes de empezar

1. Ten el código en GitHub (rama `main` o la rama que vayas a desplegar).
2. Comprueba en local que todo responde:

```bash
npm install
npm test        # debe terminar con "✅ Todos los endpoints responden correctamente"
npm run dev     # http://localhost:3000/#/home
```

No hay que crear base de datos ni configurar claves. Si quieres que los endpoints de IA usen el
modelo real, añade `OPENAI_API_KEY`, `GEMINI_API_KEY` o `DEEPSEEK_API_KEY` en el panel de la
plataforma (ver `.env.example`).

---

## B. Vercel

### Opción 1 · Desde la web (recomendada)

1. [vercel.com/new](https://vercel.com/new) → **Add New… → Project**.
2. Importa `lyanvalentinmail-prog/Velirius-storage`.
3. Vercel detecta `vercel.json`. No cambies nada:

   | Ajuste | Valor |
   | --- | --- |
   | Framework Preset | Other (`framework: null`) |
   | Build Command | `npm run build` |
   | Install Command | `npm install` |
   | Output Directory | `.` |
   | Node.js Version | 22 (en Settings → General) |

4. **Deploy**. En ~1 minuto tendrás `https://TU-PROYECTO.vercel.app`.

### Opción 2 · CLI

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # producción
```

### Cómo se sirve cada cosa

| Ruta | Quién responde |
| --- | --- |
| `/`, `/home`, `/canvas`, `/docs`… | `index.html` (reescrituras en `vercel.json`) |
| `/assets/*` | Archivos estáticos |
| `/api` | `api/index.mjs` |
| `/api/canvas/brat`, `/api/tools/morse`, … | `api/[...ruta].mjs` (catch-all) |
| `/api/health` | Catch-all → `src/app.mjs` |

Las plantillas de canvas se incrustan como base64 en `src/plantillas.mjs`, que genera el build.
Así las funciones serverless no dependen de leer archivos estáticos en tiempo de ejecución.

### Variables de entorno

Project → **Settings → Environment Variables**. Las importantes son las claves de IA, `API_KEY`
(si quieres proteger el API) y `URL_BASE` (si necesitas URLs absolutas con tu dominio).

---

## C. Render

### Opción 1 · Blueprint (un clic)

1. Render → **New → Blueprint**.
2. Conecta el repositorio. Render lee [`render.yaml`](../render.yaml).
3. Pulsa **Apply**. Crea el servicio `velirius-api` con plan free, health check `/api/health`,
   `npm install && npm run build` y `npm start`.

Si el repositorio tiene otra rama por defecto, selecciona la rama que contenga este código en el
paso de creación del Blueprint.

### Opción 2 · Web Service manual

| Campo | Valor |
| --- | --- |
| Runtime | **Node** |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Environment | `NODE_VERSION=22` |
| Plan | Free (o superior; el free duerme tras inactividad) |

Render asigna `PORT` automáticamente; `server.mjs` escucha en `0.0.0.0:$PORT`.

### Opción 3 · Docker

El [`Dockerfile`](../Dockerfile) usa `node:22-alpine`:

1. Render → **New → Web Service** → selecciona el repo → **Docker** como runtime.
2. Render detecta el `Dockerfile`, expone el puerto 10000 y ejecuta `node server.mjs`.

---

## D. Comprobación posterior

Sustituye `BASE` por tu URL y ejecuta:

```bash
curl "$BASE/api/health"
curl "$BASE/api/categories"
curl "$BASE/api/tools/morse?texto=SOS"
curl "$BASE/api/canvas/brat?text=Hola&formato=png" -o brat.png
curl "$BASE/api/openapi.json" | head
```

En el navegador abre `$BASE/#/home`: debe mostrar `STATUS: ONLINE` con el número real de routers y
endpoints. Pulsa **VIEW** en un router y **RUN** en cualquier endpoint para ejecutarlo en vivo.

---

## E. Solución de problemas

| Síntoma | Causa / solución |
| --- | --- |
| `/api/*` devuelve 404 en Vercel | Comprueba que existen `api/index.mjs` y `api/[...ruta].mjs` y que el build terminó en verde. |
| La web carga pero dice “OFFLINE” | Las funciones no responden: revisa los logs de la función en Vercel/Render. |
| Los PNG salen como SVG | `sharp` no se instaló (es `optionalDependency`). El endpoint sigue funcionando; fuerza `npm install` o usa `?formato=svg`. |
| `/api/download/*` devuelve 502 | El proveedor externo bloqueó la petición o el plan free está dormido. Es un `502` **estructurado**, no un fallo del servidor. |
| `/api/ia/*` responde `modo: demo` | Falta la clave del proveedor en las variables de entorno. |
| `401 API key incorrecta` | Hay un `API_KEY` configurado: añade `?apikey=...` o la cabecera `X-API-Key`. |
| En Render el health check falla | Verifica que `Start Command` sea `npm start` y que no se haya fijado un `PORT` distinto al que Render asigna. |
| Las imágenes de canvas salen en blanco | Ejecuta `npm run build` (regenera `src/plantillas.mjs`) y vuelve a desplegar. |

---

## F. Seguridad

- Todas las descargas remotas pasan por `urlSegura()` (anti-SSRF), con timeout, límite de
  tamaño y validación de `Content-Type`.
- Las entradas de texto se escapan antes de insertarlas en SVG/JSON.
- `LIMITE_POR_MINUTO` (120 por defecto) frena abusos por IP.
- Opcionalmente `API_KEY` protege todo el API.
- No se guardan datos del usuario: no hay base de datos ni logs de contenido.
