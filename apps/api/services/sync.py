from sqlalchemy.orm import Session
from models.proceso import Proceso
from scraper.rama_client import buscar_por_nombre, ResultadoBusqueda

def sincronizar_procesos(nombre: str, db: Session) -> dict:
    resultado: ResultadoBusqueda = buscar_por_nombre(nombre)
    
    nuevos = []
    actualizados = []

    for p in resultado.procesos:
        existente = db.query(Proceso).filter(
            Proceso.llave_proceso == p.numero_radicacion
        ).first()

        if not existente:
            nuevo = Proceso(
                llave_proceso=p.numero_radicacion,
                despacho=p.despacho,
                departamento=p.departamento,
                sujetos_procesales=p.sujetos_procesales,
                tipo_proceso=p.tipo_proceso,
                clase_proceso=p.clase_proceso,
                fecha_ultima_actuacion=p.fecha_ultima_actuacion,
            )
            db.add(nuevo)
            nuevos.append(p.numero_radicacion)

        else:
            if existente.fecha_ultima_actuacion != p.fecha_ultima_actuacion:
                existente.fecha_ultima_actuacion = p.fecha_ultima_actuacion
                existente.notificado = False
                actualizados.append(p.numero_radicacion)

    db.commit()

    return {
        "total_consultados": resultado.paginacion.cantidad_registros,
        "nuevos": len(nuevos),
        "actualizados": len(actualizados),
        "nuevos_radicados": nuevos,
        "actualizados_radicados": actualizados,
    }