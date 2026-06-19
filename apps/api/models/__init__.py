import logging
from models.database import Base, engine
from models import proceso, user, actuacion, documento_actuacion
from sqlalchemy import inspect, text
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext

logger = logging.getLogger(__name__)


def _alembic_cfg():
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", str(engine.url))
    return cfg


def init_db():
    cfg = _alembic_cfg()
    inspector = inspect(engine)

    if "alembic_version" in inspector.get_table_names():
        command.upgrade(cfg, "head")
    else:
        script = ScriptDirectory.from_config(cfg)
        head = script.get_current_head()
        if inspector.get_table_names():
            with engine.begin() as conn:
                context = MigrationContext.configure(conn)
                context._ensure_version_table()
                conn.execute(text("DELETE FROM alembic_version"))
                context.stamp(script, "570af04fcbf6")
                logger.info("Base de datos existente sin alembic. Estampada migracion inicial.")
        else:
            command.upgrade(cfg, "head")
        command.upgrade(cfg, "head")