# Changelog

Todos los cambios relevantes de Mariana's se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [Unreleased]

## [0.4.0] - 2026-10-19

Panel de administración.

### Añadido
- **Panel de administración** (`/admin`, desde Ajustes) para cuentas con rol de administrador: resumen del sistema, gestión completa de usuarios (crear con invitación, editar, suspender, cerrar sesiones, eliminar), procesos de todos los usuarios, celulares registrados para push y registro de auditoría.
- **Pruebas y diagnóstico** dentro del panel: base de datos y migraciones, configuración, registro, ingreso, restablecer contraseña, ingreso de radicados, correo, push, Telegram y Rama Judicial, con resultado paso a paso y modo «ejecutar todas» sin envíos reales.
- Roles y estado de cuenta: `is_admin`, `activo` (cuenta suspendida) y último acceso. Los administradores se definen con la variable `ADMIN_EMAILS` o desde el panel; no hay usuario ni contraseña por defecto.
- Los avisos push se gestionan en Ajustes → Notificaciones; «Probar avisos» queda como herramienta de soporte oculta.

### Notas de despliegue
- Incluye la migración `a7c3d5e9f1b2` (columnas de rol/estado en `users` y tabla `audit_log`), aditiva; se aplica sola al arrancar la API.
- Para tener un primer administrador, define `ADMIN_EMAILS` en Render con tu correo. Ver `docs/panel-admin.md`.

## [0.3.1] - 2026-10-19

### Cambiado
- Los avisos push se gestionan en **Ajustes → Notificaciones** (estado y activación). La pantalla principal ya no muestra el botón «Enviar prueba» ni la franja de «avisos activados»; solo aparece la tarjeta para activarlos si falta el permiso.
- «Probar avisos» pasa a ser una herramienta de soporte oculta (siete toques sobre la versión, en Ajustes). Permite enviar el aviso «en 15 s» para cerrar la app y comprobar que llega a la bandeja del celular.

### Corregido
- Los avisos push quedan conectados en todas las pantallas privadas (antes solo en la lista de procesos): activarlos desde Ajustes ahora registra el celular de inmediato.

## [0.3.0] - 2026-10-19

Pulido de la app móvil y prueba de avisos.

### Añadido
- Pantalla de **Ajustes** (`/ajustes`): foto de perfil, cambio de nombre de usuario (pide la contraseña actual), apariencia y cierre de sesión.
- **Modo oscuro** (claro, oscuro o automático según el dispositivo), recordado en cada dispositivo.
- **Cambio y recuperación de contraseña por correo**: enlace de un solo uso (vence en 30 min) desde Ajustes o desde «¿Olvidaste tu contraseña?»; al usarlo se cierran las demás sesiones.
- Foto de perfil visible en el encabezado; el menú inferior móvil ahora incluye Ajustes.
- «Enviar prueba» en la app: simula una novedad y llega como notificación push, para comprobar los avisos (`POST /dispositivos/prueba`).

### Calidad
- La integración continua ahora también ejecuta lint y compilación (tipos) del front y exige 80 % de cobertura en el backend antes de dar un cambio por bueno.

### Notas de despliegue
- Incluye la migración `f6b2c3d4e5a8` (columnas de foto en `users` y tabla `password_resets`), aditiva; se aplica sola al arrancar la API.
- El correo de restablecimiento usa los mismos proveedores que los avisos (Brevo, SendGrid o SMTP) y el enlace apunta a `APP_URL`.

### Corregido
- La barra de estado del celular ya no se superpone al contenido al desplazarse.
- Tarjetas de proceso: el radicado ya no se parte en dos líneas y los botones caben en la tarjeta.
- El icono del botón «Detalle» se veía como una mancha blanca.
- Formulario de agregar radicado: el campo ya no queda cortado en pantallas estrechas.
- Novedades: la cabecera no se apila en móvil, se oculta la paginación con una sola página y el contador de actuaciones indica qué significa.

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

[Unreleased]: https://github.com/JuanMa1015/Mariana-s/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/JuanMa1015/Mariana-s/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/JuanMa1015/Mariana-s/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/JuanMa1015/Mariana-s/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/JuanMa1015/Mariana-s/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JuanMa1015/Mariana-s/releases/tag/v0.1.0
