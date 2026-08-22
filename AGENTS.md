# Reglas de trabajo para asistentes/agentes

Reglas acordadas con el dueño del repositorio. NO negociables.

## Git y despliegue

1. **Nunca commitear ni pushear directo a `main`.** Todo trabajo va en una rama
   con nombre descriptivo (`feat/...`, `fix/...`, `chore/...`). El dueño revisa
   y aprueba los Pull Requests desde GitHub.
2. **Nada delicado sin permiso explícito previo**, incluyendo (no limitado a):
   - Push a `main` o merge a `main`
   - Force push o reescritura de historia
   - Migraciones ejecutadas contra la base de datos de producción (Neon)
   - Cambios de variables de entorno o configuración de Render/Vercel
   - Borrado de datos, ramas o archivos en el remoto

## Verificación antes de proponer merge

- Backend: `apps\api\.venv\Scripts\python.exe -m pytest apps\api\tests -q --no-header`
- Frontend (desde `apps\web`): `npm run lint`, `npm run test`, `npm run build`

## Entorno

- Windows PowerShell. El venv del backend vive en `apps/api/.venv`.
- `config.py` hace `load_dotenv()`: al correr alembic/scripts locales, fijar
  siempre `DATABASE_URL` explícito para no apuntar a la BD de producción.
