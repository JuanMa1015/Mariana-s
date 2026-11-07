FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# install build deps and cleanup
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py config.py alembic.ini ./
COPY alembic/ ./alembic/
COPY models/ ./models/
COPY routers/ ./routers/
COPY scraper/ ./scraper/
COPY services/ ./services/

# Keep application files root-owned and grant write access to SQLite's directory.
RUN groupadd --system api \
    && useradd --system --gid api --no-create-home api \
    && install -d -o api -g api -m 0750 /app/data

ENV DATABASE_URL=sqlite:////app/data/marianas.db
USER api

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
