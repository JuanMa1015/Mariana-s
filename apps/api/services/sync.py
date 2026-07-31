import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, FIRST_COMPLETED, wait
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import func
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
    rama_health_check,
)
from services.notifications import notificar_cambio_radicado
from config import APP_URL

logger = logging.getLogger(__name__)

_COLOMBIA_TZ = timezone(timedelta(hours=-5))
_PARALELISMO = 3
_MAX_FALLOS_CONSECUTIVOS_RAMA = 3


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
    return 7


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
        return dias_desde_sync >= 7


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


def _fetch_actuaciones_multi(ids_proceso: list[int]) -> dict:
    todas = {}
    docs = {}
    fallos = 0
    for id_proc in ids_proceso:
        try:
            resultado = cached_call(buscar_actuaciones, 300, id_proc)
            for act in resultado.actuaciones:
                if act.id_reg_actuacion not in todas:
                    todas[act.id_reg_actuacion] = act
            for act in resultado.actuaciones:
                if act.con_documentos and act.id_reg_actuacion not in docs:
                    try:
                        docs[act.id_reg_actuacion] = cached_call(buscar_documentos_actuacion, 300, act.id_reg_actuacion)
                    except Exception:
                        docs[act.id_reg_actuacion] = []
        except Exception as exc:
            fallos += 1
            logger.debug("_fetch_actuaciones_multi id_proc=%s fallo: %s", id_proc, exc)
    if fallos > 0:
        raise RuntimeError(f"{fallos}/{len(ids_proceso)} consultas de actuaciones fallaron")
    actuaciones = sorted(todas.values(), key=lambda a: (a.fecha_actuacion or "", a.id_reg_actuacion or 0))
    return {"actuaciones": actuaciones, "documentos_por_actuacion": docs}



