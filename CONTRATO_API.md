# Contrato entre el nodo y EcoNodo digital

Esta interfaz queda fija antes de construir la carcasa. El ESP32 solo debe enviar tres números y su identificador; todo lo demás lo hace el servidor.

## Ingreso de una lectura

`POST http://IP_DEL_SERVIDOR:5000/api/lecturas`

Encabezados:

```text
Content-Type: application/json
X-EcoNodo-Key: <valor de node_key si se configuró>
```

Cuerpo:

```json
{
  "node_id": "econodo-1",
  "temperature_c": 23.4,
  "humidity_pct": 68.2,
  "illuminance_lux": 1350.0
}
```

Todos los valores deben ser números JSON finitos, no texto. Límites de validación: temperatura −40 a 80 °C, humedad 0 a 100 %, luz 0 a 65 535 lx. `node_id` acepta de 1 a 40 caracteres alfanuméricos, guion o guion bajo. Una lectura válida devuelve HTTP **201** con `id` y `received_at_utc`. Formato erróneo o valor fuera de rango devuelve **400**; clave incorrecta, **401**. No se guarda ninguna lectura inválida.

El firmware no manda `timestamp`: el servidor registra la hora UTC de recepción. Una demora de red afecta esa hora; es importante dejar constancia si el nodo estuvo desconectado. El prototipo actual mide cada **10 segundos**.

### JSON del prototipo actual

También se acepta directamente:

```json
{"nodo":"econodo-01","temperatura":26.9,"humedad":78.2,"lux":57,"lux_saturado":false}
```

Se traduce `nodo → node_id`, `temperatura → temperature_c`, `humedad → humidity_pct` y `lux → illuminance_lux` antes de almacenar. El esquema SQLite, las consultas y el CSV conservan el formato anterior. No enviar ambas variantes de un mismo campo: devuelve 400 con `code: "ambiguous_fields"`.

`lux_saturado` es opcional (false por defecto) y solo acepta booleanos JSON. Si es true, la muestra completa se rechaza con 400 y `code: "light_saturated"`; no se sustituye la luz por cero ni se sobrescribe la última lectura válida. Ver [CONECTAR_PROTOTIPO.md](CONECTAR_PROTOTIPO.md) para el procedimiento operativo.

## Consultas del navegador

| Ruta | Uso |
| --- | --- |
| `GET /api/estado` | Última lectura, edad en segundos y estado `sin_datos`, `actualizado` o `sin_actualizacion` |
| `GET /api/historial?periodo=hoy` | Lecturas ascendentes y estadísticas del periodo |
| `GET /api/diario?periodo=hoy` | Capítulos construidos con esas lecturas |
| `GET /api/exportacion.csv?periodo=hoy` | CSV descargable |
| `GET /api/configuracion` | Solo configuración pública, nunca `node_key` |
| `GET /health` | Disponibilidad local |

Periodos admitidos: `1h`, `6h`, `hoy`, `24h`, `7d`. `hoy` empieza a las 00:00 de la zona horaria configurada (`America/Bogota` de forma predeterminada). La aplicación conserva UTC y entrega además `received_at_local`; por ello las cifras y el diario usan el mismo corte temporal.

## Integridad y funcionamiento

- El servidor separa `data/econodo.sqlite3` de `demo_data/econodo.sqlite3` mediante `ECONODO_DEMO=1`.
- El simulador comprueba `GET /api/configuracion` y se detiene si `demo` es falso.
- La página distingue lectura fresca de lectura atrasada (umbral configurable, 1 min para el muestreo actual de 10 s).
- Los capítulos solo comparan datos disponibles. No declaran causalidad, riesgo ambiental ni evaluación biológica.
- El navegador refresca cada 5 s, sin solapar consultas; el observatorio espera mientras reproduce. Los archivos JS/CSS, incluida Chart.js, se sirven localmente.
