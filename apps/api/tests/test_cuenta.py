import base64
import re
from datetime import timedelta

import pytest

from services import password_reset

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200


def _ip(n: int) -> dict:
    """Cada test usa su propia 'IP' para no compartir el rate limit."""
    return {"X-Forwarded-For": f"10.9.0.{n}"}


@pytest.fixture
def correos(monkeypatch):
    """Captura los correos enviados en lugar de usar un proveedor real."""
    enviados = []
    monkeypatch.setattr(password_reset, "enviar_correo", lambda dest, asunto, html, texto: enviados.append((dest, texto)) or True)
    return enviados


def _token(correos) -> str:
    return re.search(r"#token=(\S+)", correos[-1][1]).group(1)


# ── Nombre de usuario ──────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_cambiar_usuario_exige_password_y_unicidad(client, auth_headers, otro_usuario):
    h = {**auth_headers, **_ip(1)}
    mal = await client.post("/cuenta/usuario", json={"username": "nuevo_nombre", "password": "incorrecta"}, headers=h)
    assert mal.status_code == 400
    invalido = await client.post("/cuenta/usuario", json={"username": "a b", "password": "password123"}, headers=h)
    assert invalido.status_code == 400
    ocupado = await client.post("/cuenta/usuario", json={"username": "OtroUser", "password": "password123"}, headers=h)
    assert ocupado.status_code == 409
    ok = await client.post("/cuenta/usuario", json={"username": "nuevo_nombre", "password": "password123"}, headers=h)
    assert ok.status_code == 200 and ok.json() == {"username": "nuevo_nombre"}
    me = await client.get("/auth/me", headers=h)
    assert me.json()["username"] == "nuevo_nombre"


# ── Foto de perfil ─────────────────────────────────────────────────────────
def _b64(datos: bytes) -> dict:
    return {"imagen": base64.b64encode(datos).decode()}


@pytest.mark.asyncio
async def test_avatar_subir_leer_y_borrar(client, auth_headers):
    h = {**auth_headers, **_ip(2)}
    assert (await client.get("/cuenta/avatar", headers=h)).status_code == 404
    assert (await client.get("/auth/me", headers=h)).json()["tiene_avatar"] is False

    assert (await client.put("/cuenta/avatar", json=_b64(JPEG), headers=h)).status_code == 200
    assert (await client.get("/auth/me", headers=h)).json()["tiene_avatar"] is True
    r = await client.get("/cuenta/avatar", headers=h)
    assert r.json()["data_url"] == "data:image/jpeg;base64," + base64.b64encode(JPEG).decode()

    assert (await client.delete("/cuenta/avatar", headers=h)).status_code == 200
    assert (await client.get("/auth/me", headers=h)).json()["tiene_avatar"] is False


@pytest.mark.asyncio
async def test_avatar_rechaza_formato_tamano_y_basura(client, auth_headers):
    h = {**auth_headers, **_ip(3)}
    # Se valida por los bytes reales de la imagen, no por lo que declare el cliente
    assert (await client.put("/cuenta/avatar", json=_b64(b"<script>alert(1)</script>"), headers=h)).status_code == 415
    assert (await client.put("/cuenta/avatar", json=_b64(JPEG[:3] + b"0" * (300 * 1024)), headers=h)).status_code == 413
    assert (await client.put("/cuenta/avatar", json={"imagen": "no es base64!!"}, headers=h)).status_code == 400
    assert (await client.put("/cuenta/avatar", json=_b64(JPEG))).status_code == 401


# ── Restablecer contraseña ─────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_olvide_no_revela_si_el_correo_existe(client, test_user, correos):
    h = _ip(4)
    desconocido = await client.post("/auth/password/olvide", json={"email": "nadie@example.com"}, headers=h)
    conocido = await client.post("/auth/password/olvide", json={"email": "test@example.com"}, headers=h)
    assert desconocido.json() == conocido.json() == {"ok": True}
    assert len(correos) == 1 and correos[0][0] == ["test@example.com"]
    assert "/restablecer#token=" in correos[0][1]  # el token va en el fragmento, no en la query


@pytest.mark.asyncio
async def test_flujo_completo_desde_ajustes(client, auth_headers, test_user, db, correos):
    from models.password_reset import PasswordReset

    h = {**auth_headers, **_ip(5)}
    r = await client.post("/cuenta/password/solicitar", headers=h)
    assert r.status_code == 200 and r.json()["email"].startswith("t") and "*" in r.json()["email"]
    # Segundo intento inmediato: se frena para no inundar el correo
    assert (await client.post("/cuenta/password/solicitar", headers=h)).status_code == 429

    token = _token(correos)
    # En la BD solo queda el hash, nunca el token
    assert db.query(PasswordReset).filter(PasswordReset.token_hash == token).first() is None

    assert (await client.post("/auth/password/restablecer", json={"token": "falso", "password": "NuevaClave#2026"}, headers=h)).status_code == 400
    assert (await client.post("/auth/password/restablecer", json={"token": token, "password": "corta"}, headers=h)).status_code == 400

    ok = await client.post("/auth/password/restablecer", json={"token": token, "password": "NuevaClave#2026"}, headers=h)
    assert ok.status_code == 200
    # Un solo uso
    assert (await client.post("/auth/password/restablecer", json={"token": token, "password": "OtraClave#2026"}, headers=h)).status_code == 400

    viejo = await client.post("/auth/login", json={"credential": "test@example.com", "password": "password123"}, headers=h)
    nuevo = await client.post("/auth/login", json={"credential": "test@example.com", "password": "NuevaClave#2026"}, headers=h)
    assert viejo.status_code == 401 and nuevo.status_code == 200


@pytest.mark.asyncio
async def test_token_vencido_se_rechaza(client, test_user, db, correos):
    from models.password_reset import PasswordReset

    h = _ip(6)
    await client.post("/auth/password/olvide", json={"email": "test@example.com"}, headers=h)
    token = _token(correos)
    registro = db.query(PasswordReset).one()
    registro.expira_en = registro.expira_en - timedelta(hours=2)
    db.commit()
    r = await client.post("/auth/password/restablecer", json={"token": token, "password": "NuevaClave#2026"}, headers=h)
    assert r.status_code == 400 and "venció" in r.json()["detail"]


@pytest.mark.asyncio
async def test_solicitar_informa_si_falla_el_correo(client, auth_headers, monkeypatch):
    monkeypatch.setattr(password_reset, "enviar_correo", lambda *a, **k: False)
    r = await client.post("/cuenta/password/solicitar", headers={**auth_headers, **_ip(7)})
    assert r.status_code == 503
