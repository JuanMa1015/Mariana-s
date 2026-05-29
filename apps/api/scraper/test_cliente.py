from rama_client import buscar_por_nombre

resultado = buscar_por_nombre("Juan Manuel Londoño")
print(f"Procesos encontrados: {resultado.paginacion.cantidad_registros}")
for p in resultado.procesos:
    print(f"  - {p.numero_radicacion} | {p.despacho} | {p.sujetos_procesales[:60]}")