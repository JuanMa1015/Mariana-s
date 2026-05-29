from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import init_db
from services.scheduler import iniciar_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = iniciar_scheduler(intervalo_horas=6)
    yield
    scheduler.shutdown()

app = FastAPI(title="Mariana's - Monitor Judicial", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}