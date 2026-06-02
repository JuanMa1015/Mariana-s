import logging
import re
import time
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.actuacion import Actuacion
from models.documento_actuacion import DocumentoActuacion
from models.proceso import Proceso
from scraper.rama_client import (
    ResultadoBusqueda,
    buscar_actuaciones,
    buscar_detalle_proceso,
    buscar_documentos_actuacion,
    buscar_por_radicado,
)
from services.notifications import notificar_cambio_radicado

logger = logging.getLogger(__name__)


def _normalizar_texto(valor: str | None) -> str:
    return (valor or "").strip()


def _puntaje_proceso(proceso: ResultadoBusqueda | object) -> int:
    campos = [
        getattr(proceso, "despacho", None),
        getattr(proceso, "departamento", None),
        getattr(proceso, "sujetos_procesales", None),
        getattr(proceso, "tipo_proceso", None),
        getattr(proceso, "clase_proceso", None),
        getattr(proceso, "fecha_proceso", None),
        getattr(proceso, "fecha_ultima_actuacion", None),
    ]
    return sum(1 for campo in campos if _normalizar_texto(campo))


def _elegir_mejor_proceso(resultados: list[object]):
    return max(resultados, key=_puntaje_proceso)


def _serializar_texto(valor: str | None) -> str | None:
    valor_normalizado = _normalizar_texto(valor)
    return valor_normalizado or None


def _es_hoy(fecha_str: str | None) -> bool:
    if not fecha_str:
        return False
    try:
        fecha = fecha_str[:10]
        return fecha == date.today().isoformat()
    except (ValueError, IndexError):
        return False


def _actualizar_campos_proceso(proceso: Proceso, resumen, detalle) -> bool:
    changed = False

    def set_if_changed(field_name: str, value: str | None):
        nonlocal changed
        normalized = _serializar_texto(value)
        current = _serializar_texto(getattr(proceso, field_name, None))
        if normalized and normalized != current:
            setattr(proceso, field_name, normalized)
            changed = True

    set_if_changed("despacho", detalle.despacho or resumen.despacho)
    set_if_changed("departamento", resumen.departamento)
    set_if_changed("sujetos_procesales", resumen.sujetos_procesales)
    set_if_changed("tipo_proceso", detalle.tipo_proceso or resumen.tipo_proceso)
    set_if_changed("clase_proceso", detalle.clase_proceso or resumen.clase_proceso)
    set_if_changed("fecha_proceso", detalle.fecha_proceso or resumen.fecha_proceso)

    if proceso.es_privado != detalle.es_privado:
        proceso.es_privado = detalle.es_privado
        changed = True

    return changed


def _upsert_actuacion(db: Session, proceso_db: Proceso, actuacion_remota) -> Actuacion:
    existente = (
        db.query(Actuacion)
        .filter(Actuacion.proceso_id == proceso_db.id, Actuacion.id_reg_actuacion == actuacion_remota.id_reg_actuacion)
        .first()
    )

    if existente is None:
        existente = Actuacion(proceso_id=proceso_db.id, id_reg_actuacion=actuacion_remota.id_reg_actuacion)
        db.add(existente)

    existente.cons_actuacion = actuacion_remota.cons_actuacion
    existente.fecha_actuacion = _serializar_texto(actuacion_remota.fecha_actuacion)
    existente.actuacion = _serializar_texto(actuacion_remota.actuacion)
    existente.anotacion = _serializar_texto(actuacion_remota.anotacion)
    existente.fecha_inicial = _serializar_texto(actuacion_remota.fecha_inicial)
    existente.fecha_final = _serializar_texto(actuacion_remota.fecha_final)
    existente.fecha_registro = _serializar_texto(actuacion_remota.fecha_registro)
    existente.cod_regla = _serializar_texto(actuacion_remota.cod_regla)
    existente.con_documentos = bool(actuacion_remota.con_documentos)
    existente.cant = actuacion_remota.cant

    return existente


