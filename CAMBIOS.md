# Cambios de esta versión · «Herbario de señales»

## Integración del prototipo operativo

Actualización posterior al rediseño descrito abajo: recepción del JSON en español del ESP32, validación de saturación y valores extremos, muestreo previsto de 10 s, refresco de 5 s, pérdida de señal a 60 s, historial del observatorio actualizado automáticamente sin interrumpir la reproducción y diagnóstico de red. Se conserva el diseño, el esquema SQLite, los endpoints de consulta y el firmware existente. La guía vigente es [CONECTAR_PROTOTIPO.md](CONECTAR_PROTOTIPO.md).

## Publicación en internet con dirección fija

`publicar.ps1` activa Tailscale Funnel y guarda `public_url`. `run_server.py` abre además `127.0.0.1:5080` (`public_port`), de solo lectura: solo acepta `POST /api/lecturas` si hay `node_key`. Respuestas comprimidas con gzip. `/acceso` explica «cualquier red» cuando la URL es pública. Sin cambios en SQLite, el contrato del ESP32 ni el puerto 5000. Guía: [PUBLICAR_INTERNET.md](PUBLICAR_INTERNET.md).

## QR con la IP actual del hotspot

`/acceso` y `/acceso/qr.svg` ya no dependen de una `public_url` escrita a mano: usan la IPv4 con la que el PC sale a la red (hotspot), incluso si la página se abre desde `127.0.0.1`. Una `public_url` con una IP que el PC ya no tiene se ignora; un nombre de dominio se respeta. `run_server.py` imprime al arrancar la URL para celulares, el `SERVER_URL` del ESP32 y la del QR. Sin cambios en el `POST /api/lecturas`, SQLite ni el firmware.

## Rediseño original

Rediseño visual y narrativo de EcoNodo Digital sobre el proyecto existente. **No cambia** el firmware, el esquema SQLite, `config.json`, `app.py`, `econodo/storage.py`, las herramientas (`tools/`), los scripts de arranque ni el contrato de `POST /api/lecturas` (`node_id`, `temperature_c`, `humidity_pct`, `illuminance_lux`; rangos −40…80, 0…100, 0…65535; respuestas 201/400/401). `data/` y `demo_data/` siguen separadas y no se insertó ningún dato ficticio en la base real.

La dirección y sus reglas están en [SISTEMA_VISUAL.md](SISTEMA_VISUAL.md). Las comprobaciones, con lo ejecutado y lo pendiente, en [VERIFICACION.md](VERIFICACION.md).

## Qué cambió para quien usa la página

- **Portada** (`/`): nueva composición editorial (titular con palabra en cursiva, folios numerados), la carcasa sobre una hoja de herbario con ramas originales, y las secciones «Ahora», «Diario», «Datos», «Registro» y «Entender» con un mismo vocabulario. Se mantienen la carcasa giratoria, los puntos «+», sus equivalentes por teclado y tacto, «Recorrer el dato», «Pausar movimiento», los periodos, la tabla y el CSV.
- **Observatorio** (`/experiencia`): paisaje original en capas (cielo, sol, rayos, niebla, colinas, flora), texto sobre una pantalla fija para que el contraste no dependa de la lectura, panel «Muestra seleccionada» y consola de tiempo con progreso «Hoy · momento 151 de 201 · 12:32 p. m.».
- **Acceso** (`/acceso`): pasos numerados («misma red Wi-Fi»), QR de 240 px o más, dirección y aviso de comprobar el acceso antes de imprimir; la versión impresa conserva ese aviso.
- **Sin falsa geolocalización**: se eliminaron «05° N», «05° 04′ N», LAT / LON y la flecha norte. En su lugar hay una tira de folio sin coordenadas.
- **Líneas SVG fijas de las tarjetas**: reemplazadas por una regla de escala cuya marca sigue la lectura real (la luz usa escala logarítmica y lo dice).

## Cambios de comportamiento (no solo de aspecto)

