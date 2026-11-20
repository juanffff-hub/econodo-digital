"""EcoNodo: servidor local y contrato HTTP del nodo ambiental."""

from __future__ import annotations

import csv
import io
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Flask, Response, jsonify, render_template, request

from econodo.ingestion import ReadingValidationError, normalize_reading
from econodo.narrative import build_story
from econodo.storage import count_readings, init_db, insert_reading, read_history


ROOT = Path(__file__).resolve().parent


def load_settings() -> dict:
    import json

    defaults = {
        "site_name": "Zona verde del campus",
        "site_description": "Un diario ambiental para mirar con más atención el lugar que compartimos.",
        "timezone": "America/Bogota",
        "public_url": "",
        "host": "0.0.0.0",
        "port": 5000,
        "node_key": "",
        "stale_after_minutes": 1,
        "reading_interval_seconds": 10,
        "refresh_interval_seconds": 5,
        "gap_after_seconds": 60,
    }
    paths = [ROOT / "config.json", Path(os.environ.get("ECONODO_CONFIG", ROOT / "config.local.json"))]
    for path in paths:
        if path.exists():
            with path.open(encoding="utf-8-sig") as handle:
                data = json.load(handle)
            defaults.update(data)
    return defaults


LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", ""}


def detect_lan_ip() -> str | None:
    """IPv4 de la interfaz con la que este PC sale a la red (p. ej. el hotspot).

    Un socket UDP "conectado" no envía paquetes: solo pide al sistema la ruta.
    """
    import ipaddress
    import socket

    for probe in ("8.8.8.8", "10.255.255.255", "192.168.255.255"):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect((probe, 9))
                ip = ipaddress.ip_address(sock.getsockname()[0])
        except OSError:
            continue
        if ip.is_private and not ip.is_loopback and not ip.is_link_local:
            return str(ip)
    return None


def local_ipv4_addresses() -> set[str]:
    import socket

    found = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.add(info[4][0])
    except OSError:
        pass
    lan = detect_lan_ip()
    if lan:
        found.add(lan)
    return found


