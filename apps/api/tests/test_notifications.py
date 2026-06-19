import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_notificar_sin_config_retorna_false():
    from services.notifications import notificar_cambio_radicado

    result = notificar_cambio_radicado(
        llave_proceso="05001310301220210012300",
        despacho="Juzgado 12",
        departamento="Antioquia",
        fecha_ultima_actuacion="2024-06-10",
        sujetos_procesales="Perez, Juan | DEMANDANTE",
        actuacion="Se admitio demanda",
        anotacion="Auto admisorio",
    )
    assert result is False


@pytest.mark.asyncio
async def test_notificar_sujetos_procesales_vacios():
    from services.notifications import notificar_cambio_radicado

    result = notificar_cambio_radicado(
        llave_proceso="05001310301220210012300",
        despacho="",
        departamento="",
        fecha_ultima_actuacion=None,
        sujetos_procesales="",
    )
    assert result is False


@pytest.mark.asyncio
async def test_enviar_sendgrid_sin_api_key_retorna_false():
    from services.notifications import _enviar_sendgrid

    result = _enviar_sendgrid(
        destinatarios=["test@example.com"],
        asunto="Test",
        cuerpo_html="<p>Test</p>",
        cuerpo_texto="Test",
    )
    assert result is False


@pytest.mark.asyncio
async def test_enviar_smtp_sin_host_retorna_false():
    from services.notifications import _enviar_smtp

    result = _enviar_smtp(
        destinatarios=["test@example.com"],
        asunto="Test",
        cuerpo_html="<p>Test</p>",
        cuerpo_texto="Test",
    )
    assert result is False


@pytest.mark.asyncio
async def test_notificar_telegram_fallback_sin_token():
    from services.notifications import notificar_cambio_radicado

    with patch("services.telegram.notificar_telegram") as mock_tg:
        result = notificar_cambio_radicado(
            llave_proceso="05001310301220210012300",
            despacho="Juzgado 12",
            departamento="Antioquia",
            fecha_ultima_actuacion="2024-06-10",
            sujetos_procesales="Perez, Juan",
            actuacion="Se admitio demanda",
        )
        assert result is False
        mock_tg.assert_called_once()


@pytest.mark.asyncio
async def test_notificar_con_custom_asunto_cuerpo():
    from services.notifications import notificar_cambio_radicado

    with (
        patch("services.notifications.SENDGRID_API_KEY", "fake-key"),
        patch("services.notifications._enviar_sendgrid") as mock_sg,
        patch("services.telegram.notificar_telegram"),
    ):
        mock_sg.return_value = True
        result = notificar_cambio_radicado(
            llave_proceso="test",
            despacho="",
            departamento="",
            fecha_ultima_actuacion=None,
            sujetos_procesales="",
            custom_asunto="Asunto personalizado",
            custom_cuerpo="<p>Cuerpo personalizado</p>",
        )
        assert result is True
        mock_sg.assert_called_once()
        args, kwargs = mock_sg.call_args
        assert "Asunto personalizado" in args[1]
        assert "<p>Cuerpo personalizado</p>" in args[2]
