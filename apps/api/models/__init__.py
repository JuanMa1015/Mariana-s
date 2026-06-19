from models.database import Base, engine
from models import proceso, user, actuacion, documento_actuacion
from alembic.config import Config
from alembic import command

def init_db():
    Base.metadata.create_all(bind=engine)

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", str(engine.url))
    command.upgrade(alembic_cfg, "head")