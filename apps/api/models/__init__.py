from models.database import Base, engine
from models import proceso, user, actuacion, documento_actuacion
from sqlalchemy import inspect, text
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext


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
        if inspector.get_table_names():
            script = ScriptDirectory.from_config(cfg)
            head = script.get_current_head()
            with engine.begin() as conn:
                context = MigrationContext.configure(conn)
                context._ensure_version_table()
                context.stamp(script, head)
        else:
            command.upgrade(cfg, "head")