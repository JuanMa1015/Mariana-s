from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock, ANY
import pytest

_COLOMBIA_TZ = timezone(timedelta(hours=-5))
RADICADO = "05001310301220210012300"


def _make_proceso_remoto(**kwargs):
    from scraper.rama_client import Proceso
    defaults = dict(id_proceso=1, numero_radicacion=RADICADO, despacho="Juzgado 12",
                    departamento="Antioquia", sujetos_procesales="Perez|DEMANDANTE",
                    tipo_proceso="VERBAL", clase_proceso="SUMARIO", es_privado=False,
                    fecha_proceso="2023-01-15", fecha_ultima_actuacion="2024-06-10")
    defaults.update(kwargs)
    return Proceso(**defaults)


def _make_detalle(**kwargs):
    from scraper.rama_client import DetalleProceso
    defaults = dict(id_reg_proceso=1, llave_proceso=RADICADO, id_conexion=1,
                    es_privado=False, fecha_proceso="2023-01-15",
                    despacho="Juzgado 12", ponente=None, tipo_proceso="VERBAL",
                    clase_proceso="SUMARIO", subclase_proceso=None, recurso=None,
                    ubicacion=None, contenido_radicacion=None, fecha_consulta=None,
                    ultima_actualizacion=None, cod_despacho_completo=None)
    defaults.update(kwargs)
    return DetalleProceso(**defaults)


def _make_actuacion(id_reg_actuacion=1, **kwargs):
    from scraper.rama_client import Actuacion
    defaults = dict(id_reg_actuacion=id_reg_actuacion, llave_proceso=RADICADO,
                    cons_actuacion=1, fecha_actuacion="2024-06-10",
                    actuacion="Se admitio demanda", anotacion="Auto admisorio",
                    fecha_inicial=None, fecha_final=None, fecha_registro="2024-06-10",
                    cod_regla=None, con_documentos=False, cant=0)
    defaults.update(kwargs)
    return Actuacion(**defaults)


def _make_paginacion(cantidad=1):
    from scraper.rama_client import Paginacion
    return Paginacion(cantidad_registros=cantidad, registros_pagina=10,
                      cantidad_paginas=1, pagina=1)


# ─── _enviar_notificaciones_acumuladas tests ─────────────────────────────────

@pytest.mark.asyncio
async def test_enviar_notificaciones_individuales():
    from services.sync import _enviar_notificaciones_acumuladas

    acumuladas = {
        "test@example.com": [
            {"llave_proceso": "p1", "despacho": "D1", "departamento": "Dep1",
             "fecha_ultima_actuacion": "2024-06-10", "sujetos_procesales": "",
             "actuacion": "A1", "anotacion": "An1", "fecha_registro": "2024-06-10",
             "con_documentos": False, "categoria": "General", "telegram_chat_id": None},
        ]
    }
    emails = []

    with (
        patch("services.sync.notificar_cambio_radicado", return_value={"email": True, "telegram": False}) as m_ncr,
        patch("services.sync.time.sleep"),
    ):
        _enviar_notificaciones_acumuladas(acumuladas, emails)
        m_ncr.assert_called_once()
        assert len(emails) == 1
        assert emails[0] == "p1"


@pytest.mark.asyncio
async def test_enviar_notificaciones_resumen():
    from services.sync import _enviar_notificaciones_acumuladas

    acumuladas = {
        "test@example.com": [
            {"llave_proceso": f"p{i}", "despacho": "D", "departamento": "Dep",
             "fecha_ultima_actuacion": "2024-06-10", "sujetos_procesales": "",
             "actuacion": "A", "anotacion": "An", "fecha_registro": "2024-06-10",
             "con_documentos": False, "categoria": "General", "telegram_chat_id": None}
            for i in range(4)
        ]
    }
    emails = []

    with (
        patch("services.sync.notificar_cambio_radicado", return_value={"email": True, "telegram": False}) as m_ncr,
        patch("services.email_templates.template_resumen") as m_tr,
        patch("services.sync.time.sleep"),
    ):
        m_tr.return_value = ("Resumen asunto", "<p>Resumen html</p>")
        _enviar_notificaciones_acumuladas(acumuladas, emails)

        m_tr.assert_called_once()
        m_ncr.assert_called_once()
        _, kwargs = m_ncr.call_args
        assert kwargs.get("llave_proceso") == "resumen"
        assert kwargs.get("custom_asunto") is not None
        assert len(emails) == 1
        assert "resumen" in emails[0]


