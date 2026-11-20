# Sistema visual · «Herbario de señales»

EcoNodo se presenta como un **herbario de señales del lugar**: cada lectura es una hoja que se archiva con su fecha, su unidad y su procedencia. El sistema combina tres dimensiones, y cada decisión de diseño debe servir al menos a una sin estorbar a las otras dos.

| Dimensión | Qué aporta | Dónde se ve |
| --- | --- | --- |
| **Editorial** | Titulares expresivos en serif con una palabra en cursiva, jerarquía de folios numerados («Folio 02 · El presente») y un ritmo que alterna páginas claras y una sección nocturna. | Encabezados de sección, capítulos del diario, observatorio. |
| **Ambiental** | Ilustración botánica original (hojas, ramas, hierba), papel con textura, capas y luz. Nunca es una medición. | Ramas laterales, hoja de herbario de la carcasa, paisaje del observatorio. |
| **Instrumental** | Cifras legibles con unidad, regla de escala, sello de antigüedad, fecha, procedencia y estado en texto. | Tarjetas «Ahora», ritmo, gráficas, tabla, panel «Muestra seleccionada». |

## Fuente única: `static/css/tokens.css`

Los tres recorridos (`/`, `/experiencia`, `/acceso`) cargan `tokens.css` y después su hoja propia (`styles.css` o `experience.css`). Cambiar un token cambia las tres.

### Color

| Token | Valor | Uso |
| --- | --- | --- |
| `--paper` · `--paper-2` · `--card` | `#f4efe2` · `#ebe4d1` · `#fbf8ef` | Fondo de página, fondo alterno y hoja de herbario. |
| `--ink` · `--ink-soft` | `#10332a` · `#4b6358` | Texto principal y secundario. |
| `--night` · `--on-night` · `--on-night-soft` | `#0f2d26` · `#eef2dc` · `#b9cdb9` | Sección de datos, observatorio y pie. |
| `--moss` · `--moss-deep` · `--moss-soft` | `#6b8856` · `#4a6a3c` · `#cddab6` | Vegetación y observación. |
| `--c-temp` | `#b05a36` (arcilla) | Temperatura, siempre. |
| `--c-humidity` | `#3f7f78` (verde azulado) | Humedad relativa, siempre. |
| `--c-light` | `#a67c0e` (citrino) | Iluminancia, siempre. |

Cada variable conserva **el mismo color en tarjeta, gráfica, leyenda, ritmo, resumen y capítulo**; cada una tiene además una variante `-ink` (texto) y `-soft` (relleno). Ningún color funciona como alarma, semáforo o calificación: la temperatura alta no es «roja» por ser peligrosa, es arcilla porque es la temperatura.

### Tipografía y espacio

- Serif de sistema (`Iowan Old Style`, `Palatino`, `Georgia`) para titulares y cifras grandes; sans de sistema para el resto. **No se descarga ninguna fuente.** Cifras con `lining-nums tabular-nums` para que no salten al actualizarse.
- Escala: `--t-note` 12 px (mínimo absoluto), `--t-small` 14 px, `--t-body` 17 px, y cuatro tamaños fluidos (`lead`, `h3`, `h2`, `h1`) más `--t-figure` para la cifra de cada tarjeta.
- Espaciado sobre una retícula de 4 px (`--s-1` a `--s-9`) y margen lateral fluido `--gutter`.
- Esquina «hoja»: `2px 28px 2px 28px` (y una versión grande). Es la única forma que se repite en tarjetas, paneles y botones de acción.

## Motivos y recursos (todos locales y originales)

| Recurso | Descripción |
| --- | --- |
| `templates/_motivos.html` | Símbolos SVG ocultos: `h-hoja`, `h-ramita`, `h-hierba`, `h-marca` y los glifos `g-temp`, `g-humedad`, `g-luz`. Se reutilizan con `<use>`. |
| `static/img/papel.svg` | Textura de papel (ruido fractal de 240 px) usada como fondo del `body`. |
| `static/img/hoja.svg` | Hoja grande usada como marca de agua en capítulos y pie. |
| `static/favicon.svg` | Marca de EcoNodo (sin cambios respecto de la versión anterior). |

Todo motivo es decorativo: `aria-hidden="true"`, fuera del orden de tabulación y fuera del flujo de datos.

## Componentes instrumentales

