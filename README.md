# mapeo_3d — Visor 3D embebible de propiedades

Visor web que muestra propiedades inmobiliarias en **3D** (con **AR nativo en iPhone**) y en
**planta 2D con anotaciones**, pensado para embeberse en las fichas de **arriendamelo.cl** con un
`<iframe>` de una línea. No requiere tocar el backend del sitio ni compilar nada en iOS.

- **3D + AR** en el navegador con [`<model-viewer>`](https://modelviewer.dev/) (glTF/GLB + USDZ).
- **Anotaciones** (ventanas al exterior, accesos, muros) como hotspots clicables.
- **Vista 2D** con la planta de la propiedad y los metros por habitación.
- **Embebible** y desacoplado: se despliega como sitio estático.

## Requisitos

- Node.js 18+ y npm.
- Para capturar propiedades: un iPhone/iPad con LiDAR (ej. iPhone 15 Pro Max).

## Desarrollo

```bash
npm install
npm run dev      # abre http://localhost:5173/?id=demo
npm run build    # genera el sitio estático en dist/
npm run preview  # sirve dist/ para probar el build
```

La propiedad **demo** vive en `public/demo/` y se carga con `?id=demo`.

> Nota: el `model.glb` de la demo es un **departamento de ejemplo generado proceduralmente**
> (piso, muros, ventanas con vidrio y muebles simples), creado con `node tools/build-apartment.mjs`.
> Es solo web-3D (sin `model.usdz`, por lo que no muestra botón AR). Reemplázalo por tus escaneos
> reales de Scaniverse, que sí incluyen `.usdz` para AR.

## Cómo se ve una propiedad: flujo completo

### 1. Escanear (gratis, sin Mac)

Usa una app de escaneo LiDAR en tu iPhone. Recomendada: **Scaniverse** (gratis). Alternativas:
**3D Scanner App**, **Polycam**.

Exporta de la app:
- `model.glb` — modelo 3D para el navegador.
- `model.usdz` — para el AR ("Ver en tu espacio") en iPhone/iPad.
- `floorplan.png` (o `.svg`) — la planta 2D, si la app la genera. Si no, puedes omitirla.

### 2. Crear la carpeta de la propiedad

Cada propiedad es una carpeta con sus archivos + un `data.json`:

```
propiedades/<id>/
├─ model.glb
├─ model.usdz
├─ floorplan.svg     (o .png — opcional)
└─ data.json
```

En desarrollo local pon la carpeta dentro de `public/` (ej. `public/propiedades/<id>/`).
En producción puedes servirla desde un bucket (Cloudflare R2 / S3) y usar `?src=`.

### 3. Escribir el `data.json`

```json
{
  "id": "depto-providencia-123",
  "title": "Departamento 2D/2B - Providencia",
  "model": "model.glb",
  "iosModel": "model.usdz",
  "floorplan": "floorplan.svg",
  "rooms": [
    { "name": "Dormitorio principal", "area": 14.2 },
    { "name": "Living-comedor", "area": 22.0 }
  ],
  "annotations": [
    { "label": "Ventana exterior (norte)", "position": "1.2 1.0 -0.5", "normal": "0 0 1" }
  ]
}
```

Campos:

| Campo         | Descripción                                                            |
|---------------|------------------------------------------------------------------------|
| `title`       | Nombre que se muestra en la vista 2D.                                   |
| `model`       | Archivo GLB (3D web). **Obligatorio.**                                  |
| `iosModel`    | Archivo USDZ (AR iOS). Opcional; si falta, no se muestra el botón AR.   |
| `floorplan`   | Imagen de la planta (`.svg`/`.png`). Opcional.                          |
| `rooms[]`     | Lista de habitaciones: `name` y `area` (m²).                            |
| `annotations[]` | Hotspots 3D: `label`, `position` ("x y z") y `normal` opcional.       |

#### Cómo obtener `position` / `normal` de una anotación

`position` es el punto 3D (en coordenadas del modelo) donde se ancla el hotspot. La forma fácil de
obtenerlo es con el editor de model-viewer:
<https://modelviewer.dev/editor/> → carga tu GLB → clic derecho sobre el punto deseado → copia los
valores de `data-position` y `data-normal`.

### 4. Embeber en arriendamelo.cl

Pega en la ficha de la propiedad (funciona con cualquier backend: Node, PHP, WordPress, etc.):

```html
<iframe
  src="https://visor.arriendamelo.cl/?id=depto-providencia-123"
  style="width:100%;height:480px;border:0"
  loading="lazy"
  allow="xr-spatial-tracking; fullscreen"
  allowfullscreen></iframe>
```

Ver `embed/snippet.html` para un ejemplo completo de ficha.

## Cómo carga las propiedades el visor

El visor (`src/main.js`) resuelve el origen así:

- `?id=<slug>` → carga `propiedades/<slug>/data.json` (la demo usa `demo/data.json`).
- `?src=<url>` → carga un `data.json` desde una URL directa (útil para buckets/CDN).

Las rutas de `model`, `iosModel` y `floorplan` se resuelven relativas a la carpeta del `data.json`.

## Estructura del proyecto

```
mapeo_3d/
├─ index.html          # contenedor del visor
├─ src/
│  ├─ main.js          # orquesta: parsea ?id/?src, carga datos, toggle 3D/2D
│  ├─ viewer.js        # arma <model-viewer> + AR + hotspots
│  ├─ minimap.js       # vista 2D (planta + habitaciones)
│  └─ style.css
├─ public/demo/        # propiedad de ejemplo
├─ embed/snippet.html  # ejemplo de integración
└─ vite.config.js
```

## Despliegue

Es un sitio estático. `npm run build` genera `dist/`, que puedes publicar en Cloudflare Pages,
Netlify, Vercel o cualquier hosting estático. Apunta un subdominio (ej. `visor.arriendamelo.cl`) a
ese despliegue.

## Hoja de ruta

- **Fase 1**: minimapa 2D interactivo (Three.js leyendo la geometría de paredes), compresión Draco
  de los GLB, más tipos de anotación (medidas, "pared al exterior"), panel por habitación.
- **Fase 2**: app de captura propia con **RoomPlan** (compilada en la nube vía EAS Build/Codemagic,
  instalada por TestFlight) con subida directa y edición de habitaciones. Solo cuando el volumen de
  escaneos lo justifique — hoy Scaniverse cubre la captura gratis.
