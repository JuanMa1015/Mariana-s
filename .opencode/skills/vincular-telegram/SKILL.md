---
name: vincular-telegram
description: Link a Telegram chat_id to a user so they receive notification messages. Use when asked to "vincular Telegram", "conectar Telegram", when a user reports not receiving Telegram alerts, or to list who has written to the bot.
---

# Vincular Telegram

Vincula un `chat_id` de Telegram a un usuario (por email) para que reciba
notificaciones.

## Pasos

1. Listar quién ha escrito al bot (para obtener el chat_id):

```powershell
# Desde apps\api
.venv\Scripts\python.exe scripts\vincular_telegram.py listar
```

2. Vincular el chat_id a un usuario:

```powershell
.venv\Scripts\python.exe scripts\vincular_telegram.py vincular <chat_id> <email>
```

## Requisitos

- `TELEGRAM_BOT_TOKEN` configurado en el entorno (`.env` / Render).
- El usuario debe haber enviado al menos un mensaje al bot para aparecer en
  `listar`.

## Alternativa HTTP

También existe `POST /admin/telegram-vincular` (protegido por `API_TOKEN`).
