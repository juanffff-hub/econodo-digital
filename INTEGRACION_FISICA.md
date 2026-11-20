# Ruta de integración física, cuatro semanas

> **Actualización del prototipo operativo:** el hardware ya mide cada 10 segundos. Para conectar hoy el Windows 11 (10.218.192.22), el ESP32, los celulares y el QR, seguir [CONECTAR_PROTOTIPO.md](CONECTAR_PROTOTIPO.md). El cronograma siguiente conserva la planificación original, cuya frecuencia de cinco minutos ya no describe este montaje.

Este documento separa las decisiones ya cerradas de lo que depende de la compra, fabricación y prueba del nodo. El apartado digital puede presentarse y revisarse desde hoy mediante la demostración.

## Semana 1 — Cerrar la interfaz y adquirir componentes

- Abrir este proyecto, revisar la demo en computador y celular (mínimo 360 px), aprobar el texto narrativo y el aspecto visual.
- Congelar el JSON del `POST /api/lecturas` descrito en `CONTRATO_API.md`. El servidor ya lo implementa.
- Definir la zona exacta a observar, un nombre breve para la página y el lugar bajo techo del portátil.
- Adquirir ESP32 DevKit V1, DHT22, BH1750, LED, resistencias, cables, fuente USB, caja, prensaestopa y ventana transparente según el presupuesto del Avance 2. Confirmar fichas y pinout reales de cada módulo.
- Preparar la red 2,4 GHz y reservar IP del servidor. Registrar SSID, IP y clave fuera del repositorio.

**Salida:** página demo aprobada, materiales comprobados, contrato estable y red definida.

## Semana 2 — Nodo abierto, sin carcasa

- Montar en mesa el circuito con alimentación USB de 5 V y sensores a 3,3 V.
- Cargar el sketch, revisar I²C 0x23, lecturas DHT22, LED y respuesta HTTP 201.
- Comparar serie ↔ dashboard ↔ CSV. Revisar los rangos y la frecuencia de cinco minutos.
- Dejar varias horas funcionando y observar pérdidas de Wi-Fi o lecturas inválidas. Ajustar solo conexión o ubicación del sensor, sin cambiar el contrato.

**Salida:** nodo y servidor funcionales con datos reales en `data/`.

## Semana 3 — Carcasa y red de campo

- Ensayar posición del DHT22 en ventilación protegida, lejos del calor del ESP32; BH1750 bajo la ventana, sin sol directo; cable USB con prensaestopa.
- Verificar que la caja cierra sin forzar conectores y que la antena del ESP32 mantiene señal.
- Repetir lectura, envío y consulta desde varios celulares en el punto definitivo.
- Observar si la ventana altera los lux y documentar esa limitación. Comprobar que la carcasa no calienta el DHT22 de forma evidente.

**Salida:** equipo cerrado y accesible en la red local.

## Semana 4 — Operación y entrega

- Operar al menos una jornada, verificar que el estado no quede atrasado y revisar huecos de datos.
- Abrir `/acceso` desde un segundo dispositivo; imprimir el QR solo tras confirmar la URL/IP fija y la red.
- Guardar CSV y una copia de `data/econodo.sqlite3`; capturar evidencia del dashboard, del circuito y de la carcasa.
- Documentar ubicación, fecha, red, materiales, incidencias y límites de interpretación. La demostración ficticia nunca reemplaza esta evidencia.

**Salida:** circuito y dashboard conectados, historial real, QR válido y material de sustentación.

## Decisiones que evitan trabajo físico adicional

- La humedad se obtiene del DHT22 ya previsto. No requiere otro sensor.
- El computador fecha, almacena y narra; el nodo solo mide y envía. No hay RTC, SD, pantalla, botones ni sonido físico.
- Toda interacción está en el teléfono o PC del visitante. El LED existente solo indica éxito/fallo de envío.
- El QR codifica una URL verificada; no necesita módulo ni programación en la caja.
- La interfaz web puede evolucionar visualmente sin alterar cables o firmware mientras se mantenga el contrato JSON.
- El observatorio inmersivo reproduce el historial ya guardado. Sus límites visuales son defensivos y no cambian los rangos de aceptación del sensor ni descartan datos de SQLite.

## Pendiente de comprobación cuando exista el hardware

La compilación del sketch para la versión exacta del core ESP32 y de las librerías elegidas, la dirección I²C real, el pinout de los módulos, la ventilación y las lecturas con la ventana montada solo pueden cerrarse con los componentes físicos. El código entregado es una base concreta y no una medición ya validada.
