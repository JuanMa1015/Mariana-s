import re
from unittest.mock import patch, MagicMock
import pytest
from datetime import datetime, timezone, timedelta

_COLOMBIA_TZ = timezone(timedelta(hours=-5))


def _make_proceso_remoto(
    id_proceso=1,
    numero_radicacion="05001310301220210012300",
    despacho="Juzgado 12 Civil del Circuito",
    departamento="Antioquia",
    sujetos_procesales="Perez, Juan | DEMANDANTE",
    tipo_proceso="VERBAL",
    clase_proceso="SUMARIO",
    es_privado=False,
    fecha_proceso="2023-01-15",
    fecha_ultima_actuacion="2024-06-10",
):
    from scraper.rama_client import Proceso
    return Proceso(
        id_proceso=id_proceso,
        numero_radicacion=numero_radicacion,
        despacho=despacho,
        departamento=departamento,
        sujetos_procesales=sujetos_procesales,
        tipo_proceso=tipo_proceso,
        clase_proceso=clase_proceso,
        es_privado=es_privado,
        fecha_proceso=fecha_proceso,
        fecha_ultima_actuacion=fecha_ultima_actuacion,
    )


def _make_detalle(
    id_reg_proceso=1,
    llave_proceso="05001310301220210012300",
    id_conexion=1,
    es_privado=False,
    fecha_proceso="2023-01-15",
    despacho="Juzgado 12 Civil del Circuito",
    ponente=None,
    tipo_proceso="VERBAL",
    clase_proceso="SUMARIO",
    subclase_proceso=None,
    recurso=None,
    ubicacion=None,
    contenido_radicacion=None,
    fecha_consulta=None,
    ultima_actualizacion=None,
    cod_despacho_completo=None,
):
    from scraper.rama_client import DetalleProceso
    return DetalleProceso(
        id_reg_proceso=id_reg_proceso,
        llave_proceso=llave_proceso,
        id_conexion=id_conexion,
        es_privado=es_privado,
        fecha_proceso=fecha_proceso,
        cod_despacho_completo=cod_despacho_completo,
        despacho=despacho,
        ponente=ponente,
        tipo_proceso=tipo_proceso,
        clase_proceso=clase_proceso,
        subclase_proceso=subclase_proceso,
        recurso=recurso,
        ubicacion=ubicacion,
        contenido_radicacion=contenido_radicacion,
        fecha_consulta=fecha_consulta,
        ultima_actualizacion=ultima_actualizacion,
    )


def _make_actuacion(
    id_reg_actuacion=1,
    llave_proceso="05001310301220210012300",
    cons_actuacion=1,
    fecha_actuacion="2024-06-10",
    actuacion="Se admitio demanda",
    anotacion="Auto admisorio",
    fecha_inicial=None,
    fecha_final=None,
    fecha_registro="2024-06-10",
    cod_regla=None,
    con_documentos=False,
    cant=0,
):
    from scraper.rama_client import Actuacion
    return Actuacion(
        id_reg_actuacion=id_reg_actuacion,
        llave_proceso=llave_proceso,
        cons_actuacion=cons_actuacion,
        fecha_actuacion=fecha_actuacion,
        actuacion=actuacion,
        anotacion=anotacion,
        fecha_inicial=fecha_inicial,
        fecha_final=fecha_final,
        fecha_registro=fecha_registro,
        cod_regla=cod_regla,
        con_documentos=con_documentos,
        cant=cant,
    )


@pytest.mark.asyncio
async def test_sincronizar_radicado_exitoso(test_user, db):
    from services.sync import sincronizar_radicado
    from models.proceso import Proceso

    llave = "05001310301220210012300"
    proceso = Proceso(llave_proceso=llave, user_id=test_user.id)
    db.add(proceso)
    db.commit()

    mock_proceso = _make_proceso_remoto(numero_radicacion=llave)
    mock_detalle = _make_detalle(llave_proceso=llave)
    mock_act = _make_actuacion(llave_proceso=llave)
    from scraper.rama_client import ResultadoBusqueda, ResultadoActuaciones, Paginacion

    pag = Paginacion(cantidad_registros=1, registros_pagina=10, cantidad_paginas=1, pagina=1)

    with patch("services.sync.buscar_por_radicado") as mock_buscar:
        mock_buscar.return_value = ResultadoBusqueda(procesos=[mock_proceso], paginacion=pag)
        with patch("services.sync.buscar_detalle_proceso") as mock_det:
            mock_det.return_value = mock_detalle
            with patch("services.sync.buscar_actuaciones") as mock_acts:
                mock_acts.return_value = ResultadoActuaciones(
                    actuaciones=[mock_act], paginacion=pag
                )
                with patch("services.sync.buscar_documentos_actuacion") as mock_docs:
                    mock_docs.return_value = []

                    result = sincronizar_radicado(db, proceso)

                    assert result is True
                    mock_buscar.assert_called_once_with(llave, solo_activos=False)
                    mock_det.assert_called_once()
                    mock_acts.assert_called_once()

                    db.refresh(proceso)
                    assert proceso.despacho == "Juzgado 12 Civil del Circuito"
                    assert proceso.departamento == "Antioquia"
                    assert proceso.ultima_sincronizacion is not None
                    assert proceso.fallos_consecutivos == 0


