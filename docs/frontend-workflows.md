# Refactorización de los recorridos web y móvil

## Plan aplicado

1. Separar sesión vencida, fallo de conexión, expediente inexistente y error de carga.
2. Conservar el destino del usuario después del login y los filtros al volver del detalle.
3. Aislar la caché por cuenta y retirar los expedientes del almacenamiento persistente.
4. Diferenciar revisión del abogado, entrega de avisos y fecha de consulta a Rama Judicial.
5. Compartir la navegación móvil y permitir leer las actuaciones sin desplazamiento horizontal.
6. Corregir etiquetas, teclado, foco y confirmaciones.
7. Ejecutar regresiones, revisar la interfaz con expedientes ficticios y compilar Android.

## Decisiones

- La caché dura cinco minutos en memoria y se limpia al cambiar de cuenta, expirar
  la sesión o salir. Las versiones anteriores guardaban expedientes en localStorage.
- Búsqueda, categoría, orden y paginación se conservan en la URL. La posición de
  la lista se conserva en memoria al abrir un expediente.
- La tabla de escritorio usa una estructura semántica única. La paginación permite
  un máximo de cien procesos por página. Se retiró react-window y sus tipos.
- La fecha de consulta muestra hora de Colombia. Si hubo fallos posteriores, se
  advierte que los datos anteriores siguen pendientes de verificar.
- Las escrituras no se reintentan automáticamente tras errores de red o HTTP.
- Los diálogos bloquean el fondo, mantienen el foco y lo devuelven al cerrarse.
  Atrás de Android cierra primero el diálogo.
- La portada describe el monitoreo por lotes y disponibilidad de la fuente.

## Verificación local

- Backend con Python 3.11 y SQLite de pruebas: 171 pruebas aprobadas.
- Frontend con Node 22: 106 pruebas aprobadas.
- Última medición de cobertura de líneas, antes de añadir el aviso Android: 65,43 %.
- ESLint y compilación TypeScript/Vite aprobados.
- Comprobación de diff sin errores de espacios ni marcadores de conflicto.
- Navegador con API local y expedientes ficticios: filtros, ida y vuelta al detalle,
  etiquetas del login, tabla con ocho cabeceras, expansión de novedades, navegación
  móvil y cancelación del marcado masivo.
- Vista móvil de 390 px: las novedades y sus actuaciones no desbordan el ancho.

La revisión local de pantallas privadas usa una API de pruebas en memoria. Los
flujos de error y sesión se verifican también con pruebas automatizadas.

## Antes de publicar

1. Instalar el APK de prueba y comprobar sesión, navegación inferior, botón Atrás,
   filtros, consulta de actuaciones y marcado de revisión en el teléfono.
2. Verificar descarga de documentos reales y avisos con la configuración de release.
   El APK local lleva los avisos push desactivados.
3. Compilar y revisar en iOS desde macOS/Xcode. Esta plataforma no se compiló en Windows.
4. Revisar el diff y la CI del PR, incluida la importación de cobertura y el Quality Gate.
5. Tras el merge, comprobar despliegue y recorridos esenciales con la versión publicada.

El APK local usa el identificador de prueba co.mariana.monitor.test y firma de
depuración. La actualización sobre una instalación de release requiere su firma.

## Mensajes propuestos

Commit y título del PR:

`fix: mejorar los flujos, la navegación y la accesibilidad del frontend`

Descripción del PR:

> Evita cargas permanentes al fallar expedientes y separa los errores de conexión
> de una sesión vencida. Conserva el destino después del login y los filtros al
> volver al listado. Retira la caché persistente de expedientes y la aísla por cuenta.
>
> Comparte la navegación móvil, adapta las actuaciones a pantallas pequeñas,
> reemplaza la lista virtualizada por una tabla accesible y aclara la revisión
> del abogado frente a la entrega de avisos y la fecha de consulta.
>
> Validación local: 171 pruebas de backend y 106 de frontend aprobadas, lint y build
> aprobados, cobertura de líneas de frontend del 65,43 % y revisión en navegador
> con datos ficticios. Pendientes validación en dispositivos, iOS y CI remota.

## Corrección de descarga nativa

La descarga web con un enlace blob no guardaba archivos dentro del WebView de
Android. Ahora el mismo endpoint autenticado entrega el PDF al plugin
@capgo/capacitor-file-sharer 8.1.16. Android guarda en Descargas y iOS presenta
las opciones de exportación del sistema. Si Android bloquea el guardado directo,
se ofrece el selector nativo. El botón indica progreso, bloquea toques repetidos
y confirma el resultado o muestra el error.

La prueba local de actualización de APK usa versionCode 3 con el mismo
identificador co.mariana.monitor.test. Se debe verificar el archivo guardado en
el teléfono antes de preparar el commit.

## Aviso de descarga en Android

Tras guardar el archivo se crea una notificación local en el canal Documentos
descargados. Tocarla o pulsar Abrir lanza el visor de PDF mediante un PendingIntent
con permiso de lectura limitado a ese archivo. El canal usa el permiso de
notificaciones de Android y respeta su bloqueo. Si está desactivado, el archivo
se conserva y se informa dentro de la app. La descarga de prueba usa ahora
versionCode 4. Queda pendiente comprobar la pulsación en un teléfono.

## Ajustes visuales finales

La cabecera móvil muestra Mis procesos y el usuario en una sola línea. Las
acciones de navegación duplicadas quedan en la barra inferior y Ajustes. En
Novedades, la actuación reciente tiene prioridad visual; categoría y tipo se
presentan como información secundaria. Al expandir un proceso se muestran cinco
actuaciones y Ver más actuaciones revela otras cinco. Cerrar y volver a abrir
reinicia la vista compacta. El APK final de prueba usa versionCode 5.

Verificación final: 106 pruebas de frontend aprobadas, lint y build aprobados.
