import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_register_user(client):
    response = await client.post(
        "/auth/register",
        json={"email": "nuevo@example.com", "password": "segura123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "nuevo@example.com"
    assert "access_token" in response.cookies
    assert data["telegram_chat_id"] is None


@pytest.mark.asyncio
async def test_register_short_password(client):
    response = await client.post(
        "/auth/register",
        json={"email": "corta@example.com", "password": "corta"},
    )
    assert response.status_code == 400
    assert "8 caracteres" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client, test_user):
    response = await client.post(
        "/auth/register",
        json={"email": "test@example.com", "password": "otra1234"},
    )
    assert response.status_code == 400
    assert "registrado" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_password_filtrada_rechazada(client):
    import routers.auth as auth_router

    with patch("routers.auth.password_en_filtraciones", return_value=True):
        response = await client.post(
            "/auth/register",
            json={"email": "filtrada@example.com", "password": "password123"},
        )
    assert response.status_code == 400
    assert "filtraciones" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_password_en_filtraciones_detecta_brecha():
    from services.auth import password_en_filtraciones
    import hashlib
    from unittest.mock import MagicMock, patch

    sha1 = hashlib.sha1(b"password123").hexdigest().upper()
    sufijo = sha1[5:]
    fake_resp = MagicMock()
    fake_resp.text = f"{sufijo}:37452\nABCDEF:0"
    fake_resp.raise_for_status = lambda: None

    with patch("services.auth.HIBP_CHECK_ENABLED", True), \
         patch("services.auth.httpx.get", return_value=fake_resp):
        assert password_en_filtraciones("password123") is True


@pytest.mark.asyncio
async def test_password_en_filtraciones_sin_brecha():
    from services.auth import password_en_filtraciones
    from unittest.mock import MagicMock, patch

    fake_resp = MagicMock()
    fake_resp.text = "ZZZZZ:3"
    fake_resp.raise_for_status = lambda: None

    with patch("services.auth.HIBP_CHECK_ENABLED", True), \
         patch("services.auth.httpx.get", return_value=fake_resp):
        assert password_en_filtraciones("clave-unicamente-segura-9x8y") is False


@pytest.mark.asyncio
async def test_password_en_filtraciones_fail_open_sin_red():
    """Si HIBP no responde, no debe bloquearse el registro."""
    from services.auth import password_en_filtraciones
    from unittest.mock import patch

    with patch("services.auth.HIBP_CHECK_ENABLED", True), \
         patch("services.auth.httpx.get", side_effect=RuntimeError("sin red")):
        assert password_en_filtraciones("password123") is False


@pytest.mark.asyncio
async def test_login_with_email(client, test_user):
    response = await client.post(
        "/auth/login",
        json={"credential": "test@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in response.cookies
    assert data["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_login_with_username(client, test_user):
    response = await client.post(
        "/auth/login",
        json={"credential": "testuser", "password": "password123"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_login_wrong_password(client, test_user):
    response = await client.post(
        "/auth/login",
        json={"credential": "test@example.com", "password": "incorrecta"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_mutation_with_disallowed_origin(client):
    response = await client.post(
        "/auth/login",
        json={"credential": "test@example.com", "password": "password123"},
        headers={"Origin": "https://sitio-malicioso.example"},
    )
    assert response.status_code == 403
    assert "no permitido" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mutation_with_allowed_origin(client, test_user):
    response = await client.post(
        "/auth/login",
        json={"credential": "test@example.com", "password": "password123"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_mutation_with_bearer_skips_origin_check(client, test_user):
    from services.auth import create_access_token
    token = create_access_token(data={"sub": test_user.email})
    response = await client.post(
        "/auth/login",
        json={"credential": "test@example.com", "password": "password123"},
        headers={"Authorization": f"Bearer {token}", "Origin": "https://cualquiera.example"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_update_telegram_chat_id(client, auth_headers):
    response = await client.patch(
        "/auth/telegram",
        json={"telegram_chat_id": "123456789"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["telegram_chat_id"] == "123456789"


@pytest.mark.asyncio
async def test_update_telegram_requires_auth(client):
    response = await client.patch(
        "/auth/telegram",
        json={"telegram_chat_id": "123456789"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_clear_telegram_chat_id(client, auth_headers, test_user, db):
    test_user.telegram_chat_id = "123456789"
    db.commit()

    response = await client.patch(
        "/auth/telegram",
        json={"telegram_chat_id": None},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["telegram_chat_id"] is None


# ---------- Revocacion de tokens (token_version) ----------

@pytest.mark.asyncio
async def test_logout_revoca_token(client, test_user, db):
    from services.auth import create_access_token

    token = create_access_token(data={"sub": test_user.email, "ver": 1})
    headers = {"Authorization": f"Bearer {token}"}

    me_antes = await client.get("/auth/me", headers=headers)
    assert me_antes.status_code == 200

    logout = await client.post("/auth/logout", headers=headers)
    assert logout.status_code == 200

    db.refresh(test_user)
    assert test_user.token_version == 2

    me_despues = await client.get("/auth/me", headers=headers)
    assert me_despues.status_code == 401


@pytest.mark.asyncio
async def test_token_con_version_distinta_es_rechazado(client, test_user, db):
    from services.auth import create_access_token

    token = create_access_token(data={"sub": test_user.email, "ver": 99})
    response = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
