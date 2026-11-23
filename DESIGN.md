---
type: registro
---

# DESIGN — arte/fact0s

Sistema visual, tipográfico, espacial y de interacción de `arte/fact0s`. Refleja la arquitectura vigente en producción.

---

## 1. Dispositivo de lectura y memoria

La obra reconstruye seis artefactos vinculados a la última dictadura cívico-militar argentina (`libro`, `silueta`, `tijeras`, `tv`, `pajaros`, `vuelo`) como esculturas tipográficas ASCII sobre las cuales se inscriben fragmentos literarios y documentos históricos verificables (`assets/texts/texts.json`).

- **Apertura en Gelman (`scrollY = 0`)**: al pulsar `Entrar` en el umbral de carga (`#loader`), la experiencia se abre en negro (`#interpoema`) con el revelado carácter por carácter del fragmento de Juan Gelman (*Bajo la lluvia ajena*, 1980), respetando sus cinco versos originales. A partir de allí, el scroll da ingreso al primer artefacto (`El libro quemado`).
- **Secuencia por pieza**:
  1. El artefacto 3D entra en escena con levitación continua y se despliega la `.narrativa` en primer plano.
  2. La `.narrativa` (`clamp(30px, 3.6vw, 50px)`) asciende con parallax rápido y sale por el borde superior del viewport sin hacer fade-out de opacidad.
  3. El scroll articula la transformación completa del artefacto (`stateOf(p)` en `0.05..0.82`).
  4. Finalizada la animación (`state = 1`), el artefacto asciende de forma fluida y controlada hasta salir por completo de la pantalla (`updateParallax`, `exitScrollVel`) **antes** del fundido a negro.
  5. En negro pleno aparece `#interpoema` con el poema del artefacto siguiente y su autor (`clamp(22px, 2.2vw, 30px)`).
  6. Al continuar scrolleando, el poema y su autor hacen fade-out suave acompañados por parallax vertical sin borrar su texto del DOM; recién cuando el fade-out concluye ingresa el siguiente artefacto.

---

## 2. Parallax en tres planos y encuadre responsivo

La composición espacial separa tres planos de profundidad con velocidades diferenciadas:

| Plano | Elemento | Escala y movimiento |
|---|---|---|
| Primer plano | `.narrativa` y `#interpoema` | Tipografía editorial grande (`30–50px` en narrativa, `32–58px` en poema). Mayor velocidad vertical (`translate3d`), saliendo por arriba en las piezas y desplazándose en fase durante el fade-out de los poemas. |
| Plano medio | `.glyph-scene` (artefacto 3D) | Escala monumental y uniforme (`FIT_BOX` por pieza en `fitMultiState`), alternando lado derecho/izquierdo respecto de la columna de texto en desktop (`> 1100px`), con deriva sutil durante la animación y ascenso completo en la salida. |
| Fondo | `#bg` (`src/bg.js`) | Retratos de ausencias por celdas en canvas con deriva lenta (`-22vh` a lo largo de todo el documento) y actualización incremental por tiles sucios. |

### Encuadre responsivo sin superposición
- En desktop (`> 1100px`), los artefactos se centran en el hemisferio opuesto al texto (`[0.65, 0.50]` / `[0.35, 0.50]`, `[0.35, 0.56]` para `tv`, `[0.65, 0.44]` para `pajaros`) y la columna `.piece-inner > *` ocupa `min(38vw, 580px)`.
- En ventanas angostas o móviles (`<= 1100px`), `stageCenterFor` ubica el modelo en el tercio superior (`[0.5, 0.31]`, `[0.5, 0.27]` para `pajaros`) con `targetH = 0.46`, mientras `.js .piece .piece-inner` alinea la narrativa en la franja inferior (`justify-content: flex-end; padding: 0 24px 5vh`), garantizando `0 px` de superposición entre modelo y texto en cualquier tamaño de ventana.

---

## 3. Barra de recorrido lateral (`#hud-progress`)

Centrada verticalmente en el margen derecho (`right: 26px; top: 50%; transform: translateY(-50%)`), ofrece orientación y navegación directa sin ruido numérico:

- **Sin contadores numéricos**: no muestra `01 / 06` ni etiquetas permanentes.
- **Línea siempre visible e iluminada por el recorrido**: `.hud-track` se dibuja de punta a punta con baja opacidad (`rgba(207, 199, 184, 0.22)`) y `.hud-fill` se ilumina en ámbar (`--accent`, con `box-shadow` cálido) reflejando de manera continua la posición exacta del scroll entre los seis artefactos.
- **Nodos centrados y memoria en naranja**: cada `.hud-node` está centrado al subpíxel sobre la línea. Los artefactos ya recorridos (`.is-passed`) quedan marcados en naranja (`--accent`), y el artefacto activo (`.is-active`) rota a rombo (`rotate(45deg) scale(1.35)`).
- **Texto flotante sin contenedor al hover**: al posar el cursor o enfocar un nodo con teclado, `.hud-label` aparece flotando a la izquierda en `Newsreader` itálica (`17px`), sin bordes, sin caja y sin fondo (`background: transparent; border: 0`).
- **Viaje fluido al clic**: clickear un nodo invoca `scrollPacer.glideTo(targetY)`, deslizando el recorrido con amortiguación exponencial continua hasta el artefacto elegido.

