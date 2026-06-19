import pytest

PREFIX = "/procesos"
RADICADO_VALIDO = "05001310301220210012300"


@pytest.mark.asyncio
async def test_list_procesos_empty(client, auth_headers):
    response = await client.get(f"{PREFIX}/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["procesos"] == []


@pytest.mark.asyncio
async def test_add_radicado(client, auth_headers):
    response = await client.post(
        f"{PREFIX}/add",
        json={"llave_proceso": RADICADO_VALIDO, "despacho": "Juzgado 12 Civil"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["created"] is True
    assert data["llave_proceso"] == RADICADO_VALIDO


@pytest.mark.asyncio
async def test_add_radicado_invalid_format(client, auth_headers):
    response = await client.post(
        f"{PREFIX}/add",
        json={"llave_proceso": "123", "despacho": "Test"},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_add_duplicate_proceso(client, auth_headers, test_user, db):
    from models.proceso import Proceso

    proceso = Proceso(llave_proceso=RADICADO_VALIDO, user_id=test_user.id)
    db.add(proceso)
    db.commit()

    response = await client.post(
        f"{PREFIX}/add",
        json={"llave_proceso": RADICADO_VALIDO},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert "existe" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_procesos_with_data(client, auth_headers, test_user, db):
    from models.proceso import Proceso

    for i in range(3):
        p = Proceso(
            llave_proceso=f"0500131030122021001230{i}",
            despacho=f"Juzgado {i}",
            user_id=test_user.id,
        )
        db.add(p)
    db.commit()

    response = await client.get(f"{PREFIX}/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["procesos"]) == 3


@pytest.mark.asyncio
async def test_list_procesos_other_user_not_visible(
    client, auth_headers, otro_usuario, db
):
    from models.proceso import Proceso

    p = Proceso(
        llave_proceso="05001310301220210012300",
        user_id=otro_usuario.id,
    )
    db.add(p)
    db.commit()

    response = await client.get(f"{PREFIX}/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_requires_auth(client):
    response = await client.get(f"{PREFIX}/")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_proceso(client, auth_headers, test_user, db):
    from models.proceso import Proceso

    p = Proceso(
        llave_proceso=RADICADO_VALIDO,
        user_id=test_user.id,
    )
    db.add(p)
    db.commit()

    response = await client.delete(
        f"{PREFIX}/{RADICADO_VALIDO}", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["deleted"] is True
    assert response.json()["llave_proceso"] == RADICADO_VALIDO


@pytest.mark.asyncio
async def test_delete_other_user_proceso_forbidden(
    client, auth_headers, otro_usuario, db
):
    from models.proceso import Proceso

    p = Proceso(
        llave_proceso=RADICADO_VALIDO,
        user_id=otro_usuario.id,
    )
    db.add(p)
    db.commit()

    response = await client.delete(
        f"{PREFIX}/{RADICADO_VALIDO}", headers=auth_headers
    )
    assert response.status_code == 404
