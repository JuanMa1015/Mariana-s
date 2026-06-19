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


# ─── _procesar_radicado tests ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_procesar_initial_sync_recente(test_user, db):
    from services.sync import _procesar_radicado
    from models.proceso import Proceso

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id)
    db.add(p)
    db.commit()

    mock_proc = _make_proceso_remoto()
    mock_det = _make_detalle()
    mock_act = _make_actuacion()
    from scraper.rama_client import ResultadoBusqueda, ResultadoActuaciones

    pag = _make_paginacion()

    nuevos, actualizados, emails_enviados, errores, acumuladas = [], [], [], [], {}

    with (
        patch("services.sync.buscar_por_radicado") as m_br,
        patch("services.sync.buscar_detalle_proceso") as m_bd,
        patch("services.sync.buscar_actuaciones") as m_ba,
        patch("services.sync.buscar_documentos_actuacion", return_value=[]),
        patch("services.sync.time.sleep"),
        patch("services.sync._es_reciente", return_value=True),
    ):
        m_br.return_value = ResultadoBusqueda(procesos=[mock_proc], paginacion=pag)
        m_bd.return_value = mock_det
        m_ba.return_value = ResultadoActuaciones(actuaciones=[mock_act], paginacion=pag)

        _procesar_radicado(db, p, nuevos, actualizados, emails_enviados, errores, acumuladas)

        db.refresh(p)
        assert p.notificado is False
        assert p.tipo_novedad == "actualizacion"
        assert p.ultima_sincronizacion is not None
        assert p.fallos_consecutivos == 0
        assert len(actualizados) == 1
        assert RADICADO in actualizados
        assert len(errores) == 0
        assert test_user.email in acumuladas
        assert len(acumuladas[test_user.email]) == 1


@pytest.mark.asyncio
async def test_procesar_initial_sync_antiguo(test_user, db):
    from services.sync import _procesar_radicado
    from models.proceso import Proceso

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id)
    db.add(p)
    db.commit()

    mock_proc = _make_proceso_remoto()
    mock_det = _make_detalle()
    from scraper.rama_client import ResultadoBusqueda, ResultadoActuaciones
    pag = _make_paginacion()

    nuevos, actualizados, emails_enviados, errores, acumuladas = [], [], [], [], {}

    with (
        patch("services.sync.buscar_por_radicado") as m_br,
        patch("services.sync.buscar_detalle_proceso") as m_bd,
        patch("services.sync.buscar_actuaciones") as m_ba,
        patch("services.sync.buscar_documentos_actuacion", return_value=[]),
        patch("services.sync.time.sleep"),
        patch("services.sync._es_reciente", return_value=False),
    ):
        m_br.return_value = ResultadoBusqueda(procesos=[mock_proc], paginacion=pag)
        m_bd.return_value = mock_det
        m_ba.return_value = ResultadoActuaciones(actuaciones=[], paginacion=pag)

        _procesar_radicado(db, p, nuevos, actualizados, emails_enviados, errores, acumuladas)

        db.refresh(p)
        assert p.notificado is True
        assert len(nuevos) == 1
        assert RADICADO in nuevos
        assert len(acumuladas) == 0


@pytest.mark.asyncio
async def test_procesar_update_sync_con_novedad(test_user, db):
    from services.sync import _procesar_radicado
    from models.proceso import Proceso
    from models.actuacion import Actuacion

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id)
    db.add(p)
    db.commit()
    existing = Actuacion(proceso_id=p.id, id_reg_actuacion=1, cons_actuacion=1, actuacion="Vieja")
    db.add(existing)
    db.commit()

    mock_proc = _make_proceso_remoto()
    mock_det = _make_detalle()
    mock_act_old = _make_actuacion(id_reg_actuacion=1, cons_actuacion=1, actuacion="Vieja")
    mock_act_new = _make_actuacion(id_reg_actuacion=2, actuacion="Nueva actuacion")
    from scraper.rama_client import ResultadoBusqueda, ResultadoActuaciones
    pag = _make_paginacion()

    nuevos, actualizados, emails_enviados, errores, acumuladas = [], [], [], [], {}

    with (
        patch("services.sync.buscar_por_radicado") as m_br,
        patch("services.sync.buscar_detalle_proceso") as m_bd,
        patch("services.sync.buscar_actuaciones") as m_ba,
        patch("services.sync.buscar_documentos_actuacion", return_value=[]),
        patch("services.sync.time.sleep"),
    ):
        m_br.return_value = ResultadoBusqueda(procesos=[mock_proc], paginacion=pag)
        m_bd.return_value = mock_det
        m_ba.return_value = ResultadoActuaciones(actuaciones=[mock_act_old, mock_act_new], paginacion=pag)

        _procesar_radicado(db, p, nuevos, actualizados, emails_enviados, errores, acumuladas)

        db.refresh(p)
        assert p.notificado is False
        assert p.tipo_novedad == "actualizacion"
        assert len(actualizados) == 1
        assert len(errores) == 0
        assert test_user.email in acumuladas


