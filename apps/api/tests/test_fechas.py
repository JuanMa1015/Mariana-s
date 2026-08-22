from datetime import datetime, timezone

from services.fechas import fecha_corta, parsear_fecha


def test_parsear_iso_basico():
    assert parsear_fecha("2024-06-10") == datetime(2024, 6, 10)


def test_parsear_iso_con_hora():
    assert parsear_fecha("2024-06-10 14:30:25") == datetime(2024, 6, 10, 14, 30, 25)
    assert parsear_fecha("2024-06-10T14:30:25") == datetime(2024, 6, 10, 14, 30, 25)


def test_parsear_iso_con_offset_se_vuelve_naive():
    dt = parsear_fecha("2024-06-10T14:30:25Z")
    assert dt == datetime(2024, 6, 10, 14, 30, 25)
    assert dt.tzinfo is None


def test_parsear_hora_12h_am_pm():
    assert parsear_fecha("2024-06-10 05:25:00 PM") == datetime(2024, 6, 10, 17, 25, 0)
    assert parsear_fecha("2024-06-10 12:05:00 a.m.") == datetime(2024, 6, 10, 0, 5, 0)


def test_parsear_datetime_passthrough_y_quita_tz():
    naive = datetime(2023, 1, 2, 3, 4, 5)
    assert parsear_fecha(naive) is naive
    aware = naive.replace(tzinfo=timezone.utc)
    assert parsear_fecha(aware) == naive
    assert parsear_fecha(aware).tzinfo is None


def test_parsear_valores_invalidos_devuelven_none():
    assert parsear_fecha(None) is None
    assert parsear_fecha("") is None
    assert parsear_fecha("   ") is None
    assert parsear_fecha("null") is None
    assert parsear_fecha("no-es-una-fecha") is None
    assert parsear_fecha("31/31/9999") is None


def test_fecha_corta_con_datetime_string_y_none():
    assert fecha_corta(datetime(2024, 6, 10, 8, 0)) == "2024-06-10"
    assert fecha_corta("2024-06-10 08:00:00") == "2024-06-10"
    assert fecha_corta(None) == "N/D"
    assert fecha_corta(None, defecto="-") == "-"
    assert fecha_corta("") == "N/D"
