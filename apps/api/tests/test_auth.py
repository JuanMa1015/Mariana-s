import pytest


@pytest.mark.asyncio
async def test_register_user(client):
    response = await client.post(
        "/auth/register",
        json={"email": "nuevo@example.com", "password": "segura123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "nuevo@example.com"
    assert "access_token" in data
    assert data["telegram_chat_id"] is None


@pytest.mark.asyncio
async def test_register_duplicate_email(client, test_user):
    response = await client.post(
        "/auth/register",
        json={"email": "test@example.com", "password": "otra123"},
    )
    assert response.status_code == 400
    assert "registrado" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_with_email(client, test_user):
    response = await client.post(
        "/auth/login",
        json={"credential": "test@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
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
