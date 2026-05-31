from models.database import Base, engine
from models import proceso, user

def init_db():
    Base.metadata.create_all(bind=engine)