"""Relato determinista, transparente y limitado a lo que muestran los datos.

Reglas de redacción (se comprueban en tests/test_api.py y tests/test_narrative.py):
- Se describe lo observado y se reconoce lo que falta.
- Dos lecturas comparan dos instantes; no demuestran una tendencia continua.
- Una lectura aislada no permite hablar de evolución.
- Un periodo con datos parciales no representa necesariamente el día completo.
- No se infieren causas (sombra, nubes, personas, clima) ni contaminación, CO₂, lluvia,
  biodiversidad o salud de las plantas: el nodo solo mide temperatura, humedad y luz.
- Cada capítulo declara en qué lecturas se apoya (`evidence`) y qué dato lo sustenta (`signal_*`).
"""

import math
from datetime import datetime

PERIOD_NAMES = {"1h": "la última hora", "6h": "las últimas seis horas", "24h": "las últimas 24 horas", "hoy": "hoy", "7d": "los últimos siete días"}
WHOLE_NAMES = {"1h": "la hora completa", "6h": "las seis horas completas", "24h": "las 24 horas completas", "hoy": "el día completo", "7d": "los siete días completos"}
EXPECTED_SECONDS = {"1h": 3600, "6h": 21600, "24h": 86400, "hoy": 86400, "7d": 604800}
MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
GAP_MINUTES = 20  # Cuatro intervalos nominales (300 s): una pausa mayor se menciona y no se interpreta.
QUESTIONS = {
    "hoy": "¿Qué pudo estar ocurriendo en la zona verde mientras el nodo escuchaba? EcoNodo guarda temperatura, humedad y luz. Para explicar causas, como la hora, la sombra o el clima, hacen falta observaciones que el nodo no realiza.",
    "1h": "Una hora cabe en una sola mirada. ¿Qué notaste tú en el lugar durante ese tiempo? Las cifras dicen cuánto cambiaron la temperatura, la humedad y la luz, pero no por qué.",
    "6h": "En seis horas el ambiente puede cambiar de ritmo más de una vez. ¿Qué momentos de las gráficas te gustaría revisar con más calma? Las cifras muestran el cambio, no su causa.",
    "24h": "Un día entero deja una forma en las gráficas. ¿Se parece a lo que recuerdas del lugar? El nodo registra tres variables; lo demás depende de quien mire.",
    "7d": "Siete días permiten comparar un momento con otro. ¿Qué cambió y qué se repitió? Para saber por qué hacen falta observaciones que este nodo no recoge.",
}


def fmt(value, digits=1):
    """Número en español: coma decimal, punto de millar y «−» tipográfico (nunca «−0,0»)."""
    text = f"{abs(value):,.{digits}f}".replace(",", "\0").replace(".", ",").replace("\0", ".")
    if round(abs(value), digits) == 0:
        return text
    return ("−" if value < 0 else "") + text


def signed(value, digits=1):
    """Número con signo tipográfico: «+3,0», «−1,2» o «0,0»."""
    text = fmt(abs(value), digits)
    if round(abs(value), digits) == 0:
        return text
    return ("+" if value > 0 else "−") + text


