import pytest


@pytest.mark.asyncio
async def test_template_novedad_contiene_campos_principales():
    from services.email_templates import template_novedad

    html = template_novedad(
        llave_proceso="05001310301220210012300",
        despacho="Juzgado 12 Civil",
        departamento="Antioquia",
        fecha_ultima_actuacion="2024-06-10",
        sujetos_procesales="Perez, Juan | DEMANDANTE",
        actuacion="Se admitio demanda",
        anotacion="Auto admisorio",
        fecha_registro="2024-06-10",
        con_documentos=True,
        categoria="General",
    )

    assert "05001310301220210012300" in html
    assert "Juzgado 12 Civil" in html
    assert "Antioquia" in html
    assert "Se admitio demanda" in html
    assert "Auto admisorio" in html
    assert "Perez, Juan" in html
    assert "DEMANDANTE" in html
    assert "Sí" in html or "Si" in html
    assert "General" in html
    assert "Rama Judicial" in html
    assert "Mariana's" in html


@pytest.mark.asyncio
async def test_template_novedad_sujetos_en_lineas_separadas():
    from services.email_templates import template_novedad

    html = template_novedad(
        llave_proceso="test",
        despacho="",
        departamento="",
        fecha_ultima_actuacion=None,
        sujetos_procesales="Perez, Juan | DEMANDANTE | Garcia, Maria | demandado",
    )

    assert "Perez, Juan" in html
    assert "DEMANDANTE" in html
    assert "Garcia, Maria" in html
    assert "demandado" in html


@pytest.mark.asyncio
async def test_template_novedad_sin_sujetos_muestra_default():
    from services.email_templates import template_novedad

    html = template_novedad(
        llave_proceso="test",
        despacho="",
        departamento="",
        fecha_ultima_actuacion=None,
        sujetos_procesales="",
    )

    assert "Sin informacion" in html


@pytest.mark.asyncio
async def test_template_novedad_sin_datos_muestra_nd():
    from services.email_templates import template_novedad

    html = template_novedad(
        llave_proceso="test",
        despacho="",
        departamento="",
        fecha_ultima_actuacion=None,
        sujetos_procesales="",
    )

    assert "N/D" in html


@pytest.mark.asyncio
async def test_template_novedad_sin_documentos():
    from services.email_templates import template_novedad

    html = template_novedad(
        llave_proceso="test",
        despacho="",
        departamento="",
        fecha_ultima_actuacion=None,
        sujetos_procesales="",
        con_documentos=False,
    )

    assert "No" in html or "no" in html


@pytest.mark.asyncio
async def test_template_novedad_categoria_trabajo():
    from services.email_templates import template_novedad

    html = template_novedad(
        llave_proceso="test",
        despacho="",
        departamento="",
        fecha_ultima_actuacion=None,
        sujetos_procesales="",
        categoria="Trabajo",
    )

    assert "Trabajo" in html


@pytest.mark.asyncio
async def test_template_novedad_categoria_consultorio():
    from services.email_templates import template_novedad

    html = template_novedad(
        llave_proceso="test",
        despacho="",
        departamento="",
        fecha_ultima_actuacion=None,
        sujetos_procesales="",
        categoria="Consultorio",
    )

    assert "Consultorio" in html


@pytest.mark.asyncio
async def test_template_novedad_es_html_valido():
    from services.email_templates import template_novedad

    html = template_novedad(
        llave_proceso="test",
        despacho="",
        departamento="",
        fecha_ultima_actuacion=None,
        sujetos_procesales="",
    )

    assert html.startswith("<!DOCTYPE html>")
    assert "</html>" in html
    assert "<table" in html


@pytest.mark.asyncio
async def test_template_resumen_contiene_total():
    from services.email_templates import template_resumen

    asunto, html = template_resumen([
        {"llave_proceso": "p1", "despacho": "D1", "categoria": "General",
         "actuacion": "A1", "con_documentos": False, "departamento": "Dep"},
        {"llave_proceso": "p2", "despacho": "D2", "categoria": "Trabajo",
         "actuacion": "A2", "con_documentos": True, "departamento": "Dep"},
    ])

    assert "2" in asunto
    assert "p1" in html
    assert "p2" in html
    assert "Trabajo" in html
    assert "General" in html
    assert "Mariana's" in html
    assert "Rama Judicial" in html


@pytest.mark.asyncio
async def test_template_resumen_con_muchos_items():
    from services.email_templates import template_resumen

    items = [
        {"llave_proceso": f"p{i}", "despacho": "D", "categoria": "General",
         "actuacion": "A", "con_documentos": False, "departamento": "Dep"}
        for i in range(10)
    ]

    asunto, html = template_resumen(items)

    assert "10" in asunto
    assert "novedades" in asunto.lower()


@pytest.mark.asyncio
async def test_template_resumen_es_html_valido():
    from services.email_templates import template_resumen

    _, html = template_resumen([
        {"llave_proceso": "p1", "despacho": "D1", "categoria": "General",
         "actuacion": "A1", "con_documentos": True, "departamento": "Dep"},
    ])

    assert html.startswith("<!DOCTYPE html>")
    assert "</html>" in html
    assert "<table" in html


@pytest.mark.asyncio
async def test_color_categoria_default():
    from services.email_templates import _color_categoria

    fg, bg = _color_categoria(None)
    assert fg == "#7c3aed"
    assert bg == "#f5f3ff"

    fg, bg = _color_categoria("General")
    assert fg == "#7c3aed"
    assert bg == "#f5f3ff"


@pytest.mark.asyncio
async def test_color_categoria_trabajo():
    from services.email_templates import _color_categoria

    fg, bg = _color_categoria("Trabajo")
    assert fg == "#0ea5e9"
    assert bg == "#e0f2fe"


@pytest.mark.asyncio
async def test_color_categoria_consultorio():
    from services.email_templates import _color_categoria

    fg, bg = _color_categoria("Consultorio")
    assert fg == "#f59e0b"
    assert bg == "#fffbeb"
