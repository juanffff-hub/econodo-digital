"""Arranque local para varios navegadores en la misma red."""

from waitress import create_server

from app import app, detect_lan_ip


if __name__ == "__main__":
    settings = app.config["ECONODO_SETTINGS"]
    host, port = settings["host"], int(settings["port"])
    try:
        server = create_server(app, host=host, port=port, threads=4)
    except OSError as error:
        if error.errno in {48, 98, 10048} or getattr(error, "winerror", None) == 10048:
            raise SystemExit(f"El puerto {port} ya está ocupado. Cierra el servidor anterior con Ctrl+C "
                             "en su terminal o cambia 'port' en config.local.json.") from error
        raise
    print(f"EcoNodo disponible en http://127.0.0.1:{port}", flush=True)
    lan = detect_lan_ip()
    if lan:
        print(f"Celulares (mismo hotspot): http://{lan}:{port}", flush=True)
        print(f"ESP32 SERVER_URL:          http://{lan}:{port}/api/lecturas", flush=True)
        print(f"QR para imprimir:          http://{lan}:{port}/acceso", flush=True)
    else:
        print("Para otros dispositivos, conecta este PC al hotspot y usa su IP local.", flush=True)
    print("Modo:", "DEMOSTRACIÓN" if app.config["ECONODO_DEMO"] else "REAL", flush=True)
    print(f"Muestreo previsto: {settings['reading_interval_seconds']} s | Página: cada {settings['refresh_interval_seconds']} s", flush=True)
    print("En otra terminal, ejecuta comprobar_conexion.ps1 para ver las direcciones del ESP32, celulares y QR.", flush=True)
    server.run()
