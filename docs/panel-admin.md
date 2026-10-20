# Panel de administración

Disponible en `/admin` (web y app) solo para cuentas con rol de administrador. Se abre desde **Ajustes → Administración**.

## Cómo se define un administrador

**No hay usuario ni contraseña por defecto.** Una credencial conocida de antemano es el primer lugar donde mira un atacante. El administrador es una cuenta normal (con su contraseña propia y su correo verificable) que recibe el rol de una de estas formas:

| Forma | Quién la usa | Se puede quitar desde el panel |
|---|---|---|
| Variable `ADMIN_EMAILS` (correos separados por coma) en Render | La primera cuenta admin (tú) | No: hay que editar la variable |
| Casilla «Administrador» al crear o editar un usuario | Más admins, dados por otro admin | Sí |

### Configuración inicial (una sola vez)
1. Regístrate normalmente en la app con tu correo, si todavía no tienes cuenta.
2. En Render → servicio de la API → **Environment** → añade `ADMIN_EMAILS` con tu correo (varios, separados por coma). Render reinicia solo.
3. Cierra sesión y vuelve a entrar: en **Ajustes** aparece «Administración».

Por seguridad usa una contraseña larga y única para esa cuenta.

## Secciones

- **Resumen:** usuarios, procesos, novedades, sincronización atrasada, fallos, avisos sin entregar y estado de las integraciones.
- **Usuarios:** buscar, crear (con invitación por correo o contraseña inicial), editar, suspender/reactivar, enviar enlace de contraseña, cerrar sesiones y eliminar (borra también sus procesos).
- **Procesos:** de todos los usuarios; buscar, filtrar por estado, crear, editar, reprogramar sincronización y eliminar.
- **Dispositivos:** celulares registrados para push (el token completo nunca se muestra).
- **Pruebas:** diagnóstico del sistema (ver abajo).
- **Auditoría:** quién hizo qué desde el panel y cuándo.

Reglas de seguridad: un admin no puede suspenderse, eliminarse ni quitarse el rol a sí mismo; los admins de `ADMIN_EMAILS` no se pueden eliminar desde el panel; una cuenta suspendida pierde sus sesiones abiertas y no puede volver a entrar.

## Pruebas y diagnóstico

Cada tarjeta ejecuta una prueba real y muestra paso a paso qué pasó. **Ejecutar todas** corre todo en modo seguro (no envía correos, push ni mensajes).

| Prueba | Qué comprueba |
|---|---|
| Base de datos | Conexión, migraciones al día y lectura de tablas |
| Configuración | Variables clave, sin mostrar secretos |
| Registro de cuentas | Registrar, duplicado, contraseña débil, sesión al registrarse |
| Ingreso (login) | Correo y usuario, clave incorrecta, cierre de sesión que invalida el token, cuenta suspendida |
| Restablecer contraseña | Token de un solo uso, contraseña nueva, anterior invalidada (no envía correos) |
| Ingreso de radicados | Agregar, duplicado, formato inválido, editar, detalle y eliminar, con consulta a Rama Judicial |
| Correo | Plantillas y envío real por cada proveedor configurado (Brevo, SendGrid, SMTP) |
| Notificaciones push | Credenciales de Firebase y aviso a los celulares de un usuario (con demora para probar con la app cerrada) |
| Telegram | Valida el bot y envía un mensaje al chat vinculado |
| Rama Judicial | Disponibilidad y consulta opcional de un radicado, sin guardarlo |

Las pruebas que necesitan datos crean una cuenta `qa-…@example.com` que se borra siempre al terminar, aunque la prueba falle.

Una prueba es **Correcta** (verde), **Con avisos** (ámbar: algo opcional sin configurar o con degradación) o **Con fallos** (rojo: algo que debería funcionar no funciona).

## Privacidad

Los administradores pueden ver procesos de todos los usuarios. Úsalo solo para soporte, y recuerda que las acciones que modifican datos quedan en Auditoría.
