"""Arranque local para varios navegadores en la misma red (y, opcional, en internet)."""

import threading

from waitress import create_server

from app import app, detect_lan_ip, is_public_url, public_readonly


def open_server(application, host, port, threads, setting):
    try:
        return create_server(application, host=host, port=port, threads=threads)
    except OSError as error:
        if error.errno in {48, 98, 10048} or getattr(error, "winerror", None) == 10048:
            raise SystemExit(f"El puerto {port} ya está ocupado. Cierra el servidor anterior con Ctrl+C "
                             f"en su terminal o cambia '{setting}' en config.local.json.") from error
        raise


if __name__ == "__main__":
    settings = app.config["ECONODO_SETTINGS"]
    host, port = settings["host"], int(settings["port"])
    server = open_server(app, host, port, 4, "port")

    # Segundo puerto, solo accesible desde este PC: es el que publica el túnel
    # (publicar.ps1). Comparte base y código, pero no deja escribir sin clave.
    public_port = int(settings.get("public_port") or 0)
    public_server = None
    if public_port:
        public_server = open_server(public_readonly(app, settings), "127.0.0.1", public_port, 8, "public_port")
        threading.Thread(target=public_server.run, name="econodo-publico", daemon=True).start()

    print(f"EcoNodo disponible en http://127.0.0.1:{port}", flush=True)
    lan = detect_lan_ip()
    if lan:
        print(f"Celulares (mismo hotspot): http://{lan}:{port}", flush=True)
        print(f"ESP32 SERVER_URL:          http://{lan}:{port}/api/lecturas", flush=True)
        print(f"QR para imprimir:          http://{lan}:{port}/acceso", flush=True)
    else:
        print("Para otros dispositivos, conecta este PC al hotspot y usa su IP local.", flush=True)
    configured = str(settings.get("public_url", "")).strip().rstrip("/")
    if public_server:
        if configured and is_public_url(configured):
            print(f"Internet (cualquier red):  {configured}", flush=True)
            print(f"QR fijo para imprimir:     {configured}/acceso", flush=True)
        else:
            print(f"Puerto para publicar:      127.0.0.1:{public_port} (ejecuta publicar.ps1 una vez)", flush=True)
    print("Modo:", "DEMOSTRACIÓN" if app.config["ECONODO_DEMO"] else "REAL", flush=True)
    print(f"Muestreo previsto: {settings['reading_interval_seconds']} s | Página: cada {settings['refresh_interval_seconds']} s", flush=True)
    print("En otra terminal, ejecuta comprobar_conexion.ps1 para ver las direcciones del ESP32, celulares y QR.", flush=True)
    server.run()
