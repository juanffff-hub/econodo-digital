# Publicar EcoNodo en internet (QR fijo)

Objetivo: que cualquier persona escanee un QR **impreso** y vea las mediciones en vivo desde sus datos móviles o cualquier Wi-Fi, sin unirse al hotspot. La medición no cambia: el ESP32 sigue alimentado por USB-C en el PC, enviando cada 10 s, y el PC sigue ejecutando `iniciar.ps1`.

## Cómo funciona

```
ESP32 ──Wi-Fi hotspot──▶ PC :5000  (igual que antes: ESP32 y red local)
                          PC :5080  (solo 127.0.0.1, solo lectura)
                             ▲
Visitantes ──internet──▶ Tailscale Funnel ── https://<equipo>.<red>.ts.net  (dirección fija)
```

- **Tailscale Funnel** (gratis, plan personal) abre un túnel saliente desde el PC. No hay que abrir puertos, tocar el firewall ni conocer la IP del hotspot: la dirección `https://….ts.net` es **siempre la misma**, cambie o no la IP. Por eso el QR se puede imprimir.
- `run_server.py` abre un segundo puerto, `127.0.0.1:5080`, que es el único que se publica. Es de **solo lectura**: un visitante de internet no puede añadir ni borrar lecturas (HTTP 403). El puerto 5000 sigue igual para el ESP32 y los celulares del hotspot.
- Las respuestas JSON, HTML, CSS y JS se envían comprimidas (gzip). El historial de un día completo pasa de ~1,7 MB a ~180 KB.

## Pasos (una sola vez)

1. Instalar Tailscale: `winget install --id Tailscale.Tailscale` (o desde tailscale.com/download/windows). Abrir otra terminal.
2. En la carpeta del proyecto:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\publicar.ps1
   ```

   - Si no hay sesión, se abre el navegador para entrar con una cuenta (Google, Microsoft, GitHub…).
   - La primera vez, Tailscale imprime un enlace para **habilitar HTTPS y Funnel** en la cuenta: abrirlo y aceptar.
   - El script guarda la dirección en `config.local.json` como `public_url` (UTF-8 sin BOM).
3. Reiniciar `iniciar.ps1`. La terminal mostrará `Internet (cualquier red): https://…ts.net`.
4. Abrir `https://…ts.net/acceso` **con datos móviles** (Wi-Fi apagado) y comprobar. Ahora sí imprimir ese QR.

Funnel queda activo en segundo plano, también tras reiniciar el PC. Los días siguientes solo hace falta lo de siempre: hotspot → PC → `iniciar.ps1`. Para apagarlo: `.\publicar.ps1 -Desactivar`.

**Nombre de la dirección:** se compone del nombre del equipo y del nombre de la red Tailscale (`tailXXXX.ts.net`). Ambos pueden cambiarse **antes de imprimir** desde el panel de Tailscale (renombrar la máquina, y en *DNS* elegir un nombre de red). Después, no cambiarlos.

## Lo que hay que saber

- **El PC es el servidor.** Si el PC se apaga, suspende o pierde internet, la página muestra «Sin conexión». El hotspot ahora necesita **datos móviles** para los visitantes externos.
- **Consumo de datos del hotspot.** Cada visitante con la página abierta descarga el historial del periodo cada `refresh_interval_seconds` (5 s). Con un día completo son ~180 KB por consulta, ~2 MB/min por visitante, que salen por el plan de datos del hotspot. Con muchas personas a la vez conviene subir el intervalo en `config.local.json`, por ejemplo `"refresh_interval_seconds": 15`.
- **Privacidad.** La dirección es pública: cualquiera con el enlace ve las mediciones y descarga el CSV. No hay datos personales, pero el nombre del sitio (`site_name`) también es visible.
- El QR del hotspot ya no es necesario para los visitantes; sigue sirviendo para el ESP32.

## Opcional: que el ESP32 tampoco dependa de la IP

Hoy el sketch envía a `http://IP_DEL_PC:5000/api/lecturas` y hay que actualizar esa IP si el hotspot la cambia. Con Funnel activo, el ESP32 puede enviar a la dirección fija por HTTPS (necesita internet en el hotspot):

1. En `config.local.json`, añadir `"node_key": "una-clave-larga-y-unica"`. El puerto público **solo** acepta lecturas con esa clave; sin clave las rechaza todas.
2. En el sketch:

```cpp
#include <WiFiClientSecure.h>
const char* SERVER_URL = "https://<equipo>.<red>.ts.net/api/lecturas";
const char* NODE_KEY   = "una-clave-larga-y-unica";

// Al enviar:
WiFiClientSecure client;
client.setInsecure();               // sin validar certificado: suficiente para este piloto
HTTPClient http;
http.begin(client, SERVER_URL);
http.addHeader("Content-Type", "application/json");
http.addHeader("X-EcoNodo-Key", NODE_KEY);
int code = http.POST(payload);      // 201 = guardada
```

Con esto nunca más hay que tocar `SERVER_URL`. Si falta internet en el hotspot, las lecturas no llegan (con la IP local sí llegarían): elegir una u otra según la presentación.