def _enviar_notificaciones_acumuladas(acumuladas: dict[str, list[dict]], emails_enviados: list) -> set[str]:
    entregadas: set[str] = set()
    for llave_grupo, notifs in acumuladas.items():
        email = notifs[0].get("email")
        destinatarios = [email] if email else None
        chat_id = notifs[0].get("telegram_chat_id")
        if len(notifs) > 3:
            from services.email_templates import template_resumen
            asunto, cuerpo_html = template_resumen(notifs)
            res = notificar_cambio_radicado(
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
            if res.get("email") or res.get("telegram"):
                emails_enviados.append(f"resumen_{llave_grupo}")
                entregadas.update(n["llave_proceso"] for n in notifs)
            time.sleep(0.5)
        else:
            for n in notifs:
                actuaciones = n.get("actuaciones", [])
                res = notificar_cambio_radicado(
                    llave_proceso=n["llave_proceso"],
                    despacho=n["despacho"],
                    departamento=n["departamento"],
                    fecha_ultima_actuacion=n["fecha_ultima_actuacion"],
                    sujetos_procesales=n["sujetos_procesales"],
                    actuacion=None,
                    anotacion=None,
                    fecha_registro=None,
                    con_documentos=None,
                    destinatarios=destinatarios,
                    categoria=n["categoria"],
                    telegram_chat_id=n.get("telegram_chat_id"),
                    actuaciones=actuaciones,
                )
                if res.get("email") or res.get("telegram"):
                    emails_enviados.append(n["llave_proceso"])
                    entregadas.add(n["llave_proceso"])
                time.sleep(0.5)
    return entregadas


_INTENTOS_MAX_NOTIFICACION = 5
_BACKOFF_NOTIFICACION_HORAS = [1, 3, 6, 12, 24]


def _backoff_notificacion_horas(intentos: int) -> int:
    return _BACKOFF_NOTIFICACION_HORAS[min(intentos, len(_BACKOFF_NOTIFICACION_HORAS) - 1)]


def _reenviar_notificaciones_pendientes(db: Session) -> list[str]:
    """Reintenta envíos fallidos de novedades usando datos de la BD (sin llamar a Rama)."""
    pendientes = db.query(Proceso).filter(Proceso.notificacion_pendiente.is_(True)).all()
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    reenviadas: list[str] = []

    for radicado in pendientes:
        intentos = radicado.intentos_notificacion or 0
        if intentos >= _INTENTOS_MAX_NOTIFICACION:
            logger.warning(
                "Notificacion de %s alcanzó el máximo de %d intentos; queda visible en la app",
                radicado.llave_proceso, _INTENTOS_MAX_NOTIFICACION,
            )
            continue
        espera_h = _backoff_notificacion_horas(intentos)
        if radicado.ultima_notificacion_intento and \
                (ahora - radicado.ultima_notificacion_intento).total_seconds() < espera_h * 3600:
            continue

        user_email = radicado.user.email.strip() if radicado.user and radicado.user.email else None
        telegram_chat_id = radicado.user.telegram_chat_id if radicado.user else None

        actuaciones_db = (
            db.query(Actuacion)
            .filter(Actuacion.proceso_id == radicado.id)
            .order_by(Actuacion.id_reg_actuacion.desc())
            .limit(10)
            .all()
        )
        actuaciones = [
            {
                "actuacion": a.actuacion,
                "anotacion": a.anotacion,
                "fecha_registro": a.fecha_registro,
                "fecha_actuacion": a.fecha_actuacion,
                "con_documentos": a.con_documentos,
            }
            for a in actuaciones_db
        ]

        res = notificar_cambio_radicado(
            llave_proceso=radicado.llave_proceso,
            despacho=radicado.despacho or "",
            departamento=radicado.departamento or "",
            fecha_ultima_actuacion=radicado.fecha_ultima_actuacion,
            sujetos_procesales=radicado.sujetos_procesales or "",
            destinatarios=[user_email] if user_email else None,
            categoria=radicado.categoria,
            telegram_chat_id=telegram_chat_id,
            actuaciones=actuaciones,
        )

        radicado.intentos_notificacion = intentos + 1
        radicado.ultima_notificacion_intento = ahora
        if res.get("email") or res.get("telegram"):
            radicado.notificacion_pendiente = False
            radicado.intentos_notificacion = 0
            reenviadas.append(radicado.llave_proceso)
        db.commit()

    return reenviadas



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
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return {"status": "private", "llave_proceso": radicado.llave_proceso}
        return {"status": "error", "llave_proceso": radicado.llave_proceso, "error": f"HTTP {exc.response.status_code}", "paso": "detalle"}
    except Exception as exc:
        return {"status": "error", "llave_proceso": radicado.llave_proceso, "error": f"{type(exc).__name__}: {exc}", "paso": "detalle"}

    ids_proceso = sorted({p.id_proceso for p in resultado.procesos if p.id_proceso})
    if not ids_proceso:
        ids_proceso = [resumen.id_proceso]

    act_data = None
    for act_intento in range(3):
        try:
            act_data = _fetch_actuaciones_multi(ids_proceso)
            break
        except Exception as exc:
            if act_intento < 2:
                time.sleep(5 * (2 ** act_intento))
    if act_data is None:
        return {"status": "error", "llave_proceso": radicado.llave_proceso, "error": "actuaciones fallaron tras 3 intentos", "paso": "actuaciones"}

    return {
        "status": "ok",
        "llave_proceso": radicado.llave_proceso,
        "resumen": resumen,
        "detalle": detalle,
        "actuaciones": act_data["actuaciones"],
        "documentos_por_actuacion": act_data["documentos_por_actuacion"],
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
    tiene_canal = bool(user_email or telegram_chat_id)
    llave_acumulada = user_email or f"telegram:{telegram_chat_id}"

    if is_initial_sync:
        if latest_remote is not None and _es_reciente(latest_remote.fecha_actuacion):
            radicado.notificado = False
            radicado.tipo_novedad = "actualizacion"
            actualizados.append(radicado.llave_proceso)
            if tiene_canal:
                radicado.notificacion_pendiente = True
                acumuladas.setdefault(llave_acumulada, []).append({
                    "llave_proceso": radicado.llave_proceso,
                    "despacho": radicado.despacho or "",
                    "departamento": radicado.departamento or "",
                    "fecha_ultima_actuacion": radicado.fecha_ultima_actuacion,
                    "sujetos_procesales": radicado.sujetos_procesales or "",
                    "actuaciones": [{
                        "actuacion": latest_remote.actuacion,
                        "anotacion": latest_remote.anotacion,
                        "fecha_registro": latest_remote.fecha_registro,
                        "fecha_actuacion": latest_remote.fecha_actuacion,
                        "con_documentos": latest_remote.con_documentos,
                    }],
                    "categoria": radicado.categoria,
                    "telegram_chat_id": telegram_chat_id,
                    "email": user_email,
                })
        else:
            radicado.notificado = True
            nuevos.append(radicado.llave_proceso)
    elif latest_remote is not None and latest_stored_id != previous_latest_id:
        radicado.notificado = False
        radicado.tipo_novedad = "actualizacion"
        actualizados.append(radicado.llave_proceso)
        nuevas_actuaciones_db = (
            db.query(Actuacion)
            .filter(
                Actuacion.proceso_id == radicado.id,
                Actuacion.id_reg_actuacion > previous_latest_id,
            )
            .order_by(Actuacion.id_reg_actuacion.asc())
            .all()
        )
        if tiene_canal:
            radicado.notificacion_pendiente = True
            acumuladas.setdefault(llave_acumulada, []).append({
                "llave_proceso": radicado.llave_proceso,
                "despacho": radicado.despacho or "",
                "departamento": radicado.departamento or "",
                "fecha_ultima_actuacion": radicado.fecha_ultima_actuacion,
                "sujetos_procesales": radicado.sujetos_procesales or "",
                "actuaciones": [
                    {
                        "actuacion": a.actuacion,
                        "anotacion": a.anotacion,
                        "fecha_registro": a.fecha_registro,
                        "fecha_actuacion": a.fecha_actuacion,
                        "con_documentos": a.con_documentos,
                    }
                    for a in nuevas_actuaciones_db
                ],
                "categoria": radicado.categoria,
                "telegram_chat_id": telegram_chat_id,
                "email": user_email,
            })

    radicado.ultima_sincronizacion = datetime.now(timezone.utc).replace(tzinfo=None)
    radicado.dias_sin_cambios = _calcular_dias_sin_cambios(radicado.fecha_ultima_actuacion)
    radicado.fallos_consecutivos = 0

    if datos_cambiaron or latest_remote is not None or is_initial_sync:
        db.commit()


def _ejecutar_lote(pendientes: list[Proceso]) -> tuple[list[dict], list[str]]:
    """Consulta Rama en paralelo con circuit breaker.

    Si hay _MAX_FALLOS_CONSECUTIVOS_RAMA radicados seguidos que fallan, se
    considera que Rama esta inestable, se deja de consultar y el resto se marca
    como saltado para que el lote responda rapido en vez de colgarse.
    """
    datos_remotos: list[dict] = []
    saltados_rama: list[str] = []
    por_ejecutar = list(pendientes)
    racha_fallos = 0

    with ThreadPoolExecutor(max_workers=_PARALELISMO) as executor:
        futuros = {}
        while por_ejecutar or futuros:
            while len(futuros) < _PARALELISMO and por_ejecutar:
                radicado = por_ejecutar.pop(0)
                futuros[executor.submit(_fetch_radicado_remoto, radicado)] = radicado
                time.sleep(0.3)

            if not futuros:
                break

            terminados, _ = wait(futuros, return_when=FIRST_COMPLETED)
            for futuro in terminados:
                radicado = futuros.pop(futuro)
                try:
                    datos = futuro.result()
                except Exception as exc:
                    datos = {
                        "status": "error",
                        "llave_proceso": radicado.llave_proceso,
                        "error": f"{type(exc).__name__}: {exc}",
                        "paso": "worker",
                    }
                datos_remotos.append(datos)
                if datos["status"] == "error":
                    racha_fallos += 1
                else:
                    racha_fallos = 0

            if racha_fallos >= _MAX_FALLOS_CONSECUTIVOS_RAMA and por_ejecutar:
                saltados_rama.extend(r.llave_proceso for r in por_ejecutar)
                por_ejecutar = []
                logger.warning(
                    "Circuit breaker: %d fallos consecutivos a Rama. %d radicados saltados del lote.",
                    racha_fallos, len(saltados_rama),
                )

    return datos_remotos, saltados_rama


def _aplicar_resultado(db: Session, datos: dict, pendientes: list[Proceso], nuevos: list,
                       actualizados: list, emails_enviados: list, errores_rama: list,
                       errores_app: list, acumuladas: dict, privados: list):
    """Aplica un resultado remoto (ok / error / private / no_data) a la BD."""
    radicado = next((r for r in pendientes if r.llave_proceso == datos["llave_proceso"]), None)

    if datos["status"] == "ok":
        if radicado is not None:
            try:
                _aplicar_datos_remotos(db, radicado, datos, nuevos, actualizados, emails_enviados, errores_app, acumuladas)
            except OperationalError as exc:
                logger.warning("Error BD en radicado %s: %s. Reintentando...", radicado.llave_proceso, exc)
                db.rollback()
                try:
                    _aplicar_datos_remotos(db, radicado, datos, nuevos, actualizados, emails_enviados, errores_app, acumuladas)
                except OperationalError as exc2:
                    logger.warning("Error BD persistente en radicado %s: %s", radicado.llave_proceso, exc2)
                    db.rollback()
                    errores_app.append({
                        "radicado": radicado.llave_proceso,
                        "error": str(exc2),
                        "paso": "base_de_datos",
                        "origen": "app",
                    })
    elif datos["status"] == "error":
        errores_rama.append({
            "radicado": datos["llave_proceso"],
            "error": datos.get("error", "unknown"),
            "paso": datos.get("paso", "remoto"),
            "origen": "rama",
        })
    elif datos["status"] == "private":
        privados.append(datos["llave_proceso"])
        if radicado is not None:
            radicado.ultima_sincronizacion = datetime.now(timezone.utc).replace(tzinfo=None)
            radicado.fallos_consecutivos = 0
            db.commit()


def _sincronizar_lista(db: Session, radicados: list[Proceso]) -> dict:
    nuevos: list = []
    actualizados: list = []
    emails_enviados: list = []
    ignorados: list = []
    errores_rama: list = []
    errores_app: list = []
    saltados: list = []
    saltados_rama: list = []
    privados: list = []
    acumuladas: dict[str, list[dict]] = {}

    for radicado in radicados:
        if not re.fullmatch(r"\d{23}", radicado.llave_proceso or ""):
            ignorados.append(radicado.llave_proceso)
            continue

        if not _debe_sincronizar(radicado):
            saltados.append(radicado.llave_proceso)
            continue

    usuarios_afectados = len({r.user_id for r in radicados if re.fullmatch(r"\d{23}", r.llave_proceso or "")})
    pendientes = [r for r in radicados if r.llave_proceso not in ignorados and r.llave_proceso not in saltados]

    # Ronda 1: lote principal con circuit breaker
    datos_remotos, saltados_rama = _ejecutar_lote(pendientes)
    for datos in datos_remotos:
        _aplicar_resultado(db, datos, pendientes, nuevos, actualizados, emails_enviados,
                           errores_rama, errores_app, acumuladas, privados)

    # Ronda 2: reintento en el mismo ciclo de los que fallaron por Rama (errores transitorios)
    if errores_rama and rama_health_check():
        pendientes_retry = [r for r in pendientes if r.llave_proceso in {e["radicado"] for e in errores_rama}]
        errores_rama = []
        datos_retry, saltados_retry = _ejecutar_lote(pendientes_retry)
        saltados_rama.extend(saltados_retry)
        for datos in datos_retry:
            _aplicar_resultado(db, datos, pendientes, nuevos, actualizados, emails_enviados,
                               errores_rama, errores_app, acumuladas, privados)
    elif errores_rama:
        logger.warning("Rama sigue sin responder; se omitio el reintento del lote.")

    errores = errores_rama + errores_app
    entregadas = _enviar_notificaciones_acumuladas(acumuladas, emails_enviados)
    if entregadas:
        db.query(Proceso).filter(Proceso.llave_proceso.in_(list(entregadas))).update(
            {Proceso.notificacion_pendiente: False}, synchronize_session=False
        )
        db.commit()
    reenviadas = _reenviar_notificaciones_pendientes(db)

    return {
        "total_consultados": len(radicados),
        "nuevos": len(nuevos),
        "actualizados": len(actualizados),
        "nuevos_radicados": nuevos,
        "actualizados_radicados": actualizados,
        "emails_enviados": emails_enviados,
        "radicados_ignorados": ignorados,
        "radicados_saltados_frecuencia": saltados,
        "radicados_privados": privados,
        "radicados_saltados_rama": saltados_rama,
        "errores_rama": len(errores_rama),
        "errores_app": len(errores_app),
        "rama_estable": not errores_rama and not saltados_rama,
        "radicados_error_consulta": errores,
        "usuarios_afectados": usuarios_afectados,
        "notificaciones_reenviadas": reenviadas,
    }