---

## 4. Cursor e interacción 3D

- El escenario (`.stage`) mantiene `cursor: default` en el espacio vacío.
- En `pointermove`, `stage.hitTestClient(clientX, clientY)` consulta una vecindad de `3×3` celdas sobre la grilla activa (`lastChar`): sólo cuando el puntero está sobre el cuerpo del artefacto se activa `.is-hover-model` (`cursor: grab`) y permite iniciar la rotación por arrastre (`.is-dragging`, `cursor: grabbing`).
- En pantallas táctiles (`pointerType === 'touch'`), un filtro direccional preserva el scroll vertical nativo y sólo rota ante gestos francamente horizontales.

---

## 5. Iluminación de estudio y materiales (`src/lighting.js`, `src/modelos/*`)

Cada artefacto cuenta con un rig propio de tres luces direccionales (`keyDir`, `fillDir`, `rimDir`), luz hemisférica (`hemiSky`, `hemiGround`), término especular Blinn-Phong con Fresnel en bordes y oclusión ambiental en pantalla (`applyDepthCreviceAO`):

- **El libro quemado (`libro.js`)**: tapas, lomo y hojas curvadas con paso de página continuo y combustión celular (`Doom Fire`) cuantizada en 8 tonos cálidos + cenizas en suspensión.
- **La silueta (`silueta.js`)**: campo de distancia firmada (`SDF`) simétrico con transición morfológica de glifos y levitación sub-píxel por GPU (`--float-y`) para eliminar saltos discretos de fila en reposo.
- **Las tijeras (`tijeras.js`)**: hojas metálicas articuladas y corte de cinta cinematográfica con caída aerodinámica y aleteo.
- **La televisión (`tv.js`)**: gabinete de madera veteada, marco crema biselado (`#ece4d6`), frente grafito oscuro (`#4c4740`) que contrasta con las 4 perillas superiores cromadas, los 2 diales VHF/UHF con aguja y los listones verticales del parlante; carcasa trasera escalonada (`#c6bba6` / `#efe7d8`) con ranuras de ventilación y cuello del tubo CRT iluminada por `fillDir` posterior (`fillIntensity: 0.56`); pantalla con estática cuantizada y barra de hum.
- **Los pájaros (`pajaros.js`)**: jaula centrada en `[0.65, 0.44]` cuyos barrotes se abren y caen mientras una bandada de 16 aves despliega el vuelo hasta salir por completo de la pantalla (`len: 0` al final de la pieza).
- **El vuelo (`vuelo.js`)**: avión de transporte bimotor con hélices en rotación, giro de fuselaje y apertura de rampa trasera.

---

## 6. Tipografía, paleta y colofón editorial

| Token / Rol | Valor | Uso |
|---|---|---|
| `--bg` | `#060607` | Fondo general |
| `--ink` | `#e4e1da` | Texto principal (narrativa, poemas, títulos) |
| `--ink-2` | `#8d909b` | Atribuciones y metadatos (contraste WCAG AA) |
| `--paper` | `#cfc7b8` | Glifos de los artefactos 3D y enlaces en créditos |
| `--accent` | `#d99b26` | Foco, filetes de autor, línea y nodos del HUD |
| `--hairline` | `#2a2d36` | Filetes divisorios de 1 px en el colofón |
| `--poem-font` | `'Cormorant Garamond', 'Newsreader', Georgia, serif` | Poemas en `#interpoema` y citas del colofón |
| `'Newsreader'` | `300 / 400`, óptico | Narrativas (`30–50px`), títulos, etiquetas flotantes del HUD y metadatos |
| `'Sligoil Micro'` | `14px` (`10px` en `< 720px`) | Trama ASCII de los seis artefactos |

### Colofón (`#credits`)
Grilla editorial de dos columnas (`max-width: 960px`) con título «Créditos y fuentes» centrado (`clamp(34px, 3.8vw, 48px)`), filetes horizontales `--hairline`, el verso completo en itálica a la izquierda (`.credits-cite`) y la ficha bibliográfica verificada con enlace directo a la fuente primaria y encuadre legal (art. 10, Ley 11.723) a la derecha (`.credits-meta`). En el colofón se desactiva el tope de velocidad de scroll (`inFooter()`) y se oculta suavemente el HUD lateral.
