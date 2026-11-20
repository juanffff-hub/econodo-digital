"""Completa las últimas 24 horas de lecturas ficticias solo en demo_data/."""

import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from econodo.storage import init_db, insert_reading, read_history

DB = ROOT / "demo_data" / "econodo.sqlite3"


def main():
    init_db(DB)
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    latest = read_history(DB, None, limit=1, descending=True)
    if latest:
        start = max(datetime.fromisoformat(latest[0]["received_at_utc"]) + timedelta(minutes=5), now - timedelta(hours=24))
    else:
        start = now - timedelta(hours=24)
    created = 0
    moment = start
    while moment <= now:
        local_hour = (moment.hour - 5) % 24
        index = int(moment.timestamp() // 300)
        daylight = max(0.0, math.sin(math.pi * (local_hour + moment.minute / 60 - 6) / 12))
        slow_wave = math.sin(index * .08)
        temperature = 19.1 + 5.6 * daylight + .38 * slow_wave
        humidity = 78 - 18 * daylight - 2.5 * slow_wave
        light = 8 + 1740 * daylight ** 1.4 + 80 * daylight * math.sin(index * .19)
        insert_reading(DB, "demo-1", moment.isoformat(timespec="seconds"), {
            "temperature_c": round(temperature, 2),
            "humidity_pct": round(humidity, 2),
            "illuminance_lux": round(max(0, light), 2),
        })
        created += 1
        moment += timedelta(minutes=5)
    print(f"{created} lecturas ficticias añadidas en demo_data/. No representan mediciones reales.")
    print(f"Base de demostración: {DB}")


if __name__ == "__main__":
    main()
