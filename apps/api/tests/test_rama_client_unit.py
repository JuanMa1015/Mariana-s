import pytest

from scraper.rama_client import sanear_nombre_archivo


def test_nombre_simple_se_mantiene():
    assert sanear_nombre_archivo("informe legal 2024.pdf") == "informe legal 2024.pdf"


def test_elimina_comillas_y_separadores():
    resultado = sanear_nombre_archivo('report"e;.pdf')
    assert '"' not in resultado
    assert sanear_nombre_archivo("../../etc/passwd") == "etcpasswd"
    assert "/" not in sanear_nombre_archivo("../../etc/passwd")
    assert "\\" not in sanear_nombre_archivo("..\\..\\windows\\win.ini")


def test_elimina_saltos_de_linea_para_evitar_inyeccion_de_header():
    resultado = sanear_nombre_archivo("mal\r\nSet-Cookie: session=1.pdf")
    assert "\r" not in resultado
    assert "\n" not in resultado
    assert ":" not in resultado


def test_vacio_devuelve_default():
    assert sanear_nombre_archivo("") == "documento.pdf"
    assert sanear_nombre_archivo('""') == "documento.pdf"


def test_trunca_nombres_excesivamente_largos():
    resultado = sanear_nombre_archivo("a" * 500 + ".pdf")
    assert len(resultado) <= 120