def _upsert_documento(db: Session, actuacion_db: Actuacion, documento_remoto) -> DocumentoActuacion:
    existente = (
        db.query(DocumentoActuacion)
        .filter(
            DocumentoActuacion.actuacion_id == actuacion_db.id,
            DocumentoActuacion.id_reg_documento == documento_remoto.id_reg_documento,
        )
        .first()
    )

    if existente is None:
        existente = DocumentoActuacion(
            actuacion_id=actuacion_db.id,
            id_reg_documento=documento_remoto.id_reg_documento,
            guid_documento_sxxiw=documento_remoto.guid_documento_sxxiw,
            nombre=documento_remoto.nombre,
        )
        db.add(existente)

    existente.id_conexion = documento_remoto.id_conexion
    existente.cons_actuacion = documento_remoto.cons_actuacion
    existente.guid_documento_sxxiw = documento_remoto.guid_documento_sxxiw
    existente.nombre = documento_remoto.nombre
    existente.descripcion = documento_remoto.descripcion
    existente.tipo = documento_remoto.tipo
    existente.fecha_carga = documento_remoto.fecha_carga

    return existente


def _latest_actuacion(actuaciones: list[object]):
    if not actuaciones:
        return None
    return max(
        actuaciones,
        key=lambda actuacion: (
            _normalizar_texto(getattr(actuacion, "fecha_actuacion", None)),
            int(getattr(actuacion, "id_reg_actuacion", 0) or 0),
        ),
    )


def sincronizar_radicado(db: Session, radicado: Proceso) -> bool:
    """Sincroniza un solo radicado contra Rama Judicial en vivo.
    Busca datos del proceso, actuaciones y documentos, y los persiste en DB.
    Retorna True si se pudo sincronizar, False si falló.
    """
    if not re.fullmatch(r"\d{23}", radicado.llave_proceso or ""):
        return False

    try:
        resultado: ResultadoBusqueda = buscar_por_radicado(radicado.llave_proceso, solo_activos=False)
    except Exception as exc:
        logger.warning("No se pudo consultar radicado %s: %s", radicado.llave_proceso, exc)
        return False

    if not resultado.procesos:
        return False

    resumen = _elegir_mejor_proceso(resultado.procesos)

    try:
        detalle = buscar_detalle_proceso(resumen.id_proceso)
        resultado_actuaciones = buscar_actuaciones(resumen.id_proceso)
    except Exception as exc:
        logger.warning("No se pudo traer detalle de Rama para %s: %s", radicado.llave_proceso, exc)
        return False

    _actualizar_campos_proceso(radicado, resumen, detalle)

    latest_remote = _latest_actuacion(resultado_actuaciones.actuaciones)
    if latest_remote is not None:
        radicado.fecha_ultima_actuacion = _serializar_texto(latest_remote.fecha_actuacion)

    for actuacion_remota in resultado_actuaciones.actuaciones:
        actuacion_db = _upsert_actuacion(db, radicado, actuacion_remota)
        if actuacion_remota.con_documentos:
            try:
                documentos = buscar_documentos_actuacion(actuacion_remota.id_reg_actuacion)
            except Exception as exc:
                logger.warning(
                    "No se pudieron traer documentos de la actuación %s: %s",
                    actuacion_remota.id_reg_actuacion, exc,
                )
                documentos = []
            for documento_remoto in documentos:
                _upsert_documento(db, actuacion_db, documento_remoto)

    logger.info(
        "Radicado %s sincronizado: %d actuaciones, última: %s",
        radicado.llave_proceso,
        len(resultado_actuaciones.actuaciones),
        latest_remote.fecha_actuacion if latest_remote else "N/A",
    )
    db.commit()
    return True


