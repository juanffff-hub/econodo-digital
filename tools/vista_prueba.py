"""Vista aislada para comprobar estados sin tocar las bases del proyecto."""
import argparse
import os
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--estado", choices=["vacio", "atrasado", "error", "lento", "reciente"], default="error")
    parser.add_argument("--puerto", type=int, default=5001)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="econodo-vista-") as directory:
        os.environ["ECONODO_DEMO"] = "1"
        os.environ["ECONODO_DATA_DIR"] = directory
        from app import create_app
        from econodo.storage import insert_reading
        from flask import jsonify, request
        from waitress import serve
        app = create_app({"port": args.puerto, "node_key": "", "public_url": f"http://127.0.0.1:{args.puerto}"})
        if args.estado in {"atrasado", "reciente"}:
            age = timedelta(hours=2) if args.estado == "atrasado" else timedelta()
            insert_reading(app.config["ECONODO_DB"], "prueba",
                           (datetime.now(timezone.utc)-age).isoformat(timespec="seconds"),
                           {"temperature_c": 22.6, "humidity_pct": 65.4, "illuminance_lux": 780})
        @app.before_request
        def simulated_response():
            if request.path.startswith("/api/") and args.estado in {"error", "lento"}:
                if args.estado == "lento":
                    time.sleep(12)  # El cliente corta la espera a los ocho segundos.
                return jsonify({"error": "Fallo deliberado de la vista de prueba"}), 503
        print(f"Vista de prueba ({args.estado}): http://127.0.0.1:{args.puerto}", flush=True)
        print("Base temporal aislada. Detén esta terminal con Ctrl+C.", flush=True)
        serve(app, host="127.0.0.1", port=args.puerto, threads=4)

if __name__ == "__main__":
    main()
