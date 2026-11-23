---
type: registro
---

# PLAN: arte/fact0s

Qué hay que hacer para que la obra quede lista, en orden. Todo marcado: no queda nada abierto.

Catálogo vigente: `book`, `silhouette`, `scissors`, `tv`, `birds`, `flight`. Donde una etapa vieja dice `scarf`/pañuelo, léase `tv`/televisión.

El diseño y la interacción están en `DESIGN.md`. Las reglas del repo están en `AGENTS.md`.

---

## [x] Etapa 0 — Que la herramienta ande

Que `glyphcss` entre al proyecto sin CDN y sin obligar a instalar nada para ver la obra.

- [x] Instalar `glyphcss@0.3.1` (`package.json`)
- [x] Empaquetar `three`, `motion`, `glyphcss` por vendor (`build.mjs`)
- [x] Declarar `glyphcss` en el importmap (`index.html`)
- [x] `vendor/glyphcss.js` commiteado
- [x] Publicar `Newsreader` para la lectura (`assets/fonts/`)

Ojo: `npm install` no anda en `G:`. El toolchain se instala en disco local y se copia solo `vendor/*.js`. `vendor/` va commiteado.

---

## [x] Etapa 1 — Que una pieza se vea de punta a punta

- [x] Conversor Three.js → `Polygon[]` (`src/geometry.js`)
- [x] Mapeo de ejes Y-up → Z-up (`src/geometry.js`)
- [x] Centrado del objeto en el origen (`src/geometry.js`)
- [x] Escena glyphcss: grilla, esculpido, encuadre (`src/glyph-stage.js`)
- [x] Esculpido del texto sobre las celdas ocupadas (`src/glyph-stage.js`)
- [x] Medición de la celda tras `document.fonts.ready` (`src/main.js`)
- [x] Columna de lectura con el texto en el DOM (`index.html`, `style.css`)
- [x] Sistema visual completo (`style.css`)

---

## [x] Etapa 2 — Que las seis piezas se lean

### [x] Encuadre y silueta de cada pieza

Cada pieza se vuelca a texto plano y se ajusta la pose hasta que se lee sola. Herramientas: `dump-pose`, `dump-sweep`, `find-pose`, `shot`, `shot-at`, `silhouette-bbox`.

| Pieza | Pose | Por qué |
|---|---|---|
| book | 70 / 90 | El lomo al medio, las dos tapas separadas |
| silhouette | 80 / 90 | La persona de frente, completa |
| scissors | 60 / 30 | Las dos hojas abiertas en diagonal |
| tv | 90 / 270 | La pantalla de frente |
| birds | 86 / 90 | La formación entera |
| flight | 26 / 55 | Fuselaje y ala de perfil |

### [x] Los seis modelos

Cada uno es `update(p)`: una función del progreso, sin estado interno ni partículas.

| Pieza | p=0 | p=1 |
|---|---|---|
| book | intacto | quemado, hojas carbonizadas |
| silhouette | figura entera | se borra en el sitio |
| scissors | abiertas, película entera | cerradas, película cortada |
| tv | pantalla nítida | estática creciente |
| birds | libres | la jaula se cierra |
| flight | rampa cerrada | rampa abajo |

- [x] Convertir cada uno y calibrar su pose (`src/main.js`)
- [x] Decidir el estado de cada pieza en función de `p`
- [x] Borrar los sistemas de partículas
- [x] Quitar los `toggle()`

### [x] Scroll continuo

- [x] Secciones de 150 vh por pieza
- [x] `p` sale del scroll de cada sección
- [x] Estado amortiguado, sin saltos
- [x] Estado congelado en los bordes de cada pieza
- [x] Parallax leve del objeto
- [x] La columna de lectura no se anima
- [x] Teclado: flechas saltan de pieza en pieza

### [x] Rotación

- [x] Arrastre gira la pieza, sin rebote
- [x] La rotación queda donde quedó
- [x] En táctil el dedo vertical scrollea y el horizontal gira
- [x] Cursor `grab` / `grabbing`

### [x] El texto

- [x] Seis citas reales (`assets/texts/texts.json`)
- [x] Máximo 4 versos o 40 palabras por cita
- [x] Bloque legible e inscripción salen del mismo texto
- [x] `server.py` sirve el corpus como archivo estático
- [x] Borrados `poems.json` y `src/poetry.js`

| Pieza | Autor | Obra | Año |
|---|---|---|---|
| El libro quemado | Juan Gelman | Bajo la lluvia ajena | 1980 |
| La silueta | Rodolfo Walsh | Carta Abierta… | 1977 |
| Las tijeras | María Elena Walsh | Desventuras en el País-Jardín-de-Infantes | 1979 |
| La televisión | Rodolfo Walsh | Carta Abierta… | 1977 |
| Los pájaros | Paco Urondo | Poemas de la cárcel | 1973 |
| El vuelo | Néstor Perlongher | Cadáveres | 1984 |

