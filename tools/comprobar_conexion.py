"""Diagnóstico de solo lectura para el computador que ejecuta el servidor."""
import ipaddress
import json
import os
import socket
import sys
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def main():
    settings = {"port": 5000, "host": "0.0.0.0", "public_url": "", "node_key": ""}
    for path in (ROOT / "config.json", Path(os.environ.get("ECONODO_CONFIG", ROOT / "config.local.json"))):
        if path.exists():
            settings.update(json.loads(path.read_text(encoding="utf-8-sig")))
    port = int(settings["port"])
    print("ECONODO - COMPROBACION DEL COMPUTADOR SERVIDOR")
    print("Puerto:", port, "| Escucha configurada:", settings["host"])
    print("Clave de nodo:", "configurada (se necesita X-EcoNodo-Key)" if settings["node_key"] else "sin clave para el piloto local")
    candidates = set()
    try:
        for address in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = ipaddress.ip_address(address[4][0])
            if ip.is_private and not ip.is_loopback and not ip.is_link_local:
                candidates.add(str(ip))
    except OSError:
        pass
    print("\nDIRECCIONES CANDIDATAS: elige la IPv4 de Wi-Fi del hotspot (ver ipconfig).")
    for ip in sorted(candidates):
        base = f"http://{ip}:{port}"
        print(f"  ESP32 SERVER_URL: {base}/api/lecturas")
        print(f"  Celulares:        {base}")
        print(f"  QR para imprimir: {base}/acceso")
    if not candidates:
        print("  No se encontro una IPv4 util. Conecta este PC al hotspot y ejecuta ipconfig.")
    if settings["public_url"]:
        print("URL fijada para el QR:", settings["public_url"])
        print("  Comprueba que coincida con la IPv4 actual antes de imprimir.")
    if settings["host"] in {"127.0.0.1", "localhost", "::1"}:
        print("ATENCION: host local. Usa host 0.0.0.0 para aceptar al ESP32 y los celulares.")
    try:
        def read(route):
            with urlopen(f"http://127.0.0.1:{port}{route}", timeout=5) as response:
                return json.load(response)
        health = read("/health")
        state = read("/api/estado")
        print("\nSERVIDOR:", health["status"], "| MODO:", "DEMO" if health["demo"] else "REAL")
        if health["demo"]:
            print("Deten iniciar_demo.ps1 con Ctrl+C y ejecuta iniciar.ps1 para el prototipo.")
        print("Lecturas guardadas:", state["total_readings"], "| Estado:", state["state"])
        if state["latest"]:
            row = state["latest"]
            print("Nodo:", row["node_id"], "| Edad:", state["age_seconds"], "s")
            print("Temperatura:", row["temperature_c"], "C | Humedad:", row["humidity_pct"], "% | Luz:", row["illuminance_lux"], "lx")
        else:
            print("Aun no hay lecturas. Es normal antes del primer POST aceptado.")
    except (URLError, TimeoutError, ValueError, KeyError) as error:
        print("\nNo se pudo verificar el servidor:", error)
        print("Manten iniciar.ps1 abierto en otra terminal y vuelve a ejecutar esta comprobacion.")
        return 1
    print("\nEsta comprobacion no prueba acceso externo: abre la URL desde un segundo celular.")
    print("Primero mismo hotspot; despues escanear QR. Confirma HTTP 201 en el ESP32.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
