# HANDOFF — arte/fact0s

Estado actual en `main`, verificado sobre `python server.py` (puerto `8022` por defecto) y sincronizado con GitHub (`origin/main`).

## Arquitectura y estado actual

1. **Modelos y carpeta en español (`src/modelos/`)**:
   - `src/modelos/libro.js` (`crearLibro`, `kind: 'libro'`)
   - `src/modelos/silueta.js` (`crearSilueta`, `kind: 'silueta'`)
   - `src/modelos/tijeras.js` (`crearTijeras`, `kind: 'tijeras'`)
   - `src/modelos/tv.js` (`crearTv`, `kind: 'tv'`)
   - `src/modelos/pajaros.js` (`crearPajaros`, `kind: 'pajaros'`)
   - `src/modelos/vuelo.js` (`crearVuelo`, `kind: 'vuelo'`)
   - `src/modelos/compartido.js` (constructores Three.js, levitación y flujo de versos)
   - Comentarios en todo el repositorio depurados a marcas estructurales breves (`// Libro`, `// Libro en llamas`, `// Scroll`, `// Iluminacion`, `// Escena`, etc.).
   - Eliminados `iniciar.bat` y los scripts temporales de calibración (`compare-*`, `dump-*`, `find-pose`, `shot*`, `silhouette-bbox`), conservando en `tools/` únicamente la suite de verificación (`checks.mjs`, `cdp.mjs`, `verify-nojs.mjs`, `perf.mjs`).

2. **Barra de recorrido lateral (`#hud-progress`)**:
   - Centrada verticalmente a la derecha (`right: 26px; top: 50%; transform: translateY(-50%)`), sin indicadores numéricos (`01 / 06`).
   - Línea base (`.hud-track`) siempre visible con baja opacidad (`rgba(207, 199, 184, 0.22)`), iluminándose en ámbar (`--accent`) de forma continua según el progreso real entre las piezas, con alineación exacta al centro de los nodos (`trackCenterX = dotCenterX = 1384`).
   - Los nodos ya recorridos (`.is-passed`) y el activo (`.is-active`) quedan marcados en naranja (`--accent`).
   - Al hacer hover o focus sobre un nodo, el título del artefacto (`.hud-label`) aparece flotando sin contenedor, sin bordes y sin fondo (`background: transparent; border: 0`).
   - Al hacer clic en un nodo, `scrollPacer.glideTo(targetY)` desplaza el recorrido con transición fluida hasta la pieza.

3. **Iluminación de la TV, jaula centrada y rendimiento (60 FPS)**:
   - En `src/modelos/tv.js` y `src/lighting.js` (`LIGHT_RIGS.tv`), el panel frontal grafito (`#4c4740`) y las juntas (`#33302b`) contrastan nítidamente con las 4 perillas superiores cromadas, los 2 diales VHF/UHF con aguja, el marco crema biselado (`#ece4d6`) y las barras del parlante. La carcasa trasera escalonada (`#c6bba6` / `#efe7d8`) incorpora ranuras de ventilación y cuello del tubo CRT con iluminación posterior (`fillDir: [0.35, 0.84, 0.41]`, `fillIntensity: 0.56`).
   - En `src/modelos/pajaros.js` y `src/main.js`, la jaula se centra más arriba (`[0.65, 0.44]` en desktop, `[0.5, 0.27]` en `<= 1100px`) y las 16 aves salen volando por completo fuera de la pantalla al finalizar la animación.
   - Estática CRT cuantizada en 5 tonos (`tvBand`, `tvGray`), `colorTolerance: 16` y cadencia adaptativa (`EFFECT_FRAME_MS = 55 ms` en reposo) sostienen `54–60.6 fps` en todas las escenas.

4. **Tipografía editorial, saltos de verso originales, parallax y cursor contextual**:
   - `.narrativa` escalada a `clamp(30px, 3.6vw, 50px)` (`min(38vw, 580px)`), a la par de los poemas (`#interpoema .inter-poema`), viajando hacia arriba con parallax hasta salir por el borde superior sin fade-out.
   - Restaurados los 5 versos con `\n` del poema inicial de Juan Gelman en `assets/texts/texts.json` e `index.html`; todos los poemas respetan sus saltos de línea originales.
   - Cursor `default` en toda la experiencia, cambiando a `grab` / `grabbing` únicamente al posarse o arrastrar sobre los glifos del modelo 3D (`stage.hitTestClient`).
   - Encuadre responsivo (`fitMultiState` con `probeZoom = 28` centrado en `[0.5, 0.5]` y `FIT_BOX` por pieza) con `0 px` de superposición entre modelo y texto al achicar la ventana (`900×700` y `375×812`).

## Verificación ejecutada

- `python server.py --bake`: exit 0 (`index.html` actualizado).
- `node tools/checks.mjs`: exit 0 (`OK all checks passed`).
- `node tools/cdp.mjs scroll all`: exit 0, `frames: 232`, `CONSOLA: limpia`, recorrido completo `libro` -> `silueta` -> `tijeras` -> `tv` -> `pajaros` -> `vuelo`.
- `node tools/verify-nojs.mjs`: exit 0, `piezas: 6`, `hayEscenario: false`, `textoVisible: [229, 182, 183, 194, 144, 134]`.
- `node tools/perf.mjs`: exit 0, `convertMs: 0.5`, `renderMs: 8.2`, `fpsDuringScroll: 60.1`, `peorCuadroMs: 19.5`.
