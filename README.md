# Velirius · Galería de fotos

Galería de fotos estática, **sin dependencias ni base de datos**. Para publicar una foto nueva solo
arrastras el archivo a la carpeta `fotos/` del repositorio y haces *commit*: Vercel reconstruye la web
y la foto aparece.

- 🖼️ Masonry responsive, visor a pantalla completa, búsqueda y filtros por álbum
- 🌗 Tema claro / oscuro con preferencia guardada
- 📁 Cada subcarpeta de `fotos/` es un álbum; los títulos salen del nombre del archivo
- ⚡ Cero dependencias: `git push` y listo, sin instalar nada
- 🔗 Enlaces directos a cada foto (`/#foto=viajes/lisboa.jpg`)
- 🧩 **API JSON** generada en el build: `/datos/fotos.json`, `/datos/albumes.json` y `/datos/albumes/<slug>.json`
- 🚀 Listo para Vercel (también funciona en GitHub Pages, Netlify o cualquier hosting estático)

---

## 1. Añadir fotos (la forma fácil, desde GitHub)

1. Abre la carpeta [`fotos/`](fotos) en GitHub.
2. Pulsa **Add file → Upload files**.
3. Arrastra tus imágenes (puedes crear subcarpetas para álbumes: `fotos/viajes/`, `fotos/retratos/`…).
4. Pulsa **Commit changes**.

Vercel detecta el *push*, ejecuta `npm run build` y publica la galería con las fotos nuevas.
No hay que tocar código ni volver a desplegar a mano.

> También puedes hacerlo por terminal:
>
> ```bash
> git clone https://github.com/lyanvalentinmail-prog/Velirius-storage.git
> cd Velirius-storage
> cp ~/mis-fotos/*.jpg fotos/viajes/
> git add fotos && git commit -m "Nuevas fotos" && git push
> ```

### Álbumes y títulos

```
fotos/
├── 01-dunas-al-amanecer.jpg    → álbum "General"  · "Dunas al amanecer"
├── viajes/
│   ├── 01-lisboa.jpg           → álbum "Viajes"   · "Lisboa"
│   └── 02-porto.jpg            → álbum "Viajes"   · "Porto"
└── retratos/
    └── ana.jpg                 → álbum "Retratos" · "Ana"
```

- El álbum es el nombre de la carpeta (`playa-2026` → **Playa 2026**).
- El título sale del nombre del archivo sin números ni guiones.
- El orden es alfabético/natural: usa prefijos `01-`, `02-` para controlarlo.
- Formatos admitidos: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`, `.bmp`.

Para poner títulos, descripciones o portadas personalizadas, edita
[`fotos/info.json`](fotos/info.json) (todas las claves son opcionales):

```json
{
  "viajes/01-lisboa.jpg": {
    "titulo": "Lisboa, tejados",
    "descripcion": "Vista desde el mirador al atardecer.",
    "etiquetas": ["ciudad", "atardecer"],
    "fecha": "2026-06-14",
    "album": "Viajes",
    "orden": 1
  }
}
```

Trucos para fotos ligeras: exporta a **JPG/WebP de 1600–2400 px** de lado mayor y **menos de 500 KB**.
Las `.heic` de iPhone no se ven en el navegador: exporta a JPG.

---

## 2. Publicar en Vercel

### Opción A · Desde la web de Vercel (recomendada)

1. Entra en [vercel.com/new](https://vercel.com/new) e inicia sesión con GitHub.
2. Importa el repositorio **`lyanvalentinmail-prog/Velirius-storage`**.
3. No cambies nada: el proyecto ya incluye [`vercel.json`](vercel.json) con
   *Build Command* `node scripts/generar-galeria.mjs`, *Output Directory* `.` y sin dependencias.
4. Pulsa **Deploy**. En ~20 segundos tendrás tu URL `*.vercel.app`.

A partir de ahí, **cada push a `main` (o a cualquier rama) se publica automáticamente**.

### Opción B · Desde la terminal

```bash
npm i -g vercel
vercel          # primer despliegue (preview)
vercel --prod   # a producción
```

### Dominio propio

En Vercel: **Project → Settings → Domains → Add**, escribe tu dominio y apunta el DNS que te indique
(un `CNAME` a `cname.vercel-dns.com` o los `A` para el dominio raíz).

---

## 3. Ver la galería en local

```bash
npm run dev      # http://localhost:5173  (regenera galeria.json al añadir fotos)
```

No hace falta `npm install`: no hay dependencias.

Si prefieres un servidor estático cualquiera:

```bash
npm run build    # genera galeria.json
npx serve .
```

---

## 4. Usar las fotos en un API / otros proyectos

Cada build publica JSON estático con todas las fotos y sus metadatos. **No hay funciones, claves ni
base de datos**: son archivos servidos por el CDN, así que también funcionan desde cualquier frontend.

| Endpoint | Devuelve |
| --- | --- |
| `/datos/albumes.json` | Índice: álbumes con su `slug`, totales y lista de endpoints |
| `/datos/fotos.json` | Todas las fotos con título, álbum, etiquetas, fecha, dimensiones y URL |
| `/datos/albumes/<slug>.json` | Solo las fotos de un álbum (`/datos/albumes/texturas.json`) |
| `/datos/…` (imágenes en `/fotos/…`) | El archivo original: JPG, PNG, WebP, AVIF… |

Ejemplo de una foto en `fotos.json`:

```json
{
  "id": "01-dunas-al-amanecer.jpg",
  "titulo": "Dunas al amanecer",
  "descripcion": "Primera luz sobre la arena fría.",
  "album": "General",
  "etiquetas": ["arena", "amanecer"],
  "fecha": "2026-01-18",
  "archivo": "01-dunas-al-amanecer.jpg",
  "imagen": "/fotos/01-dunas-al-amanecer.jpg",
  "ancho": 1600,
  "alto": 1067,
  "peso": 233637,
  "destacada": true
}
```

Consumirlo desde otra web o app:

```js
const base = 'https://tu-dominio.vercel.app';
const { fotos } = await fetch(`${base}/datos/fotos.json`).then((r) => r.json());

