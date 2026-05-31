Sync workflow

- Este workflow se ejecuta 4 veces al día: 6am, 12pm, 6pm y medianoche (hora de Colombia).
- Llama al endpoint `POST /procesos/sync` del backend desplegado (p. ej. Railway).
- Requiere dos secretos de repositorio: `API_URL` (base URL del API) y `API_TOKEN` (token secreto para autorizar la llamada).
- Puede ejecutarse manualmente desde la pestaña de GitHub Actions (`workflow_dispatch`).
- El paso principal reintenta hasta 3 veces en caso de fallo (`--retry 3 --retry-delay 10`).
