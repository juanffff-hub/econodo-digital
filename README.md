# EcoNodo digital

Diario ambiental local para una zona verde. Recibe mediciones de un ESP32, guarda temperatura, humedad relativa e iluminancia, y las convierte en una experiencia web narrativa con gráficas, estadísticas e historial descargable.

**Estado de esta entrega:** el apartado digital y el contrato de integración están implementados. Incluye una demostración claramente identificada y aislada. La lectura de sensores, la conexión Wi-Fi definitiva y la ubicación dentro de la carcasa deben revisarse cuando exista el montaje físico.

## Abrir y explorar en Visual Studio Code

1. Descomprime el ZIP.
2. En Visual Studio Code (o VSCodium), elige **File → Open Folder** y selecciona la carpeta `econodo-digital`.
3. Instala [Python 3.9 o posterior](https://www.python.org/downloads/) si aún no está instalado. La primera ejecución necesita conexión a internet para instalar las dependencias Python. La consulta posterior funciona dentro de la red local; Chart.js viene incluido.
4. Abre una terminal integrada y ejecuta el arranque de demostración:

**Windows / PowerShell**

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar_demo.ps1
```

**Debian / Linux**

```bash
bash iniciar_demo.sh
```

5. Abre **http://127.0.0.1:5000** en el navegador. La banda superior indica claramente **MODO DEMOSTRACIÓN**. El cargador crea lecturas ficticias únicamente en `demo_data/`, separadas de `data/`.

La carpeta `.venv/` se crea al ejecutar el script y no debe copiarse ni publicarse. En Windows, `iniciar.ps1` detecta automáticamente un entorno copiado desde otro computador, lo conserva como `.venv_incompatible_...` y crea uno nuevo con el Python local. Si Debian indica que falta `venv`, instala el paquete `python3-venv` de tu distribución y repite el comando.

### Clonar en otro computador Windows

```powershell
git clone URL_DEL_REPOSITORIO
cd econodo-digital
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

El computador necesita Python 3.10 o posterior. La primera ejecución instala las dependencias; las siguientes reutilizan el entorno local. Después, las actualizaciones se reciben con `git pull` mientras el servidor esté detenido.

### Carcasa interactiva en la portada

El hero incluye una representación ligera de la carcasa del archivo `EcoNodo_estudio.blend` del Avance 2. Se dibuja directamente con HTML y CSS 3D: caja blanca vertical de proporción aproximada **110 × 70 × 150 mm**, tapa frontal con cuatro tornillos, LED, logo y QR; ventana óptica superior para BH1750, lateral con perforación circular y ventilación del DHT22, y paso USB/PG7 inferior. El ESP32 está indicado como componente **interno**, no como pieza expuesta. El servidor local se muestra por separado porque está en el computador.

- Mueve el cursor sobre la caja para una rotación suave. En móvil, arrastra horizontalmente sobre la ilustración; el ángulo es limitado para conservar la lectura de las caras.
- Selecciona los puntos `+` con mouse, tacto o teclado (`Tab`, `Enter`/`Espacio`) para leer la función de DHT22, BH1750, ESP32, LED y servidor.
- Los valores de °C, % y lux usan la **misma lectura actual** que las tarjetas. Sin datos muestran `—`; ante fallo de conexión muestran `Sin lectura`. Con datos atrasados mantienen los valores y una advertencia.
- **Pausar movimiento** detiene los pulsos y la rotación. Si el sistema tiene `prefers-reduced-motion`, el movimiento arranca reducido y el control lo indica.
- El QR del frente es una miniatura de la URL que genera la página `/acceso`. Antes de usarlo físicamente, configura la IP definitiva y comprueba el acceso desde un segundo equipo.
- Los nombres DHT22, BH1750, ESP32, LED y Servidor son controles equivalentes a los puntos `+`, con al menos 44 px de alto. También puedes enfocar la carcasa y girarla con las flechas; `Inicio` restablece el ángulo.
- Rayos de luz, niebla, calidez y rutas discontinuas rodean el dispositivo. **Son metáforas visuales, no nuevas piezas, mediciones adicionales ni pronósticos.** Sus intensidades son moderadas y acotadas. En ausencia de lecturas vuelven a un ambiente neutro; la carcasa y el ambiente siguen disponibles con la API caída.
- Al seleccionar componentes se resaltan trayectorias; una lectura distinta produce un pulso breve. Los enlaces inferiores conectan el nodo con el diario y las gráficas. La pausa abarca todos estos efectos y se recuerda en el navegador. Fuera de pantalla dejan de animarse para ahorrar trabajo.
- **Recorrer el dato** activa una secuencia guiada de cinco pasos: sensores, ESP32, Wi-Fi, servidor y relato. Cada paso puede seleccionarse manualmente; al pausar el movimiento o solicitar movimiento reducido, el avance automático se detiene sin ocultar la explicación.

### Ritmo del periodo y diario visual

La sección de datos incluye una franja llamada **Ritmo del periodo**, calculada en el navegador con el mismo historial que alimenta las gráficas. Cada columna resume un tramo de tiempo (nominalmente cinco minutos, hasta 40 columnas); los tramos sin lecturas se dibujan como hueco discontinuo. La altura sigue la iluminancia y el color mezcla temperatura y humedad, **normalizadas dentro del periodo elegido**: sirve para ver la forma del día, no para comparar un periodo con otro, y el pie de la franja indica los valores mínimo y máximo de esa escala. Es una síntesis descriptiva, no una escala de calidad ambiental.

Las gráficas usan un eje de tiempo proporcional y no suavizan: una pausa de más de 20 minutos corta la línea y se anuncia en una nota, porque en ese tramo no hay observaciones. Las horas se muestran en la zona horaria configurada en `config.json` (`timezone`), no en la del navegador.

Los capítulos del diario incorporan una huella visual, un dato de apoyo (temperatura de apertura, cambio entre extremos, humedad media o luz media) y la línea **«Se apoya en: …»**, que dice qué lecturas sostienen la frase. Son campos aditivos en `GET /api/diario` (`tone`, `signal_label`, `signal_value`, `evidence`): no modifican el `POST /api/lecturas`, el firmware ni el almacenamiento.

### Observatorio vivo

La ruta `/experiencia` ofrece una reproducción inmersiva e independiente del dashboard. Utiliza exclusivamente `GET /api/historial` y permite recorrer **hoy** o las **últimas 24 horas** mediante reproducción automática o una línea temporal manual. El paisaje abstracto cambia su luz, paleta y niebla a partir de iluminancia, temperatura y humedad. Si hoy está vacío, intenta las últimas 24 horas antes de presentar el estado sin datos.

La experiencia protege su presentación antes de usar datos reales:

- Rechaza en el navegador entradas no numéricas, fechas inválidas y valores fuera del mismo contrato que valida el servidor.
- Conserva y muestra el número exacto de una lectura válida aunque resulte extrema.
- Limita solamente su efecto gráfico a −5…45 °C, 5…95 % y 0…30 000 lx. Estos intervalos son escalas visuales, no nuevos criterios de aceptación ni alarmas ambientales.
- Usa transformación logarítmica para la luz y variables CSS siempre acotadas entre 0 y 1. Una lectura alta nunca puede producir tamaños, opacidades o colores inválidos.
- Resume historiales extensos a un máximo de 500 momentos, preservando primero y último, sin modificar el CSV ni la base de datos.
- Mantiene estados explícitos para carga, ausencia de lecturas, timeout, error de red y movimiento reducido.

Esta ruta no cambia `POST /api/lecturas`, la frecuencia de cinco minutos, SQLite ni el firmware. Puede evolucionar o desactivarse sin afectar la captura física.

### Sistema visual: herbario de señales

La interfaz se presenta como un **herbario de señales del lugar**: cada lectura es una hoja archivada con su fecha, su unidad y su procedencia. Combina tres dimensiones: *editorial* (titulares expresivos, folios numerados, ritmo entre páginas claras y una sección nocturna), *ambiental* (ilustración botánica original, papel, capas y luz) e *instrumental* (cifras con unidad, reglas de escala, sellos de antigüedad, fecha, procedencia y estado en texto).

Los motivos son SVG y CSS locales y originales (`templates/_motivos.html`, `static/img/`); no dependen de imágenes externas, servicios de diseño, tipografías remotas ni bibliotecas nuevas. Son decorativos, están ocultos a lectores de pantalla y fuera del flujo de datos: cambiarlos no altera los endpoints, las validaciones, SQLite, el firmware ni el tratamiento defensivo de valores extremos. Cada variable conserva un color propio en tarjetas, gráficas, leyendas y ritmo (arcilla para temperatura, verde azulado para humedad, citrino para luz); ninguno funciona como alarma. **No hay coordenadas geográficas ni orientación**: la tira superior solo nombra el folio y el lugar configurado.

Los tokens (color, tipografía, espacio, movimiento) viven en `static/css/tokens.css` y los comparten las tres rutas. Reglas, componentes, criterios de accesibilidad y cómo modificar el sistema: [SISTEMA_VISUAL.md](SISTEMA_VISUAL.md). Resumen de cambios y archivos: [CAMBIOS.md](CAMBIOS.md).

### Independencia de la escena

La geometría está siempre en `templates/index.html`; incluso si falla JavaScript, queda una ilustración visible. El script local `static/js/carcasa.js` se ejecuta inmediatamente después del HTML de la escena, antes de los scripts diferidos Chart.js y `app.js`.

- `initCarcasa3D()` inicializa una sola vez la interacción. No consulta la API.
- `updateCarcasa3DState()` cambia estado, LED y avisos.
- `updateCarcasa3DReadings()` cambia únicamente valores e intensidades ambientales.
- `refresh()` en `app.js` consulta los endpoints existentes y comunica el resultado de `/api/estado` mediante el evento local `econodo:state`. No conoce ni reemplaza el árbol HTML de la carcasa.

Estado actual, historial y diario se procesan de forma independiente. Las consultas tienen un límite de ocho segundos; al cambiar de periodo se cancelan las anteriores. Una respuesta antigua no puede sobrescribir el periodo seleccionado. Una gráfica fallida conserva acceso a tabla y CSV. La actualización automática continúa cada 30 segundos.

Flask vuelve a comprobar las plantillas modificadas y entrega HTML sin caché persistente. Esto evita combinar una portada antigua sin carcasa con JavaScript nuevo. **Reinicia el servidor una vez después de instalar esta versión**, porque los cambios Python necesitan recargarse.

La representación es una traducción visual para navegador: respeta la disposición y las proporciones generales del `.blend`, pero omite tornillería interna, cableado y geometría detallada de piezas ocultas. No sustituye el plano ni valida el montaje físico. No requiere Blender, modelo externo, CDN ni otra dependencia web.

La correspondencia entre los objetos del archivo original y las piezas de la escena está documentada en [REFERENCIA_CARCASA.md](REFERENCIA_CARCASA.md).

Para revisar estados: inicia el modo real sin nodo para ver **sin lecturas**; abre la demo para ver **datos simulados**; detén la fuente de lecturas durante más de 12 minutos para ver **datos atrasados**; detén el servidor mientras la página sigue abierta y pulsa un filtro temporal para ver **error de conexión**. En móvil y teclado, revisa que los hotspots, el control de movimiento y las secciones restantes sigan disponibles.

### Explorar la recepción en vivo, sin hardware

Con el servidor de demostración abierto, usa una segunda terminal:

```bash
python tools/simular_nodo.py
```

En Windows, si `python` no apunta al entorno del proyecto:

```powershell
.\.venv\Scripts\python.exe tools\simular_nodo.py
```

Para repetir cada cinco minutos: `python tools/simular_nodo.py --cada 300`. La página se actualiza cada 30 segundos. El simulador comprueba que el servidor esté en modo demo y se niega a insertar datos ficticios en la base real.

El cargador completa las últimas 24 horas cuando reinicias la demo; no es un simulador continuo. Un fallo al crear el entorno, instalar dependencias o sembrar datos detiene el arranque. Si usas una instalación específica de Python, define `ECONODO_PYTHON` con la ruta de su ejecutable antes del primer arranque.

Si aparece **«El puerto 5000 ya está ocupado»**, vuelve a la terminal del servidor anterior y presiona `Ctrl+C`. Si no puedes localizarla, crea `config.local.json` con `{"port":5001,"public_url":"http://127.0.0.1:5001"}` y abre esa URL. Guarda el archivo como **UTF-8 sin BOM**: `Set-Content -Encoding utf8` de Windows PowerShell 5.1 añade una marca BOM y el servidor no arranca (error de JSON al leer la configuración); con VS Code o con `[IO.File]::WriteAllText(...)` no ocurre. No hace falta cerrar procesos desconocidos. Para el simulador, añade `--url http://127.0.0.1:5001/api/lecturas`.

### Comprobar la versión corregida

1. Inicia la demo y abre `http://127.0.0.1:5000`. Comprueba caja blanca, cinco componentes, tres métricas, capítulos, gráficas, tabla y CSV.
2. Ejecuta el simulador y espera hasta 30 segundos. Comprueba que los valores de la escena coinciden con las tarjetas.
3. Cambia por los cinco periodos y selecciona un hotspot. Su selección y la carcasa deben persistir durante las actualizaciones.
4. Pausa el movimiento; gira con teclado; prueba 360 px de ancho y activa movimiento reducido en el sistema.
5. Para probar estados sin tocar datos reales ni demo, abre otra terminal:

```powershell
.\.venv\Scripts\python.exe tools\vista_prueba.py --estado error --puerto 5001
```

En Linux: `.venv/bin/python tools/vista_prueba.py --estado error --puerto 5001`.
Abre `http://127.0.0.1:5001`. Repite cambiando `error` por `vacio`, `atrasado`, `lento` o `reciente`, deteniendo cada servidor de prueba con `Ctrl+C` antes del siguiente. Este banco usa una base temporal y no añade endpoints al servidor normal. En `lento`, la carcasa debe aparecer inmediatamente y el aviso de error después de ocho segundos.

Pruebas automatizadas, sin dependencias adicionales para ejecutarlas:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_api.py -v
node tests/scene.test.cjs
node tests/experience.test.cjs
node --check static/js/app.js; node --check static/js/carcasa.js; node --check static/js/experience.js
```

Node es opcional y se usa solamente para las pruebas de JavaScript; **no es necesario para ejecutar EcoNodo**. Resultados y límites de la revisión: [VERIFICACION.md](VERIFICACION.md).

## Iniciar con datos reales

Detén el servidor demo con `Ctrl+C` y ejecuta:

**Windows**

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

**Debian / Linux**

```bash
bash iniciar.sh
```

La base real se crea automáticamente en `data/econodo.sqlite3`. Comenzará vacía; la interfaz explica que aún no hay lecturas. Jamás se copian las ficticias a esa base.

> Solo debe estar activo uno de los dos modos a la vez en el puerto 5000.

## Preparación de la red local

1. En el computador servidor, configura una red Wi-Fi/hotspot **de 2,4 GHz, WPA2** y anota la IP privada que tendrá de forma estable durante el piloto. Conecta el computador y el ESP32 a la misma red.
2. El servidor escucha en `0.0.0.0:5000` (todas las interfaces). Si hay firewall, permite TCP 5000 únicamente en la red privada usada para el piloto.
3. Crea `config.local.json` junto a `config.json` para tus valores propios, por ejemplo:

```json
{
  "site_name": "Jardín de la biblioteca",
  "public_url": "http://192.168.1.100:5000",
  "node_key": "una-clave-larga-para-el-piloto"
}
```

4. Reinicia el servidor. Abre `http://IP_DEL_SERVIDOR:5000` desde **otro dispositivo** conectado a esa misma red.
5. Abre `/acceso`: contiene URL y QR para imprimir. Solo imprímelo después de comprobar que abre desde otro dispositivo. El QR **no conecta al Wi-Fi**; los visitantes deben unirse antes a la red.

**¿Visitantes fuera del hotspot o QR impreso fijo?** Ver [PUBLICAR_INTERNET.md](PUBLICAR_INTERNET.md): `publicar.ps1` publica una dirección HTTPS fija de solo lectura con Tailscale Funnel.

`config.local.json` se excluye de Git. `node_key` es opcional para explorar localmente, pero conviene configurarla para el piloto: el ESP32 enviará el mismo valor en `X-EcoNodo-Key`. El acceso de lectura al sitio sigue sujeto al control de la red WPA2. Este servidor HTTP está pensado para una LAN controlada, no para exponerse directamente a internet.

## Integrar la carcasa y el nodo más adelante

El firmware de partida está en `firmware/EcoNodo/`. En Arduino IDE, abre `EcoNodo.ino`, instala las librerías **DHT sensor library** de Adafruit (y **Adafruit Unified Sensor**, dependencia de esa librería) y **BH1750** de Christopher Laws, y selecciona la placa ESP32 DevKit V1 correspondiente.

1. Copia `firmware/EcoNodo/config.h` a `config.local.h` en la misma carpeta y reemplaza SSID, contraseña, IP/URL del servidor, `NODE_KEY` y `NODE_ID`. No incluyas `localhost` en `SERVER_URL`: en el ESP32 apuntaría al propio nodo.
2. Mantén el cableado fijado en el Avance 2: DHT22 datos → GPIO 4 (pull-up de 4,7 kΩ a 3,3 V); BH1750 SDA → GPIO 21, SCL → GPIO 22, dirección I²C 0x23; LED → GPIO 18 con resistencia de 220 Ω. Alimenta el ESP32 por USB 5 V; los sensores a 3,3 V. Comprueba el pinout de **los módulos concretos comprados** antes de energizar.
3. El nodo envía inmediatamente al iniciar y después cada 10 s. Un destello del LED significa POST aceptado (HTTP 201); dos destellos significan lectura inválida, pérdida de Wi-Fi o fallo de envío. El monitor serie a 115200 baudios muestra el código HTTP.
4. El servidor pone la fecha y hora al **recibir** cada lectura. El nodo no necesita reloj RTC, sincronización NTP ni almacenamiento de historial.
5. En la carcasa, separa físicamente el DHT22 del calor del ESP32 y dale ventilación protegida. Sitúa el BH1750 detrás de la ventana transparente sin apuntarlo directamente al sol; el material de esa ventana puede atenuar la luz y debe anotarse al interpretar los lux.
6. Compara varias lecturas reales en el monitor serie, el dashboard y el CSV. Confirma estabilidad durante una jornada antes de fijar el QR.

La elección de **humedad relativa** aprovecha la salida del mismo DHT22: no añade sensor, cable, perforación ni consumo de instalación relevante. La interpretación es descriptiva; no hay alertas ecológicas ni conclusiones causales automáticas.

Para el contrato HTTP exacto, consulta [CONTRATO_API.md](CONTRATO_API.md). Para la secuencia restante del proyecto, consulta [INTEGRACION_FISICA.md](INTEGRACION_FISICA.md).

## Qué ofrece la página

- Estado actual con hora de la última recepción y aviso si pasan más de 12 minutos sin datos.
- Tres series temporales con filtros de 1 hora, 6 horas, hoy, 24 horas y 7 días.
- Mínimo, máximo y promedio para cada variable en el periodo elegido.
- Diario de cuatro capítulos generado de forma determinista con datos del mismo periodo. Cuando falta información, reconoce expresamente el límite.
- Últimas ocho filas del periodo y CSV con horas local y UTC.
- Página `/acceso` con QR para la URL del servidor.
- Representación interactiva de la carcasa del Avance 2, con hotspots y valores actuales.
- Observatorio vivo con reproducción temporal y paisaje ambiental derivado del historial.
- Diseño adaptable, revisado sin desplazamiento horizontal de 320 a 1440 px; recursos visuales locales; sin cuentas ni servicios de terceros para consultar.

## Estructura

| Ruta | Función |
| --- | --- |
| `app.py` | API, validación, servidor de horas y páginas |
| `econodo/storage.py` | SQLite |
| `econodo/narrative.py` | Capítulos basados en lecturas |
| `templates/`, `static/` | Experiencia web, motivos SVG (`_motivos.html`, `static/img/`) y Chart.js incluido |
| `static/css/tokens.css` | Tokens y base compartidos; `styles.css` (portada y acceso) y `experience.css` (observatorio) los usan |
| `SISTEMA_VISUAL.md`, `CAMBIOS.md` | Sistema visual y resumen de cambios de esta versión |
| `entregables/capturas/` | Capturas reales de escritorio, tablet, móvil y estados |
| `tools/cargar_demo.py` | Historial ficticio aislado |
| `tools/simular_nodo.py` | POST del mismo contrato, solo a demo |
| `tools/vista_prueba.py` | Estados aislados para comprobación manual |
| `static/js/carcasa.js` | Escena persistente, interacción y ambiente |
| `tests/` | Regresión del contrato, del relato y del ciclo de vida de la escena y del observatorio |
| `firmware/EcoNodo/` | Sketch y configuración de partida del ESP32 |
| `data/`, `demo_data/` | Bases creadas al ejecutar; no forman parte del ZIP |

## Licencias y datos

El código y los gráficos originales de EcoNodo se entregan bajo MIT ([LICENSE](LICENSE)). Chart.js se incluye localmente con su licencia MIT en `static/vendor/CHART_LICENSE.md`. Dependencias y atribuciones: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Los datos reales son del equipo del proyecto: respalda `data/econodo.sqlite3` con el servidor detenido y conserva los CSV del piloto. La base demo nunca es evidencia experimental.
