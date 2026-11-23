# HANDOFF — arte/fact0s

Seis artefactos ASCII. Server en puerto 8022.

## Audit y ports

Findings 1 a 10 aplicados. Vendor glyphcss actualizado en `vendor`.

Modelos en `C:\Users\Usuario\Vibe Coding\Modelos ASCII` portados a `src/modelos/{libro,tijeras,silueta}.js`.

book con scroll nativo; tv con scroll virtual (scrollCtl). Titulos ocultos. Debug con window.__artefact0s.

## Silueta

Huecos de cuello y torso por el oclusor sólido removidos; quedaron los de espacios. Puente vertical para filas vacías con buffer `Int16Array` reutilizado (`rowCountBuf`).

En reposo y vista frontal por defecto (`restStart || restEnd`), la levitación vertical (`levitationBob`) muestrea el grid SDF continuo a nivel sub-celda (`bobNormY` sobre `sdfGrid`), evitando los saltos por fila entera cada 800 ms. `prewarm()` precalcula el cache SDF durante la carga inicial junto con los demás modelos.

## Scroll, ritmo de revelado y separación visual

Impulso de rueda transferido de forma gradual (`scrollImpulse` + `scrollVel`) con acumulador flotante y cola suave (`exp(-dt * 2.9)`), respetando saltos externos (`cdp.mjs`, `perf.mjs`, barra y teclado).

Tope continuo de velocidad (`maxScrollVel = clamp(innerHeight * 0.58, 380, 560)`) aplicado a rueda y teclas de paso dentro del recorrido de las piezas, y desactivado automáticamente al ingresar al pie (`#credits`, `inFooter()`), devolviendo el scroll nativo libre para recorrer fuentes y créditos.

Revelado del poema en `#interpoema` (`updateInterlude(dt)`) acotado temporalmente (`INTER_REVEAL_CPS = 34`, `INTER_HIDE_CPS = 72`) sobre ventanas ampliadas (`dOut` `-0.52..-0.04`, `dIn` `0.12..0.34`), y avance positivo de `Typewriter.setScroll` limitado respecto a `doneTime` para sostener el ritmo de lectura aunque se scrollee rápido.

En desktop (`> 1100px`), `.piece-inner > *` reducido a `min(28vw, 410px)` con `padding: 0 3.5vw`, y `stage.camera.center` desplazado al lado opuesto (`stageCenterFor`: `[0.65, 0.50]` / `[0.35, 0.50]` alternado, `[0.35, 0.56]` para `tv`, `[0.65, 0.56]` para `pajaros`). En `src/modelos/pajaros.js`, trayectoria de la bandada y apertura izquierda de barrotes dirigidas hacia el cielo derecho para despejar la columna de texto.

## Estabilidad ASCII, sombras, pivotes y rendimiento

`src/modelos/tv.js` y `src/geometry.js`: grupos de antenas marcados con `userData.excludeCenter = true` para que `computeCenter` calcule el pivote en el centro del gabinete y las patas, evitando el balanceo pendular desde lo alto de las antenas.

`src/modelos/pajaros.js`: geometrías compartidas de baja poligonización (`SphereGeometry(6,4)`/`(5,3)`, `ConeGeometry(4)`, `ShapeGeometry` plana en alas y cola, menor subdivisión en jaula), reduciendo de `10.952` a `3.036` polígonos.

`src/lighting.js`, `src/modelos/compartido.js`, `src/glyph-stage.js` y `src/main.js`: rotación en el sitio de vértices (`applyPolygonLevitationInPlace`), cache de enteros hex (`HEX_RGB_INT` / `parseHexBytes`) en `applyDepthCreviceAO`, pooling de objetos poligonales (`_litSlots`) devolviendo siempre un arreglo nuevo para respetar el caché por referencia de `glyphcss` (`Ge()` / `Oe()`), `colorTolerance: 10`, actualización de `Typewriter` restringida a piezas vecinas (`|i - current| <= 1`), y omisión de redibujado del escenario (`o <= 0.002`) y `bg.draw` cuando `#interpoema` cubre la pantalla (`interO >= 0.995`).

`src/bg.js`, `src/modelos/vuelo.js`, `src/modelos/libro.js` y tipografía (`Cormorant Garamond` + `Newsreader`) sin regresiones sobre la iteración previa.

## Decisiones y pendiente

Poemas iguales a excerpts. Renombre al español pendiente. Hallazgos 19 a 32 del barrido L4. Prueba en teléfono real. Commitear carpeta.

## Verificacion

Verificado tras `--bake` sobre servidor local (`python server.py --port 8022`):
- `python server.py --bake`: exit 0 (`index.html` actualizado).
- `node tools/cdp.mjs scroll all`: exit 0, `frames: 231`, `height: 22402`, `CONSOLA: limpia`, variación activa de glifos en las seis piezas (`book` `1544->2023->603`, `silhouette` `630->2197`, `scissors` `999->589`, `tv` `1409->1284`, `birds` `1454->2103->115`, `flight` `622->781`).
- `node tools/verify-nojs.mjs`: exit 0, `piezas: 6`, `hayEscenario: false`, `altoTotal: 6946`.
- `node tools/perf.mjs`: exit 0, `convertMs: 0.3`, `renderMs: 3.9`, `fpsDuringScroll: 60.1`, `peorCuadroMs: 20.3`, `glifos: 725` (`169x57`).
- Chequeo CDP integral de 6 puntos (`eval`): exit 0, `CONSOLA: limpia`:
  - Rendimiento por pieza y color: `book` (`1064` polys, `8.84 ms`), `silhouette` (`3.6 ms`), `scissors` (`2088` polys, `6.4 ms`), `tv` (`1684` polys, `4.58 ms`), `birds` (`3036` polys, `6.94 ms`), `flight` (`1732` polys, `3.2 ms`), `distinct: 3/3` en todas y `cool: 0` en todas.
  - Separación desktop (`1424x805`): brecha positiva en las seis piezas y estados (`book` `+169/+128 px`, `silhouette` `+341/+251 px`, `scissors` `+128/+78 px`, `tv` `+234/+234 px`, `birds` `+185/+62/+817 px`, `flight` `+251/+234/+242 px`).
  - Flotación continua en `silhouette`: `19/19` cuadros distintos muestreados a `55 ms`.
  - Velocidad de revelado en `#interpoema`: `7/110` a `26/110` caracteres visibles en `500 ms` (`38 cps`).
  - Tope en piezas y liberación en pie: `wheelPrevented` `book: true`, `credits: false`.
  - Centro de giro en `tv`: centro vertical del gabinete estable (`bodyRows` medio `29`, `31`, `29` en `(90,270)`, `(68,225)` y `(90,315)`).
- Inspección visual por captura CDP (`tv 0.3`, `tv 0.3 68 225`, `birds 0.2`, `birds 0.55`, `silhouette 0`, `flight 0.85`): exit 0, `CONSOLA: limpia`; sombreado monocromo cálido sin sesgo violeta, TV centrada al rotar, jaula abriéndose y bandada volando por la derecha, silueta continua y compuerta trasera abierta en `flight`.
