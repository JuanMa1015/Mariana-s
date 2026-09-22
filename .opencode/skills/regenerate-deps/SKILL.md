---
name: regenerate-deps
description: Regenerate the pinned Python dependency locks (requirements.txt, requirements-dev.txt) with pip-tools under Python 3.11. Use when editing requirements.in / requirements-dev.in, adding or updating Python dependencies, or when the lock header shows the wrong Python version (e.g. 3.14).
---

# Regenerate deps

Regenera los locks de dependencias con **Python 3.11** (target de producción).

## Por qué 3.11

El Dockerfile y la CI usan Python 3.11. El venv local puede ser 3.14, pero
regenerar el lock con 3.14 fija versiones que podrían no ser compatibles con
3.11. El lock debe generarse siempre con 3.11.

## Pasos

```powershell
# Crear venv temporal 3.11 (uv)
uv venv --python 3.11 --seed "$env:TEMP\opencode\venv311"
uv pip install --python "$env:TEMP\opencode\venv311\Scripts\python.exe" pip-tools

# Desde apps\api, regenerar los locks
& "$env:TEMP\opencode\venv311\Scripts\python.exe" -m piptools compile --output-file=requirements.txt --strip-extras requirements.in
& "$env:TEMP\opencode\venv311\Scripts\python.exe" -m piptools compile --output-file=requirements-dev.txt --strip-extras requirements-dev.in
```

## Notas

- Editar `requirements.in` (runtime) o `requirements-dev.in` (runtime + tests)
  y regenerar el lock correspondiente.
- Verificar el header del lock: debe decir `pip-compile with Python 3.11`.
- pip-tools 7.x puede registrar un `--no-index` espurio en el header; es un
  artefacto, la resolución sí usa PyPI. Se puede limpiar a mano.