@pytest.mark.asyncio
async def test_enviar_notificaciones_con_telegram():
    from services.sync import _enviar_notificaciones_acumuladas

    acumuladas = {
        "test@example.com": [
            {"llave_proceso": "p1", "despacho": "D", "departamento": "Dep",
             "fecha_ultima_actuacion": "2024-06-10", "sujetos_procesales": "",
             "actuacion": "A", "anotacion": "An", "fecha_registro": "2024-06-10",
             "con_documentos": False, "categoria": "General", "telegram_chat_id": "12345"},
        ]
    }
    emails = []

    with (
        patch("services.sync.notificar_cambio_radicado", return_value={"email": True, "telegram": False}) as m_ncr,
        patch("services.sync.time.sleep"),
    ):
        _enviar_notificaciones_acumuladas(acumuladas, emails)
        m_ncr.assert_called_once()
        _, kwargs = m_ncr.call_args
        assert kwargs.get("telegram_chat_id") == "12345"


@pytest.mark.asyncio
async def test_email_fallido_no_marca_entregada_aunque_telegram_funcione():
    """Regression: antes bastaba telegram=True para dar por entregada la
    notificacion y el correo fallido se perdia sin reintento."""
    from services.sync import _enviar_notificaciones_acumuladas

    acumuladas = {
        "test@example.com": [
            {"llave_proceso": "p1", "despacho": "D", "departamento": "Dep",
             "fecha_ultima_actuacion": "2024-06-10", "sujetos_procesales": "",
             "actuacion": "A", "anotacion": "An", "fecha_registro": "2024-06-10",
             "con_documentos": False, "categoria": "General",
             "telegram_chat_id": "12345", "email": "test@example.com"},
        ]
    }
    emails = []

    with (
        patch("services.sync.notificar_cambio_radicado", return_value={"email": False, "telegram": True}),
        patch("services.sync.TELEGRAM_BOT_TOKEN", "tok"),
        patch("services.sync.time.sleep"),
    ):
        entregadas = _enviar_notificaciones_acumuladas(acumuladas, emails)

    assert emails == []
    assert entregadas == {}


@pytest.mark.asyncio
async def test_fetch_actuaciones_multi_raise_si_uno_falla():
    from services.sync import _fetch_actuaciones_multi
    from scraper.rama_client import ResultadoActuaciones

    pag = _make_paginacion(cantidad=1)
    ok = ResultadoActuaciones(actuaciones=[_make_actuacion(id_reg_actuacion=1)], paginacion=pag)

    with patch("services.sync.cached_call", side_effect=[Exception("Rama caida"), ok]):
        with pytest.raises(RuntimeError):
            _fetch_actuaciones_multi([100, 200])


@pytest.mark.asyncio
async def test_aplicar_datos_remotos_telegram_only(db, test_user):
    from services.sync import _aplicar_datos_remotos
    from models.proceso import Proceso

    test_user.telegram_chat_id = "12345"
    test_user.email = ""
    db.commit()

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id, notificado=True)
    db.add(p)
    db.commit()

    act = _make_actuacion(id_reg_actuacion=10)
    datos = {
        "status": "ok",
        "resumen": _make_proceso_remoto(),
        "detalle": _make_detalle(),
        "actuaciones": [act],
        "documentos_por_actuacion": {},
    }
    nuevos, actualizados, emails, errores, acumuladas = [], [], [], [], {}

    with patch("services.sync._es_reciente", return_value=True):
        _aplicar_datos_remotos(db, p, datos, nuevos, actualizados, emails, errores, acumuladas)

    assert p.notificado is False
    assert p.notificacion_pendiente is True
    assert "telegram:12345" in acumuladas
    entry = acumuladas["telegram:12345"][0]
    assert entry["email"] is None
    assert entry["telegram_chat_id"] == "12345"
    assert entry["llave_proceso"] == RADICADO


@pytest.mark.asyncio
async def test_reenviar_notificaciones_pendientes_exitoso(db, test_user):
    from services.sync import _reenviar_notificaciones_pendientes
    from models.proceso import Proceso

    p = Proceso(
        llave_proceso=RADICADO,
        user_id=test_user.id,
        notificado=False,
        notificacion_pendiente=True,
        intentos_notificacion=1,
        ultima_notificacion_intento=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=5),
    )
    db.add(p)
    db.commit()

    with patch("services.sync.notificar_cambio_radicado", return_value={"email": True, "telegram": False}):
        reenviadas = _reenviar_notificaciones_pendientes(db)

    assert reenviadas == [RADICADO]
    db.refresh(p)
    assert p.notificacion_pendiente is False
    assert p.intentos_notificacion == 0
    assert p.canales_notificados == "email"


