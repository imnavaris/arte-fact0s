---
type: registro
---

# PLAN: arte/fact0s

Registro de etapas ejecutadas y verificadas de la obra.

Catálogo vigente (`src/modelos/`): `libro`, `silueta`, `tijeras`, `tv`, `pajaros`, `vuelo`.

---

## [x] Etapa 0 — Base y empaquetado local
- [x] Empaquetar `three` y `glyphcss` en `vendor/` (`build.mjs`)
- [x] Declarar importmap local en `index.html` sin depender de `npm` para correr
- [x] Publicar `Sligoil Micro`, `Paper Mono` y `Newsreader` en `assets/fonts/`

## [x] Etapa 1 — Pipeline geométrico y tipográfico
- [x] Conversor Three.js → `Polygon[]` con mapeo `(x, -z, y)` (`src/geometry.js`)
- [x] Iluminación de estudio por pieza y oclusión ambiental en profundidad (`src/lighting.js`)
- [x] Escena glyphcss, esculpido continuo de versos y `fitMultiState` (`src/glyph-stage.js`)
- [x] Pre-horneado estático del corpus en `index.html` (`python server.py --bake`)

## [x] Etapa 2 — Los seis artefactos en español (`src/modelos/`)
- [x] `src/modelos/libro.js` (`crearLibro`): libro articulado con hojas en movimiento, fuego celular y cenizas
- [x] `src/modelos/silueta.js` (`crearSilueta`): campo SDF simétrico con transición morfológica y levitación GPU (`--float-y`)
- [x] `src/modelos/tijeras.js` (`crearTijeras`): tijeras articuladas y corte de película con caída aerodinámica
- [x] `src/modelos/tv.js` (`crearTv`): televisor CRT con gabinete de madera, frente grafito, perillas y diales VHF/UHF cromados, trasera iluminada con ventilación y estática cuantizada
- [x] `src/modelos/pajaros.js` (`crearPajaros`): jaula centrada en `[0.65, 0.44]` que se abre y bandada de 16 aves que salen volando fuera de cuadro
- [x] `src/modelos/vuelo.js` (`crearVuelo`): avión de transporte con hélices y apertura de rampa trasera

## [x] Etapa 3 — Narrativa, parallax, interpoemas y HUD
- [x] Poema inicial de Juan Gelman al pulsar `Entrar` (`scrollY = 0`) con sus 5 versos originales
- [x] Parallax en tres planos: `.narrativa` (`clamp(30px, 3.6vw, 50px)`) que asciende y sale por arriba sin fade-out, modelo 3D en plano medio y `#bg` al fondo
- [x] Salida fluida de cada modelo hacia arriba antes del fundido a negro y fade-out con parallax de cada poema antes del modelo siguiente
- [x] Barra de recorrido lateral (`#hud-progress`) centrada a la derecha, línea base siempre visible, progreso continuo real, nodos recorridos en naranja, título flotante sin contenedor al hover y viaje fluido (`scrollPacer.glideTo`) al clic
- [x] Cursor contextual: `default` en toda la página y `grab` / `grabbing` únicamente sobre los glifos del modelo 3D (`stage.hitTestClient`)
- [x] Diseño responsivo sin superposición entre modelo y texto (`<= 1100px` y `<= 720px`)
- [x] Colofón editorial de dos columnas (`#credits`) con título centrado y fuentes originales verificadas

## [x] Etapa 4 — Higiene de repositorio y verificación
- [x] Nombres de carpeta, archivos y constructores de modelos en español (`src/modelos/*`)
- [x] Comentarios depurados a marcas estructurales breves (`// Libro`, `// Scroll`, `// Iluminacion`)
- [x] Eliminados `iniciar.bat` y scripts temporales de calibración de `tools/`

---

## Cómo se verifica

```sh
node tools/checks.mjs           # invariantes estáticos (ejes, ventana de estado, LUTs)
node tools/cdp.mjs scroll all   # recorrido entero de las 6 piezas, consola limpia
node tools/verify-nojs.mjs      # 6 piezas y texto completo en el DOM sin JavaScript
node tools/perf.mjs             # conversión, raster, FPS en scroll continuo y peor cuadro
```
