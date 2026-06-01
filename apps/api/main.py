from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import init_db
from services.scheduler import iniciar_scheduler
from routers.procesos import router as procesos_router
from routers.auth import router as auth_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = iniciar_scheduler(intervalo_horas=6)
    yield
    scheduler.shutdown()

app = FastAPI(title="Mariana's - Monitor Judicial", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://mariana-app-nu.vercel.app", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(auth_router)
app.include_router(procesos_router)