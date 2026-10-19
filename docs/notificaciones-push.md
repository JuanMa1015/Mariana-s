# Notificaciones push (app móvil)

La app Android recibe un aviso al instante cuando un proceso tiene actuaciones nuevas. Es un canal extra: el correo y Telegram siguen igual y, si falta la configuración de abajo, la app funciona sin push.

```
sync detecta novedad → services/push.py → FCM (Firebase) → celular → toque → abre el proceso
```

## Configuración única (Firebase)

1. En [console.firebase.google.com](https://console.firebase.google.com) crea un proyecto («Mariana's»). Google Analytics no hace falta.
2. **Añadir app → Android**, paquete exacto `co.mariana.monitor`. Descarga `google-services.json`.
3. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**: descarga el JSON de la cuenta de servicio.
4. Guarda ambos archivos fuera del repo (están en `.gitignore`).

## Dónde va cada credencial

| Credencial | Destino | Para qué |
|---|---|---|
| Cuenta de servicio (JSON completo, pegado tal cual) | Render → Environment → `FCM_SERVICE_ACCOUNT_JSON` | La API envía los avisos |
| `google-services.json` en base64 | GitHub → Secrets → `GOOGLE_SERVICES_JSON_BASE64` | El APK trae Firebase |

Base64 del `google-services.json` (PowerShell, lo copia al portapapeles):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\google-services.json")) | clip
```

## Probar

1. Publica una versión (`vX.Y.Z`) y descarga el APK nuevo; instálalo.
2. Inicia sesión: aparece «Activa los avisos en tu celular». Pulsa **Activar avisos** y acepta el permiso del sistema.
3. Firebase → Messaging → **Enviar mensaje de prueba** con el token del dispositivo, o espera una novedad real en la sincronización.
4. Toca el aviso: abre el detalle del proceso.

## Notas

- El token del celular se guarda en la tabla `dispositivos` y se borra al cerrar sesión; los tokens que FCM marca como inválidos se limpian solos.
- Sin `GOOGLE_SERVICES_JSON_BASE64` el APK se compila sin push (la app no pide permiso ni se registra).
- iOS necesita además una clave APNs en Firebase y una cuenta de desarrollador Apple; no está configurado.
