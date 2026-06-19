import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_notificar_telegram_sin_token():
    from services.telegram import notificar_telegram

    result = notificar_telegram(
        llave_proceso="05001310301220210012300",
        despacho="Juzgado 12",
        departamento="Antioquia",
        fecha_ultima_actuacion="2024-06-10",
    )
    assert result is False


@pytest.mark.asyncio
async def test_notificar_telegram_sin_chat_id():
    from services.telegram import notificar_telegram

    with patch("services.telegram.TELEGRAM_BOT_TOKEN", "fake:token"):
        result = notificar_telegram(
            llave_proceso="05001310301220210012300",
            despacho="Juzgado 12",
            departamento="Antioquia",
            fecha_ultima_actuacion="2024-06-10",
        )
        assert result is False


@pytest.mark.asyncio
async def test_mensaje_texto_formato():
    from services.telegram import _mensaje_texto

    texto = _mensaje_texto(
        llave_proceso="05001310301220210012300",
        despacho="Juzgado 12",
        departamento="Antioquia",
        fecha_ultima_actuacion="2024-06-10",
        actuacion="Se admitio demanda",
        anotacion="Auto admisorio",
        categoria="General",
        sujetos_procesales="Perez, Juan | DEMANDANTE",
        fecha_registro="2024-06-10",
        con_documentos=True,
    )

    assert "05001310301220210012300" in texto
    assert "Juzgado 12" in texto
    assert "Antioquia" in texto
    assert "Se admitio demanda" in texto
    assert "Auto admisorio" in texto
    assert "Perez, Juan" in texto
    assert "DEMANDANTE" in texto
    assert "General" in texto


@pytest.mark.asyncio
async def test_mensaje_texto_sin_sujetos():
    from services.telegram import _mensaje_texto

    texto = _mensaje_texto(
        llave_proceso="test",
        despacho="",
        departamento="",
        fecha_ultima_actuacion=None,
    )

    assert "Sin informacion" in texto


@pytest.mark.asyncio
async def test_mensaje_texto_con_documentos():
    from services.telegram import _mensaje_texto

    texto_si = _mensaje_texto(
        llave_proceso="test", despacho="", departamento="",
        fecha_ultima_actuacion=None, con_documentos=True,
    )
    assert "Sí" in texto_si or "Si" in texto_si or "Si" in texto_si

    texto_no = _mensaje_texto(
        llave_proceso="test", despacho="", departamento="",
        fecha_ultima_actuacion=None, con_documentos=False,
    )
    assert "No" in texto_no
