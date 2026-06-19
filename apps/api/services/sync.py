import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import func, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from models.actuacion import Actuacion
from models.database import SessionLocal
from models.documento_actuacion import DocumentoActuacion
from models.proceso import Proceso
from scraper.cache import cached_call
from scraper.rama_client import (
    ResultadoBusqueda,
    buscar_actuaciones,
    buscar_detalle_proceso,
    buscar_documentos_actuacion,
    buscar_por_radicado,
)
from services.notifications import notificar_cambio_radicado
from config import APP_URL

logger = logging.getLogger(__name__)

_COLOMBIA_TZ = timezone(timedelta(hours=-5))
_PARALELISMO = 3


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


def _es_reciente(fecha_str: str | None, dias: int = 5) -> bool:
    if not fecha_str:
        return False
    try:
        fecha = datetime.strptime(fecha_str[:10], "%Y-%m-%d").date()
        hoy_colombia = datetime.now(_COLOMBIA_TZ).date()
        diff = abs((hoy_colombia - fecha).days)
        return diff <= dias
    except (ValueError, IndexError):
        return False


def _calcular_dias_sin_cambios(fecha_str: str | None) -> int:
    if not fecha_str:
        return 999
    try:
        fecha = datetime.strptime(fecha_str[:10], "%Y-%m-%d").date()
        hoy_colombia = datetime.now(_COLOMBIA_TZ).date()
        diff = (hoy_colombia - fecha).days
        return max(0, diff)
    except (ValueError, IndexError):
        return 999


def _backoff_dias(proceso: Proceso) -> int:
    fallos = proceso.fallos_consecutivos or 0
    if fallos == 0:
        return 0
    if fallos == 1:
        return 1
    if fallos == 2:
        return 3
    if fallos == 3:
        return 7
    return 15


def _debe_sincronizar(proceso: Proceso) -> bool:
    if proceso.ultima_sincronizacion is None:
        return True
    dias_desde_sync = (datetime.now(timezone.utc).replace(tzinfo=None) - proceso.ultima_sincronizacion).days
    dias_sin_cambios = proceso.dias_sin_cambios or 0
    backoff = _backoff_dias(proceso)

    if backoff > 0:
        return dias_desde_sync >= backoff

    if dias_sin_cambios < 7:
        return dias_desde_sync >= 1
    elif dias_sin_cambios < 30:
        return dias_desde_sync >= 3
    elif dias_sin_cambios < 90:
        return dias_desde_sync >= 7
    else:
        return dias_desde_sync >= 15


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



def _enviar_notificaciones_acumuladas(acumuladas: dict[str, list[dict]], emails_enviados: list):
    for email, notifs in acumuladas.items():
        destinatarios = [email]
        chat_id = notifs[0].get("telegram_chat_id") if notifs else None
        if len(notifs) > 3:
            from services.email_templates import template_resumen
            asunto, cuerpo_html = template_resumen(notifs)
            ok = notificar_cambio_radicado(
                llave_proceso="resumen",
                despacho="",
                departamento="",
                fecha_ultima_actuacion=None,
                sujetos_procesales="",
                actuacion=None,
                anotacion=None,
                fecha_registro=None,
                con_documentos=None,
                destinatarios=destinatarios,
                custom_asunto=asunto,
                custom_cuerpo=cuerpo_html,
                telegram_chat_id=chat_id,
            )
            if ok:
                emails_enviados.append(f"resumen_{email}")
            time.sleep(0.5)
        else:
            for n in notifs:
                ok = notificar_cambio_radicado(
                    llave_proceso=n["llave_proceso"],
                    despacho=n["despacho"],
                    departamento=n["departamento"],
                    fecha_ultima_actuacion=n["fecha_ultima_actuacion"],
                    sujetos_procesales=n["sujetos_procesales"],
                    actuacion=n["actuacion"],
                    anotacion=n["anotacion"],
                    fecha_registro=n["fecha_registro"],
                    con_documentos=n["con_documentos"],
                    destinatarios=destinatarios,
                    categoria=n["categoria"],
                    telegram_chat_id=n.get("telegram_chat_id"),
                )
                if ok:
                    emails_enviados.append(n["llave_proceso"])
                time.sleep(0.5)



def sincronizar_radicados_lote(db: Session, lote: int = 25, user_id: int | None = None) -> dict:
    from sqlalchemy import case, desc, nullsfirst, nullslast

    query = db.query(Proceso)
    if user_id is not None:
        query = query.filter(Proceso.user_id == user_id)
    radicados = (
        query.order_by(
            # Priority 1: nunca sincronizados
            Proceso.ultima_sincronizacion.is_(None).desc(),
            # Priority 2: con novedades sin revisar
            Proceso.notificado.asc(),
            # Priority 3: actuación reciente más probable
            Proceso.fecha_ultima_actuacion.desc().nullslast(),
            # Priority 4: los que llevan más tiempo sin sincronizar
            Proceso.ultima_sincronizacion.asc().nullsfirst(),
            Proceso.id.asc(),
        )
        .limit(lote)
        .all()
    )
    return _sincronizar_lista(db, radicados)


