from types import SimpleNamespace

import pytest

from services import password_reset
from services.auth import create_access_token, get_password_hash


def _ip(n: int) -> dict:
    """Cada test usa su propia 'IP' para no compartir el rate limit."""
    return {"X-Forwarded-For": f"10.8.0.{n}"}


@pytest.fixture
def admin(db):
    from models.user import User

    u = User(email="admin@example.com", username="admin", password_hash=get_password_hash("admin-pass-123"), is_admin=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def adm(admin):
    return {"Authorization": f"Bearer {create_access_token(data={'sub': admin.email, 'ver': admin.token_version})}"}


@pytest.fixture(autouse=True)
def sin_correos(monkeypatch):
    enviados = []
    monkeypatch.setattr(password_reset, "enviar_correo", lambda d, a, h, t: enviados.append(d) or True)
    return enviados


# ── Acceso ─────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_solo_admins_entran(client, auth_headers, adm):
    h = _ip(1)
    assert (await client.get("/panel/resumen", headers=h)).status_code == 401
    assert (await client.get("/panel/resumen", headers={**auth_headers, **h})).status_code == 403
    assert (await client.get("/panel/resumen", headers={**adm, **h})).status_code == 200
    assert (await client.get("/auth/me", headers={**adm, **h})).json()["es_admin"] is True
    assert (await client.get("/auth/me", headers={**auth_headers, **h})).json()["es_admin"] is False


@pytest.mark.asyncio
async def test_admin_por_correo_en_admin_emails(client, auth_headers, monkeypatch):
    from routers import panel_admin
    from services import auth

    monkeypatch.setattr(auth, "ADMIN_EMAILS", {"test@example.com"})
    monkeypatch.setattr(panel_admin, "ADMIN_EMAILS", {"test@example.com"})
    h = {**auth_headers, **_ip(2)}
    assert (await client.get("/panel/resumen", headers=h)).status_code == 200
    assert (await client.get("/auth/me", headers=h)).json()["es_admin"] is True


@pytest.mark.asyncio
async def test_resumen(client, adm, test_user, db):
    from models.proceso import Proceso

    db.add(Proceso(user_id=test_user.id, llave_proceso="05001310301720240048000", notificado=False))
    db.commit()
    r = (await client.get("/panel/resumen", headers={**adm, **_ip(3)})).json()
    assert r["usuarios"]["total"] == 2 and r["usuarios"]["admins"] == 1
    assert r["procesos"]["total"] == 1 and r["procesos"]["con_novedad"] == 1
    assert {"correo", "telegram", "push", "api_token"} <= set(r["integraciones"])


# ── Usuarios ───────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_crud_de_usuarios_con_invitacion_y_auditoria(client, adm, sin_correos):
    h = {**adm, **_ip(4)}
    r = await client.post("/panel/usuarios", json={"email": "Nuevo@Example.com", "username": "nuevo_1"}, headers=h)
    assert r.status_code == 201 and r.json()["email"] == "nuevo@example.com" and r.json()["invitacion"] == "enviado"
    assert sin_correos == [["nuevo@example.com"]]
    uid = r.json()["id"]

    assert (await client.post("/panel/usuarios", json={"email": "nuevo@example.com"}, headers=h)).status_code == 409
    assert (await client.post("/panel/usuarios", json={"email": "otro@example.com", "username": "nuevo_1"}, headers=h)).status_code == 409
    assert (await client.post("/panel/usuarios", json={"email": "x@example.com", "password": "corta"}, headers=h)).status_code == 400

    lista = (await client.get("/panel/usuarios?q=nuevo", headers=h)).json()
    assert lista["total"] == 1 and lista["usuarios"][0]["id"] == uid

    ed = await client.patch(f"/panel/usuarios/{uid}", json={"username": "renombrado", "es_admin": True, "telegram_chat_id": "123"}, headers=h)
    assert ed.json()["username"] == "renombrado" and ed.json()["es_admin"] is True and ed.json()["telegram_chat_id"] == "123"
    assert (await client.get("/panel/usuarios?estado=admins", headers=h)).json()["total"] == 2

    assert (await client.delete(f"/panel/usuarios/{uid}", headers=h)).status_code == 200
    assert (await client.get(f"/panel/usuarios/{uid}", headers=h)).status_code == 404

    acciones = [a["accion"] for a in (await client.get("/panel/auditoria", headers=h)).json()["registros"]]
    assert acciones[:3] == ["usuario.eliminar", "usuario.editar", "usuario.crear"]


@pytest.mark.asyncio
async def test_suspender_bloquea_el_acceso_y_los_admin_no_se_autodañan(client, adm, admin, auth_headers, test_user):
    h = {**adm, **_ip(5)}
    assert (await client.patch(f"/panel/usuarios/{admin.id}", json={"activo": False}, headers=h)).status_code == 400
    assert (await client.patch(f"/panel/usuarios/{admin.id}", json={"es_admin": False}, headers=h)).status_code == 400
    assert (await client.delete(f"/panel/usuarios/{admin.id}", headers=h)).status_code == 400

    # Una cuenta suspendida pierde la sesión que ya tenía y no puede volver a entrar
    assert (await client.get("/auth/me", headers={**auth_headers, **_ip(6)})).status_code == 200
    await client.patch(f"/panel/usuarios/{test_user.id}", json={"activo": False}, headers=h)
    assert (await client.get("/auth/me", headers={**auth_headers, **_ip(6)})).status_code == 401
    login = await client.post("/auth/login", json={"credential": "test@example.com", "password": "password123"}, headers=_ip(7))
    assert login.status_code == 403
    await client.patch(f"/panel/usuarios/{test_user.id}", json={"activo": True}, headers=h)
    assert (await client.get("/auth/me", headers={**auth_headers, **_ip(6)})).status_code == 200


@pytest.mark.asyncio
async def test_acciones_sobre_un_usuario(client, adm, test_user, db, auth_headers, sin_correos):
    h = {**adm, **_ip(8)}
    assert (await client.post(f"/panel/usuarios/{test_user.id}/enviar-reset", headers=h)).json() == {"estado": "enviado"}
    assert sin_correos == [["test@example.com"]]
    await client.post(f"/panel/usuarios/{test_user.id}/cerrar-sesiones", headers=h)
    # El token emitido antes de cerrar sesiones queda invalidado (lleva la versión anterior)
    viejo = {"Authorization": f"Bearer {create_access_token(data={'sub': test_user.email, 'ver': 1})}"}
    assert (await client.get("/auth/me", headers={**viejo, **_ip(9)})).status_code == 401


@pytest.mark.asyncio
async def test_borrar_usuario_arrastra_procesos_y_dispositivos(client, adm, test_user, db):
    from models.dispositivo import Dispositivo
    from models.proceso import Proceso

    db.add_all([Proceso(user_id=test_user.id, llave_proceso="05001310301720240048000"), Dispositivo(user_id=test_user.id, token="t" * 30)])
    db.commit()
    assert (await client.delete(f"/panel/usuarios/{test_user.id}", headers={**adm, **_ip(10)})).status_code == 200
    db.expire_all()
    assert db.query(Proceso).count() == 0 and db.query(Dispositivo).count() == 0


@pytest.mark.asyncio
async def test_no_se_puede_eliminar_un_admin_de_admin_emails(client, adm, test_user, monkeypatch):
    from routers import panel_admin

    monkeypatch.setattr(panel_admin, "ADMIN_EMAILS", {"test@example.com"})
    r = await client.delete(f"/panel/usuarios/{test_user.id}", headers={**adm, **_ip(11)})
    assert r.status_code == 400 and "ADMIN_EMAILS" in r.json()["detail"]


# ── Procesos y dispositivos ────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_crud_de_procesos(client, adm, test_user):
    h = {**adm, **_ip(12)}
    llave = "05001310301720240048000"
    c = await client.post("/panel/procesos", json={"usuario_id": test_user.id, "llave_proceso": llave, "alias": "Pérez"}, headers=h)
    assert c.status_code == 201 and c.json()["usuario_email"] == "test@example.com"
    pid = c.json()["id"]
    assert (await client.post("/panel/procesos", json={"usuario_id": test_user.id, "llave_proceso": llave}, headers=h)).status_code == 409
    assert (await client.post("/panel/procesos", json={"usuario_id": test_user.id, "llave_proceso": "123"}, headers=h)).status_code == 422

    assert (await client.get("/panel/procesos?q=pérez", headers=h)).json()["total"] == 1
    assert (await client.get("/panel/procesos?estado=novedad", headers=h)).json()["total"] == 0
    ed = await client.patch(f"/panel/procesos/{pid}", json={"notificado": False, "categoria": "Trabajo", "alias": ""}, headers=h)
    assert ed.json()["notificado"] is False and ed.json()["categoria"] == "Trabajo" and ed.json()["alias"] is None
    assert (await client.get("/panel/procesos?estado=novedad", headers=h)).json()["total"] == 1
    assert (await client.post(f"/panel/procesos/{pid}/reprogramar-sync", headers=h)).status_code == 200
    assert (await client.delete(f"/panel/procesos/{pid}", headers=h)).status_code == 200
    assert (await client.delete(f"/panel/procesos/{pid}", headers=h)).status_code == 404


@pytest.mark.asyncio
async def test_dispositivos_no_exponen_el_token_completo(client, adm, test_user, db):
    from models.dispositivo import Dispositivo

    db.add(Dispositivo(user_id=test_user.id, token="secreto-" + "z" * 30 + "ABCDEFGH"))
    db.commit()
    h = {**adm, **_ip(13)}
    d = (await client.get("/panel/dispositivos", headers=h)).json()["dispositivos"][0]
    assert d["token"] == "…ABCDEFGH" and "secreto" not in str(d)
    assert (await client.delete(f"/panel/dispositivos/{d['id']}", headers=h)).status_code == 200
    assert (await client.get("/panel/dispositivos", headers=h)).json()["total"] == 0


# ── Pruebas y diagnóstico ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_catalogo_de_pruebas_y_acceso(client, adm, auth_headers):
    cat = (await client.get("/panel/pruebas", headers={**adm, **_ip(14)})).json()["pruebas"]
    assert {"bd", "configuracion", "registro", "login", "restablecer", "radicados", "correo", "push", "telegram", "rama"} <= {p["id"] for p in cat}
    assert (await client.post("/panel/pruebas/bd", json={}, headers={**auth_headers, **_ip(15)})).status_code == 403
    assert (await client.post("/panel/pruebas/no-existe", json={}, headers={**adm, **_ip(15)})).status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("prueba", ["registro", "login", "restablecer"])
async def test_pruebas_de_cuenta_pasan_y_no_dejan_basura(client, adm, db, prueba):
    from models.user import User

    antes = db.query(User).count()
    r = (await client.post(f"/panel/pruebas/{prueba}", json={}, headers={**adm, **_ip(20 + len(prueba))})).json()
    fallos = [p for p in r["pasos"] if p["estado"] == "fallo"]
    assert r["estado"] == "ok" and not fallos, fallos
    db.expire_all()
    assert db.query(User).count() == antes  # el usuario temporal se borra siempre


@pytest.mark.asyncio
async def test_prueba_de_radicados_con_rama_caida_avisa_pero_no_falla(client, adm, db, monkeypatch):
    from routers import procesos

    monkeypatch.setattr(procesos, "buscar_por_radicado", lambda *a, **k: SimpleNamespace(procesos=[]))
    r = (await client.post("/panel/pruebas/radicados", json={}, headers={**adm, **_ip(40)})).json()
    assert [p for p in r["pasos"] if p["estado"] == "fallo"] == []
    assert r["estado"] == "aviso"  # se guardó pero sin datos de Rama
    bad = (await client.post("/panel/pruebas/radicados", json={"parametros": {"radicado": "12"}}, headers={**adm, **_ip(41)})).json()
    assert bad["estado"] == "fallo"


@pytest.mark.asyncio
async def test_prueba_de_correo_por_proveedor(client, adm, monkeypatch):
    from services import notifications, pruebas

    h = {**adm, **_ip(42)}
    sin = (await client.post("/panel/pruebas/correo", json={}, headers=h)).json()
    assert sin["estado"] == "fallo"  # ningún proveedor configurado en tests

    monkeypatch.setattr(pruebas, "BREVO_API_KEY", "k")
    monkeypatch.setattr(notifications, "_enviar_brevo", lambda d, a, h, t: (True, None))
    ok = (await client.post("/panel/pruebas/correo", json={"parametros": {"destino": "yo@example.com"}}, headers={**adm, **_ip(43)})).json()
    assert ok["estado"] == "ok" and any(p["nombre"] == "Envío por Brevo" for p in ok["pasos"])
    solo_config = (await client.post("/panel/pruebas/correo", json={"parametros": {"enviar": False}}, headers={**adm, **_ip(44)})).json()
    assert any(p["nombre"] == "Envío real" and p["estado"] == "aviso" for p in solo_config["pasos"])


@pytest.mark.asyncio
async def test_pruebas_de_integraciones_sin_configurar(client, adm):
    for i, prueba in enumerate(["push", "telegram", "configuracion", "bd", "rama"]):
        r = (await client.post(f"/panel/pruebas/{prueba}", json={"parametros": {}}, headers={**adm, **_ip(50 + i)})).json()
        assert r["id"] == prueba and r["estado"] in {"ok", "aviso", "fallo"} and r["pasos"]
    push = (await client.post("/panel/pruebas/push", json={}, headers={**adm, **_ip(60)})).json()
    # Push sin configurar es opcional: avisa, no falla
    assert push["estado"] == "aviso" and "FCM_SERVICE_ACCOUNT_JSON" in push["pasos"][0]["detalle"]