def resolve_public_url(settings: dict, host_url: str) -> str:
    """Dirección que abre EcoNodo desde otro dispositivo de la misma red.

    Orden: public_url si sigue siendo válida en este PC → la dirección con la que
    se abrió la página si no es local → la IPv4 actual detectada → host_url.
    Así el QR sigue a la IP vigente aunque el hotspot la cambie.
    """
    import ipaddress
    from urllib.parse import urlsplit

    configured = str(settings.get("public_url", "")).strip().rstrip("/")
    if configured:
        host = urlsplit(configured).hostname or ""
        try:
            ipaddress.ip_address(host)
            is_ip = True
        except ValueError:
            is_ip = False
        # Un nombre de dominio se respeta; una IP fija solo si este PC aún la tiene.
        if host not in LOOPBACK_HOSTS and (not is_ip or host in local_ipv4_addresses()):
            return configured
    request_url = host_url.rstrip("/")
    if (urlsplit(request_url).hostname or "") not in LOOPBACK_HOSTS:
        return request_url
    lan = detect_lan_ip()
    if lan:
        return f"http://{lan}:{int(settings['port'])}"
    return request_url


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    settings = load_settings()
    if test_config:
        settings.update(test_config)
    demo = os.environ.get("ECONODO_DEMO", "0") == "1"
    db_path = Path(os.environ.get("ECONODO_DATA_DIR", ROOT / ("demo_data" if demo else "data"))) / "econodo.sqlite3"
    init_db(db_path)
    app.config.update(ECONODO_SETTINGS=settings, ECONODO_DB=db_path, ECONODO_DEMO=demo,
                      TEMPLATES_AUTO_RELOAD=True, SEND_FILE_MAX_AGE_DEFAULT=0)

    @app.after_request
    def revalidate_local_pages(response):
        # Evita mezclar una plantilla antigua con JavaScript recién actualizado.
        if response.mimetype == "text/html":
            response.headers["Cache-Control"] = "no-store"
        return response

    def local_timezone():
        try:
            return ZoneInfo(settings["timezone"])
        except ZoneInfoNotFoundError:
            return timezone(timedelta(hours=-5))

    def period_start(period: str):
        now = datetime.now(timezone.utc)
        if period == "1h":
            return now - timedelta(hours=1)
        if period == "6h":
            return now - timedelta(hours=6)
        if period == "24h":
            return now - timedelta(hours=24)
        if period == "7d":
            return now - timedelta(days=7)
        if period == "hoy":
            local_now = now.astimezone(local_timezone())
            local_midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
            return local_midnight.astimezone(timezone.utc)
        return None

    def validate_period():
        period = request.args.get("periodo", "hoy")
        if period not in {"1h", "6h", "24h", "hoy", "7d"}:
            return None
        return period

    def serialize(row):
        value = dict(row)
        value["received_at_local"] = datetime.fromisoformat(value["received_at_utc"]).astimezone(local_timezone()).isoformat(timespec="seconds")
        return value

    def summary(rows):
        result = {}
        for key in ("temperature_c", "humidity_pct", "illuminance_lux"):
            values = [float(row[key]) for row in rows if row[key] is not None]
            result[key] = {
                "min": round(min(values), 1) if values else None,
                "max": round(max(values), 1) if values else None,
                "avg": round(sum(values) / len(values), 1) if values else None,
            }
        return result

    @app.get("/")
    def index():
        return render_template("index.html", settings=settings, demo=demo)

    @app.get("/experiencia")
    def experience():
        return render_template("experience.html", settings=settings, demo=demo)

    @app.get("/acceso")
    def access():
        from urllib.parse import urlsplit

        public_url = resolve_public_url(settings, request.host_url)
        host = urlsplit(public_url).hostname or ""
        local_only = host in LOOPBACK_HOSTS
        return render_template("access.html", settings=settings, public_url=public_url, local_only=local_only)

    @app.get("/acceso/qr.svg")
    def access_qr():
        import qrcode
        from qrcode.image.svg import SvgPathImage

        public_url = resolve_public_url(settings, request.host_url)
        qr =qrcode.QRCode(box_size=8, border=3, error_correction=qrcode.constants.ERROR_CORRECT_M)
        qr.add_data(public_url)
        qr.make(fit=True)
        buffer = io.BytesIO()
        qr.make_image(image_factory=SvgPathImage).save(buffer)
        return Response(buffer.getvalue(), mimetype="image/svg+xml", headers={"Cache-Control": "no-store"})

    @app.get("/api/configuracion")
    def public_settings():
        return jsonify({
            "site_name": settings["site_name"],
            "site_description": settings["site_description"],
            "timezone": settings["timezone"],
            "stale_after_minutes": settings["stale_after_minutes"],
            "reading_interval_seconds": settings["reading_interval_seconds"],
            "refresh_interval_seconds": settings["refresh_interval_seconds"],
            "demo": demo,
        })

    @app.post("/api/lecturas")
    def receive_reading():
        secret = str(settings.get("node_key", ""))
        if secret and request.headers.get("X-EcoNodo-Key", "") != secret:
            return jsonify({"error": "Clave del nodo incorrecta."}), 401
        try:
            node_id, values = normalize_reading(request.get_json(silent=True))
        except ReadingValidationError as error:
            return jsonify({"error": str(error), "code": error.code}), 400
        timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        reading_id = insert_reading(db_path, node_id, timestamp, values)
        return jsonify({"id": reading_id, "received_at_utc": timestamp, "status": "stored"}), 201

    @app.get("/api/estado")
    def current_state():
        rows = read_history(db_path, None, limit=1, descending=True)
        latest = serialize(rows[0]) if rows else None
        age = None
        state = "sin_datos"
        if latest:
            age = max(0, int((datetime.now(timezone.utc) - datetime.fromisoformat(latest["received_at_utc"])).total_seconds()))
            state = "actualizado" if age <= int(settings["stale_after_minutes"]) * 60 else "sin_actualizacion"
        return jsonify({"state": state, "age_seconds": age, "latest": latest, "total_readings": count_readings(db_path), "demo": demo})

    @app.get("/api/historial")
    def history():
        period = validate_period()
        if period is None:
            return jsonify({"error": "Periodo inválido."}), 400
        rows = [serialize(r) for r in read_history(db_path, period_start(period))]
        return jsonify({"period": period, "count": len(rows), "summary": summary(rows), "readings": rows})

    @app.get("/api/diario")
    def story():
        period = validate_period()
        if period is None:
            return jsonify({"error": "Periodo inválido."}), 400
        rows = [serialize(r) for r in read_history(db_path, period_start(period))]
        return jsonify({"period": period, "count": len(rows), "chapters": build_story(
            rows, summary(rows), period, settings["site_name"], gap_seconds=settings["gap_after_seconds"])})

    @app.get("/api/exportacion.csv")
    def export_csv():
        period = validate_period()
        if period is None:
            return jsonify({"error": "Periodo inválido."}), 400
        rows = [serialize(r) for r in read_history(db_path, period_start(period))]
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["fecha_hora_local", "fecha_hora_utc", "nodo", "temperatura_c", "humedad_relativa_pct", "iluminancia_lux"])
        for row in rows:
            writer.writerow([row["received_at_local"], row["received_at_utc"], row["node_id"], row["temperature_c"], row["humidity_pct"], row["illuminance_lux"]])
        filename = f"econodo_{period}_{datetime.now(local_timezone()).strftime('%Y%m%d_%H%M')}.csv"
        return Response("\ufeff" + out.getvalue(), mimetype="text/csv; charset=utf-8", headers={"Content-Disposition": f"attachment; filename={filename}", "Cache-Control": "no-store"})

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "demo": demo, "readings": count_readings(db_path)})

    return app


app = create_app()


if __name__ == "__main__":
    configuration = app.config["ECONODO_SETTINGS"]
    app.run(host=configuration["host"], port=int(configuration["port"]), debug=False, threaded=True)