def _finite(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def _clean(rows):
    """Conserva solo filas con fecha válida y tres cifras finitas. Nunca lanza errores."""
    clean = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        try:
            moment = datetime.fromisoformat(str(row.get("received_at_local")))
        except ValueError:
            continue
        values = {key: _finite(row.get(key)) for key in ("temperature_c", "humidity_pct", "illuminance_lux")}
        if any(value is None for value in values.values()):
            continue
        clean.append({"t": moment, **values})
    clean.sort(key=lambda item: item["t"])
    return clean


def _stats(rows, key):
    values = [row[key] for row in rows]
    return {"min": min(values), "max": max(values), "avg": sum(values) / len(values)}


def _clock(moment):
    return moment.strftime("%H:%M")


def _stamp(moment, with_day):
    return f"{moment.day} {MONTHS[moment.month - 1]}, {_clock(moment)}" if with_day else _clock(moment)


def _duration(seconds):
    minutes = int(round(seconds / 60))
    hours, rest = divmod(minutes, 60)
    if not hours:
        return f"{minutes} min"
    return f"{hours} h" if not rest else f"{hours} h {rest} min"


def _largest_gap(rows, gap_seconds=GAP_MINUTES * 60):
    best = None
    for before, after in zip(rows, rows[1:]):
        seconds = (after["t"] - before["t"]).total_seconds()
        if seconds >= gap_seconds and (best is None or seconds > best[0]):
            best = (seconds, before["t"], after["t"])
    return best


def _count(n):
    return "1 lectura" if n == 1 else f"{n:,} lecturas".replace(",", ".")


def _change_phrase(delta, noun, unit, threshold, digits, up, down, same):
    if abs(delta) < threshold:
        return f"{noun} {same}"
    return f"{noun} {up if delta > 0 else down} {fmt(abs(delta), digits)} {unit}"


def build_story(rows: list, stats: dict, period: str, site_name: str, gap_seconds=GAP_MINUTES * 60):
    period = period if period in PERIOD_NAMES else "hoy"
    name = PERIOD_NAMES[period]
    data = _clean(rows)

    if not data:
        return [
            {"number": "01", "eyebrow": "El comienzo", "title": "El lugar espera su primera lectura",
             "body": f"Cuando EcoNodo reciba datos de {site_name}, este diario empezará a contar lo que se observó. Por ahora no hay mediciones para {name}, y no se inventa ninguna.",
             "kind": "empty", "tone": "neutral", "signal_label": "Estado del diario", "signal_value": "en espera",
             "evidence": f"Sin lecturas para {name}"},
            {"number": "02", "eyebrow": "Mientras tanto", "title": "Una invitación a observar",
             "body": "La temperatura, la humedad relativa y la luz describen una parte del ambiente. Una medición aislada no explica sus causas ni el estado ecológico del lugar: sirve para empezar a hacer preguntas.",
             "kind": "guide", "tone": "light", "signal_label": "Próxima señal", "signal_value": "temperatura · humedad · luz",
             "evidence": "Guía de lectura, sin datos del periodo"},
        ]

    first, last = data[0], data[-1]
    with_day = period == "7d" or first["t"].date() != last["t"].date()
    n = len(data)
    t_first, t_last = _stamp(first["t"], with_day), _stamp(last["t"], with_day)
    temp, hum, light = (_stats(data, key) for key in ("temperature_c", "humidity_pct", "illuminance_lux"))

    if n == 1:
        opening = (f"A las {t_first}, el nodo registró {fmt(first['temperature_c'])} °C, {fmt(first['humidity_pct'])} % de humedad relativa "
                   f"y {fmt(first['illuminance_lux'], 0)} lx. Es la única lectura de {name}: una fotografía del momento, todavía sin historia.")
    else:
        opening = (f"El primer registro de {name} llegó a las {t_first}: {fmt(first['temperature_c'])} °C, "
                   f"{fmt(first['humidity_pct'])} % de humedad relativa y {fmt(first['illuminance_lux'], 0)} lx. Desde ahí el nodo siguió registrando.")
    chapters = [{
        "number": "01", "eyebrow": "Apertura", "title": "La primera señal", "body": opening, "kind": "data", "tone": "temperature",
        "signal_label": "Temperatura de apertura", "signal_value": f"{fmt(first['temperature_c'])} °C",
        "evidence": f"Lectura de las {t_first}",
    }]

    if n >= 2:
        dt = last["temperature_c"] - first["temperature_c"]
        dh = last["humidity_pct"] - first["humidity_pct"]
        dl = last["illuminance_lux"] - first["illuminance_lux"]
        phrases = [
            _change_phrase(dt, "la temperatura", "°C", .5, 1, "aumentó", "disminuyó", "quedó muy cerca de su valor inicial"),
            _change_phrase(dh, "la humedad relativa", "puntos", 2, 1, "aumentó", "disminuyó", "quedó cerca de su valor inicial"),
            _change_phrase(dl, "la iluminancia", "lx", 20, 0, "aumentó", "disminuyó", "quedó cerca de su valor inicial"),
        ]
        chapters.append({
            "number": "02", "eyebrow": "Entre lecturas", "title": "Lo que cambió",
            "body": f"Entre la primera y la última lectura registrada, {phrases[0]}, {phrases[1]} y {phrases[2]}. Son dos instantes: lo que ocurrió entre ellos está en las gráficas, y dos puntos no bastan para hablar de una tendencia.",
            "kind": "data", "tone": "change", "signal_label": "Cambio de temperatura", "signal_value": f"{signed(dt)} °C",
            "evidence": f"Lecturas de las {t_first} y las {t_last}",
        })
    else:
        chapters.append({
            "number": "02", "eyebrow": "Entre lecturas", "title": "La historia necesita tiempo",
            "body": "Hay una sola observación. Con una lectura no se puede decir si algo sube, baja o se mantiene; cuando lleguen más, EcoNodo podrá comparar momentos sin inventar una tendencia.",
            "kind": "guide", "tone": "neutral", "signal_label": "Base disponible", "signal_value": "1 lectura",
            "evidence": f"Lectura de las {t_first}",
        })

    if n >= 2:
        if fmt(temp["min"]) == fmt(temp["max"]):
            temp_range = f"la temperatura se mantuvo en {fmt(temp['min'])} °C en todas las lecturas"
        else:
            temp_range = f"la temperatura estuvo entre {fmt(temp['min'])} y {fmt(temp['max'])} °C (promedio {fmt(temp['avg'])} °C)"
        parts = [f"En {_count(n)}, {temp_range}. "
                 f"La humedad relativa promedió {fmt(hum['avg'])} % y la iluminancia {fmt(light['avg'], 0)} lx, con un máximo de {fmt(light['max'], 0)} lx."]
        span = (last["t"] - first["t"]).total_seconds()
        if span < EXPECTED_SECONDS[period] * (.9 if period == "hoy" else .8):
            parts.append(f"Las lecturas abarcan de las {t_first} a las {t_last}, así que no describen necesariamente {WHOLE_NAMES[period]}.")
        gap = _largest_gap(data, gap_seconds)
        if gap:
            parts.append(f"Hubo una pausa de {_duration(gap[0])} sin lecturas entre las {_stamp(gap[1], with_day)} y las {_stamp(gap[2], with_day)}; esos minutos no se interpretan.")
        chapters.append({
            "number": "03", "eyebrow": "Panorama", "title": "El rango del periodo", "body": " ".join(parts), "kind": "data", "tone": "humidity",
            "signal_label": "Humedad media", "signal_value": f"{fmt(hum['avg'])} %", "evidence": f"{_count(n)} de {name}",
        })
    else:
        chapters.append({
            "number": "03", "eyebrow": "Panorama", "title": "Un punto de partida",
            "body": "Los mínimos, máximos y promedios coinciden con la única lectura disponible, así que todavía no describen variaciones del lugar.",
            "kind": "guide", "tone": "humidity", "signal_label": "Humedad observada", "signal_value": f"{fmt(first['humidity_pct'])} %",
            "evidence": f"Lectura de las {t_first}",
        })

    chapters.append({
        "number": "04", "eyebrow": "Mirada crítica", "title": "La pregunta que queda abierta", "body": QUESTIONS[period] if n >= 2 else QUESTIONS["hoy"],
        "kind": "reflection", "tone": "light", "signal_label": "Lecturas que sustentan el relato", "signal_value": _count(n),
        "evidence": f"Periodo: {name}",
    })
    return chapters
