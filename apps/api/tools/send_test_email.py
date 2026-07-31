from services.notifications import notificar_cambio_radicado


def main():
    # Datos de prueba
    llave = "TEST-000"
    despacho = "Despacho de prueba"
    departamento = "Departamento X"
    fecha = "2026-05-30"
    sujetos = "Actor: Juan Perez\nDemandado: ACME S.A."

    res = notificar_cambio_radicado(llave, despacho, departamento, fecha, sujetos)
    if res.get("email"):
        print("EMAIL_SENT: OK")
    else:
        print("EMAIL_SENT: FAILED")
    print(f"TELEGRAM_SENT: {'OK' if res.get('telegram') else 'FAILED'}")


if __name__ == '__main__':
    main()
