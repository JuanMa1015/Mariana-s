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
    assert result == {"email": False, "telegram": False}


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
    assert result == {"email": False, "telegram": False}


@pytest.mark.asyncio
async def test_enviar_sendgrid_sin_api_key_retorna_false():
    from services.notifications import _enviar_sendgrid

    ok, _detalle = _enviar_sendgrid(
        destinatarios=["test@example.com"],
        asunto="Test",
        cuerpo_html="<p>Test</p>",
        cuerpo_texto="Test",
    )
    assert ok is False


@pytest.mark.asyncio
async def test_enviar_smtp_sin_host_retorna_false():
    from services.notifications import _enviar_smtp

    ok, detalle = _enviar_smtp(
        destinatarios=["test@example.com"],
        asunto="Test",
        cuerpo_html="<p>Test</p>",
        cuerpo_texto="Test",
    )
    assert ok is False
    assert detalle is not None


@pytest.mark.asyncio
async def test_enviar_smtp_reintenta_465_cuando_587_inalcanzable():
    """Si la red bloquea el 587 (p. ej. Render), reintenta por 465 SSL."""
    from services import notifications as n

    with (
        patch.object(n, "SMTP_HOST", "smtp.gmail.com"),
        patch.object(n, "SMTP_PORT", 587),
        patch.object(n, "SMTP_USE_TLS", True),
        patch.object(n, "smtplib") as mock_smtplib,
    ):
        # Tanto SMTP como SMTP_SSL fallan al conectar
        mock_smtplib.SMTP.side_effect = OSError(101, "Network is unreachable")
        mock_smtplib.SMTP_SSL.side_effect = OSError(101, "Network is unreachable")

        ok, detalle = n._enviar_smtp(
            destinatarios=["test@example.com"],
            asunto="Test",
            cuerpo_html="<p>Test</p>",
            cuerpo_texto="Test",
        )

    assert ok is False
    assert "starttls/587" in detalle and "ssl/465" in detalle
    mock_smtplib.SMTP.assert_called_once()
    mock_smtplib.SMTP_SSL.assert_called_once()


@pytest.mark.asyncio
async def test_enviar_smtp_usa_465_directo_cuando_esta_configurado():
    from services import notifications as n

    sent = {}

    class FakeServer:
        def __init__(self, host, port, timeout=None):
            sent["puerto"] = port
            sent["modo"] = "ssl"

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def login(self, u, p):
            pass

        def send_message(self, m):
            sent["enviado"] = True

    with (
        patch.object(n, "SMTP_HOST", "smtp.gmail.com"),
        patch.object(n, "SMTP_PORT", 465),
        patch.object(n, "smtplib") as mock_smtplib,
    ):
        mock_smtplib.SMTP_SSL.side_effect = FakeServer

        ok, _detalle = n._enviar_smtp(
            destinatarios=["test@example.com"],
            asunto="Test",
            cuerpo_html="<p>Test</p>",
            cuerpo_texto="Test",
        )

    assert ok is True
    assert sent == {"puerto": 465, "modo": "ssl", "enviado": True}
    mock_smtplib.SMTP.assert_not_called()


@pytest.mark.asyncio
async def test_notificar_telegram_fallback_sin_token():
    from services.notifications import notificar_cambio_radicado

    with patch("services.telegram.notificar_telegram", return_value=False) as mock_tg:
        result = notificar_cambio_radicado(
            llave_proceso="05001310301220210012300",
            despacho="Juzgado 12",
            departamento="Antioquia",
            fecha_ultima_actuacion="2024-06-10",
            sujetos_procesales="Perez, Juan",
            actuacion="Se admitio demanda",
        )
        assert result == {"email": False, "telegram": False}
        mock_tg.assert_called_once()


@pytest.mark.asyncio
async def test_notificar_con_custom_asunto_cuerpo():
    from services.notifications import notificar_cambio_radicado

    with (
        patch("services.notifications.SENDGRID_API_KEY", "fake-key"),
        patch("services.notifications._enviar_sendgrid") as mock_sg,
        patch("services.telegram.notificar_telegram", return_value=False),
    ):
        mock_sg.return_value = (True, None)
        result = notificar_cambio_radicado(
            llave_proceso="test",
            despacho="",
            departamento="",
            fecha_ultima_actuacion=None,
            sujetos_procesales="",
            custom_asunto="Asunto personalizado",
            custom_cuerpo="<p>Cuerpo personalizado</p>",
        )
        assert result["email"] is True
        mock_sg.assert_called_once()
        args, kwargs = mock_sg.call_args
        assert "Asunto personalizado" in args[1]
        assert "<p>Cuerpo personalizado</p>" in args[2]
