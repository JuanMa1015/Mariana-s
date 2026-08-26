import { Link } from "react-router-dom"
import { useTitle } from "../hooks/useTitle"
import { CONTACT_EMAIL, FECHA_ACTUALIZACION_LEGAL, NOMBRE_APP, RESPONSABLE, UBICACION } from "../site"
import { CookieBanner, PublicShell } from "./PublicShell"

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

export function PrivacyPage() {
  useTitle("Política de Privacidad")
  return (
    <PublicShell>
      <CookieBanner />
      <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Política de Privacidad y Tratamiento de Datos Personales</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {FECHA_ACTUALIZACION_LEGAL}</p>

        <Seccion titulo="1. Responsable del tratamiento">
          <p><strong>{RESPONSABLE}</strong> ({UBICACION}), en adelante "Mariana's", es responsable del tratamiento de los datos personales recopilados a través de la plataforma. Contacto para asuntos de privacidad: <a className="font-semibold text-violet-700 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </Seccion>

        <Seccion titulo="2. Datos que recopilamos">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Datos de cuenta:</strong> correo electrónico, nombre de usuario y contraseña (almacenada únicamente como hash criptográfico, nunca en texto plano).</li>
            <li><strong>Datos procesales:</strong> números de radicado que el usuario registra y la información pública asociada obtenida de la Rama Judicial del Colombia (despacho, departamento, partes procesales, actuaciones y documentos).</li>
            <li><strong>Datos opcionales:</strong> identificador de chat de Telegram, si el usuario activa notificaciones por ese canal.</li>
            <li><strong>Datos técnicos:</strong> registros mínimos de operación del servicio (fecha, endpoint y código de resultado), sin contenido de las peticiones.</li>
          </ul>
        </Seccion>

        <Seccion titulo="3. Finalidad del tratamiento">
          <p>Los datos se usan exclusivamente para: (a) prestar el servicio de monitoreo automático de procesos judiciales; (b) enviar notificaciones de novedades por los canales configurados; (c) autenticar al usuario y mantener su sesión; (d) atender solicitudes de soporte.</p>
          <p>No se realizan tratamientos para publicidad, perfilamiento ni venta de datos a terceros.</p>
        </Seccion>

        <Seccion titulo="4. Proveedores terceros (encargados del tratamiento)">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Render</strong> — infraestructura del servidor de la aplicación.</li>
            <li><strong>Neon</strong> — base de datos PostgreSQL cifrada.</li>
            <li><strong>Vercel</strong> — alojamiento del sitio web y analítica web agregada y sin cookies.</li>
            <li><strong>Brevo</strong> — envío de correos electrónicos de notificación.</li>
            <li><strong>Telegram</strong> — mensajería de notificaciones, solo si el usuario configura ese canal.</li>
            <li><strong>Rama Judicial</strong> — fuente pública de la información procesal consultada.</li>
          </ul>
          <p>Cada proveedor procesa datos conforme a sus propios términos de seguridad; no se transfieren más datos que los estrictamente necesarios para operar el servicio.</p>
        </Seccion>

        <Seccion titulo="5. Cookies y almacenamiento local">
          <p>{NOMBRE_APP} <strong>no utiliza cookies de seguimiento, publicitarias ni de terceros</strong>. Solo se emplean: (a) una cookie técnica httpOnly que contiene el token de sesión; y (b) almacenamiento local del navegador para preferencias visuales y caché temporal de datos ya consultados. La analítica del sitio es agregada y sin cookies.</p>
        </Seccion>

        <Seccion titulo="6. Seguridad">
          <p>Las comunicaciones viajan cifradas (HTTPS/TLS). Las contraseñas se almacenan con bcrypt. El acceso a los procesos está restringido al usuario que los registró, con controles de acceso verificados en cada consulta y límites de tasa contra abusos.</p>
        </Seccion>

        <Seccion titulo="7. Derechos del titular">
          <p>Conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013, el titular puede conocer, actualizar, rectificar y suprimir sus datos personales, así como revocar la autorización. Basta escribir a <a className="font-semibold text-violet-700 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>; la respuesta se dará dentro de los plazos legales. Eliminar la cuenta implica la supresión de sus procesos y datos asociados.</p>
        </Seccion>

        <Seccion titulo="8. Conservación">
          <p>Los datos se conservan mientras exista la cuenta activa. Tras solicitar la eliminación, se suprimen de forma definitiva de la base de datos principal, sin perjuicio de copias de seguridad automáticas que rotan en plazos cortos.</p>
        </Seccion>

        <Seccion titulo="9. Menores de edad">
          <p>El servicio está dirigido a profesionales del derecho y mayores de edad. No se recopilan datos de menores.</p>
        </Seccion>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/terminos" className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100">Ver Términos y Condiciones</Link>
          <Link to="/" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Volver al inicio</Link>
        </div>
      </article>
    </PublicShell>
  )
}