@pytest.mark.asyncio
async def test_reenviar_email_fallido_telegram_ok_mantiene_pendiente(db, test_user):
    """Con email+telegram configurados, solo telegram OK debe dejar la
    novedad pendiente para reintentar el correo; cuando ambos canales
    funcionan, se limpia."""
    from services.sync import _reenviar_notificaciones_pendientes
    from models.proceso import Proceso

    test_user.telegram_chat_id = "12345"
    db.commit()
    p = Proceso(
        llave_proceso=RADICADO,
        user_id=test_user.id,
        notificado=False,
        notificacion_pendiente=True,
        intentos_notificacion=0,
        ultima_notificacion_intento=None,
    )
    db.add(p)
    db.commit()

    with (
        patch("services.sync.notificar_cambio_radicado", return_value={"email": False, "telegram": True}),
        patch("services.sync.TELEGRAM_BOT_TOKEN", "tok"),
    ):
        reenviadas = _reenviar_notificaciones_pendientes(db)

    assert reenviadas == []
    db.refresh(p)
    assert p.notificacion_pendiente is True
    assert p.intentos_notificacion == 1

    # Sale del cooldown y en el reintento ambos canales tienen exito
    p.ultima_notificacion_intento = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=4)
    db.commit()
    with (
        patch("services.sync.notificar_cambio_radicado", return_value={"email": True, "telegram": True}),
        patch("services.sync.TELEGRAM_BOT_TOKEN", "tok"),
    ):
        reenviadas = _reenviar_notificaciones_pendientes(db)

    assert reenviadas == [RADICADO]
    db.refresh(p)
    assert p.notificacion_pendiente is False
    assert p.intentos_notificacion == 0
    assert p.canales_notificados == "email+telegram"


@pytest.mark.asyncio
async def test_reenviar_notificaciones_pendientes_en_cooldown(db, test_user):
    from services.sync import _reenviar_notificaciones_pendientes
    from models.proceso import Proceso

    p = Proceso(
        llave_proceso=RADICADO,
        user_id=test_user.id,
        notificacion_pendiente=True,
        intentos_notificacion=1,
        ultima_notificacion_intento=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1),
    )
    db.add(p)
    db.commit()

    with patch("services.sync.notificar_cambio_radicado", return_value={"email": False, "telegram": False}):
        reenviadas = _reenviar_notificaciones_pendientes(db)

    assert reenviadas == []
    db.refresh(p)
    assert p.notificacion_pendiente is True
    assert p.intentos_notificacion == 1


@pytest.mark.asyncio
async def test_reenviar_notificaciones_pendientes_agota_intentos(db, test_user):
    from services.sync import _reenviar_notificaciones_pendientes
    from models.proceso import Proceso

    p = Proceso(
        llave_proceso=RADICADO,
        user_id=test_user.id,
        notificacion_pendiente=True,
        intentos_notificacion=5,
        ultima_notificacion_intento=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=30),
    )
    db.add(p)
    db.commit()

    with patch("services.sync.notificar_cambio_radicado", return_value={"email": False, "telegram": False}):
        reenviadas = _reenviar_notificaciones_pendientes(db)

    assert reenviadas == []
    db.refresh(p)
    assert p.notificacion_pendiente is True
    assert p.intentos_notificacion == 5


@pytest.mark.asyncio
async def test_ejecutar_lote_circuit_breaker(db, test_user):
    from services.sync import _ejecutar_lote
    from models.proceso import Proceso

    radicados = [Proceso(llave_proceso=f"{i:023d}", user_id=test_user.id) for i in range(1, 8)]

    def fake_fetch(radicado):
        if radicado.llave_proceso.startswith(("00000000000000000000001", "00000000000000000000002", "00000000000000000000003")):
            return {"status": "error", "llave_proceso": radicado.llave_proceso, "error": "Rama caida", "paso": "buscar_por_radicado"}
        return {"status": "ok", "llave_proceso": radicado.llave_proceso}

    with (
        patch("services.sync._fetch_radicado_remoto", side_effect=fake_fetch),
        patch("services.sync.time.sleep"),
    ):
        datos, saltados = _ejecutar_lote(radicados)

    errores = [d for d in datos if d["status"] == "error"]
    assert len(errores) == 3
    assert len(saltados) == 4
    assert all(d["status"] == "ok" for d in datos if d not in errores)


