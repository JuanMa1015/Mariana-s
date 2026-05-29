from models.database import Base, engine
from models import proceso

def init_db():
    Base.metadata.create_all(bind=engine)