export function TermsPage() {
  useTitle("Términos y Condiciones")
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Términos y Condiciones de Uso</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {FECHA_ACTUALIZACION_LEGAL}</p>

        <Seccion titulo="1. Objeto del servicio">
          <p>{NOMBRE_APP} es una herramienta tecnológica que monitorea automáticamente procesos judiciales públicos ante la Rama Judicial del Colombia y notifica al usuario cuando detecta actuaciones nuevas. El servicio consiste en consultar, organizar y avisar; no interpreta ni gestiona el proceso judicial.</p>
        </Seccion>

        <Seccion titulo="2. Naturaleza del servicio — No es asesoría legal">
          <p>{NOMBRE_APP} <strong>no presta servicios de abogacía ni asesoría jurídica</strong>. La información mostrada proviene de fuentes públicas de la Rama Judicial y se ofrece tal cual, sin garantía de exactitud, integridad u oportunidad de la fuente. Las decisiones procesales son responsabilidad exclusiva del usuario o de su apoderado.</p>
        </Seccion>

        <Seccion titulo="3. Cuenta de usuario">
          <p>El usuario debe registrar un correo válido y una contraseña segura, cuya confidencialidad es de su exclusiva responsabilidad. Toda actividad realizada desde su sesión se presume efectuada por él. Notificará de inmediato cualquier uso no autorizado a {CONTACT_EMAIL}.</p>
        </Seccion>

        <Seccion titulo="4. Uso adecuado">
          <p>Queda prohibido: intentar acceder a procesos ajenos sin autorización del titular de la cuenta que los registra, automatizar consultas masivas contra el servicio, reversar o intentar vulnerar la plataforma, o usar el servicio con fines ilícitos.</p>
        </Seccion>

        <Seccion titulo="5. Disponibilidad y dependencias">
          <p>El servicio depende de la disponibilidad de la Rama Judicial y de proveedores de infraestructura de terceros. Aunque se monitoriza cada hora y se reintentan fallos, {NOMBRE_APP} no garantiza continuidad absoluta ni detección instantánea de novedades, y no será responsable por perjuicios derivados de demoras, caídas de la fuente pública o fallos de dichos proveedores.</p>
        </Seccion>

        <Seccion titulo="6. Propiedad intelectual">
          <p>La marca, el software, el diseño y el contenido de la plataforma pertenecen a {RESPONSABLE}. El usuario obtiene una licencia personal, intransferible y revocable para usar el servicio mientras cumpla estos términos.</p>
        </Seccion>

        <Seccion titulo="7. Limitación de responsabilidad">
          <p>En la máxima medida permitida por la ley, la responsabilidad total de {NOMBRE_APP} frente al usuario por cualquier reclamo estará limitada al valor equivalente a un (1) mes del último precio pagado por el servicio. En ningún caso habrá responsabilidad por lucro cesante, pérdida de oportunidad o daños consecuenciales derivados del uso del servicio o de la información procesal mostrada.</p>
        </Seccion>

        <Seccion titulo="8. Suspensión y terminación">
          <p>El usuario puede eliminar su cuenta en cualquier momento, con lo cual se suprimen sus datos según la Política de Privacidad. {RESPONSABLE} podrá suspender o terminar cuentas que incumplan estos términos, previo aviso cuando sea posible.</p>
        </Seccion>

        <Seccion titulo="9. Modificaciones">
          <p>Estos términos pueden actualizarse; se publicará la versión vigente en esta página con nueva fecha. Los cambios sustanciales se comunicarán razonablemente a los usuarios registrados.</p>
        </Seccion>

        <Seccion titulo="10. Ley aplicable y jurisdicción">
          <p>Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia será resuelta ante los tribunales competentes de {UBICACION}, salvo competencia imperativa distinta del consumidor.</p>
        </Seccion>

        <Seccion titulo="11. Contacto">
          <p>Dudas sobre estos términos: <a className="font-semibold text-violet-700 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </Seccion>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/privacidad" className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100">Ver Política de Privacidad</Link>
          <Link to="/" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Volver al inicio</Link>
        </div>
      </article>
    </PublicShell>
  )
}
