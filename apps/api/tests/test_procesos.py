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
async def test_list_procesos_paginacion_validada(client, auth_headers):
    """skip/limit deben validar rango para evitar consultas desmedidas."""
    resp_limit_cero = await client.get(f"{PREFIX}/?limit=0", headers=auth_headers)
    assert resp_limit_cero.status_code == 422

    resp_limit_excesivo = await client.get(f"{PREFIX}/?limit=10000", headers=auth_headers)
    assert resp_limit_excesivo.status_code == 422

    resp_skip_negativo = await client.get(f"{PREFIX}/?skip=-5", headers=auth_headers)
    assert resp_skip_negativo.status_code == 422

    resp_ok = await client.get(f"{PREFIX}/?skip=0&limit=100", headers=auth_headers)
    assert resp_ok.status_code == 200


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
async def test_search_by_sujetos_procesales(client, auth_headers, test_user, db):
    from models.proceso import Proceso

    db.add(
        Proceso(
            llave_proceso="05001310301220210012300",
            sujetos_procesales="DEMANDANTE: Paula Correa\nDEMANDADO: Empresa SAS",
            user_id=test_user.id,
        )
    )
    db.add(
        Proceso(
            llave_proceso="05001400300520230010000",
            sujetos_procesales="DEMANDANTE: Otra Parte",
            user_id=test_user.id,
        )
    )
    db.commit()

    response = await client.get(f"{PREFIX}/?q=paula", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["procesos"][0]["llave_proceso"] == "05001310301220210012300"


@pytest.mark.asyncio
async def test_search_by_despacho(client, auth_headers, test_user, db):
    from models.proceso import Proceso

    db.add(
        Proceso(
            llave_proceso="05001310301220210012300",
            despacho="Juzgado 17 Civil del Circuito de Medellín",
            user_id=test_user.id,
        )
    )
    db.commit()

    response = await client.get(f"{PREFIX}/?q=civil", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1


@pytest.mark.asyncio
async def test_filter_by_notificado(client, auth_headers, test_user, db):
    from models.proceso import Proceso

    db.add(
        Proceso(
            llave_proceso="05001310301220210012300",
            notificado=True,
            user_id=test_user.id,
        )
    )
    db.add(
        Proceso(
            llave_proceso="05001400300520230010000",
            notificado=False,
            user_id=test_user.id,
        )
    )
    db.commit()

    vigente = await client.get(f"{PREFIX}/?notificado=true", headers=auth_headers)
    assert vigente.status_code == 200
    assert vigente.json()["total"] == 1
    assert vigente.json()["procesos"][0]["llave_proceso"] == "05001310301220210012300"

    pendiente = await client.get(f"{PREFIX}/?notificado=false", headers=auth_headers)
    assert pendiente.status_code == 200
    assert pendiente.json()["total"] == 1
    assert pendiente.json()["procesos"][0]["llave_proceso"] == "05001400300520230010000"


@pytest.mark.asyncio
async def test_filter_by_despacho(client, auth_headers, test_user, db):
    from models.proceso import Proceso

    db.add(
        Proceso(
            llave_proceso="05001310301220210012300",
            despacho="Juzgado 17 Civil del Circuito de Medellín",
            user_id=test_user.id,
        )
    )
    db.add(
        Proceso(
            llave_proceso="05001400300520230010000",
            despacho="Juzgado 5 Civil Municipal",
            user_id=test_user.id,
        )
    )
    db.commit()

    response = await client.get(f"{PREFIX}/?despacho=municipal", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["procesos"][0]["llave_proceso"] == "05001400300520230010000"


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


def _crear_proceso_con_documento(db, user_id, id_reg_documento=999):
    from models.proceso import Proceso
    from models.actuacion import Actuacion
    from models.documento_actuacion import DocumentoActuacion

    p = Proceso(llave_proceso=RADICADO_VALIDO, user_id=user_id)
    db.add(p)
    db.commit()
    db.refresh(p)
    a = Actuacion(proceso_id=p.id, id_reg_actuacion=1, cons_actuacion=1)
    db.add(a)
    db.commit()
    db.refresh(a)
    d = DocumentoActuacion(
        actuacion_id=a.id, id_reg_documento=id_reg_documento, nombre="auto.pdf"
    )
    db.add(d)
    db.commit()
    return d


@pytest.mark.asyncio
async def test_documento_de_otro_usuario_rechazado(client, auth_headers, otro_usuario, db):
    _crear_proceso_con_documento(db, otro_usuario.id)

    response = await client.get(f"{PREFIX}/documento/999", headers=auth_headers)
    assert response.status_code == 404
    assert "Documento no encontrado" in response.json()["detail"]


@pytest.mark.asyncio
async def test_documento_propietario_puede_descargar(client, auth_headers, test_user, db):
    from unittest.mock import patch

    _crear_proceso_con_documento(db, test_user.id)

    with patch(
        "scraper.rama_client.descargar_documento",
        return_value=(b"%PDF-1.4 contenido-de-prueba", "auto.pdf"),
    ):
        response = await client.get(f"{PREFIX}/documento/999", headers=auth_headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert b"contenido-de-prueba" in response.content


@pytest.mark.asyncio
async def test_documento_requiere_auth(client):
    response = await client.get(f"{PREFIX}/documento/999")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_sync_manual_responde_inmediato_y_estado_disponible(client, auth_headers):
    respuesta = await client.post(f"{PREFIX}/sync", headers=auth_headers)
    assert respuesta.status_code == 200
    data = respuesta.json()
    assert data["iniciado"] is True
    assert data["en_curso"] is True

    estado = await client.get(f"{PREFIX}/sync/estado", headers=auth_headers)
    assert estado.status_code == 200
    body = estado.json()
    assert "en_curso" in body
    assert "resultado" in body
    assert "error" in body


@pytest.mark.asyncio
async def test_sync_estado_sin_historial(client, auth_headers):
    estado = await client.get(f"{PREFIX}/sync/estado", headers=auth_headers)
    assert estado.status_code == 200
    body = estado.json()
    assert body["en_curso"] is False
    assert body["resultado"] is None


@pytest.mark.asyncio
async def test_sync_manual_requiere_auth(client):
    response = await client.post(f"{PREFIX}/sync")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_novedades_detalle_incluye_info_de_aviso(client, auth_headers, test_user, db):
    from models.proceso import Proceso

    p = Proceso(
        llave_proceso=RADICADO_VALIDO,
        user_id=test_user.id,
        notificado=False,
        tipo_novedad="actualizacion",
        canales_notificados="email+telegram",
        notificacion_pendiente=False,
        intentos_notificacion=2,
    )
    db.add(p)
    db.commit()

    response = await client.get(f"{PREFIX}/novedades-detalle", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["intentos_max_aviso"] == 5
    item = body["novedades"][0]
    assert item["canales_notificados"] == "email+telegram"
    assert item["notificacion_pendiente"] is False
    assert item["intentos_notificacion"] == 2


@pytest.mark.asyncio
async def test_novedades_detalle_sin_aviso_registrado(client, auth_headers, test_user, db):
    """Radicado sin canales configurados: campos presentes y en None/0."""
    from models.proceso import Proceso

    p = Proceso(llave_proceso=RADICADO_VALIDO, user_id=test_user.id, notificado=False)
    db.add(p)
    db.commit()

    response = await client.get(f"{PREFIX}/novedades-detalle", headers=auth_headers)
    assert response.status_code == 200
    item = response.json()["novedades"][0]
    assert item["canales_notificados"] is None
    assert item["notificacion_pendiente"] is False
    assert item["intentos_notificacion"] == 0