@pytest.mark.asyncio
async def test_sincronizar_radicado_formato_invalido(test_user, db):
    from services.sync import sincronizar_radicado
    from models.proceso import Proceso

    proceso = Proceso(llave_proceso="invalido", user_id=test_user.id)
    db.add(proceso)
    db.commit()

    result = sincronizar_radicado(db, proceso)
    assert result is False


@pytest.mark.asyncio
async def test_sincronizar_radicado_sin_resultados(test_user, db):
    from services.sync import sincronizar_radicado
    from models.proceso import Proceso
    from scraper.rama_client import ResultadoBusqueda, Paginacion

    llave = "05001310301220210012300"
    proceso = Proceso(llave_proceso=llave, user_id=test_user.id)
    db.add(proceso)
    db.commit()

    pag = Paginacion(cantidad_registros=0, registros_pagina=10, cantidad_paginas=0, pagina=1)

    with patch("services.sync.buscar_por_radicado") as mock_buscar:
        mock_buscar.return_value = ResultadoBusqueda(procesos=[], paginacion=pag)
        result = sincronizar_radicado(db, proceso)
        assert result is False


@pytest.mark.asyncio
async def test_sincronizar_radicado_error_rama(test_user, db):
    from services.sync import sincronizar_radicado
    from models.proceso import Proceso

    llave = "05001310301220210012300"
    proceso = Proceso(llave_proceso=llave, user_id=test_user.id)
    db.add(proceso)
    db.commit()

    with patch("services.sync.buscar_por_radicado") as mock_buscar:
        mock_buscar.side_effect = Exception("Timeout en Rama Judicial")
        result = sincronizar_radicado(db, proceso)
        assert result is False


@pytest.mark.asyncio
async def test_es_reciente():
    from services.sync import _es_reciente

    hoy = datetime.now(_COLOMBIA_TZ).strftime("%Y-%m-%d")
    assert _es_reciente(hoy, dias=5) is True

    ayer = (datetime.now(_COLOMBIA_TZ) - timedelta(days=1)).strftime("%Y-%m-%d")
    assert _es_reciente(ayer, dias=5) is True

    viejo = (datetime.now(_COLOMBIA_TZ) - timedelta(days=10)).strftime("%Y-%m-%d")
    assert _es_reciente(viejo, dias=5) is False

    assert _es_reciente(None, dias=5) is False
    assert _es_reciente("", dias=5) is False


@pytest.mark.asyncio
async def test_calcular_dias_sin_cambios():
    from services.sync import _calcular_dias_sin_cambios

    hoy = datetime.now(_COLOMBIA_TZ).strftime("%Y-%m-%d")
    assert _calcular_dias_sin_cambios(hoy) == 0

    assert _calcular_dias_sin_cambios(None) == 999
    assert _calcular_dias_sin_cambios("") == 999


@pytest.mark.asyncio
async def test_backoff_dias():
    from services.sync import _backoff_dias
    from models.proceso import Proceso

    p0 = Proceso(fallos_consecutivos=0)
    assert _backoff_dias(p0) == 0

    p1 = Proceso(fallos_consecutivos=1)
    assert _backoff_dias(p1) == 1

    p2 = Proceso(fallos_consecutivos=2)
    assert _backoff_dias(p2) == 3

    p3 = Proceso(fallos_consecutivos=3)
    assert _backoff_dias(p3) == 7

    p4 = Proceso(fallos_consecutivos=5)
    assert _backoff_dias(p4) == 15
