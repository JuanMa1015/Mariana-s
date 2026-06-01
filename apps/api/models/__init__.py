from models.database import Base, engine
from models import proceso, user, actuacion, documento_actuacion

def init_db():
    Base.metadata.create_all(bind=engine)