@pytest.mark.asyncio
async def test_procesar_update_sync_sin_cambios(test_user, db):
    from services.sync import _procesar_radicado
    from models.proceso import Proceso
    from models.actuacion import Actuacion

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id)
    db.add(p)
    db.commit()
    existing = Actuacion(proceso_id=p.id, id_reg_actuacion=1, cons_actuacion=1, actuacion="Existente")
    db.add(existing)
    db.commit()

    mock_proc = _make_proceso_remoto()
    mock_det = _make_detalle()
    mock_act = _make_actuacion(id_reg_actuacion=1, cons_actuacion=1, actuacion="Existente")
    from scraper.rama_client import ResultadoBusqueda, ResultadoActuaciones
    pag = _make_paginacion()

    nuevos, actualizados, emails_enviados, errores, acumuladas = [], [], [], [], {}

    with (
        patch("services.sync.buscar_por_radicado") as m_br,
        patch("services.sync.buscar_detalle_proceso") as m_bd,
        patch("services.sync.buscar_actuaciones") as m_ba,
        patch("services.sync.buscar_documentos_actuacion", return_value=[]),
        patch("services.sync.time.sleep"),
    ):
        m_br.return_value = ResultadoBusqueda(procesos=[mock_proc], paginacion=pag)
        m_bd.return_value = mock_det
        m_ba.return_value = ResultadoActuaciones(actuaciones=[mock_act], paginacion=pag)

        _procesar_radicado(db, p, nuevos, actualizados, emails_enviados, errores, acumuladas)

        assert len(actualizados) == 0
        assert len(acumuladas) == 0


@pytest.mark.asyncio
async def test_procesar_error_buscar_por_radicado(test_user, db):
    from services.sync import _procesar_radicado
    from models.proceso import Proceso

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id, fallos_consecutivos=0)
    db.add(p)
    db.commit()

    nuevos, actualizados, emails_enviados, errores, acumuladas = [], [], [], [], {}

    with patch("services.sync.buscar_por_radicado", side_effect=Exception("Timeout")):
        _procesar_radicado(db, p, nuevos, actualizados, emails_enviados, errores, acumuladas)

        assert p.fallos_consecutivos == 1
        assert len(errores) == 1
        assert errores[0]["paso"] == "buscar_por_radicado"


@pytest.mark.asyncio
async def test_procesar_error_detalle(test_user, db):
    from services.sync import _procesar_radicado
    from models.proceso import Proceso
    from scraper.rama_client import ResultadoBusqueda

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id, fallos_consecutivos=0)
    db.add(p)
    db.commit()

    mock_proc = _make_proceso_remoto()
    pag = _make_paginacion()

    nuevos, actualizados, emails_enviados, errores, acumuladas = [], [], [], [], {}

    with (
        patch("services.sync.buscar_por_radicado") as m_br,
        patch("services.sync.buscar_detalle_proceso", side_effect=Exception("403 Forbidden")),
        patch("services.sync.time.sleep"),
    ):
        m_br.return_value = ResultadoBusqueda(procesos=[mock_proc], paginacion=pag)
        _procesar_radicado(db, p, nuevos, actualizados, emails_enviados, errores, acumuladas)

        assert p.fallos_consecutivos == 1
        assert len(errores) == 1
        assert errores[0]["paso"] == "detalle"


@pytest.mark.asyncio
async def test_procesar_error_actuaciones(test_user, db):
    from services.sync import _procesar_radicado
    from models.proceso import Proceso
    from scraper.rama_client import ResultadoBusqueda

    p = Proceso(llave_proceso=RADICADO, user_id=test_user.id, fallos_consecutivos=0)
    db.add(p)
    db.commit()

    mock_proc = _make_proceso_remoto()
    mock_det = _make_detalle()
    pag = _make_paginacion()

    nuevos, actualizados, emails_enviados, errores, acumuladas = [], [], [], [], {}

    with (
        patch("services.sync.buscar_por_radicado") as m_br,
        patch("services.sync.buscar_detalle_proceso") as m_bd,
        patch("services.sync.buscar_actuaciones", side_effect=Exception("Error")),
        patch("services.sync.time.sleep"),
    ):
        m_br.return_value = ResultadoBusqueda(procesos=[mock_proc], paginacion=pag)
        m_bd.return_value = mock_det
        _procesar_radicado(db, p, nuevos, actualizados, emails_enviados, errores, acumuladas)

        assert p.fallos_consecutivos == 1
        assert len(errores) == 1
        assert errores[0]["paso"] == "actuaciones"


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
        patch("services.sync.notificar_cambio_radicado", return_value=True) as m_ncr,
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
        patch("services.sync.notificar_cambio_radicado", return_value=True) as m_ncr,
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
        patch("services.sync.notificar_cambio_radicado", return_value=True) as m_ncr,
        patch("services.sync.time.sleep"),
    ):
        _enviar_notificaciones_acumuladas(acumuladas, emails)
        m_ncr.assert_called_once()
        _, kwargs = m_ncr.call_args
        assert kwargs.get("telegram_chat_id") == "12345"


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
        patch("services.sync.notificar_cambio_radicado", return_value=True),
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
    from datetime import datetime, timedelta

    p = Proceso(
        ultima_sincronizacion=datetime.utcnow() - timedelta(days=1),
        fallos_consecutivos=1,
        dias_sin_cambios=0,
    )
    assert _debe_sincronizar(p) is True

    p.ultima_sincronizacion = datetime.utcnow() - timedelta(hours=1)
    assert _debe_sincronizar(p) is False


@pytest.mark.asyncio
async def test_debe_sincronizar_sin_cambios_recientes(db):
    from services.sync import _debe_sincronizar
    from models.proceso import Proceso
    from datetime import datetime, timedelta

    p = Proceso(
        ultima_sincronizacion=datetime.utcnow() - timedelta(days=2),
        fallos_consecutivos=0,
        dias_sin_cambios=3,
    )
    assert _debe_sincronizar(p) is True

    p.ultima_sincronizacion = datetime.utcnow() - timedelta(hours=12)
    assert _debe_sincronizar(p) is False
