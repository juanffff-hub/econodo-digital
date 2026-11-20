# Conectar el prototipo hoy — Windows 11 y hotspot

Esta es la guía operativa del montaje que ya funciona: ESP32, DHT22 y BH1750; muestreo **cada 10 segundos**. Conserva el sketch y el cableado que ya están probados. El firmware de `firmware/` es una referencia anterior y no reemplaza automáticamente ese sketch.

## Direcciones del computador definitivo

Confirmadas a partir de su captura de `ipconfig` (Wi-Fi 2):

- IPv4: **10.218.192.22**. La puerta de enlace 10.218.192.208 pertenece al hotspot, no al servidor.
- `SERVER_URL` del ESP32: **http://10.218.192.22:5000/api/lecturas**
- Página de los visitantes: **http://10.218.192.22:5000**
- QR y hoja de acceso: **http://10.218.192.22:5000/acceso**
- Observatorio: **http://10.218.192.22:5000/experiencia**

Estas direcciones solo valen mientras ese PC conserve esa IPv4. Tras reconectar el hotspot, comprobar `ipconfig`; si cambia, actualizar `SERVER_URL` y regenerar el QR. Mantener PC y hotspot encendidos durante la presentación.

## 1. Llevar esta versión al otro PC

1. Copiar el ZIP actualizado y extraerlo completo. Abrir la carpeta **econodo-digital** que contiene `app.py`, `requirements.txt` e `iniciar.ps1`.
2. Instalar Python **3.10 o posterior** si no está instalado (recomendado 3.11 o posterior). No copiar `.venv` desde otro PC: el script crea un entorno para este equipo.
3. Conectar el computador y el ESP32 al **mismo hotspot de 2,4 GHz**. La primera instalación de dependencias requiere internet; la página y sus recursos se sirven después en la red local.
4. Abrir PowerShell en esa carpeta y ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

Dejar esa terminal abierta. Debe indicar **Modo: REAL**. No ejecutar `iniciar_demo.ps1` para recibir mediciones reales. Si hay una demo en el puerto 5000, detenerla con Ctrl+C en su propia terminal primero.

La pantalla puede estar vacía inicialmente: es correcto hasta que llegue la primera medición.

## 2. Configurar el sketch que ya mide

Cambiar en SU sketch, manteniendo los pines y el intervalo actual de 10 segundos:

```cpp
const bool USAR_WIFI = true;
const char* WIFI_SSID = "NOMBRE_DEL_HOTSPOT";
const char* WIFI_PASSWORD = "CLAVE_DEL_HOTSPOT";
const char* SERVER_URL = "http://10.218.192.22:5000/api/lecturas";
```

Usar los nombres exactos de constantes que tenga ese sketch. No publicar la contraseña ni incluirla en los archivos que se comparten. Compilar y cargar desde el Arduino IDE del computador conectado al ESP32.

El envío debe ser un **HTTP POST** con `Content-Type: application/json` y su JSON actual:

```json
{"nodo":"econodo-01","temperatura":26.9,"humedad":78.2,"lux":57,"lux_saturado":false}
```

El servidor ya acepta estos nombres y conserva también el contrato anterior en inglés. El monitor serie a **115200 baudios** debe mostrar **HTTP 201** por cada envío aceptado. Ver solo las cifras/JSON no prueba que el servidor los haya recibido: revisar el código de respuesta HTTP.

La configuración incluida no requiere clave de nodo. Si se ha añadido `node_key` en `config.local.json`, el sketch debe enviar esa misma clave en la cabecera `X-EcoNodo-Key`; no se desactiva una clave ya configurada.

## 3. Verificar los datos y los celulares

En otra terminal del computador servidor:

```powershell
powershell -ExecutionPolicy Bypass -File .\comprobar_conexion.ps1
```

La comprobación es de solo lectura: indica modo, direcciones candidatas, última lectura, nodo, edad y número de muestras. No envía datos de prueba al historial real.

- Abrir **http://10.218.192.22:5000** en el computador. Comparar temperatura, humedad y lux con el monitor serie.
- Esperar varios envíos: el registro debe crecer y las nuevas cifras aparecer automáticamente. La interfaz consulta cada **5 s**; si una petición tarda, espera a que termine.
- Conectar **un segundo celular** al mismo hotspot y abrir esa misma URL. No usar `localhost` ni `127.0.0.1` desde el celular o el ESP32.
- Verificar portada, gráficas, diario, CSV y observatorio. Este último actualiza el historial mientras está en pausa; conserva el momento elegido y no interrumpe una reproducción. Si estaba mostrando la última muestra, sigue las nuevas.
- Más de **60 s sin muestras válidas** produce “Sin actualización reciente”. Si el servidor se apaga, aparece un error de conexión. Al reconectar, vuelve a recibir datos.
- Las muestras durante una desconexión no se recuperan automáticamente: el servidor fecha la recepción; no se ha añadido una cola de almacenamiento al firmware.

