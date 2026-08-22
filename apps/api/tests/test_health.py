import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["base_de_datos"]["ok"] is True
    assert data["sync_disparador"] == "github-actions"


@pytest.mark.asyncio
async def test_health_ligero_no_consulta_rama(client):
    """Por defecto /health NO debe golpear Rama Judicial."""
    with patch("scraper.rama_client.rama_health_check") as mock_rama:
        response = await client.get("/health")
        assert response.status_code == 200
        mock_rama.assert_not_called()
        assert "rama_judicial" not in response.json()


@pytest.mark.asyncio
async def test_health_deep_consulta_rama(client):
    with patch("scraper.rama_client.rama_health_check", return_value=True) as mock_rama:
        response = await client.get("/health?deep=true")
        assert response.status_code == 200
        mock_rama.assert_called_once()
        assert response.json()["rama_judicial"]["ok"] is True


@pytest.mark.asyncio
async def test_health_includes_cors_headers(client):
    response = await client.options(
        "/health",
        headers={
            "Origin": "https://mariana-app-nu.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") is not None
