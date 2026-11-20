"""Arranque local para varios navegadores en la misma red."""

from waitress import create_server

from app import app


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
    print("Para otros dispositivos, usa la IP local del servidor y la misma red Wi-Fi.", flush=True)
    print("Modo:", "DEMOSTRACIÓN" if app.config["ECONODO_DEMO"] else "REAL", flush=True)
    print(f"Muestreo previsto: {settings['reading_interval_seconds']} s | Página: cada {settings['refresh_interval_seconds']} s", flush=True)
    print("En otra terminal, ejecuta comprobar_conexion.ps1 para ver las direcciones del ESP32, celulares y QR.", flush=True)
    server.run()
