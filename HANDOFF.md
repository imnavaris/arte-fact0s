---
type: manual-agente
scope: proyecto Artefactos de memoria
status: activo
sources: [Matu, ejecución local de tools/, docs/VALIDACION.md]
---

# HANDOFF — Artefactos de memoria

Punto de reanudación. Última sesión de trabajo: 2026-11-02. La obra está completa y calibrada; falta re-correr la validación automatizada después de los últimos cambios.

Reglas, stack y decisiones técnicas: `AGENTS.md` de la carpeta. Criterios de cierre y cómo se miden: `docs/VALIDACION.md`. Este archivo sólo lleva el estado.

## Estado

Seis artefactos procedurales en `src/models/*.js`, cada uno `update(p)`: función pura del progreso, sin memoria ni partículas.

| id | Pieza | Cita |
|---|---|---|
| `book` | El libro quemado | Juan Gelman, *Bajo la lluvia ajena*, 1980 |
| `silhouette` | La silueta | Rodolfo Walsh, *Carta abierta…*, 1977 |
| `scissors` | Las tijeras | María Elena Walsh, *Desventuras en el País-Jardín-de-Infantes*, 1979 |
| `tv` | El televisor | Rodolfo Walsh, *Carta abierta…*, 1977 |
| `birds` | Los pájaros | Paco Urondo, *Poemas de la cárcel*, 1973 |
| `flight` | El vuelo | Néstor Perlongher, *Cadáveres*, 1984 |

`AGENTS.md` todavía lista «El Pañuelo»; en disco el sexto modelo es `tv.js`. El corpus vive en `assets/texts/texts.json` y es la única fuente de verdad del texto.

## Capas agregadas en la última sesión

- `src/typewriter.js`: máquina de escribir atada al scroll. Bajar tipea con cadencia y micro-pausas; subir borra letra por letra hasta el inicio. Cursor `▌`.
- `src/dissolve.js`: revelado progresivo de títulos y versos con rampa glitch/polvo (` .·░▒▓█`).
- `src/bg.js`: fondo ASCII con bustos humanos, matriz densa (`@#BWMQ8…`), respiración y dispersión con el scroll.
- `src/glyph-stage.js`: iluminación direccional por pieza (`setDirectionalLight`). El televisor usa `[0.35, -0.75, 0.6]`, chasis claro y tubo posterior oscuro.
- `style.css`: scrollbars ocultas, interpolación continua a 60 fps (`FRAME_MS = 16`), sin reducción de movimiento forzada.

## Verificación registrada

`docs/VALIDACION.md` (tabla corrida el 2026-10-27):

| # | Resultado |
|---|---|
| V1 | 6 piezas en orden, estados `0 → 1` y regreso, `--glow` en `[0.72, 0.86, 1]`, consola limpia |
| V2 | Sin JS: 6 piezas, 134 a 231 caracteres visibles por pieza |
| V3 | 58,6 fps; conversión 10,3 ms en libro y 0,9 a 5,3 ms en las demás; `birds` de 24 080 a 6 128 tris |
| V5 | Los seis modelos cumplen `update(p)` |
| V6 | `leakedAsciiCount = 0` en las 6 piezas |
| V7 | Contraste 5,08:1 a 13,32:1; 0 celdas bajo 4,5:1 |
| V10 | Mobile 375×812: sin superposición ni overflow horizontal |
| C1-C4 | Las seis citas en `verified`, con autor, obra, año, URL y licencia |

Evidencia del 2026-11-02, posterior a esa tabla: capturas CDP del televisor en `p = 0` y `p = 0.25` con pantalla nítida, tubo en sombra y estática analógica; del libro en `p = 0`; consola limpia en ambas; 60 fps continuos.

## Cómo se abre

```sh
python server.py           # o iniciar.bat; http://localhost:8000
python server.py --bake    # hornea citas y créditos en index.html
python server.py --port 8011   # puerto que esperan las herramientas
```

`vendor/` está commiteado: la obra abre sin npm. `npm install` falla en `G:` (el drive deja archivos de 0 bytes al extraer el tar); el toolchain se instala en disco local y se copian sólo `vendor/*.js`.

## Herramientas

`tools/cdp.mjs scroll all` recorre la obra entera; `eval` y `shot` operan sobre la página viva. `verify-nojs.mjs` mide sin scripts. `perf.mjs` mide conversión, render, fps y peor cuadro. `dump-pose`, `dump-sweep`, `find-pose`, `silhouette-bbox` y `shot-at` calibran encuadre, pose y silueta. Las que hablan con la página necesitan el servidor en 8011.

## Pendiente

- **Re-correr la validación completa** después de `typewriter.js`, `dissolve.js`, `bg.js` y la iluminación del televisor: `cdp.mjs scroll all` (V1, V4), `verify-nojs.mjs` (V2) y `perf.mjs` (V3). La tabla de `docs/VALIDACION.md` sigue fechada el 2026-10-27 y no cubre esos cambios.
- **Alinear `AGENTS.md` con el catálogo real**: dice «El Pañuelo» donde el modelo es `tv`. `VALIDACION.md` V8 también habla de `scarf`.
- **Carpeta sin git**: el vault trackea la carpeta como untracked. No hay historial para reconstruir; conviene commitearla para que el estado quede versionado.
