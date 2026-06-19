APP_URL = "https://mariana-app-nu.vercel.app"


def _color_categoria(categoria: str | None) -> str:
    if categoria == "Trabajo":
        return "#0ea5e9"
    if categoria == "Consultorio":
        return "#f59e0b"
    return "#7c3aed"


def template_novedad(
    llave_proceso: str,
    despacho: str,
    departamento: str,
    fecha_ultima_actuacion: str | None,
    sujetos_procesales: str,
    actuacion: str | None = None,
    anotacion: str | None = None,
    fecha_registro: str | None = None,
    con_documentos: bool | None = None,
    categoria: str | None = None,
) -> str:
    color = _color_categoria(categoria)
    docs = "Sí" if con_documentos else "No"
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
<tr><td style="padding:32px 32px 0">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#a78bfa">Mariana's</span></td>
<td align="right"><span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;color:{color};background:{color}15">{categoria or "General"}</span></td>
</tr>
</table>
<h1 style="margin:16px 0 4px;font-size:20px;font-weight:700;color:#1e293b">Se detectó una nueva actuación</h1>
<p style="margin:0 0 24px;font-size:14px;color:#64748b">En el proceso <strong style="font-family:monospace;letter-spacing:0.08em">{llave_proceso}</strong></p>
</td></tr>
<tr><td style="padding:0 32px">
<table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0">
<tr><td style="padding:16px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:6px 0"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">Radicado</span></td><td style="padding:6px 0;text-align:right"><span style="font-size:13px;font-weight:600;color:#1e293b;font-family:monospace;letter-spacing:0.08em">{llave_proceso}</span></td></tr>
<tr><td style="padding:6px 0"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">Despacho</span></td><td style="padding:6px 0;text-align:right"><span style="font-size:13px;color:#334155">{despacho or "—"}</span></td></tr>
<tr><td style="padding:6px 0"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">Departamento</span></td><td style="padding:6px 0;text-align:right"><span style="font-size:13px;color:#334155">{departamento or "—"}</span></td></tr>
<tr><td style="padding:6px 0"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">Última actuación</span></td><td style="padding:6px 0;text-align:right"><span style="font-size:13px;color:#334155">{fecha_ultima_actuacion or "N/D"}</span></td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 32px">
<h2 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#1e293b">Novedad</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;background:#fffbeb;border:1px solid #fde68a">
<tr><td style="padding:16px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:6px 0;vertical-align:top;width:100px"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#b45309">Actuación</span></td><td style="padding:6px 0"><span style="font-size:13px;color:#78350f">{actuacion or "N/D"}</span></td></tr>
<tr><td style="padding:6px 0;vertical-align:top"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#b45309">Anotación</span></td><td style="padding:6px 0"><span style="font-size:13px;color:#78350f">{anotacion or "N/D"}</span></td></tr>
<tr><td style="padding:6px 0;vertical-align:top"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#b45309">Fecha registro</span></td><td style="padding:6px 0"><span style="font-size:13px;color:#78350f">{fecha_registro or "N/D"}</span></td></tr>
<tr><td style="padding:6px 0;vertical-align:top"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#b45309">Documentos</span></td><td style="padding:6px 0"><span style="font-size:13px;color:#78350f">{docs}</span></td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 32px 24px">
<h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1e293b">Sujetos procesales</h2>
<p style="margin:0;font-size:13px;color:#475569;line-height:1.5">{sujetos_procesales or "—"}</p>
</td></tr>
<tr><td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td><span style="font-size:12px;color:#94a3b8">Mariana's — Monitor Judicial</span></td>
<td align="right"><a href="{APP_URL}" style="display:inline-block;padding:10px 20px;border-radius:999px;font-size:13px;font-weight:600;color:#ffffff;background:#7c3aed;text-decoration:none">Ver en Mariana's</a></td>
</tr>
</table>
</td></tr>
</table>
</td></tr></table>
</body>
</html>"""


def template_resumen(novedades: list[dict]) -> tuple[str, str]:
    items_html = ""
    for n in novedades:
        color = _color_categoria(n.get("categoria"))
        docs = "Sí" if n.get("con_documentos") else "No"
        items_html += f"""
<tr><td style="padding:0 0 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;border:1px solid #e2e8f0;background:#ffffff">
<tr><td style="padding:16px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:4px 0"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">Radicado</span></td><td style="padding:4px 0;text-align:right"><span style="font-size:13px;font-weight:600;color:#1e293b;font-family:monospace;letter-spacing:0.08em">{n["llave_proceso"]}</span></td></tr>
<tr><td style="padding:4px 0"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">Categoría</span></td><td style="padding:4px 0;text-align:right"><span style="font-size:12px;font-weight:600;color:{color}">{n.get("categoria") or "General"}</span></td></tr>
<tr><td style="padding:4px 0"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">Despacho</span></td><td style="padding:4px 0;text-align:right"><span style="font-size:13px;color:#334155">{n.get("despacho", "") or "—"}</span></td></tr>
<tr><td style="padding:4px 0"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">Actuación</span></td><td style="padding:4px 0;text-align:right"><span style="font-size:13px;color:#334155">{n.get("actuacion") or "N/D"}</span></td></tr>
<tr><td style="padding:4px 0"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">Documentos</span></td><td style="padding:4px 0;text-align:right"><span style="font-size:13px;color:#334155">{docs}</span></td></tr>
</table>
</td></tr>
</table>
</td></tr>"""

    total = len(novedades)
    asunto = f"[{total} novedades] Resumen de actualizaciones judiciales"
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
<tr><td style="padding:32px 32px 0">
<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#a78bfa">Mariana's</span>
<h1 style="margin:12px 0 4px;font-size:20px;font-weight:700;color:#1e293b">Resumen de novedades</h1>
<p style="margin:0 0 24px;font-size:14px;color:#64748b">Se detectaron <strong>{total}</strong> novedades en tus procesos</p>
</td></tr>
<tr><td style="padding:0 32px 24px">
{items_html}
</td></tr>
<tr><td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td><span style="font-size:12px;color:#94a3b8">Mariana's — Monitor Judicial</span></td>
<td align="right"><a href="{APP_URL}" style="display:inline-block;padding:10px 20px;border-radius:999px;font-size:13px;font-weight:600;color:#ffffff;background:#7c3aed;text-decoration:none">Ver en Mariana's</a></td>
</tr>
</table>
</td></tr>
</table>
</td></tr></table>
</body>
</html>"""
    return asunto, html