def sincronizar_radicados(db: Session, user_id: int | None = None) -> dict:
    query = db.query(Proceso)
    if user_id is not None:
        query = query.filter(Proceso.user_id == user_id)
    radicados = query.order_by(Proceso.id.asc()).all()

    nuevos = []
    actualizados = []
    emails_enviados = []
    ignorados = []
    errores = []

    for idx, radicado in enumerate(radicados):
        # Pausa entre radicados para evitar rate limiting de Rama Judicial
        if idx > 0:
            time.sleep(1.5)

        if not re.fullmatch(r"\d{23}", radicado.llave_proceso or ""):
            ignorados.append(radicado.llave_proceso)
            continue

        try:
            resultado: ResultadoBusqueda = buscar_por_radicado(radicado.llave_proceso, solo_activos=False)
        except Exception as exc:
            msg = f"{type(exc).__name__}: {exc}"
            logger.warning("No se pudo consultar radicado %s: %s", radicado.llave_proceso, msg)
            errores.append({"radicado": radicado.llave_proceso, "error": msg, "paso": "buscar_por_radicado"})
            if "403" in msg:
                time.sleep(8)
            continue

        if not resultado.procesos:
            continue

        resumen = _elegir_mejor_proceso(resultado.procesos)

        time.sleep(0.5)
        try:
            detalle = buscar_detalle_proceso(resumen.id_proceso)
            time.sleep(0.5)
            resultado_actuaciones = buscar_actuaciones(resumen.id_proceso)
        except Exception as exc:
            msg = f"{type(exc).__name__}: {exc}"
            logger.warning("No se pudo traer detalle de Rama para %s: %s", radicado.llave_proceso, msg)
            errores.append({"radicado": radicado.llave_proceso, "error": msg, "paso": "detalle_o_actuaciones"})
            if "403" in msg:
                time.sleep(5)
            continue

        previous_latest_id = (
            db.query(func.max(Actuacion.id_reg_actuacion))
            .filter(Actuacion.proceso_id == radicado.id)
            .scalar()
        )
        is_initial_sync = previous_latest_id is None

        datos_cambiaron = _actualizar_campos_proceso(radicado, resumen, detalle)

        latest_remote = _latest_actuacion(resultado_actuaciones.actuaciones)
        if latest_remote is not None:
            radicado.fecha_ultima_actuacion = _serializar_texto(latest_remote.fecha_actuacion)

        for actuacion_remota in resultado_actuaciones.actuaciones:
            actuacion_db = _upsert_actuacion(db, radicado, actuacion_remota)
            if actuacion_remota.con_documentos:
                try:
                    documentos = buscar_documentos_actuacion(actuacion_remota.id_reg_actuacion)
                except Exception as exc:
                    logger.warning(
                        "No se pudieron traer documentos de la actuación %s: %s",
                        actuacion_remota.id_reg_actuacion,
                        exc,
                    )
                    documentos = []
                for documento_remoto in documentos:
                    _upsert_documento(db, actuacion_db, documento_remoto)

        db.flush()

        latest_stored_id = (
            db.query(func.max(Actuacion.id_reg_actuacion))
            .filter(Actuacion.proceso_id == radicado.id)
            .scalar()
        )

        if is_initial_sync:
            if latest_remote is not None and _es_hoy(latest_remote.fecha_actuacion):
                radicado.notificado = False
                actualizados.append(radicado.llave_proceso)
                if notificar_cambio_radicado(
                    llave_proceso=radicado.llave_proceso,
                    despacho=radicado.despacho or "",
                    departamento=radicado.departamento or "",
                    fecha_ultima_actuacion=radicado.fecha_ultima_actuacion,
                    sujetos_procesales=radicado.sujetos_procesales or "",
                    actuacion=latest_remote.actuacion,
                    anotacion=latest_remote.anotacion,
                    fecha_registro=latest_remote.fecha_registro,
                    con_documentos=latest_remote.con_documentos,
                ):
                    emails_enviados.append(radicado.llave_proceso)
            else:
                radicado.notificado = True
                nuevos.append(radicado.llave_proceso)
        elif latest_remote is not None and latest_stored_id != previous_latest_id:
            radicado.notificado = False
            actualizados.append(radicado.llave_proceso)
            if notificar_cambio_radicado(
                llave_proceso=radicado.llave_proceso,
                despacho=radicado.despacho or "",
                departamento=radicado.departamento or "",
                fecha_ultima_actuacion=radicado.fecha_ultima_actuacion,
                sujetos_procesales=radicado.sujetos_procesales or "",
                actuacion=latest_remote.actuacion,
                anotacion=latest_remote.anotacion,
                fecha_registro=latest_remote.fecha_registro,
                con_documentos=latest_remote.con_documentos,
                total_actualizadas=len(actualizados),
            ):
                emails_enviados.append(radicado.llave_proceso)

        if datos_cambiaron or latest_remote is not None or is_initial_sync:
            db.commit()

    return {
        "total_consultados": len(radicados),
        "nuevos": len(nuevos),
        "actualizados": len(actualizados),
        "nuevos_radicados": nuevos,
        "actualizados_radicados": actualizados,
        "emails_enviados": emails_enviados,
        "radicados_ignorados": ignorados,
        "radicados_error_consulta": errores,
    }