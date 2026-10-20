import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

TOKEN_A = "token-fcm-dispositivo-a-" + "x" * 30
TOKEN_B = "token-fcm-dispositivo-b-" + "y" * 30


@pytest.mark.asyncio
async def test_registrar_y_reasignar_dispositivo(client, auth_headers, test_user, otro_usuario, db):
    from models.dispositivo import Dispositivo

    r = await client.post("/dispositivos/", json={"token": TOKEN_A}, headers=auth_headers)
    assert r.status_code == 200
    # Registrar dos veces el mismo token no duplica
    await client.post("/dispositivos/", json={"token": TOKEN_A, "plataforma": "ios"}, headers=auth_headers)
    filas = db.query(Dispositivo).all()
    assert len(filas) == 1 and filas[0].user_id == test_user.id and filas[0].plataforma == "ios"


@pytest.mark.asyncio
async def test_registrar_valida_y_requiere_auth(client, auth_headers):
    assert (await client.post("/dispositivos/", json={"token": "corto"}, headers=auth_headers)).status_code == 422
    assert (await client.post("/dispositivos/", json={"token": TOKEN_A, "plataforma": "web"}, headers=auth_headers)).status_code == 422
    assert (await client.post("/dispositivos/", json={"token": TOKEN_A})).status_code == 401


@pytest.mark.asyncio
async def test_baja_solo_borra_el_propio(client, auth_headers, test_user, otro_usuario, db):
    from models.dispositivo import Dispositivo

    db.add_all([
        Dispositivo(user_id=test_user.id, token=TOKEN_A),
        Dispositivo(user_id=otro_usuario.id, token=TOKEN_B),
    ])
    db.commit()
    assert (await client.post("/dispositivos/baja", json={"token": TOKEN_B}, headers=auth_headers)).json() == {"removed": False}
    assert (await client.post("/dispositivos/baja", json={"token": TOKEN_A}, headers=auth_headers)).json() == {"removed": True}
    assert [d.token for d in db.query(Dispositivo).all()] == [TOKEN_B]


def _cuenta_falsa():
    clave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = clave.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    return {"client_email": "svc@proyecto.iam.gserviceaccount.com", "private_key": pem, "project_id": "proyecto-x"}


class _Resp:
    def __init__(self, status=200, datos=None, texto=""):
        self.status_code, self._d, self.text = status, datos or {}, texto

    def json(self):
        return self._d

    def raise_for_status(self):
        assert self.status_code < 400


def test_enviar_a_tokens_reporta_invalidos(monkeypatch):
    from services import push

    monkeypatch.setattr(push, "_cuenta", _cuenta_falsa)
    monkeypatch.setitem(push._acceso, "token", None)
    llamadas = []

    def post(url, **kw):
        llamadas.append(url)
        if "oauth2" in url:
            return _Resp(datos={"access_token": "acc", "expires_in": 3600})
        return _Resp(404, texto="UNREGISTERED") if kw["json"]["message"]["token"] == TOKEN_B else _Resp()

    monkeypatch.setattr(push.httpx, "post", post)
    assert push.enviar_a_tokens([TOKEN_A, TOKEN_B], "t", "c", "05001310301720240048000") == [TOKEN_B]
    assert any("/projects/proyecto-x/messages:send" in u for u in llamadas)


def test_push_desactivado_sin_credenciales():
    from services import push

    assert push.habilitado() is False
    assert push.notificar_usuario(1, "t", "c") == 0


def test_avisar_por_push_agrupa_si_son_muchos(monkeypatch):
    from services import push, sync

    enviados = []
    monkeypatch.setattr(push, "notificar_usuario", lambda *a, **k: enviados.append(a))
    n = {"llave_proceso": "05001310301720240048000", "user_id": 7, "actuaciones": [{"actuacion": "Auto admite demanda"}]}

    sync._avisar_por_push([n, n])
    assert len(enviados) == 2 and enviados[0][0] == 7 and "Auto admite demanda" in enviados[0][2]

    enviados.clear()
    sync._avisar_por_push([n] * 4)
    assert len(enviados) == 1 and "4 procesos" in enviados[0][2]

    enviados.clear()
    sync._avisar_por_push([{**n, "user_id": None}])
    assert enviados == []


@pytest.mark.asyncio
async def test_prueba_requiere_push_configurado_y_dispositivo(client, auth_headers, test_user, db, monkeypatch):
    from models.dispositivo import Dispositivo
    from services import push

    # Sin credenciales FCM en el servidor
    r = await client.post("/dispositivos/prueba", headers=auth_headers)
    assert r.status_code == 503

    monkeypatch.setattr(push, "habilitado", lambda: True)
    # Con push activo pero sin celulares registrados
    assert (await client.post("/dispositivos/prueba", headers=auth_headers)).status_code == 409

    db.add(Dispositivo(user_id=test_user.id, token=TOKEN_A))
    db.commit()
    enviados = []
    monkeypatch.setattr(push, "notificar_usuario", lambda *a, **k: enviados.append(a) or 1)
    r = await client.post("/dispositivos/prueba", headers=auth_headers)
    assert r.status_code == 200 and r.json() == {"enviados": 1}
    assert enviados[0][0] == test_user.id and "simulado" in enviados[0][2]
