---
type: registro
---

# AGENTS.md: arte/fact0s

Reglas de trabajo del repositorio. Autoridad: `usuario-en-sesión` > este archivo > `DESIGN.md` > `PLAN.md` > `SKILL.md`.

El vault tiene su propio `AGENTS.md`; este archivo sólo aplica a la carpeta del proyecto.

## Qué es esta obra

Seis artefactos (`libro`, `silueta`, `tijeras`, `tv`, `pajaros`, `vuelo`) sobre la última dictadura cívico-militar argentina, renderizados como cuerpos tipográficos ASCII en tiempo real. Es un dispositivo de lectura y memoria: el texto literario y documental verificable en `assets/texts/texts.json` es la única fuente de verdad (`python server.py --bake` persiste el HTML estático en `index.html` para que todo el contenido exista sin JavaScript ni servidor especial).

## Cómo se abre

```sh
python server.py
# http://localhost:8022
```

No requiere `npm` para visualizar: `vendor/` está commiteado. `npm` sólo se usa para reconstruir `vendor/` con `node build.mjs`.

## Stack

| Capa | Qué | Dónde |
|---|---|---|
| Geometría | Three.js como biblioteca de geometría pura (sin renderer WebGL) | `vendor/three.js` |
| Raster | glyphcss: `Polygon[]` -> texto en un `<pre>` del DOM | `vendor/glyphcss.js` |
| Puente | Three.js `BufferGeometry` -> `Polygon[]` con color por cara monocromo papel | `src/geometry.js` |
| Iluminación | Rigs de tres luces por pieza (`libro`, `silueta`, `tijeras`, `tv`, `pajaros`, `vuelo`) + AO en profundidad | `src/lighting.js` |
| Escena | Escena glyphcss, esculpido del poema, estática CRT, hit-test de glifos y `fitMultiState` | `src/glyph-stage.js` |
| Scroll | `ScrollPacer` con tope adaptable en salida/interpoema y viaje suave (`glideTo`) desde el HUD | `src/scroll.js` |
| Modelos | Los seis artefactos procedurales en español (`crearLibro`, `crearSilueta`, `crearTijeras`, `crearTv`, `crearPajaros`, `crearVuelo`) | `src/modelos/*.js` |
| Servidor | Python stdlib: estático, inyecta con escape HTML el corpus en `index.html` y soporta `--bake` y `--dev` | `server.py` |

## Mapa de archivos

```
index.html                  documento con loader, citas pre-horneadas, HUD e importmap
style.css                   sistema visual completo (tokens, tipografía, parallax, HUD, colofón)
DESIGN.md                   decisiones de diseño, tipografía, parallax, HUD e interacción
PLAN.md                     historial de etapas completadas y criterios de verificación
HANDOFF.md                  estado actual verificado y métricas en vivo
AGENTS.md                   este archivo
LICENSE.md                  licencias de código, tipografía y derecho de cita
server.py                   servidor local e inyector de corpus (--bake)
build.mjs                   empaquetador esbuild para vendor/
src/main.js                 bootstrap: fuentes, corpus, seis piezas, parallax, interpoemas, HUD, teclado y arrastre
src/geometry.js             conversor Three.js -> Polygon[] con clampPaperColor WCAG AA
src/lighting.js             iluminación de estudio monocromo cálido y oclusión ambiental
src/glyph-stage.js          escena glyphcss, grilla, esculpido continuo, encuadre multi-estado y hitTestClient
src/scroll.js               ScrollPacer y SmoothScrollController
src/bg.js                   fondo vivo de siluetas en canvas por tiles sucios
src/typewriter.js           máquina de escribir acoplada al scroll
src/dissolve.js             disolución de títulos
src/modelos/compartido.js   constructores Three.js, levitación y flujo de versos
src/modelos/libro.js        El libro quemado (crearLibro)
src/modelos/silueta.js      La silueta (crearSilueta)
src/modelos/tijeras.js      Las tijeras (crearTijeras)
src/modelos/tv.js           La televisión (crearTv)
src/modelos/pajaros.js      Los pájaros (crearPajaros)
src/modelos/vuelo.js        El vuelo (crearVuelo)
assets/texts/texts.json     corpus de citas verificadas (fuente de verdad del texto)
assets/fonts/               Sligoil Micro, Paper Mono y Newsreader
vendor/                     bundles commiteados: three.js y glyphcss.js
tools/                      verificación automatizada: checks.mjs, cdp.mjs, verify-nojs.mjs, perf.mjs
```

## Reglas duras

1. **Cursor contextual**: el escenario tiene `cursor: default` y sólo cambia a `grab` (`grabbing` al arrastrar) cuando `stage.hitTestClient(clientX, clientY)` detecta que el puntero está sobre los glifos del modelo 3D.
2. **Transición limpia modelo -> poema -> modelo**: al terminar la animación de cada pieza, el modelo asciende hasta salir por completo de la pantalla (`translate3d` sobre `.glyph-scene`) antes del fade-out a negro; luego aparece el poema en `#interpoema` con su autor; para pasar al siguiente modelo, el poema hace fade-out con parallax sin borrar su texto, y recién cuando termina el fade-out entra el siguiente modelo.
3. **Narrativa con parallax sin fade-out**: los textos `.narrativa` de cada modelo tienen escala editorial (`clamp(30px, 3.6vw, 50px)`), entran con fade-in y viajan hacia arriba con parallax hasta salir por el borde superior de la pantalla sin desvanecerse por opacidad.
4. **Barra de recorrido lateral (`#hud-progress`)**: centrada verticalmente a la derecha, sin numeración `01 / 06`. Muestra la línea base siempre con baja opacidad, ilumina el progreso real en ámbar, marca en naranja los nodos recorridos, despliega el título flotante sin contenedor (sin bordes ni fondo) al hacer hover y viaja de forma fluida (`scrollPacer.glideTo`) al hacer clic.
5. **Cero extrapolación en el corpus**: cada cita en `assets/texts/texts.json` respeta los saltos de verso originales (`\n`) y registra autor, obra, año, fuente primaria verificada y encuadre legal (art. 10, Ley 11.723).
6. **Modelos y comentarios en español**: los modelos viven en `src/modelos/` con nombres y constructores en español (`libro.js`, `silueta.js`, `tijeras.js`, `tv.js`, `pajaros.js`, `vuelo.js`, `compartido.js`), y el código lleva únicamente marcas estructurales cortas (`// Libro`, `// Scroll`, `// Iluminacion`).

## Comandos

```sh
python server.py --bake        # hornea las citas y créditos en index.html
python server.py               # sirve en :8022
node tools/checks.mjs          # chequeos estáticos de ejes, ventana de estado y LUTs
node tools/cdp.mjs scroll all  # recorre las 6 piezas con scroll real y verifica consola limpia
node tools/verify-nojs.mjs     # verifica las 6 piezas y textos en el DOM sin JavaScript
node tools/perf.mjs            # mide conversión, render, FPS durante scroll y peor cuadro
```
