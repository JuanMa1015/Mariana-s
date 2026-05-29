from dotenv import load_dotenv
import os

load_dotenv()

NOMBRE_MONITORADO = os.getenv("NOMBRE_MONITORADO", "")