def sincronizar_radicados(db: Session, user_id: int | None = None) -> dict:
    query = db.query(Proceso)
    if user_id is not None:
        query = query.filter(Proceso.user_id == user_id)
    radicados = query.order_by(Proceso.id.asc()).all()
    return _sincronizar_lista(db, radicados)


def _fetch_radicado_remoto(radicado: Proceso) -> dict:
    """Solo llama APIs externas (Rama Judicial). Sin session BD. Ejecutado en worker thread."""
    if not re.fullmatch(r"\d{23}", radicado.llave_proceso or ""):
        return {"status": "ignored", "llave_proceso": radicado.llave_proceso}

    try:
        resultado = cached_call(buscar_por_radicado, 300, radicado.llave_proceso, solo_activos=False)
    except Exception as exc:
        return {"status": "error", "llave_proceso": radicado.llave_proceso, "error": f"{type(exc).__name__}: {exc}", "paso": "buscar_por_radicado"}

    if not resultado.procesos:
        return {"status": "no_data", "llave_proceso": radicado.llave_proceso}

    resumen = _elegir_mejor_proceso(resultado.procesos)

    try:
        detalle = cached_call(buscar_detalle_proceso, 300, resumen.id_proceso)
    except Exception as exc:
        return {"status": "error", "llave_proceso": radicado.llave_proceso, "error": f"{type(exc).__name__}: {exc}", "paso": "detalle"}

    resultado_actuaciones = None
    for act_intento in range(3):
        try:
            resultado_actuaciones = cached_call(buscar_actuaciones, 300, resumen.id_proceso)
            break
        except Exception as exc:
            if act_intento < 2:
                time.sleep(5 * (2 ** act_intento))
    if resultado_actuaciones is None:
        return {"status": "error", "llave_proceso": radicado.llave_proceso, "error": "actuaciones fallaron tras 3 intentos", "paso": "actuaciones"}

    documentos_por_actuacion = {}
    for act in resultado_actuaciones.actuaciones:
        if act.con_documentos:
            try:
                documentos_por_actuacion[act.id_reg_actuacion] = cached_call(buscar_documentos_actuacion, 300, act.id_reg_actuacion)
            except Exception:
                documentos_por_actuacion[act.id_reg_actuacion] = []

    return {
        "status": "ok",
        "llave_proceso": radicado.llave_proceso,
        "resumen": resumen,
        "detalle": detalle,
        "actuaciones": resultado_actuaciones.actuaciones,
        "documentos_por_actuacion": documentos_por_actuacion,
    }


