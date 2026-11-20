"""Traduce el JSON del prototipo al contrato interno de EcoNodo."""

import math


FIELD_ALIASES = {
    "node_id": "nodo",
    "temperature_c": "temperatura",
    "humidity_pct": "humedad",
    "illuminance_lux": "lux",
}
BOUNDS = {
    "temperature_c": (-40, 80),
    "humidity_pct": (0, 100),
    "illuminance_lux": (0, 65535),
}


class ReadingValidationError(ValueError):
    def __init__(self, message, code="invalid_reading"):
        super().__init__(message)
        self.code = code


def normalize_reading(payload):
    """Valida sin mutar el original ni sustituir valores por datos inventados.

    Una luz saturada invalida la muestra completa: el esquema actual requiere
    tres medidas fiables. La última muestra válida permanece en el historial.
    """
    if not isinstance(payload, dict):
        raise ReadingValidationError("Se requiere un objeto JSON.", "invalid_json")

    normalized = {}
    for canonical, alias in FIELD_ALIASES.items():
        if canonical in payload and alias in payload:
            raise ReadingValidationError(
                f"Envía solo uno de los campos {canonical} o {alias}.", "ambiguous_fields"
            )
        if canonical in payload:
            normalized[canonical] = payload[canonical]
        elif alias in payload:
            normalized[canonical] = payload[alias]

    saturated = payload.get("lux_saturado", False)
    if not isinstance(saturated, bool):
        raise ReadingValidationError(
            "lux_saturado debe ser true o false (booleano JSON).", "invalid_saturation_flag"
        )
    if saturated:
        raise ReadingValidationError(
            "Luz saturada: no se guarda esta muestra. Se conserva la última lectura válida.",
            "light_saturated",
        )

    node_id = normalized.get("node_id", "nodo-1")
    if (not isinstance(node_id, str) or not 1 <= len(node_id) <= 40
            or not all(character.isalnum() or character in "-_" for character in node_id)):
        raise ReadingValidationError("node_id/nodo inválido.", "invalid_node_id")

    values = {}
    for key, (low, high) in BOUNDS.items():
        raw = normalized.get(key)
        # El rango se compara antes de convertir, incluso con enteros enormes.
        if (isinstance(raw, bool) or not isinstance(raw, (int, float))
                or not low <= raw <= high or not math.isfinite(raw)):
            raise ReadingValidationError(
                f"{key}/{FIELD_ALIASES[key]} debe ser un número finito entre {low} y {high}."
            )
        values[key] = round(float(raw), 2)
    return node_id, values