1. **Hora en la zona configurada.** Las tres vistas usan `settings.timezone` (a través de `<body data-timezone>`, validada con `Intl.DateTimeFormat`), no la zona del navegador. Si la zona no es válida, la página sigue funcionando con la del navegador.
2. **Periodos vacíos o con error.** Fecha, hora, procedencia, sellos y avisos de límite de la lectura anterior se borran; el observatorio vuelve a «—:—», «Sin lectura» y el botón a «Reproducir el día».
3. **Gráficas.** Eje de tiempo proporcional (antes, etiquetas por categoría); sin suavizado; una pausa de más de 20 minutos **corta** la línea y se anuncia en una nota; humedad fija en 0–100; temperatura y luz dejan margen para no recortar −40/80 °C ni 65 535 lx. Cada gráfica tiene descripción textual.
4. **Ritmo del periodo.** Ahora son tramos de tiempo (nominalmente 300 s, máximo 40) y los tramos vacíos se dibujan como hueco; antes eran hasta 32 grupos de filas. La altura se normaliza **por periodo** y el texto lo explica con los valores mínimo y máximo.
5. **Defensas en la vista principal.** `app.js` descarta filas con fecha inválida, valores no numéricos o fuera de contrato, y procesa como máximo 5 000. `carcasa.js` no escribe `NaN` ni cifras infinitas. La capa defensiva de `experience.js` (≤5 000 filas, ≤500 momentos, rangos visuales −5…45 °C, 5…95 %, 0…30 000 lx, luz logarítmica) se conserva.
6. **Observatorio.** El estado visual depende de `data-state` y `data-playing` (ya no se reasigna `className`); la niebla, las ondas del nodo y el LED solo se animan mientras se reproduce. Tras un error se vacían las lecturas.
7. **Relato** (`econodo/narrative.py`): sigue siendo determinista y sin causas. Ahora no falla con filas defectuosas, cada capítulo incluye `evidence` («Se apoya en: …»), menciona cobertura parcial y pausas largas, propone una pregunta distinta por periodo, nombra el día en 7 d, escribe «−» (signo tipográfico) y separa millares con punto. `GET /api/diario` solo **añade** el campo `evidence`; los campos anteriores no cambian.
8. **Texto de la etiqueta del QR en la carcasa:** de «Consultar» a «Acceso», porque 12 px es el mínimo y «Consultar» no cabía en el ancho del QR. El código de color del fondo pasó a verde musgo oscuro para llegar a 6,1:1 de contraste.
9. **Accesibilidad.** Foco visible con anillo propio sobre fondos nocturnos, objetivos de 44 px en menú, pie y línea temporal, ningún texto por debajo de 12 px, sin animaciones infinitas fuera de un control de pausa.

## Archivos

**Nuevos**
`static/css/tokens.css`, `static/img/papel.svg`, `static/img/hoja.svg`, `templates/_motivos.html`, `SISTEMA_VISUAL.md`, `CAMBIOS.md`, `entregables/capturas/` (capturas reales).

**Reescritos**
`templates/index.html`, `templates/access.html`, `templates/experience.html`, `static/css/styles.css`, `static/css/experience.css`, `static/js/app.js`, `econodo/narrative.py`.

**Modificados**
`static/js/carcasa.js` (zona horaria, números seguros, hora de la escena), `static/js/experience.js` (zona horaria, reinicio del panel, `data-playing`, error sin restos), `README.md`, `VERIFICACION.md` (sustituido por el informe de esta versión), `REFERENCIA_CARCASA.md`.

**Pruebas**
`tests/test_api.py` (16 pruebas; nuevas: recursos locales existentes y relato), `tests/scene.test.cjs` y `tests/experience.test.cjs` (nuevos casos: filas defectuosas, cortes de línea, extremos, zona horaria, vacío/error sin restos, `data-playing`).

**Sin cambios**
`app.py`, `econodo/storage.py`, `config.json`, `firmware/`, `tools/`, `run_server.py`, `iniciar*.ps1`, `iniciar*.sh`, `CONTRATO_API.md`, `INTEGRACION_FISICA.md`, `static/vendor/` (Chart.js 4.5.1 local), `static/favicon.svg`.