- **Tira de folio** (portada): sustituye a las coordenadas geográficas. Dice «Herbario de señales · Hoja 01 · nombre del lugar» y nada más; **no hay latitud, longitud ni norte**.
- **Hoja de herbario** (carcasa): la escena 3D descansa sobre una hoja de papel con cintas en las esquinas, una nota de procedencia («Ilustración basada en el diseño del Avance 2… el hardware aún debe validarse») y el aviso de datos simulados cuando corresponde.
- **Tarjeta «Ahora»**: cifra grande, unidad, **regla de escala** (reemplaza las líneas SVG fijas de antes; la marca se coloca con la lectura real; luz en escala logarítmica, y la regla lo dice) y **sello de antigüedad** («Recibida hace 7 min» / «Dato histórico · recibido hace 3 h 13 min» / «Sin lectura»).
- **Capítulos del diario**: tres papeles (apertura grande, dos medios, cierre nocturno). Cada uno termina con **«Se apoya en: …»** (qué lecturas sostienen la frase). El número de capítulos se adapta: 2 sin lecturas, 4 con ellas.
- **Ritmo del periodo**: tramos de tiempo (nominalmente 300 s, máximo 40). Los tramos sin lecturas se dibujan como hueco discontinuo. **Cada periodo usa su propia escala**: sirve para ver la forma del día, no para comparar un periodo con otro, y el pie lo dice con las cifras mínima y máxima.
- **Gráficas**: eje de tiempo proporcional, una marca cada «número redondo» de horas, sin suavizado. Una pausa de más de 20 minutos corta la línea (no hay observaciones). Humedad fija en 0–100 %; temperatura y luz dejan margen para que los extremos válidos (−40, 80 °C; 65 535 lx) no se recorten. Cada gráfica tiene una descripción textual con mínimo, máximo y último valor.
- **Panel «Muestra seleccionada»** (observatorio): fecha y hora en la zona horaria configurada, tres cifras, procedencia. Al estar vacío o fallar, **todo** vuelve a «—» y a «Sin lectura»; no conserva datos de la lectura anterior.

## Reglas de honestidad

1. La ilustración **traduce**, no mide: el paisaje del observatorio cambia con luz, humedad y temperatura, y la página lo dice («una interpretación, no un diagnóstico ni una medición del cielo»).
2. El relato describe observaciones y no atribuye causas (nada de contaminación, CO₂, lluvia, salud de las plantas, sombra, nubes o personas). Dos lecturas no son una tendencia; una sola no es una evolución; un periodo parcial no es un día completo.
3. Sin lugar, especie ni cifra de uso inventados. La demostración siempre se anuncia en la franja superior.
4. Un sello o una etiqueta nunca implica conectividad ni hardware certificado.

## Movimiento

- Ninguna animación infinita carece de control: la portada tiene **Pausar movimiento**; el observatorio solo anima niebla, ondas del nodo y LED mientras se reproduce (`data-playing="true"`) y se detiene al pausar.
- `prefers-reduced-motion` reduce toda animación y transición, desactiva el movimiento de la carcasa y pone a 0 la animación de las gráficas.
- El observatorio gobierna su apariencia con `data-state` y `data-playing`, no con clases que JavaScript reasigne.

## Accesibilidad (criterios y cómo se midieron)

| Criterio | Cómo se aplicó |
| --- | --- |
| Texto ≥ 12 px | Piso `--t-note`. Auditoría por script en 10 anchos (320–1440 px) × 3 rutas: 0 textos por debajo. |
| Contraste | Texto de cuerpo sobre papel 11,96:1; texto secundario 5,67:1; variantes `-ink` ≥ 6,0:1 sobre la hoja; texto claro sobre noche 8,78–12,90:1; foco 5,56:1 (claro) y 11,08:1 (nocturno). Las marcas gráficas de cada variable superan 3:1 (luz 3,59:1). |
| Objetivos ≥ 44 px | Botones, enlaces de menú y pie, y la línea temporal miden 44 px o más. Los puntos «+» de la carcasa amplían su zona táctil a unos 45 px antes de la escala de la ilustración; **en móvil la escena se reduce (hasta 0,84) y la rotación 3D los proyecta más pequeños**, por eso cada punto tiene un equivalente de 44 px en la lista de componentes (DHT22, BH1750…). |
| Foco visible | Anillo de 3 px con desplazamiento; color propio sobre fondo nocturno. |
| Zoom 200 % y 320 px | Sin desplazamiento horizontal de página en 320, 360, 390, 430, 480, 600, 768, 1024, 1366 y 1440 px. La tabla se desplaza dentro de su propio contenedor, que es enfocable. |
| Estado sin color | Todo estado tiene texto («Lectura reciente», «Sin lectura nueva», «Dato histórico»). |
| Decoración | Oculta a lectores de pantalla. |

## Cómo modificarlo sin romper nada

1. Empieza por `tokens.css`. Si cambias un color de variable, cambia también su `-ink` y `-soft` y revisa el contraste de la tabla anterior.
2. No renombres los identificadores que usa JavaScript (`#device-scene`, `[data-hotspot]`, `#experience-stage`, los `*-stamp`, etc.); los tests de `tests/*.test.cjs` los comprueban.
3. Mantén cada motivo en `_motivos.html` y refiérelo con `<use>`; no añadas fuentes, CDN ni servicios remotos (una prueba de `tests/test_api.py` falla si una plantilla referencia un archivo local que no existe; la ausencia de recursos remotos se comprobó además al leer cada plantilla y hoja de estilo).

## Límites

- Las ilustraciones son originales y simplificadas: no representan una especie ni un sitio concretos.
- Los colores y la escala se revisaron con cálculos de contraste y en Edge; no se probaron con lectores de pantalla ni con personas con baja visión.