const texturas = fotos.filter((f) => f.album === 'Texturas');
document.querySelector('img').src = base + fotos[0].imagen;
```

```bash
curl https://tu-dominio.vercel.app/datos/fotos.json
curl https://tu-dominio.vercel.app/datos/albumes/texturas.json
```

La documentación viva (con tus álbumes reales) está en **`/api-docs`** dentro del propio sitio.

> **¿Por qué `/datos` y no `/api`?** Vercel reserva la carpeta `/api` de la raíz para funciones
> serverless y no sirve los archivos estáticos que haya dentro. Si necesitas lógica de servidor
> (subir fotos, filtrar, autenticación), puedes añadir tus propias funciones en `/api` sin conflicto:
> los JSON seguirán en `/datos`.
>
> Si quieres URLs absolutas de las imágenes dentro del JSON (útil para consumirlo desde apps externas),
> rellena `urlBase` en `galeria.config.json` con `https://tu-dominio.vercel.app`.

---

## 5. Personalizar

Todo lo visible se controla desde [`galeria.config.json`](galeria.config.json):

```json
{
  "titulo": "Velirius",
  "subtitulo": "Un archivo visual de luz, textura y lugares.",
  "descripcion": "Galería de fotos personal.",
  "autor": "Velirius",
  "repositorio": "lyanvalentinmail-prog/Velirius-storage",
  "rama": "main",
  "carpetaFotos": "fotos",
  "enlace": "https://instagram.com/tu-usuario",
  "textoEnlace": "Instagram",
  "urlBase": ""
}
```

- `repositorio` y `rama` alimentan el botón **“Subir fotos a GitHub”** del diálogo de ayuda,
  que abre directamente la pantalla de subida de la carpeta.
- `enlace` añade un enlace extra en el pie (Instagram, portfolio…).
- `urlBase` (opcional) hace que los endpoints devuelvan URLs absolutas de las imágenes.
- Colores, tipografías y radios están como variables CSS al principio de
  [`assets/estilos.css`](assets/estilos.css).

---

## 6. Estructura del proyecto

```
.
├── index.html                 # la galería (una sola página)
├── assets/
│   ├── app.js                 # render, filtros, búsqueda, visor, tema
│   ├── estilos.css            # diseño responsive
│   └── favicon.svg
├── fotos/                     # ← AQUÍ van las fotos (y subcarpetas = álbumes)
│   ├── info.json              # metadatos opcionales
│   └── LEEME.md
├── api-docs.html              # documentación del API (/api-docs)
├── assets/api.js              # lógica de la página de documentación
├── scripts/
│   ├── generar-galeria.mjs    # crea galeria.json + datos/*.json recorriendo fotos/
│   └── servidor-dev.mjs       # servidor local sin dependencias
├── galeria.config.json        # título, autor, enlaces
├── vercel.json                # configuración de despliegue
└── package.json               # scripts dev / build
```

`galeria.json` y `datos/` **se generan solos** en cada build (están en `.gitignore`); no los edites a mano.
Lee las dimensiones de cada imagen para reservar el espacio y evitar saltos de diseño, y no necesita
ninguna librería externa.

### Atajos de la galería

| Acción | Tecla |
| --- | --- |
| Buscar | `/` |
| Foto anterior / siguiente | `←` / `→` |
| Cerrar visor o diálogo | `Esc` |
| Deslizar en móvil | ← → |

---

## 7. Preguntas frecuentes

**¿Se puede subir una foto desde la propia web?**
No: la galería es 100 % estática, así que las fotos se suben al repositorio. A cambio es gratis,
rapidísima y no necesita servidor. El botón *“Subir fotos a GitHub”* te lleva directo a la carpeta.

**Añadí una foto y no aparece.**
Comprueba que el archivo está dentro de `fotos/` (o una subcarpeta) y que el despliegue de Vercel
terminó en verde. Los nombres con acentos o espacios funcionan, pero conviene evitarlos.

**¿Cómo borro una foto?**
Bórrala de `fotos/` en GitHub y haz *commit*. Desaparece del manifiesto en el siguiente build.

**¿Y si el repo es privado?**
Vercel puede desplegar repositorios privados, pero las fotos quedarán públicas en la URL del sitio.
No subas material que no quieras publicar.

**¿Cuántas fotos aguanta?**
Las que quieras: el manifiesto solo guarda rutas y dimensiones. A partir de varios cientos, usa
imágenes bien comprimidas para que cargue rápido.

**¿Puedo usar las fotos en mi API o en otra app?**
Sí: `/datos/fotos.json` y `/datos/albumes/<slug>.json` son JSON estáticos de solo lectura, y cada
imagen tiene URL directa en `/fotos/…`. Ver la sección 4.

**¿Funciona en GitHub Pages?**
Sí, pero GitHub Pages no ejecuta `npm run build`; tendrías que hacer *commit* de `galeria.json`
(quítalo del `.gitignore`, junto con `datos/`) o publicar con una GitHub Action. En Vercel no hace
falta nada de eso.
