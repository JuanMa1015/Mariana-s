# Changelog

Todos los cambios relevantes de Mariana's se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [Unreleased]

## [0.2.0] - 2026-10-19

Notificaciones push y acabado de app móvil.

### Añadido
- Notificaciones push (Firebase Cloud Messaging) en la app Android: aviso al instante cuando un proceso tiene actuaciones nuevas; al tocarlo se abre el proceso.
- Solicitud de permiso de notificaciones con explicación previa (Android 13+), sin insistir si el usuario elige «Ahora no».
- Registro de dispositivos en el servidor (`/dispositivos`); el celular deja de recibir avisos al cerrar sesión.
- Icono propio (balanza), pantalla de carga clara y oscura, icono y color de las notificaciones.

### Cambiado
- La barra de estado del celular usa iconos oscuros sobre el encabezado claro.

### Notas de despliegue
- Incluye la migración `e5f1b2c3d4a7` (tabla `dispositivos`), aditiva; se aplica sola al arrancar la API.
- Las push se activan al configurar `FCM_SERVICE_ACCOUNT_JSON` en Render y `GOOGLE_SERVICES_JSON_BASE64` en GitHub; sin ellas todo funciona como antes.

## [0.1.0] - 2026-10-19

Primera versión móvil (Android) y mejoras de experiencia para abogados.

### Añadido
- App móvil Android/iOS con Capacitor; sesión por token (Bearer) en la app nativa.
- Barra de navegación inferior y botón «atrás» de Android.
- Alias o nombre del cliente por proceso (editable, buscable y visible en lista, detalle y novedades).
- Orden global de la lista (con novedad primero, más reciente, más antigua) aplicado antes de paginar.
- Aviso «N procesos requieren revisión» y radicado agrupado para leerlo mejor.
- Estados vacíos con guía y búsqueda más visible (atajo `/`).

### Cambiado
- Estados renombrados a «Al día» y «Con novedad».
- Lista en tarjetas en pantallas angostas (móvil y tablet).
- Apariencia más sobria del panel (acento índigo).

### Corregido
- Diálogos de borrar y editar accesibles (Esc, foco, validación de 23 dígitos).
- Colores de categoría consistentes; línea sobrante del historial de actuaciones.
- Tildes faltantes en el panel.

[Unreleased]: https://github.com/JuanMa1015/Mariana-s/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/JuanMa1015/Mariana-s/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JuanMa1015/Mariana-s/releases/tag/v0.1.0
