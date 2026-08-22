from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

import routers.admin as admin_router
from models.actuacion import Actuacion
from models.documento_actuacion import DocumentoActuacion
from models.proceso import Proceso


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _proceso(db, llave="900-TEST", notificado=False) -> Proceso:
    p = Proceso(user_id=1, llave_proceso=llave, notificado=notificado)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _actuacion(db, proceso_id: int, id_reg=1001) -> Actuacion:
    a = Actuacion(
        proceso_id=proceso_id,
        id_reg_actuacion=id_reg,
        cons_actuacion=1,
        fecha_actuacion=datetime(2024, 6, 10),
        actuacion="Auto",
        anotacion=None,
        fecha_inicial=None,
        fecha_final=None,
        fecha_registro=datetime(2024, 6, 10),
        cod_regla=None,
        con_documentos=True,
        cant=1,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


# ---------- Autenticación por API_TOKEN ----------

@pytest.mark.asyncio
async def test_admin_sin_token_configurado_devuelve_503(client):
    resp = await client.get("/test-email")
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_admin_token_invalido_devuelve_401(client):
    with patch.object(admin_router, "API_TOKEN", "secreto"):
        resp = await client.get("/marcar-leido", params={"llave_proceso": "X"}, headers=_auth("malo"))
    assert resp.status_code == 401


# ---------- marcar-leido ----------

@pytest.mark.asyncio
async def test_marcar_leido_marca_proceso(client, db):
    p = _proceso(db, llave="901-MARCAR")

    with patch.object(admin_router, "API_TOKEN", "secreto"):
        resp = await client.get("/marcar-leido", params={"llave_proceso": "901-MARCAR"}, headers=_auth("secreto"))

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    db.expire_all()
    assert db.query(Proceso).filter(Proceso.id == p.id).first().notificado is True


@pytest.mark.asyncio
async def test_marcar_leido_radicado_inexistente(client):
    with patch.object(admin_router, "API_TOKEN", "secreto"):
        resp = await client.get("/marcar-leido", params={"llave_proceso": "NOPE"}, headers=_auth("secreto"))
    assert resp.status_code == 200
    assert resp.json() == {"ok": False, "error": "No encontrado"}


# ---------- resetear-radicado (borrados en lote) ----------

@pytest.mark.asyncio
async def test_resetear_radicado_borra_en_lote(client, db):
    p = _proceso(db, llave="902-RESET", notificado=False)
    a = _actuacion(db, p.id)
    doc = DocumentoActuacion(
        actuacion_id=a.id,
        id_reg_documento=777,
        nombre="sentencia.pdf",
        descripcion=None,
        tipo="pdf",
        fecha_carga=datetime(2024, 6, 11),
    )
    db.add(doc)
    p.fecha_ultima_actuacion = datetime(2024, 6, 10)
    db.commit()

    with patch.object(admin_router, "API_TOKEN", "secreto"):
        resp = await client.get("/resetear-radicado", params={"llave_proceso": "902-RESET"}, headers=_auth("secreto"))

    body = resp.json()
    assert resp.status_code == 200
    assert body["ok"] is True
    assert body["actuaciones_borradas"] == 1
    assert body["documentos_borrados"] == 1

    db.expire_all()
    assert db.query(Actuacion).filter(Actuacion.proceso_id == p.id).count() == 0
    assert db.query(DocumentoActuacion).count() == 0
    p2 = db.query(Proceso).filter(Proceso.id == p.id).first()
    assert p2.notificado is True
    assert p2.fecha_ultima_actuacion is None


# ---------- resetear-todos (bulk update + delete) ----------

@pytest.mark.asyncio
async def test_resetear_todos_borra_todo_en_lote(client, db):
    for llave in ("903-TODOS-A", "904-TODOS-B"):
        p = _proceso(db, llave=llave, notificado=False)
        _actuacion(db, p.id)

    with patch.object(admin_router, "API_TOKEN", "secreto"):
        resp = await client.post("/resetear-todos", headers=_auth("secreto"))

    body = resp.json()
    assert resp.status_code == 200
    assert body["ok"] is True
    assert body["total_radicados"] == 2
    assert body["actuaciones_borradas"] == 2

    db.expire_all()
    assert db.query(Actuacion).count() == 0
    assert db.query(DocumentoActuacion).count() == 0
    procesos = db.query(Proceso).all()
    assert all(pr.notificado is True and pr.tipo_novedad == "nuevo" and pr.fecha_ultima_actuacion is None for pr in procesos)


# ---------- test-email ----------

@pytest.mark.asyncio
async def test_test_email_sin_credenciales_reporta_false(client):
    with patch.object(admin_router, "API_TOKEN", "secreto"):
        resp = await client.get("/test-email", headers=_auth("secreto"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["email_enviado"] is False
    assert body["resultados"]["sendgrid"]["api_key_set"] is False
    assert body["destinatarios"] == ["test@example.com"]


@pytest.mark.asyncio
async def test_test_email_con_sendgrid_ok_reporta_true(client):
    """Regression: el endpoint llamaba a los enviadores con 3 argumentos
    (faltaba cuerpo_texto) y siempre reportaba fallo."""
    with patch.object(admin_router, "API_TOKEN", "secreto"), patch(
        "config.SENDGRID_API_KEY", "SG.key"
    ), patch("config.SMTP_HOST", ""), patch(
        "services.notifications._enviar_sendgrid", return_value=True
    ) as m_sg:
        resp = await client.get("/test-email", headers=_auth("secreto"))

    assert resp.status_code == 200
    body = resp.json()
    assert body["email_enviado"] is True
    assert body["resultados"]["sendgrid"]["ok"] is True
    m_sg.assert_called_once()
    assert len(m_sg.call_args.args) == 4


# ---------- test-notificacion ----------

@pytest.mark.asyncio
async def test_test_notificacion_usa_ultimo_radicado(client, db):
    p = _proceso(db, llave="905-NOTIF")
    _actuacion(db, p.id)

    with patch.object(admin_router, "API_TOKEN", "secreto"), patch(
        "services.notifications.notificar_cambio_radicado",
        return_value={"email": False, "telegram": False},
    ) as mock_notif:
        resp = await client.get("/test-notificacion", headers=_auth("secreto"))

    assert resp.status_code == 200
    body = resp.json()
    assert body["radicado"] == "905-NOTIF"
    assert body["email_enviado"] is False
    mock_notif.assert_called_once()


@pytest.mark.asyncio
async def test_test_notificacion_sin_procesos(client):
    with patch.object(admin_router, "API_TOKEN", "secreto"):
        resp = await client.get("/test-notificacion", headers=_auth("secreto"))
    assert resp.status_code == 200
    assert resp.json() == {"error": "No hay procesos en la DB"}


# ---------- telegram-listar ----------

@pytest.mark.asyncio
async def test_telegram_listar_sin_bot_token(client):
    with patch.object(admin_router, "API_TOKEN", "secreto"):
        resp = await client.get("/admin/telegram-listar", headers=_auth("secreto"))
    assert resp.status_code == 200
    assert resp.json() == {"error": "TELEGRAM_BOT_TOKEN no configurado"}


@pytest.mark.asyncio
async def test_telegram_listar_chat_id_invalido_no_llama_red(client):
    with patch.object(admin_router, "API_TOKEN", "secreto"), patch.object(
        admin_router, "TELEGRAM_BOT_TOKEN", "tok"
    ), patch.object(admin_router.httpx, "post") as mock_post:
        resp = await client.get("/admin/telegram-listar", params={"test": "abc"}, headers=_auth("secreto"))

    assert resp.status_code == 200
    assert resp.json() == {"ok": False, "error": "chat_id invalido"}
    mock_post.assert_not_called()


@pytest.mark.asyncio
async def test_telegram_listar_prueba_chat_valido(client):
    fake_resp = MagicMock()
    fake_resp.json.return_value = {"ok": True}

    with patch.object(admin_router, "API_TOKEN", "secreto"), patch.object(
        admin_router, "TELEGRAM_BOT_TOKEN", "tok"
    ), patch.object(admin_router.httpx, "post", return_value=fake_resp) as mock_post:
        resp = await client.get("/admin/telegram-listar", params={"test": "-100123"}, headers=_auth("secreto"))

    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "chat_id": -100123}
    _, kwargs = mock_post.call_args
    assert kwargs["json"]["chat_id"] == -100123


# ---------- telegram-vincular ----------

@pytest.mark.asyncio
async def test_telegram_vincular_usuario_inexistente(client):
    payload = {"chat_id": "123", "email": "nadie@example.com"}
    with patch.object(admin_router, "API_TOKEN", "secreto"):
        resp = await client.post("/admin/telegram-vincular", json=payload, headers=_auth("secreto"))
    assert resp.status_code == 200
    assert resp.json() == {"ok": False, "error": "Usuario no encontrado"}
