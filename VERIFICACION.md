# Verificación de esta versión · «Herbario de señales»

Este informe describe **solo** lo comprobado sobre esta versión. Los informes anteriores (carcasa interactiva, ritmo del periodo, observatorio) corresponden a código que se reescribió en gran parte y **no sirven como prueba de ésta**.

Fecha de la revisión: 17 de noviembre de 2026. Entorno: Windows 11, Python 3.12, Node 24, Microsoft Edge (Chromium) con la API de depuración y con el navegador integrado de la aplicación. Datos: demostración y bases temporales; nunca `data/` ni `demo_data/`.

## Ejecutado

### Pruebas automáticas

| Comando | Resultado |
| --- | --- |
| `python -m unittest discover -s tests -p test_api.py -v` | 16 pruebas, todas OK |
| `node tests/scene.test.cjs` | OK |
| `node tests/experience.test.cjs` | OK |
| `node --check static/js/app.js` · `carcasa.js` · `experience.js` | Sin errores de sintaxis |

Qué cubren las pruebas nuevas o ampliadas:

- **API/relato** (Python): contrato de `POST /api/lecturas` (201/400/401), cargador aislado, recursos locales referenciados por las plantillas, ausencia de coordenadas falsas, conteo de capítulos con 0/1/muchas lecturas, campo `evidence` en cada capítulo, determinismo, dos lecturas sin «tendencia», pausas y cobertura parcial, ausencia de afirmaciones causales, filas defectuosas, extremos válidos (−40/80 °C, 65 535 lx con «−» y separador de millares) y día nombrado en 7 d.
- **Vista principal** (`scene.test.cjs`): inicio sin API, identidad de la escena, periodos, vacío, 503, red, datos atrasados, timeout y recuperación, teclado, tacto, pausa y movimiento reducido; **filas defectuosas** (nulos, cadenas, fecha inválida, fuera de contrato), **corte de línea** tras una pausa larga con `tension 0` y eje lineal, **extremos sin recorte**, **hora según `data-timezone`** (Bogotá y Tokio, zona inválida) y **estados vacío/error sin hora ni sello anteriores**.
- **Observatorio** (`experience.test.cjs`): orden, rechazo, extremos, variables visuales acotadas, muestreo de 800 lecturas, hora según zona, `data-playing` al reproducir y pausar, `className` intacto, y vacío/error sin restos y con recuperación.

### Navegador real (Edge, demostración)

| Comprobación | Resultado |
| --- | --- |
| Desbordamiento horizontal | `scrollWidth` igual al ancho de la ventana en `/`, `/experiencia` y `/acceso` a 320, 360, 390, 430, 480, 600, 768, 1024, 1366 y 1440 px (30 combinaciones, medidas con iframes del mismo origen). La tabla se desplaza dentro de su propio contenedor. |
| Texto menor de 12 px | Ninguno en las 30 combinaciones. |
| Objetivos menores de 44 px | Ninguno en las 30 combinaciones, **excepto los puntos «+» de la carcasa 3D**, que se excluyen de la medición: su zona táctil se amplía a unos 45 px pero la escala y la proyección 3D la reducen; sus equivalentes (lista de componentes) sí miden 44 px o más. |
| Controles que se tapan o se recortan | Ninguno entre botones, enlaces y campos (comprobación de solapes por pares y de texto recortado dentro de botones) en las 30 combinaciones. Esta medición se añadió después de que una captura móvil mostrara el botón «Reproducir el día» tapando «24 horas»; ya está corregido. |
| Contraste | Calculado para 20 pares de la paleta (ver `SISTEMA_VISUAL.md`): texto ≥ 5,1:1, marcas gráficas ≥ 3,5:1, etiqueta del QR 6,1:1. |
| Foco con teclado | Anillo visible de 3 px; en `/experiencia` y secciones oscuras el anillo cambia a `#f0dfa0` (medido con Tab en `/experiencia`; en las secciones oscuras de la portada se aplica la misma regla CSS, sin medición propia). |
| Movimiento reducido (emulado) | Portada: control de movimiento deshabilitado, escena en pausa, LED con una iteración de 0,01 ms. Observatorio: animaciones ambientales a 0,01 ms y una iteración mientras se reproduce. |
| Estados de la portada | Vacío, atrasado (3 h 13 min), extremos con id de nodo largo y pausa de 95 minutos, y datos defectuosos de la API: sin `NaN`/`undefined`, sin hora ni sello de lecturas anteriores, línea cortada en la pausa, −40/80 °C y 65 535 lx dentro de la gráfica. |
| Estados del observatorio | Vacío visto en el navegador; vacío y error con recuperación cubiertos por `experience.test.cjs` (no se simuló un error de red en el navegador). |
| Consola | Sin errores de EcoNodo en las 21 cargas de las capturas finales. En 3 de ellas apareció `SyntaxError: Identifier '…' already declared` procedente de scripts que Edge inyecta en la página (`AssistantLoadState`, `popupScriptEmbedded`, `BLOCK_CSS_VALUE`…); esos nombres no existen en el proyecto (búsqueda sin coincidencias). |
| Impresión de `/acceso` | Edge genera el PDF en **una hoja** tamaño Carta (el contenido ocupa 238 mm de 247 mm); el texto extraído conserva pasos, dirección y la advertencia. No se revisó visualmente la imagen impresa. |
| Recursos remotos | Búsqueda en plantillas, hojas de estilo, scripts propios e imágenes: solo aparecen los espacios de nombres `xmlns` de SVG, que no son peticiones. |

