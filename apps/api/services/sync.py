import re

from sqlalchemy.orm import Session
import logging

from models.proceso import Proceso
from scraper.rama_client import buscar_por_radicado, ResultadoBusqueda
from services.notifications import notificar_cambio_radicado

logger = logging.getLogger(__name__)


def sincronizar_radicados(db: Session) -> dict:
    radicados = db.query(Proceso).order_by(Proceso.id.asc()).all()
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

        remoto = resultado.procesos[0]

        if radicado.fecha_ultima_actuacion is None:
            radicado.despacho = remoto.despacho
            radicado.departamento = remoto.departamento
            radicado.sujetos_procesales = remoto.sujetos_procesales
            radicado.tipo_proceso = remoto.tipo_proceso
            radicado.clase_proceso = remoto.clase_proceso
            radicado.fecha_ultima_actuacion = remoto.fecha_ultima_actuacion
            radicado.notificado = True
            nuevos.append(radicado.llave_proceso)
            db.commit()
            continue

        if radicado.fecha_ultima_actuacion != remoto.fecha_ultima_actuacion:
            radicado.despacho = remoto.despacho
            radicado.departamento = remoto.departamento
            radicado.sujetos_procesales = remoto.sujetos_procesales
            radicado.tipo_proceso = remoto.tipo_proceso
            radicado.clase_proceso = remoto.clase_proceso
            radicado.fecha_ultima_actuacion = remoto.fecha_ultima_actuacion
            radicado.notificado = False
            db.commit()
            actualizados.append(radicado.llave_proceso)
            if notificar_cambio_radicado(
                llave_proceso=radicado.llave_proceso,
                despacho=radicado.despacho or "",
                departamento=radicado.departamento or "",
                fecha_ultima_actuacion=radicado.fecha_ultima_actuacion,
                sujetos_procesales=radicado.sujetos_procesales or "",
            ):
                emails_enviados.append(radicado.llave_proceso)

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