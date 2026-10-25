# Carpeta de fotos

Todo lo que pongas aquí aparece en la galería. **No hay que editar código.**

## Lo más rápido

1. Arrastra tus imágenes a esta carpeta (`fotos/`) o a una subcarpeta.
2. Haz *commit* / *push*.
3. Vercel reconstruye la web sola en unos segundos.

## Álbumes

Cada subcarpeta es un álbum:

```
fotos/
├── 01-mi-foto.jpg        → álbum "General"
├── viajes/
│   ├── lisboa.jpg        → álbum "Viajes"
│   └── porto.jpg
└── retratos/
    └── ana.jpg           → álbum "Retratos"
```

El nombre del álbum sale del nombre de la carpeta: `fotos/playa-2026/` → **Playa 2026**.
Puedes cambiarlo con la clave `album` en `info.json`.

## Títulos automáticos

El título se deduce del nombre del archivo:

| Archivo | Título |
| --- | --- |
| `01-dunas-al-amanecer.jpg` | Dunas al amanecer |
| `atardecer_en_el_puerto.png` | Atardecer en el puerto |
| `Lisboa-2026.06.avif` | Lisboa 2026.06 |

Para controlar el orden, empieza los nombres con un número (`01-`, `02-`…) o usa `"orden"` en `info.json`.

## Personalizar (opcional)

`info.json` es un objeto donde cada clave es la ruta de la foto dentro de `fotos/`:

```json
{
  "viajes/lisboa.jpg": {
    "titulo": "Lisboa, tejados",
    "descripcion": "Vista desde el mirador al atardecer.",
    "etiquetas": ["viajes", "ciudad"],
    "fecha": "2026-06-14",
    "album": "Viajes",
    "orden": 1
  }
}
```

Todas las claves son opcionales. Sin `info.json` también funciona.

## Formatos y consejos

- Formatos: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`, `.bmp`.
- Recomendado: JPG/WebP de **1600–2400 px** de lado mayor y **menos de 500 KB** por foto.
- Los archivos se sirven tal cual desde `/fotos/...`, así que cuanto más ligeros, más rápida la galería.
- Las imágenes `.heic` de iPhone no se pueden mostrar en navegadores: exporta a JPG (en iOS, *Ajustes → Cámara → Formatos → Más compatible*).

> Las fotos de ejemplo de esta carpeta son degradados generados. Bórralas cuando subas las tuyas.
