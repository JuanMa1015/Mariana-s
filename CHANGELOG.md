# Changelog

Todos los cambios relevantes de Mariana's se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [Unreleased]

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

[Unreleased]: https://github.com/JuanMa1015/Mariana-s/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/JuanMa1015/Mariana-s/releases/tag/v0.1.0
