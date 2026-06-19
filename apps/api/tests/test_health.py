import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["base_de_datos"]["ok"] is True
    assert "scheduler" in data


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
