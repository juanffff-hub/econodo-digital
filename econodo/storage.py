"""Persistencia SQLite local: el servidor es dueño de la hora y del historial."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def connection(path: Path):
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


def init_db(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with connection(path) as db:
        db.execute("""CREATE TABLE IF NOT EXISTS measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT NOT NULL,
            received_at_utc TEXT NOT NULL,
            temperature_c REAL NOT NULL,
            humidity_pct REAL NOT NULL,
            illuminance_lux REAL NOT NULL
        )""")
        db.execute("CREATE INDEX IF NOT EXISTS ix_measurements_time ON measurements(received_at_utc)")


def insert_reading(path: Path, node_id: str, timestamp: str, values: dict):
    with connection(path) as db:
        cursor = db.execute(
            "INSERT INTO measurements (node_id, received_at_utc, temperature_c, humidity_pct, illuminance_lux) VALUES (?, ?, ?, ?, ?)",
            (node_id, timestamp, values["temperature_c"], values["humidity_pct"], values["illuminance_lux"]),
        )
        return cursor.lastrowid


def read_history(path: Path, start, limit: int | None = None, descending: bool = False):
    query = "SELECT * FROM measurements"
    params = []
    if start is not None:
        query += " WHERE received_at_utc >= ?"
        params.append(start.isoformat(timespec="seconds"))
    query += " ORDER BY received_at_utc " + ("DESC" if descending else "ASC") + ", id " + ("DESC" if descending else "ASC")
    if limit is not None:
        query += " LIMIT ?"
        params.append(limit)
    with connection(path) as db:
        return [dict(row) for row in db.execute(query, params).fetchall()]


def count_readings(path: Path):
    with connection(path) as db:
        return db.execute("SELECT COUNT(*) FROM measurements").fetchone()[0]
