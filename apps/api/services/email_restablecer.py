"""Plantilla del correo de restablecimiento de contraseña."""
from services.email_templates import _esc


def template_restablecer(nombre: str, enlace: str, minutos: int) -> tuple[str, str]:
    """Retorna (html, texto)."""
    html = f"""<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0">
<tr><td style="padding:32px">
<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#4f46e5">Mariana's</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">Restablecer tu contraseña</h1>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155">Hola {_esc(nombre)}, recibimos una solicitud para cambiar la contraseña de tu cuenta.</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155">Pulsa el botón para elegir una nueva. El enlace es de un solo uso y vence en {minutos} minutos.</p>
<p style="margin:0 0 24px"><a href="{_esc(enlace)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px">Elegir nueva contraseña</a></p>
<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#64748b">Si el botón no funciona, copia este enlace en tu navegador:<br><span style="word-break:break-all;color:#4f46e5">{_esc(enlace)}</span></p>
<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b">Si no fuiste tú, ignora este correo: tu contraseña no cambiará.</p>
</td></tr></table></td></tr></table></body></html>"""
    texto = (
        f"Hola {nombre},\n\nRecibimos una solicitud para cambiar la contraseña de tu cuenta en Mariana's.\n"
        f"Elige una nueva con este enlace (un solo uso, vence en {minutos} minutos):\n{enlace}\n\n"
        "Si no fuiste tú, ignora este correo: tu contraseña no cambiará.\n"
    )
    return html, texto
