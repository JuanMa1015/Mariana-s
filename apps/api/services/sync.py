import re

from sqlalchemy.orm import Session
import logging

from models.proceso import Proceso
from scraper.rama_client import buscar_por_radicado, ResultadoBusqueda
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
        getattr(proceso, "fecha_ultima_actuacion", None),
    ]
    return sum(1 for campo in campos if _normalizar_texto(campo))


def _elegir_mejor_proceso(resultados: list[object]):
    return max(resultados, key=_puntaje_proceso)


def _rellenar_campos(proceso: Proceso, remoto) -> bool:
    """Copiar datos no vacíos desde Rama y reportar si hubo cambios."""
    changed = False

    for campo in ("despacho", "departamento", "sujetos_procesales", "tipo_proceso", "clase_proceso"):
        valor_remoto = _normalizar_texto(getattr(remoto, campo, None))
        valor_local = _normalizar_texto(getattr(proceso, campo, None))

        if valor_remoto and valor_local != valor_remoto:
            setattr(proceso, campo, valor_remoto)
            changed = True

    fecha_remota = _normalizar_texto(getattr(remoto, "fecha_ultima_actuacion", None))
    fecha_local = _normalizar_texto(proceso.fecha_ultima_actuacion)
    if fecha_remota and fecha_local != fecha_remota:
        proceso.fecha_ultima_actuacion = fecha_remota
        changed = True

    return changed


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

    for radicado in radicados:
        if not re.fullmatch(r"\d{23}", radicado.llave_proceso or ""):
            ignorados.append(radicado.llave_proceso)
            continue

        try:
            resultado: ResultadoBusqueda = buscar_por_radicado(radicado.llave_proceso, solo_activos=False)
        except Exception as exc:
            logger.warning("No se pudo consultar radicado %s: %s", radicado.llave_proceso, exc)
            errores.append(radicado.llave_proceso)
            continue

        if not resultado.procesos:
            continue

        remoto = _elegir_mejor_proceso(resultado.procesos)
        fecha_anterior = _normalizar_texto(radicado.fecha_ultima_actuacion)
        tenia_campos_vacios = any(
            not _normalizar_texto(valor)
            for valor in (
                radicado.despacho,
                radicado.departamento,
                radicado.sujetos_procesales,
                radicado.tipo_proceso,
                radicado.clase_proceso,
                radicado.fecha_ultima_actuacion,
            )
        )

        if fecha_anterior == "":
            _rellenar_campos(radicado, remoto)
            radicado.notificado = True
            nuevos.append(radicado.llave_proceso)
            db.commit()
            continue

        cambio_datos = _rellenar_campos(radicado, remoto)
        fecha_cambio = fecha_anterior != _normalizar_texto(radicado.fecha_ultima_actuacion)

        if fecha_cambio:
            radicado.notificado = False
            actualizados.append(radicado.llave_proceso)
            if notificar_cambio_radicado(
                llave_proceso=radicado.llave_proceso,
                despacho=radicado.despacho or "",
                departamento=radicado.departamento or "",
                fecha_ultima_actuacion=radicado.fecha_ultima_actuacion,
                sujetos_procesales=radicado.sujetos_procesales or "",
            ):
                emails_enviados.append(radicado.llave_proceso)

        if cambio_datos or fecha_cambio or tenia_campos_vacios:
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