@pytest.mark.asyncio
async def test_sincronizar_lista_reintenta_errores_rama(db, test_user):
    from services.sync import _sincronizar_lista
    from models.proceso import Proceso

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id)
    db.add(p)
    db.commit()

    llamadas = {"n": 0}

    def fake_fetch(radicado):
        llamadas["n"] += 1
        if llamadas["n"] <= 1:
            return {"status": "error", "llave_proceso": radicado.llave_proceso, "error": "Rama caida", "paso": "buscar_por_radicado"}
        return {
            "status": "ok",
            "llave_proceso": radicado.llave_proceso,
            "resumen": _make_proceso_remoto(),
            "detalle": _make_detalle(),
            "actuaciones": [_make_actuacion(id_reg_actuacion=10)],
            "documentos_por_actuacion": {},
        }

    with (
        patch("services.sync._fetch_radicado_remoto", side_effect=fake_fetch),
        patch("services.sync.rama_health_check", return_value=True),
        patch("services.sync.notificar_cambio_radicado", return_value={"email": True, "telegram": False}),
        patch("services.sync._es_reciente", return_value=True),
        patch("services.sync.time.sleep"),
    ):
        result = _sincronizar_lista(db, [p])

    assert llamadas["n"] == 2
    assert result["errores_rama"] == 0
    assert result["errores_app"] == 0
    assert result["actualizados"] == 1
    assert result["rama_estable"] is True


@pytest.mark.asyncio
async def test_sincronizar_lista_marca_origen_rama(db, test_user):
    from services.sync import _sincronizar_lista
    from models.proceso import Proceso

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id)
    db.add(p)
    db.commit()

    with (
        patch("services.sync._fetch_radicado_remoto", return_value={"status": "error", "llave_proceso": RADICADO, "error": "timeout", "paso": "detalle"}),
        patch("services.sync.rama_health_check", return_value=False),
        patch("services.sync.time.sleep"),
    ):
        result = _sincronizar_lista(db, [p])

    assert result["errores_rama"] == 1
    assert result["rama_estable"] is False
    assert result["radicados_error_consulta"][0]["origen"] == "rama"


# ─── _sincronizar_lista tests ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sincronizar_lista_con_radicados(test_user, db):
    from services.sync import _sincronizar_lista
    from models.proceso import Proceso

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id)
    db.add(p)
    db.commit()

    mock_proc = _make_proceso_remoto()
    mock_det = _make_detalle()
    mock_act = _make_actuacion()
    from scraper.rama_client import ResultadoBusqueda, ResultadoActuaciones
    pag = _make_paginacion()

    with (
        patch("services.sync.buscar_por_radicado") as m_br,
        patch("services.sync.buscar_detalle_proceso") as m_bd,
        patch("services.sync.buscar_actuaciones") as m_ba,
        patch("services.sync.buscar_documentos_actuacion", return_value=[]),
        patch("services.sync.time.sleep"),
        patch("services.sync.notificar_cambio_radicado", return_value={"email": True, "telegram": False}),
        patch("services.sync._es_reciente", return_value=True),
    ):
        m_br.return_value = ResultadoBusqueda(procesos=[mock_proc], paginacion=pag)
        m_bd.return_value = mock_det
        m_ba.return_value = ResultadoActuaciones(actuaciones=[mock_act], paginacion=pag)

        result = _sincronizar_lista(db, [p])

        assert result["total_consultados"] == 1
        assert result["actualizados"] == 1
        assert result["nuevos"] == 0
        assert len(result["emails_enviados"]) == 1
        assert result["radicados_ignorados"] == []
        assert result["radicados_error_consulta"] == []


@pytest.mark.asyncio
async def test_sincronizar_lista_ignora_formato_invalido(test_user, db):
    from services.sync import _sincronizar_lista
    from models.proceso import Proceso

    p = Proceso(llave_proceso="formato-invalido", user_id=test_user.id)
    db.add(p)
    db.commit()

    result = _sincronizar_lista(db, [p])
    assert result["radicados_ignorados"] == ["formato-invalido"]
    assert result["total_consultados"] == 1


# ─── _debe_sincronizar tests ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_debe_sincronizar_nunca_sincronizado(db):
    from services.sync import _debe_sincronizar
    from models.proceso import Proceso

    p = Proceso(ultima_sincronizacion=None)
    assert _debe_sincronizar(p) is True


