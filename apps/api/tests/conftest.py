import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-clave-suficientemente-larga-para-hmac-sha256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["SENDGRID_API_KEY"] = ""
os.environ["SMTP_HOST"] = ""
os.environ["EMAIL_TO"] = "test@example.com"
os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["TELEGRAM_CHAT_ID"] = ""
os.environ["API_URL"] = ""
# Sin red en tests: desactiva el chequeo de contrasenas filtradas (HIBP)
os.environ["HIBP_CHECK"] = "false"

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from models.database import Base, get_db
from models.user import User
from models.proceso import Proceso
from services.auth import get_password_hash, create_access_token


TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TEST_SESSION_LOCAL = sessionmaker(bind=TEST_ENGINE)


@pytest.fixture(autouse=True)
def setup_db():
    from scraper.cache import clear_cache
    import routers.procesos as procesos_router

    clear_cache()
    with procesos_router._sync_estado_lock:
        procesos_router._sync_estado.clear()
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


def override_get_db():
    db = TEST_SESSION_LOCAL()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def db():
    session = TEST_SESSION_LOCAL()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def test_user(db) -> User:
    user = User(
        email="test@example.com",
        username="testuser",
        password_hash=get_password_hash("password123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user) -> dict:
    token = create_access_token(data={"sub": test_user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def otro_usuario(db) -> User:
    user = User(
        email="otro@example.com",
        username="otrouser",
        password_hash=get_password_hash("password456"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
