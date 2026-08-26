import os
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER)
EMAIL_TO = os.getenv("EMAIL_TO", "")

# Acepta ambos nombres por retrocompatibilidad; el canonico es SECRET_KEY
SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET") or ""
_CLAVE_INSEGURA_DEFAULT = "insecure_dev_key_change_in_production"
if not SECRET_KEY:
    import warnings
    warnings.warn(
        "SECRET_KEY no configurado. Usando clave insegura para desarrollo. "
        "Configura SECRET_KEY en .env para produccion."
    )
    SECRET_KEY = _CLAVE_INSEGURA_DEFAULT

# En produccion (Render o ENVIRONMENT=production) no arrancar con clave debil
_EN_PRODUCCION = bool(os.getenv("RENDER_EXTERNAL_URL")) or os.getenv("ENVIRONMENT", "").lower() in {"production", "prod"}
if _EN_PRODUCCION and (not os.getenv("SECRET_KEY") and not os.getenv("JWT_SECRET")):
    raise RuntimeError(
        "SECRET_KEY/JWT_SECRET no configurado y el entorno parece produccion. "
        "Configura SECRET_KEY en las variables de entorno antes de desplegar."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Token que permite invocar endpoints protegidos desde CI/CD o workflows.
API_TOKEN = os.getenv("API_TOKEN", "")

# URL pública de la API (usada para keepalive en sync background)
API_URL = os.getenv("API_URL", "")

# URL pública de la aplicación (usada en notificaciones para enlaces)
APP_URL = os.getenv("APP_URL", "https://marianas.vercel.app")

# SendGrid (alternativa a SMTP directo)
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")

# Brevo (canal primario de correo via API HTTPS; Render bloquea SMTP saliente)
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")

# Telegram Bot (notificaciones alternativas)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# Sentry (monitoreo de errores en produccion)
SENTRY_DSN = os.getenv("SENTRY_DSN", "")

# CORS: origenes permitidos separados por coma
_CORS_DEFAULT = "http://localhost:5173,http://localhost:4173,https://marianas.vercel.app,https://mariana-app-nu.vercel.app"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", _CORS_DEFAULT).split(",") if o.strip()]

# Rama Judicial: verificar SSL
RAMA_VERIFY_SSL = os.getenv("RAMA_VERIFY_SSL", "true").lower() == "true"
if _EN_PRODUCCION and not RAMA_VERIFY_SSL:
    raise RuntimeError(
        "RAMA_VERIFY_SSL=false no esta permitido en produccion. "
        "Deshabilitar la verificacion SSL expondria las consultas a Rama Judicial."
    )

# Base de datos: pool configuration
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))