def _aplicar_datos_remotos(db: Session, radicado: Proceso, datos: dict, nuevos: list, actualizados: list,
                           emails_enviados: list, errores: list, acumuladas: dict):
    """Aplica datos remotos a la BD en la sesion del hilo principal."""
    if datos.get("status") != "ok":
        return

    resumen = datos["resumen"]
    detalle = datos["detalle"]
    actuaciones_remotas = datos["actuaciones"]
    documentos_por_actuacion = datos["documentos_por_actuacion"]

    previous_latest_id = (
        db.query(func.max(Actuacion.id_reg_actuacion))
        .filter(Actuacion.proceso_id == radicado.id)
        .scalar()
    )
    is_initial_sync = previous_latest_id is None

    datos_cambiaron = _actualizar_campos_proceso(radicado, resumen, detalle)

    latest_remote = _latest_actuacion(actuaciones_remotas)
    if latest_remote is not None:
        radicado.fecha_ultima_actuacion = _serializar_texto(latest_remote.fecha_actuacion)

    for actuacion_remota in actuaciones_remotas:
        actuacion_db = _upsert_actuacion(db, radicado, actuacion_remota)
        for documento_remoto in documentos_por_actuacion.get(actuacion_remota.id_reg_actuacion, []):
            _upsert_documento(db, actuacion_db, documento_remoto)

    db.flush()

    latest_stored_id = (
        db.query(func.max(Actuacion.id_reg_actuacion))
        .filter(Actuacion.proceso_id == radicado.id)
        .scalar()
    )

    user_email = radicado.user.email.strip() if radicado.user and radicado.user.email else None
    telegram_chat_id = radicado.user.telegram_chat_id if radicado.user else None

    if is_initial_sync:
        if latest_remote is not None and _es_reciente(latest_remote.fecha_actuacion):
            radicado.notificado = False
            radicado.tipo_novedad = "actualizacion"
            actualizados.append(radicado.llave_proceso)
            if user_email:
                acumuladas.setdefault(user_email, []).append({
                    "llave_proceso": radicado.llave_proceso,
                    "despacho": radicado.despacho or "",
                    "departamento": radicado.departamento or "",
                    "fecha_ultima_actuacion": radicado.fecha_ultima_actuacion,
                    "sujetos_procesales": radicado.sujetos_procesales or "",
                    "actuacion": latest_remote.actuacion,
                    "anotacion": latest_remote.anotacion,
                    "fecha_registro": latest_remote.fecha_registro,
                    "con_documentos": latest_remote.con_documentos,
                    "categoria": radicado.categoria,
                    "telegram_chat_id": telegram_chat_id,
                })
        else:
            radicado.notificado = True
            nuevos.append(radicado.llave_proceso)
    elif latest_remote is not None and latest_stored_id != previous_latest_id:
        radicado.notificado = False
        radicado.tipo_novedad = "actualizacion"
        actualizados.append(radicado.llave_proceso)
        if user_email:
            acumuladas.setdefault(user_email, []).append({
                "llave_proceso": radicado.llave_proceso,
                "despacho": radicado.despacho or "",
                "departamento": radicado.departamento or "",
                "fecha_ultima_actuacion": radicado.fecha_ultima_actuacion,
                "sujetos_procesales": radicado.sujetos_procesales or "",
                "actuacion": latest_remote.actuacion,
                "anotacion": latest_remote.anotacion,
                "fecha_registro": latest_remote.fecha_registro,
                "con_documentos": latest_remote.con_documentos,
                "categoria": radicado.categoria,
                "telegram_chat_id": telegram_chat_id,
            })

    radicado.ultima_sincronizacion = datetime.now(timezone.utc).replace(tzinfo=None)
    radicado.dias_sin_cambios = _calcular_dias_sin_cambios(radicado.fecha_ultima_actuacion)
    radicado.fallos_consecutivos = 0

    if datos_cambiaron or latest_remote is not None or is_initial_sync:
        db.commit()


def _sincronizar_lista(db: Session, radicados: list[Proceso]) -> dict:
    nuevos: list = []
    actualizados: list = []
    emails_enviados: list = []
    ignorados: list = []
    errores: list = []
    saltados: list = []
    acumuladas: dict[str, list[dict]] = {}

    for radicado in radicados:
        if not re.fullmatch(r"\d{23}", radicado.llave_proceso or ""):
            ignorados.append(radicado.llave_proceso)
            continue

        if not _debe_sincronizar(radicado):
            saltados.append(radicado.llave_proceso)
            continue

    pendientes = [r for r in radicados if r.llave_proceso not in ignorados and r.llave_proceso not in saltados]

    datos_remotos: list[dict] = []
    with ThreadPoolExecutor(max_workers=_PARALELISMO) as executor:
        futuros = {}
        for r in pendientes:
            futuros[executor.submit(_fetch_radicado_remoto, r)] = r
            time.sleep(0.3)

        for futuro in as_completed(futuros):
            datos_remotos.append(futuro.result())

    for datos in datos_remotos:
        if datos["status"] == "ok":
            radicado = next((r for r in pendientes if r.llave_proceso == datos["llave_proceso"]), None)
            if radicado is not None:
                try:
                    _aplicar_datos_remotos(db, radicado, datos, nuevos, actualizados, emails_enviados, errores, acumuladas)
                except OperationalError as exc:
                    logger.warning("Error BD en radicado %s: %s. Reintentando...", radicado.llave_proceso, exc)
                    db.rollback()
                    try:
                        _aplicar_datos_remotos(db, radicado, datos, nuevos, actualizados, emails_enviados, errores, acumuladas)
                    except OperationalError as exc2:
                        logger.warning("Error BD persistente en radicado %s: %s", radicado.llave_proceso, exc2)
                        db.rollback()
                        errores.append({"radicado": radicado.llave_proceso, "error": str(exc2), "paso": "base_de_datos"})
        elif datos["status"] == "error":
            errores.append({"radicado": datos["llave_proceso"], "error": datos.get("error", "unknown"), "paso": datos.get("paso", "remoto")})

    _enviar_notificaciones_acumuladas(acumuladas, emails_enviados)

    return {
        "total_consultados": len(radicados),
        "nuevos": len(nuevos),
        "actualizados": len(actualizados),
        "nuevos_radicados": nuevos,
        "actualizados_radicados": actualizados,
        "emails_enviados": emails_enviados,
        "radicados_ignorados": ignorados,
        "radicados_saltados_frecuencia": saltados,
        "radicados_error_consulta": errores,
    }