---
name: verify
description: Run the full verification suite for Mariana's. Use when asked to "run tests", "verify", "validate", "check", "lint", "build", or before proposing a merge/PR. Runs backend pytest and frontend lint + vitest + build.
---

# Verify

Corre la verificación completa del proyecto antes de proponer merge.

## Backend

```powershell
# Desde apps\api
.venv\Scripts\python.exe -m pytest tests -q --no-header
```

## Frontend

```powershell
# Desde apps\web
npm run lint
npm run test
npm run build
```

## Notas

- El venv del backend vive en `apps/api/.venv` (puede ser Python 3.14 local,
  pero el target de producción es 3.11).
- Para verificar el lock de dependencias en 3.11 (skill `regenerate-deps`),
  instalar `requirements-dev.txt` en un venv 3.11 y correr `pytest` allí.
- No commitear sin que backend y frontend estén en verde.
