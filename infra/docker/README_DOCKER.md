Dockerized setup (infra/docker)

Quick start (from repository root):

```bash
docker-compose -f infra/docker/docker-compose.yml up --build -d
```

Or from the `infra/docker` folder:

```bash
cd infra/docker
docker-compose up --build -d
```

Services:
- API: http://localhost:8000 (Swagger: /docs)
- Web: http://localhost:5173

Notes:
- The compose file references the app sources at `../../apps/*` and the runtime DB at `../../apps/api/marianas.db`.
- Create a real `.env` at `apps/api/.env` (do not commit secrets). Use the `.env.example` provided here as a template.
- Back up your SQLite DB before running commands that change data.
