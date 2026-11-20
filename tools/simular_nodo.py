"""Simula el mismo POST que hará el ESP32; útil antes de tener carcasa."""

import argparse
import json
import math
import time
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def reading():
    now = datetime.now()
    hour = now.hour + now.minute / 60
    daylight = max(0.0, math.sin(math.pi * (hour - 6) / 12))
    pulse = math.sin(time.time() / 330)
    return {
        "node_id": "simulador-1",
        "temperature_c": round(19 + 5 * daylight + .6 * pulse, 2),
        "humidity_pct": round(78 - 18 * daylight - 2 * pulse, 2),
        "illuminance_lux": round(max(0, 7 + 1900 * daylight ** 1.4 + 65 * pulse), 2),
    }


def main():
    parser = argparse.ArgumentParser(description="Envía lecturas ficticias a EcoNodo. Solo debe usarse con el servidor en modo demo.")
    parser.add_argument("--url", default="http://127.0.0.1:5000/api/lecturas", help="URL completa del endpoint")
    parser.add_argument("--clave", default="", help="Valor de X-EcoNodo-Key si el servidor usa clave")
    parser.add_argument("--cada", type=int, default=0, help="Segundos entre envíos; 0 envía una sola lectura")
    args = parser.parse_args()
    if args.cada < 0:
        parser.error("--cada no puede ser negativo")
    parsed = urlsplit(args.url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    try:
        with urlopen(f"{origin}/api/configuracion", timeout=8) as response:
            server_config = json.load(response)
    except (HTTPError, URLError, ValueError) as error:
        parser.error(f"No se pudo comprobar el modo del servidor: {error}")
    if not server_config.get("demo"):
        parser.error("El simulador solo puede enviar datos a un servidor en modo demostración.")
    while True:
        payload = reading()
        headers = {"Content-Type": "application/json"}
        if args.clave:
            headers["X-EcoNodo-Key"] = args.clave
        request = Request(args.url, json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        try:
            with urlopen(request, timeout=8) as response:
                print(f"{response.status} · lectura ficticia enviada: {payload}")
        except (HTTPError, URLError) as error:
            print(f"No se pudo enviar la lectura: {error}")
            if not args.cada:
                raise SystemExit(1)
        if not args.cada:
            break
        time.sleep(args.cada)


if __name__ == "__main__":
    main()
