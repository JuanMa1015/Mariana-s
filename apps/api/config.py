from dotenv import load_dotenv
import os

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER)
EMAIL_TO = os.getenv("EMAIL_TO", "")

SECRET_KEY = os.getenv("SECRET_KEY", "un_secreto_muy_seguro_para_desarrollo")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours

# Token que permite invocar endpoints protegidos desde CI/CD o workflows.
# Si está vacío, el endpoint mantiene el comportamiento por defecto (desarrollo local).
API_TOKEN = os.getenv("API_TOKEN", "")

# URL pública de la API (usada para keepalive en sync background)
API_URL = os.getenv("API_URL", "")

# URL pública de la aplicación (usada en notificaciones para enlaces)
APP_URL = os.getenv("APP_URL", "https://marianas.vercel.app")

# SendGrid (alternativa a SMTP directo)
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")

# Telegram Bot (notificaciones alternativas)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# Sentry (monitoreo de errores en produccion)
SENTRY_DSN = os.getenv("SENTRY_DSN", "")