---

## [x] Etapa 3 — Cierre, créditos y entrega

- [x] Créditos y fuentes como cierre del scroll
- [x] `docs/FUENTES.md` absorbido en la obra
- [x] `README.md` al día
- [x] Borrados renderer e input viejos
- [x] Borrados planes y validaciones del pipeline viejo
- [x] Repo de entrega con `node_modules/` y `__pycache__/` afuera
- [x] Registro en el vault

Accesibilidad:

- [x] Todo el texto en el DOM desde el primer render
- [x] La capa ASCII lleva `aria-hidden="true"`
- [x] Sin JS las secciones se apilan como documento
- [x] Foco visible siempre
- [x] Movimiento reducido: estado crudo, sin parallax, sin inercia

Rendimiento:

- [x] Un solo nodo de texto para la capa esculpida
- [x] `--glow` cambia solo en umbrales
- [x] Estado solo si cambió `p` o hubo arrastre

---

## [x] Etapa 4 — Lectura, fuego y fluidez

- [x] Inscripción con palabras separadas por `·`, un verso por fila (`src/glyph-stage.js`)
- [x] Trama de 14 px (`style.css`, `src/main.js`)
- [x] Fuego de glifos, sin partículas (`src/glyph-stage.js`, `src/modelos/libro.js`)
- [x] El libro se quema hoja por hoja (`src/modelos/libro.js`)
- [x] La silueta se borra en el sitio (`src/modelos/silueta.js`)
- [x] Rotación libre: yaw sin tope, pitch ±90° (`src/main.js`)
- [x] Scroll sin lecturas de layout por cuadro (`src/main.js`, `src/modelos/libro.js`)
- [x] Colofón limpio, licencias en `LICENSE.md` (`index.html`, `LICENSE.md`)

---

## [x] Etapa 5 — Auditoría `/antislop`

- [x] Corpus único pre-horneado con escape HTML (`texts.json`, `server.py`, `index.html`)
- [x] Esculpido continuo y encuadre multi-estado (`src/glyph-stage.js`)
- [x] Monocromo cálido con piso AA (`src/geometry.js`, `src/modelos/*`, `src/glyph-stage.js`)
- [x] Modelos reconstruidos y geometrías livianas (`src/modelos/*`)
- [x] Umbral, skip-link, glow, teclado completo y mobile (`index.html`, `style.css`, `src/main.js`)

---

## [x] Etapa 6 — Entrada y carga

- [x] Título `arte/fact0s` en documento, docs y paquetes (`index.html`, `*.md`, `package.json`, `texts.json`)
- [x] Loader con barra real y botón Entrar (`index.html`, `style.css`, `src/main.js`)
- [x] Escenario en negro hasta los 8 px de scroll (`src/main.js`)
- [x] Herramientas con query saltean el loader; `cdp`/`perf`/`shot-at` entran solas (`tools/*.mjs`)

Verificación 2026-11-18: V1/V4 (6 piezas `0 → 1`, consola limpia), V2 (134 a 194 caracteres), V3 (60,1 fps; 9,6 ms conversión; 5,5 ms raster).

## [x] Etapa 7 — Ajustes de entrada

- [x] Fondo negro al inicio, solo puntos (`src/bg.js`)
- [x] Libro con la misma rampa que el resto (`src/main.js`)
- [x] Títulos quietos en reposo (`src/main.js`)
- [x] Cursor sin reflow (`src/typewriter.js`, `style.css`)
- [x] Sin redraw perpetuo (`src/main.js`)

Verificación 2026-11-18: `scroll all` en verde.

---

## Cómo se verifica

```sh
node tools/cdp.mjs scroll all   # recorrido entero, consola limpia
node tools/verify-nojs.mjs      # texto en el DOM sin JavaScript
node tools/perf.mjs             # fps, conversión, raster, peor cuadro
```

## Decisiones que ya no se re-discuten

- glyphcss renderiza **100 %** de la obra. Three.js queda como biblioteca de geometría.
- La rueda hace scroll; el zoom desaparece.
- La rotación por arrastre se queda **por ahora**; no hay auto-rotación.
- Sin clic izquierdo, en ningún lugar.
- Los textos de Bécquer se borran. El corpus es real.
- La inscripción de cada pieza sale de su cita, sin texto aparte.
- Galería y configuración quedan como **dirección futura** en `DESIGN.md`, no como plan.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Citas con copyright sin permiso | Breves, con procedencia y aviso una vez al pie |
| `npm install` rompe en `G:` | Toolchain en disco local; `vendor/` commiteado |
| El drive no versiona la carpeta | Commitear la carpeta como repo de entrega |
