"""Utilidades para fechas de la Rama Judicial.

La Rama envia las fechas como texto en formatos inconsistentes
('2024-06-10', ISO con offset, horas 12h con o sin espacio antes de
AM/PM, etc.). Todo el sistema trabaja con datetime naive (hora local
Colombia tal cual llega); este modulo es el unico punto que convierte
texto -> datetime y datetime -> texto.
"""
import re
from datetime import datetime

_FORMATOS_12H = (
    "%Y-%m-%d %I:%M:%S %p",
    "%Y-%m-%d %I:%M %p",
)
_FORMATOS_24H = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
)

_SUFIJO_MERIDIANO = re.compile(r"(?i)[\s]*(a|p)\.?\s*m\.?\s*$")


def parsear_fecha(valor) -> datetime | None:
    """Convierte una fecha (texto de Rama, ISO o datetime) a datetime naive.

    Nunca lanza excepcion: devuelve None si el valor es vacio o ilegible,
    para que un dato corrupto no tumbe la sincronizacion.
    """
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.replace(tzinfo=None) if valor.tzinfo else valor

    texto = str(valor).strip()
    if not texto or texto.lower() in {"null", "none", "n/d"}:
        return None

    # ISO completo ('T' o espacio, con o sin offset/'Z')
    try:
        dt = datetime.fromisoformat(texto.replace("Z", "+00:00"))
        return dt.replace(tzinfo=None)
    except ValueError:
        pass

    candidato = texto.replace("T", " ")
    # Normalizar sufijos meridianos: '05:25:00PM', '5:25 p.m.', 'P.M.'...
    m = _SUFIJO_MERIDIANO.search(candidato)
    if m:
        candidato = candidato[: m.start()] + f" {m.group(1).upper()}M"
        for fmt in _FORMATOS_12H:
            try:
                return datetime.strptime(candidato, fmt)
            except ValueError:
                continue
    else:
        for fmt in _FORMATOS_24H:
            try:
                return datetime.strptime(candidato, fmt)
            except ValueError:
                continue

    # Ultimo recurso: solo la parte de la fecha
    try:
        return datetime.strptime(texto[:10], "%Y-%m-%d")
    except ValueError:
        return None


def fecha_corta(valor, defecto: str = "N/D") -> str:
    """Representacion 'YYYY-MM-DD' para mostrar en emails/Telegram.

    Acepta datetime (columnas ya migradas), str legado y None.
    """
    if isinstance(valor, datetime):
        return valor.strftime("%Y-%m-%d")
    texto = str(valor).strip() if valor else ""
    return texto[:10] if texto else defecto