Las capturas reales están en `entregables/capturas/` (escritorio 1440, pantalla corta 1366×768, ancho equivalente a zoom 200 % (720 px), tablet 768, móvil 390, y los estados vacío, atrasado, extremos y defectuoso).

## No ejecutado o fuera de alcance

- **Linux**: `iniciar_demo.sh` e `iniciar.sh` no se ejecutaron (no hay Linux ni WSL en este equipo). No se presentan como probados.
- **Dispositivo físico, teléfono real y lector de pantalla**: no probados. El tacto se comprobó con eventos simulados y el foco con teclado en Edge.
- **Otros navegadores**: solo Chromium (Edge). No se probó Firefox ni Safari; la textura de papel (`feTurbulence`), `@property` y `::first-letter` deberían degradar con elegancia, pero no se verificó.
- **`EcoNodo_estudio.blend` y las figuras del PDF del Avance 2**: no se abrieron ni se vieron; solo se extrajo texto del PDF. La carcasa web sigue siendo una traducción CSS aproximada y no se contrastó contra la malla.
- **Hardware, conectividad e instalación**: nada de esta revisión certifica el montaje, el ESP32, el Wi-Fi, la ventilación del DHT22 ni el QR pegado en la carcasa. El LED de la página refleja la antigüedad del dato, no una conexión.
- **Arranque con los scripts `.ps1`** en un equipo limpio: no repetido en esta versión (ver «Paquete final» para lo que sí se probó: cargador y servidor sobre el ZIP extraído, con un intérprete que ya tenía las dependencias).
- **Zoom 200 % real**: se emuló con una ventana de 720 px de ancho CSS, no con el zoom del navegador.
- El DHT22 aparece en la carcasa web con ranuras laterales inferiores; el PDF del Avance describe una «abertura inferior ventilada». Hay que decidir cuál es la correcta al montar la pieza (ver `REFERENCIA_CARCASA.md`).

## Paquete final

El ZIP (`entregables/EcoNodo-Digital_herbario-de-senales.zip`, 67 archivos, una sola raíz `econodo-digital/`) se extrajo en una carpeta nueva y, con un intérprete que ya tenía las dependencias:

| Comprobación en la copia extraída | Resultado |
| --- | --- |
| Excluidos | No hay `.venv`, `data/`, `demo_data/`, `config.local.json`, `.env`, cachés ni archivos `.sqlite3`, `.db`, `.pyc`, `.pem` o `.key`. |
| Pruebas | Python 16/16 OK; `scene.test.cjs` y `experience.test.cjs` OK; `node --check` de los tres scripts sin errores. |
| Arranque | `tools/cargar_demo.py` creó 289 lecturas de demostración solo en `demo_data/` de la copia; `run_server.py` arrancó en un puerto de prueba. |
| Respuestas HTTP | 200 en `/`, `/experiencia`, `/acceso`, `/acceso/qr.svg`, `/api/estado`, `/api/historial`, `/api/diario`, `/api/exportacion.csv`, `/health`, las tres hojas de estilo, las dos imágenes, los tres scripts propios y Chart.js local. |
| Contrato de escritura | `POST /api/lecturas` válido → **201**; temperatura 999 → **400**. (El 401 por clave inválida lo cubre `test_api.py`; en esta prueba la clave estaba vacía.) |
| Datos reales | No se creó `data/`. |
| Finales de línea | `iniciar_demo.sh` conserva LF. |

Observación al probarlo: `app.py` lee `config.local.json` como UTF-8 sin tolerar BOM. Si el archivo se crea con `Set-Content -Encoding utf8` de Windows PowerShell 5.1, el servidor falla al arrancar con un error de JSON. No se cambió `app.py` (queda fuera del alcance de esta versión); el README lo advierte.

La instalación de dependencias Python desde cero, con `iniciar_demo.ps1`, requiere conexión a internet y no se repitió en esta revisión.
