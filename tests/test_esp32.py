"""Integración del prototipo en modo real, siempre en bases temporales."""
import json
import os
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

PAYLOAD = {"nodo": "econodo-01", "temperatura": 26.9, "humedad": 78.2, "lux": 57, "lux_saturado": False}


class PrototypeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="econodo-esp32-")
        cls.env = patch.dict(os.environ, {"ECONODO_DEMO": "0", "ECONODO_DATA_DIR": str(Path(cls.temp.name) / "bootstrap")})
        cls.env.start()
        from app import create_app
        cls.factory = staticmethod(create_app)

    @classmethod
    def tearDownClass(cls):
        cls.env.stop()
        cls.temp.cleanup()

    def setUp(self):
        os.environ["ECONODO_DATA_DIR"] = str(Path(self.temp.name) / self._testMethodName)
        self.app = self.factory({"node_key": "", "stale_after_minutes": 1, "public_url": ""})
        self.client = self.app.test_client()

    def test_spanish_payload_reaches_all_views_and_export(self):
        reply = self.client.post("/api/lecturas", json=PAYLOAD)
        self.assertEqual(reply.status_code, 201)
        state = self.client.get("/api/estado").json
        self.assertFalse(state["demo"])
        self.assertEqual(state["state"], "actualizado")
        self.assertEqual(state["total_readings"], 1)
        row = state["latest"]
        for key, expected in {"node_id": "econodo-01", "temperature_c": 26.9, "humidity_pct": 78.2, "illuminance_lux": 57}.items():
            self.assertEqual(row[key], expected)
        for period in ("1h", "6h", "hoy", "24h", "7d"):
            history = self.client.get(f"/api/historial?periodo={period}").json
            self.assertEqual(history["readings"][0]["id"], row["id"])
            self.assertEqual(self.client.get(f"/api/diario?periodo={period}").json["count"], 1)
            self.assertIn("econodo-01,26.9,78.2,57.0", self.client.get(f"/api/exportacion.csv?periodo={period}").text)
        for route in ("/", "/experiencia", "/acceso"):
            response = self.client.get(route)
            self.assertEqual(response.status_code, 200)
            self.assertNotIn("MODO DEMOSTRACIÓN", response.text)
        html = self.client.get("/").text
        self.assertIn('data-reading-interval="10"', html)
        self.assertIn('data-refresh-interval="5"', html)
        self.assertNotIn("cada cinco minutos", html)

    def test_original_contract_remains_compatible_and_extremes_are_not_clipped(self):
        for values in ((-40, 0, 0), (80, 100, 65535)):
            payload = dict(zip(("temperature_c", "humidity_pct", "illuminance_lux"), values))
            self.assertEqual(self.client.post("/api/lecturas", json=payload).status_code, 201)
            state = self.client.get("/api/estado").json
            self.assertEqual(tuple(state["latest"][k] for k in payload), values)
        self.assertEqual(state["latest"]["node_id"], "nodo-1")

    def test_invalid_and_saturated_samples_do_not_replace_last_valid_reading(self):
        self.client.post("/api/lecturas", json=PAYLOAD)
        original = self.client.get("/api/estado").json["latest"]
        bad = [
            ({**PAYLOAD, "lux_saturado": True}, "light_saturated"),
            ({**PAYLOAD, "lux_saturado": "false"}, "invalid_saturation_flag"),
            ({**PAYLOAD, "lux_saturado": 0}, "invalid_saturation_flag"),
            ({**PAYLOAD, "temperatura": 9999}, "invalid_reading"),
            ({**PAYLOAD, "temperatura": 10 ** 400}, "invalid_reading"),
            ({**PAYLOAD, "temperatura": float("nan")}, "invalid_reading"),
            ({**PAYLOAD, "temperatura": float("inf")}, "invalid_reading"),
            ({**PAYLOAD, "humedad": -1}, "invalid_reading"),
            ({**PAYLOAD, "humedad": 101}, "invalid_reading"),
            ({**PAYLOAD, "humedad": True}, "invalid_reading"),
            ({**PAYLOAD, "lux": 65536}, "invalid_reading"),
            ({**PAYLOAD, "lux": None}, "invalid_reading"),
            ({**PAYLOAD, "lux": "57"}, "invalid_reading"),
            ({**PAYLOAD, "nodo": "../node"}, "invalid_node_id"),
            ({**PAYLOAD, "node_id": "otro"}, "ambiguous_fields"),
            ({**PAYLOAD, "temperature_c": 26.9}, "ambiguous_fields"),
            ([], "invalid_json"),
        ]
        for payload, code in bad:
            with self.subTest(payload=str(payload)[:90]):
                result = self.client.post("/api/lecturas", json=payload)
                self.assertEqual(result.status_code, 400)
                self.assertEqual(result.json["code"], code)
                state = self.client.get("/api/estado").json
                self.assertEqual(state["latest"], original)
                self.assertEqual(state["total_readings"], 1)
        for raw in ('{"nodo":', 'null'):
            self.assertEqual(self.client.post("/api/lecturas", data=raw, content_type="application/json").status_code, 400)

    def test_api_key_applies_to_both_formats_without_public_exposure(self):
        protected = self.factory({"node_key": "test-secret"}).test_client()
        self.assertEqual(protected.post("/api/lecturas", json=PAYLOAD).status_code, 401)
        self.assertEqual(protected.post("/api/lecturas", json=PAYLOAD, headers={"X-EcoNodo-Key": "test-secret"}).status_code, 201)
        self.assertNotIn("test-secret", protected.get("/api/configuracion").text)
        self.assertNotIn("node_key", protected.get("/api/configuracion").json)

    def test_disconnect_threshold_for_ten_second_sampling(self):
        from econodo.storage import insert_reading
        insert_reading(self.app.config["ECONODO_DB"], "econodo-01",
                       (datetime.now(timezone.utc) - timedelta(seconds=70)).isoformat(),
                       {"temperature_c": 25, "humidity_pct": 70, "illuminance_lux": 60})
        self.assertEqual(self.client.get("/api/estado").json["state"], "sin_actualizacion")
        self.client.post("/api/lecturas", json=PAYLOAD)
        self.assertEqual(self.client.get("/api/estado").json["state"], "actualizado")

    def test_qr_encodes_lan_address_and_warns_on_loopback(self):
        import qrcode
        recorded = []
        original = qrcode.QRCode.add_data
        def capture(qr, data, *args, **kwargs):
            recorded.append(data)
            return original(qr, data, *args, **kwargs)
        with patch.object(qrcode.QRCode, "add_data", capture):
            response = self.client.get("/acceso/qr.svg", base_url="http://192.168.43.25:5000")
        self.assertEqual(response.status_code, 200)
        self.assertIn("http://192.168.43.25:5000", recorded)
        self.assertIn("<svg", response.text)
        with patch("app.detect_lan_ip", return_value=None):
            self.assertIn("solo sirve en este computador", self.client.get("/acceso", base_url="http://127.0.0.1:5000").text)

    def test_qr_follows_current_lan_ip(self):
        from app import resolve_public_url
        settings = {"public_url": "", "port": 5000}
        with patch("app.detect_lan_ip", return_value="10.218.192.22"):
            # Abierto desde 127.0.0.1: el QR usa la IP actual del hotspot.
            self.assertEqual(resolve_public_url(settings, "http://127.0.0.1:5000/"), "http://10.218.192.22:5000")
            html = self.client.get("/acceso", base_url="http://127.0.0.1:5000").text
            self.assertIn("http://10.218.192.22:5000", html)
            self.assertNotIn("solo sirve en este computador", html)
        # Una IP fija que este PC ya no tiene se descarta en favor de la actual.
        stale = {"public_url": "http://10.0.0.99:5000", "port": 5000}
        with patch("app.detect_lan_ip", return_value="192.168.43.25"), \
             patch("app.local_ipv4_addresses", return_value={"192.168.43.25"}):
            self.assertEqual(resolve_public_url(stale, "http://127.0.0.1:5000/"), "http://192.168.43.25:5000")
        # Un nombre de dominio configurado se respeta.
        named = {"public_url": "http://econodo.local:5000/", "port": 5000}
        self.assertEqual(resolve_public_url(named, "http://127.0.0.1:5000/"), "http://econodo.local:5000")

    def test_real_http_server_receives_and_serves_without_demo(self):
        from waitress import create_server
        server = create_server(self.app, host="127.0.0.1", port=0, threads=2)
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.effective_port}"
            request = Request(base + "/api/lecturas", data=json.dumps(PAYLOAD).encode(),
                              headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(request, timeout=5) as response:
                self.assertEqual(response.status, 201)
            for route in ("/", "/experiencia", "/acceso", "/acceso/qr.svg", "/health", "/api/estado"):
                with urlopen(base + route, timeout=5) as response:
                    self.assertEqual(response.status, 200)
            with urlopen(base + "/api/estado", timeout=5) as response:
                state = json.load(response)
                self.assertFalse(state["demo"])
                self.assertEqual(state["latest"]["node_id"], "econodo-01")
        finally:
            server.close()
            thread.join(timeout=3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
