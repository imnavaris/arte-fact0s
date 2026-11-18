---
type: registro
scope: proyecto arte/fact0s
status: activo
sources: [Matu, ejecución local de tools/, docs/VALIDACION.md]
---

# HANDOFF — arte/fact0s

Obra terminada y verificada el 2026-11-18. Dispositivo de lectura sobre la dictadura: seis artefactos procedurales en arte ASCII, scroll como único verbo con estado, loader con título y botón Entrar.

## Catálogo

| id | Pieza | Cita |
|---|---|---|
| `book` | El libro quemado | Juan Gelman, *Bajo la lluvia ajena*, 1980 |
| `silhouette` | La silueta | Rodolfo Walsh, *Carta abierta…*, 1977, ap. 2 |
| `scissors` | Las tijeras | María Elena Walsh, *Desventuras en el País-Jardín-de-Infantes*, 1979 |
| `tv` | La televisión | Rodolfo Walsh, *Carta abierta…*, 1977, ap. 4 |
| `birds` | Los pájaros | Paco Urondo, *Poemas de la cárcel*, 1973 |
| `flight` | El vuelo | Néstor Perlongher, *Cadáveres*, 1984 |

Corpus en `assets/texts/texts.json`, única fuente de verdad. Sin `inscription` separadas: la trama esculpe el `excerpt`.

## Cómo se abre

```sh
python server.py              # o iniciar.bat; http://localhost:8000
python server.py --bake       # hornea citas y créditos en index.html
python server.py --port 8011  # puerto que esperan las herramientas
```

`vendor/` commiteado: abre sin npm. `npm install` falla en `G:`; toolchain en disco local.

## Estado

Entrada con loader (`#loader`, barra real, botón `#enter` con fade in). Al entrar: fondo negro con puntos, escenario en negro hasta los 8 px de scroll, loop atado al scroll. Estado por pieza `update(p)` puro; typewriter atado al scroll; títulos con dissolve quietos en reposo; cursor sin reflow. Herramientas con query saltean el loader. Debug global: `window.__artefact0s`.

Reglas y decisiones: `AGENTS.md`. Criterios de cierre: `docs/VALIDACION.md`.

## Verificación 2026-11-18 (Chrome 156)

V1/V4: 6 piezas en orden, estados `0 → 1`, `--glow` en `[0.72, 0.86, 1]`, consola limpia. V2: 6 piezas, `134` a `194` caracteres por pieza, sin escenario. V3: `60,1` fps, conversión `9,6` ms, raster `5,5` ms, peor cuadro `26,8` ms.

## Pendiente

- **Carpeta sin git**: el vault la trackea como untracked; commitearla para versionar el estado.

## Límites

Sin probar en teléfono real (solo viewport simulado) ni con lector de pantalla (solo DOM y `aria-hidden`).
