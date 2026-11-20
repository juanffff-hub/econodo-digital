# Dependencias y licencias

EcoNodo usa únicamente dependencias de software libre. La instalación inicial de paquetes Python se hace desde PyPI; la consulta del dashboard no llama a CDN ni a servicios externos.

| Componente | Versión fijada | Licencia | Uso |
| --- | --- | --- | --- |
| [Flask](https://pypi.org/project/Flask/) | 3.1.3 | BSD-3-Clause | Servidor y API |
| [Waitress](https://pypi.org/project/waitress/) | 3.0.2 | ZPL 2.1 | Servidor HTTP para varios clientes |
| [qrcode](https://pypi.org/project/qrcode/) | 8.2 | BSD | QR SVG local |
| [tzdata](https://pypi.org/project/tzdata/) | 2026.5, solo Windows | Apache-2.0 | Zona horaria |
| [Chart.js](https://www.chartjs.org/) | 4.5.1 | MIT | Gráficas; archivo incluido en `static/vendor/` |

El sketch está preparado para las librerías externas [DHT sensor library](https://github.com/adafruit/DHT-sensor-library), [Adafruit Unified Sensor](https://github.com/adafruit/Adafruit_Sensor) y [BH1750](https://github.com/claws/BH1750), que se instalan en Arduino IDE cuando se monte el nodo; sus códigos no se incluyen en este ZIP. Consulta sus repositorios y avisos de licencia al instalar.

La licencia íntegra de Chart.js está en [`static/vendor/CHART_LICENSE.md`](static/vendor/CHART_LICENSE.md). Los paquetes Python mantienen sus propios textos y avisos de licencia en el entorno `.venv/` tras instalarse. El código, icono vectorial, ilustración CSS, diseño y textos creados para este paquete se publican bajo la licencia MIT de la raíz del proyecto. No se usan imágenes, tipografías ni sonidos de terceros.
