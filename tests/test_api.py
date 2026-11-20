"""Contrato y demostración con bases temporales: nunca modifica data/ o demo_data/."""
import importlib.util
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT))

class EcoNodoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="econodo-tests-")
        cls.env = patch.dict(os.environ, {
            "ECONODO_DEMO": "1", "ECONODO_DATA_DIR": str(Path(cls.temp.name) / "bootstrap")
        })
        cls.env.start()
        from app import create_app
        cls.factory = staticmethod(create_app)

    @classmethod
    def tearDownClass(cls):
        cls.env.stop()
        cls.temp.cleanup()

    def setUp(self):
        self.directory = Path(self.temp.name) / self._testMethodName
        os.environ["ECONODO_DATA_DIR"] = str(self.directory / "demo_data")
        self.app = self.factory({"node_key": "", "timezone": "America/Bogota"})
        self.client = self.app.test_client()

    def test_empty_and_immediate_scene(self):
        state = self.client.get("/api/estado").json
        self.assertEqual(state["state"], "sin_datos")
        self.assertIsNone(state["latest"])
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        html = response.get_data(as_text=True)
        self.assertIn('id="device-scene"', html)
        self.assertIn('class="folio-strip shell"', html)
        self.assertIn('hero-folio', html)
        self.assertIn('js/carcasa.js', html)
        self.assertIn('data-timezone="America/Bogota"', html)
        experience = self.client.get("/experiencia")
        self.assertEqual(experience.status_code, 200)
        experience_html = experience.get_data(as_text=True)
        self.assertIn('id="experience-stage"', experience_html)
        self.assertIn('id="experience-timeline"', experience_html)
        self.assertIn('class="instrument-frame"', experience_html)
        self.assertIn('data-timezone="America/Bogota"', experience_html)
        access_html = self.client.get("/acceso").get_data(as_text=True)
        self.assertIn('class="access-card"', access_html)
        self.assertIn("misma red Wi-Fi", access_html)
        # La configuración pública no aporta geolocalización ni orientación: no deben aparecer
        # coordenadas, «LAT / LON», rosa de los vientos ni marcas que aparenten una medición.
        for page in (html, experience_html, access_html):
            for forbidden in ("05° N", "05° 04", "LAT / LON", "instrument-bearing", "topographic-field"):
                self.assertNotIn(forbidden, page, forbidden)
        for path in ("/static/js/carcasa.js", "/static/js/app.js", "/static/css/tokens.css",
                     "/static/css/styles.css", "/static/js/experience.js", "/static/css/experience.css",
                     "/static/img/papel.svg", "/static/img/hoja.svg",
                     "/static/vendor/chart.umd.js", "/acceso/qr.svg"):
            with self.client.get(path) as asset:
                self.assertEqual(asset.status_code, 200, path)

    def test_every_local_asset_referenced_by_templates_exists(self):
        """Ninguna página depende de recursos remotos ni de archivos que falten."""
        import re
        for route in ("/", "/experiencia", "/acceso"):
            html = self.client.get(route).get_data(as_text=True)
            self.assertNotRegex(html, r'(src|href)="https?://', route)
            for ref in re.findall(r'(?:src|href)="(/static/[^"?]+)', html):
                with self.client.get(ref) as asset:
                    self.assertEqual(asset.status_code, 200, f"{route} → {ref}")
        for sheet in ("tokens.css", "styles.css", "experience.css"):
            css = (PROJECT / "static" / "css" / sheet).read_text(encoding="utf-8")
            self.assertNotRegex(css, r"url\(\s*['\"]?https?:", sheet)
            self.assertNotIn("@import", css, sheet)
            for ref in re.findall(r'url\("\.\./img/([^")]+)"\)', css):
                self.assertTrue((PROJECT / "static" / "img" / ref).exists(), ref)

    def test_post_history_story_csv_contract(self):
        response = self.client.post("/api/lecturas", json={
            "node_id": "test-1", "temperature_c": 22.5, "humidity_pct": 62.2, "illuminance_lux": 680
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(set(response.json), {"id", "received_at_utc", "status"})
        state = self.client.get("/api/estado").json
        self.assertEqual(set(state), {"state", "age_seconds", "latest", "total_readings", "demo"})
        self.assertEqual(state["state"], "actualizado")
        self.assertEqual(state["latest"]["humidity_pct"], 62.2)
        self.assertTrue(state["latest"]["received_at_utc"].endswith("+00:00"))
        for period in ("1h", "6h", "hoy", "24h", "7d"):
            history = self.client.get(f"/api/historial?periodo={period}").json
            self.assertEqual(history["count"], 1)
            self.assertEqual(len(history["readings"]), 1)
            story = self.client.get(f"/api/diario?periodo={period}").json
            self.assertEqual(len(story["chapters"]), 4)
            self.assertTrue(all({"tone", "signal_label", "signal_value"} <= set(chapter)
                                for chapter in story["chapters"]))
            csv = self.client.get(f"/api/exportacion.csv?periodo={period}")
            self.assertEqual(len(csv.get_data(as_text=True).splitlines()), 2)
            self.assertIn("humedad_relativa_pct", csv.get_data(as_text=True))

    def test_stale(self):
        from econodo.storage import insert_reading
        insert_reading(self.app.config["ECONODO_DB"], "test",
                       (datetime.now(timezone.utc)-timedelta(hours=2)).isoformat(),
                       {"temperature_c": 21, "humidity_pct": 70, "illuminance_lux": 300})
        self.assertEqual(self.client.get("/api/estado").json["state"], "sin_actualizacion")

    def test_demo_loader_isolated_and_idempotent(self):
        spec = importlib.util.spec_from_file_location("demo_loader", PROJECT / "tools/cargar_demo.py")
        loader = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(loader)
        loader.DB = self.app.config["ECONODO_DB"]  # Solo esta prueba, dentro de TemporaryDirectory.
        loader.main()
        first = self.client.get("/api/estado").json
        self.assertGreaterEqual(first["total_readings"], 288)
        self.assertIsNotNone(first["latest"])
        self.assertGreater(self.client.get("/api/historial?periodo=hoy").json["count"], 0)
        loader.main()
        self.assertEqual(self.client.get("/api/estado").json["total_readings"], first["total_readings"])
        self.assertFalse((self.directory / "data").exists())

    def test_validation_and_key(self):
        for bad in (None, True, -1, 101):
            response = self.client.post("/api/lecturas", json={
                "temperature_c": 20, "humidity_pct": bad, "illuminance_lux": 30})
            self.assertEqual(response.status_code, 400)
        protected = self.factory({"node_key": "test-key"}).test_client()
        self.assertEqual(protected.post("/api/lecturas", json={}).status_code, 401)
        self.assertEqual(self.client.get("/api/historial?periodo=invalid").status_code, 400)

def reading(minutes, temperature=22.0, humidity=68.0, light=700.0, day=17):
    """Fila como la entrega /api/historial, en hora de Bogotá."""
    moment = datetime(2026, 11, day, 8, 0, tzinfo=timezone(timedelta(hours=-5))) + timedelta(minutes=minutes)
    return {"received_at_local": moment.isoformat(timespec="seconds"), "temperature_c": temperature,
            "humidity_pct": humidity, "illuminance_lux": light}


class NarrativeTests(unittest.TestCase):
    """El relato es determinista y no afirma más de lo que muestran las lecturas."""

    FORBIDDEN = ("contamin", "co₂", "co2", "calidad del aire", "biodiversidad", "lluvia", "salud de las plantas",
                 "porque", "debido a", "se debe", "gracias a", "tendencia creciente", "cada vez")

    def story(self, rows, period="hoy"):
        from econodo.narrative import build_story
        return build_story(rows, {}, period, "Zona verde del campus")

    def test_chapter_counts_adapt_to_zero_one_and_many_readings(self):
        self.assertEqual([c["kind"] for c in self.story([])], ["empty", "guide"])
        self.assertEqual(len(self.story([reading(0)])), 4)
        self.assertEqual(len(self.story([reading(0), reading(5)])), 4)
        self.assertEqual(len(self.story([reading(i * 5) for i in range(200)])), 4)

    def test_every_chapter_names_its_evidence(self):
        for rows in ([], [reading(0)], [reading(0), reading(5)]):
            for chapter in self.story(rows):
                for field in ("number", "eyebrow", "title", "body", "kind", "tone", "signal_label", "signal_value", "evidence"):
                    self.assertTrue(chapter[field], f"{field} vacío en {chapter['title']}")

    def test_deterministic(self):
        rows = [reading(0, 20), reading(5, 21.4), reading(10, 22.1)]
        self.assertEqual(self.story(rows), self.story(rows))

    def test_two_readings_are_not_called_a_trend(self):
        chapters = self.story([reading(0, 20.0), reading(30, 21.4)])
        change = chapters[1]
        self.assertIn("la temperatura aumentó 1,4 °C", change["body"])
        self.assertIn("no bastan para hablar de una tendencia", change["body"])
        self.assertEqual(change["signal_value"], "+1,4 °C")
        self.assertEqual(self.story([reading(0, 21.4), reading(30, 20.0)])[1]["signal_value"], "−1,4 °C")

    def test_single_reading_makes_no_comparison(self):
        chapters = self.story([reading(0)])
        self.assertEqual([c["kind"] for c in chapters], ["data", "guide", "guide", "reflection"])
        self.assertIn("una sola", chapters[1]["body"])
        self.assertNotIn("aumentó", " ".join(c["body"] for c in chapters))

    def test_partial_period_and_gaps_are_acknowledged(self):
        rows = [reading(i) for i in range(0, 30, 5)] + [reading(i) for i in range(120, 150, 5)]
        panorama = self.story(rows)[2]["body"]
        self.assertIn("no describen necesariamente el día completo", panorama)
        self.assertIn("pausa de", panorama)
        self.assertIn("no se interpretan", panorama)

    def test_no_unsupported_claims_in_any_period(self):
        rows = [reading(i * 5, 18 + i * .1, 80 - i * .2, i * 10) for i in range(60)]
        for period in ("1h", "6h", "hoy", "24h", "7d"):
            for data in ([], rows[:1], rows):
                text = " ".join(f"{c['title']} {c['body']}" for c in self.story(data, period)).lower()
                for word in self.FORBIDDEN:
                    self.assertNotIn(word, text, f"{word!r} en {period}")

    def test_defective_rows_never_break_the_story(self):
        bad = [None, "x", {}, {"received_at_local": "no-es-fecha", "temperature_c": 1, "humidity_pct": 1, "illuminance_lux": 1},
               {"received_at_local": "2026-11-17T08:00:00-05:00", "temperature_c": None, "humidity_pct": 50, "illuminance_lux": 1},
               {"received_at_local": "2026-11-17T08:00:00-05:00", "temperature_c": "20", "humidity_pct": 50, "illuminance_lux": 1},
               {"received_at_local": "2026-11-17T08:00:00-05:00", "temperature_c": float("nan"), "humidity_pct": 50, "illuminance_lux": 1},
               {"received_at_local": "2026-11-17T08:00:00-05:00", "temperature_c": True, "humidity_pct": 50, "illuminance_lux": 1}]
        self.assertEqual([c["kind"] for c in self.story(bad)], ["empty", "guide"])
        mixed = self.story(bad + [reading(0), reading(10)])
        self.assertEqual(len(mixed), 4)
        self.assertNotRegex(" ".join(c["body"] for c in mixed).lower(), r"\bnan\b|\binf\b|undefined|none")

    def test_extreme_valid_values_are_reported_in_full(self):
        rows = [reading(0, -40, 0, 0), reading(5, 80, 100, 65535)]
        text = " ".join(c["body"] + c["signal_value"] for c in self.story(rows))
        self.assertIn("65.535 lx", text, "Millares con punto, como en el resto de la interfaz.")
        self.assertIn("+120,0 °C", text)
        self.assertIn("−40,0 °C", text, "El signo negativo es tipográfico (−), no un guion.")
        self.assertNotRegex(text, r"(?<![\w−])-\d", "Ninguna cifra negativa usa guion.")

    def test_seven_day_story_names_the_day(self):
        rows = [reading(0), reading(60 * 24 * 3, day=17)]
        self.assertRegex(self.story(rows, "7d")[0]["body"], r"17 nov, 08:00")


class PublicationTests(unittest.TestCase):
    """Puerto público (túnel): solo lectura, compresión y hoja de acceso fija."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="econodo-public-")
        self.env = patch.dict(os.environ, {"ECONODO_DEMO": "0", "ECONODO_DATA_DIR": self.temp.name})
        self.env.start()
        from app import create_app, public_readonly
        self.create_app, self.public_readonly = create_app, public_readonly

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def public_client(self, **config):
        from werkzeug.test import Client
        app = self.create_app({"node_key": "", **config})
        return app, Client(self.public_readonly(app, app.config["ECONODO_SETTINGS"]))

    def test_public_port_is_read_only_without_key(self):
        app, client = self.public_client()
        reading = {"nodo": "econodo-01", "temperatura": 21, "humedad": 60, "lux": 100}
        self.assertEqual(client.post("/api/lecturas", json=reading).status_code, 403)
        self.assertEqual(client.get("/api/estado").json["total_readings"], 0)
        self.assertEqual(client.get("/").status_code, 200)
        # El puerto local sigue aceptando al ESP32 como antes.
        self.assertEqual(app.test_client().post("/api/lecturas", json=reading).status_code, 201)

    def test_public_port_accepts_node_only_with_key(self):
        _, client = self.public_client(node_key="clave-larga")
        reading = {"nodo": "econodo-01", "temperatura": 21, "humedad": 60, "lux": 100}
        self.assertEqual(client.post("/api/lecturas", json=reading).status_code, 401)
        ok = client.post("/api/lecturas", json=reading, headers={"X-EcoNodo-Key": "clave-larga"})
        self.assertEqual(ok.status_code, 201)
        self.assertEqual(client.delete("/api/lecturas").status_code, 403)

    def test_large_json_is_gzipped_only_when_accepted(self):
        import gzip
        app = self.create_app({"node_key": ""})
        client = app.test_client()
        for _ in range(40):
            client.post("/api/lecturas", json={"nodo": "n1", "temperatura": 21, "humedad": 60, "lux": 100})
        plain = client.get("/api/historial?periodo=hoy")
        self.assertNotIn("Content-Encoding", plain.headers)
        packed = client.get("/api/historial?periodo=hoy", headers={"Accept-Encoding": "gzip, br"})
        self.assertEqual(packed.headers["Content-Encoding"], "gzip")
        self.assertEqual(gzip.decompress(packed.data), plain.data)
        script = client.get("/static/vendor/chart.umd.js", headers={"Accept-Encoding": "gzip"})
        self.assertEqual(script.headers["Content-Encoding"], "gzip")
        self.assertLess(len(script.data), 120_000)

    def test_access_page_with_fixed_public_url(self):
        app = self.create_app({"node_key": "", "public_url": "https://econodo.ejemplo.ts.net"})
        html = app.test_client().get("/acceso").get_data(as_text=True)
        self.assertIn("https://econodo.ejemplo.ts.net", html)
        self.assertIn("cualquier red", html)
        self.assertNotIn("misma red Wi-Fi", html)

    def test_is_public_url(self):
        from app import is_public_url
        self.assertTrue(is_public_url("https://econodo.ejemplo.ts.net"))
        self.assertFalse(is_public_url("http://10.218.192.22:5000"))
        self.assertFalse(is_public_url("http://127.0.0.1:5000"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