@pytest.mark.asyncio
async def test_debe_sincronizar_con_backoff(db):
    from services.sync import _debe_sincronizar
    from models.proceso import Proceso
    from datetime import datetime, timezone, timedelta

    p = Proceso(
        ultima_sincronizacion=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1),
        fallos_consecutivos=1,
        dias_sin_cambios=0,
    )
    assert _debe_sincronizar(p) is True

    p.ultima_sincronizacion = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
    assert _debe_sincronizar(p) is False


@pytest.mark.asyncio
async def test_debe_sincronizar_sin_cambios_recientes(db):
    from services.sync import _debe_sincronizar
    from models.proceso import Proceso
    from datetime import datetime, timezone, timedelta

    p = Proceso(
        ultima_sincronizacion=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2),
        fallos_consecutivos=0,
        dias_sin_cambios=3,
    )
    assert _debe_sincronizar(p) is True

    p.ultima_sincronizacion = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=12)
    assert _debe_sincronizar(p) is False


# ─── Trazabilidad de canales de notificacion ─────────────────────────────────


@pytest.mark.asyncio
async def test_envio_registra_canales_entregados_por_proceso():
    """El mapa retornado debe traer proceso_id -> canales con exito."""
    from services.sync import _enviar_notificaciones_acumuladas

    acumuladas = {
        "test@example.com": [
            {"proceso_id": 7, "llave_proceso": "p1", "despacho": "D", "departamento": "Dep",
             "fecha_ultima_actuacion": "2024-06-10", "sujetos_procesales": "",
             "actuacion": "A", "anotacion": "An", "fecha_registro": "2024-06-10",
             "con_documentos": False, "categoria": "General",
             "telegram_chat_id": "12345", "email": "test@example.com"},
        ]
    }

    with (
        patch("services.sync.notificar_cambio_radicado", return_value={"email": True, "telegram": True}),
        patch("services.sync.TELEGRAM_BOT_TOKEN", "tok"),
        patch("services.sync.time.sleep"),
    ):
        entregadas = _enviar_notificaciones_acumuladas(acumuladas, [])

    assert entregadas == {7: "email+telegram"}


@pytest.mark.asyncio
async def test_envio_parcial_no_registra_canales():
    """Con email fallido y telegram OK la novedad no cuenta como entregada
    y por lo tanto no registra canales (queda pendiente para reintento)."""
    from services.sync import _enviar_notificaciones_acumuladas

    acumuladas = {
        "test@example.com": [
            {"proceso_id": 9, "llave_proceso": "p1", "despacho": "D", "departamento": "Dep",
             "fecha_ultima_actuacion": "2024-06-10", "sujetos_procesales": "",
             "actuacion": "A", "anotacion": "An", "fecha_registro": "2024-06-10",
             "con_documentos": False, "categoria": "General",
             "telegram_chat_id": "12345", "email": "test@example.com"},
        ]
    }

    with (
        patch("services.sync.notificar_cambio_radicado", return_value={"email": False, "telegram": True}),
        patch("services.sync.TELEGRAM_BOT_TOKEN", "tok"),
        patch("services.sync.time.sleep"),
    ):
        entregadas = _enviar_notificaciones_acumuladas(acumuladas, [])

    assert entregadas == {}


@pytest.mark.asyncio
async def test_nueva_novedad_limpia_canales_anteriores(db, test_user):
    """Cuando llega una novedad nueva los canales del aviso anterior deben
    borrarse: la insignia debe reflejar el estado del aviso ACTUAL."""
    from services.sync import _aplicar_datos_remotos
    from models.proceso import Proceso

    test_user.email = "test@example.com"
    test_user.telegram_chat_id = None
    db.commit()

    p = Proceso(
        llave_proceso=RADICADO,
        user_id=test_user.id,
        notificado=True,
        notificacion_pendiente=False,
        canales_notificados="email",
    )
    db.add(p)
    db.commit()

    datos = {
        "status": "ok",
        "resumen": _make_proceso_remoto(),
        "detalle": _make_detalle(),
        "actuaciones": [_make_actuacion(id_reg_actuacion=10)],
        "documentos_por_actuacion": {},
    }
    nuevos, actualizados, emails, errores, acumuladas = [], [], [], [], {}

    with patch("services.sync._es_reciente", return_value=True):
        _aplicar_datos_remotos(db, p, datos, nuevos, actualizados, emails, errores, acumuladas)

    assert p.notificado is False
    assert p.notificacion_pendiente is True
    assert p.canales_notificados is None