## 4. Si el PC abre la página y el celular o el ESP32 no

Comprobar en este orden:

1. Misma red y dirección IPv4 actual del computador servidor.
2. Servidor en modo REAL, terminal abierta y `host: "0.0.0.0"`, puerto 5000.
3. Windows 11: usar perfil de red **Privado** para este hotspot de confianza y permitir la aplicación Python en redes privadas si Windows lo solicita.
4. Si sigue bloqueado, un administrador puede crear una regla específica. No desactivar el firewall. Ejecutar en PowerShell como administrador **solo en el computador servidor**:

```powershell
New-NetFirewallRule -DisplayName "EcoNodo TCP 5000 - red local" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5000 -Profile Private -RemoteAddress LocalSubnet
```

5. Algunos hotspots aíslan dispositivos conectados. Si persiste el problema con el firewall y direcciones correctos, probar un router de 2,4 GHz u otro hotspot que permita comunicación entre clientes. Volver a anotar la IP.

El teléfono que comparte el hotspot puede comportarse distinto de otro teléfono conectado: la prueba decisiva es con un segundo dispositivo.

| Respuesta / síntoma | Acción |
| --- | --- |
| HTTP 201 | Muestra guardada; revisar contador y cifras de la página |
| HTTP 400 | Leer el cuerpo de error: JSON, valores o luz saturada |
| HTTP 401 | Falta o no coincide `X-EcoNodo-Key` |
| HTTP 404 | Confirmar ruta exacta `/api/lecturas` |
| HTTP 405 | Confirmar método POST |
| Timeout / código negativo en ESP32 | Revisar Wi-Fi, IP, servidor y firewall |
| Puerto ocupado | Detener la instancia anterior con Ctrl+C |

## 5. Logo, QR y cierre de la carcasa

Primero probar la página desde el segundo celular. Después abrir **http://10.218.192.22:5000/acceso** y usar **Imprimir esta página**. Esa vista genera el QR para la dirección de red; no imprimir el QR abierto desde `127.0.0.1`.

El QR **no conecta al Wi-Fi** ni contiene su contraseña: indicar al visitante cómo unirse al hotspot antes de escanear. No sustituye una página pública en internet.

Mantener el margen blanco del QR, contraste oscuro sobre blanco y tamaño legible (idealmente al menos 35 mm de lado), y ensayar la lectura con la etiqueta a su tamaño final antes de pegarla. No cubrir la ventana del BH1750, la ventilación del DHT22 ni el LED.

## Protección de las mediciones

Se aceptan temperatura −40…80 °C, humedad 0…100 % y luz 0…65 535 lx, como números finitos. Se rechazan texto, booleanos numéricos, nulos, NaN, infinitos, extremos fuera de contrato y alias duplicados.

`lux_saturado: true` rechaza **la muestra completa** con HTTP 400 y `code: "light_saturated"`. También se omiten temperatura y humedad de ese paquete: el esquema actual requiere tres valores válidos. La última muestra válida queda guardada, y su edad sigue aumentando. La página no muestra todavía un diagnóstico específico de saturación; el motivo se consulta en la respuesta HTTP.

Un valor erróneo pero dentro de esos rangos no puede detectarse solo por software: comparar con las lecturas serie y revisar ubicación/calibración del sensor. Los valores válidos extremos conservan su cifra; solo se limita el efecto visual del paisaje.

A 10 s se reciben aproximadamente **360 lecturas/hora** y **8.640/día**. SQLite y CSV conservan todas; las gráficas dibujan hasta las últimas 5.000 y lo indican; el observatorio resume esas lecturas a hasta 500 momentos. Las estadísticas y el diario usan todo el periodo.

## Qué está comprobado y qué falta físicamente

Las pruebas automatizadas usan bases temporales. Cubren el JSON del prototipo, compatibilidad anterior, rechazo de errores, clave, desconexión, HTTP real local, vistas y contenido de la URL codificada en el QR. No sustituyen la prueba sobre el hotspot definitivo.

Antes de dar el montaje por cerrado: **HTTP 201 en el ESP32 → lectura coincidente en la página → acceso desde otro celular → QR escaneado a tamaño final**. El servidor permanece encendido, sin suspensión, durante la demostración.
