"""
Script administrativo para vincular Telegram de clientes.

USO:
    # 1. Ver quienes han escrito al bot
    python scripts/vincular_telegram.py listar

    # 2. Vincular un chat_id a un usuario (por email)
    python scripts/vincular_telegram.py vincular 5157563788 gonzalezjuanmanuel645@gmail.com
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from config import TELEGRAM_BOT_TOKEN
from models.database import SessionLocal
from models.user import User


API_BASE = "https://api.telegram.org/bot"


def listar_mensajes():
    if not TELEGRAM_BOT_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN no configurado")
        return
    url = f"{API_BASE}{TELEGRAM_BOT_TOKEN}/getUpdates"
    response = httpx.get(url, timeout=10)
    data = response.json()
    if not data.get("ok") or not data.get("result"):
        print("No hay mensajes. Pide al cliente que escriba al bot.")
        return
    vistos = set()
    print("Usuarios que han escrito al bot:\n")
    for update in data["result"]:
        msg = update.get("message", {})
        chat = msg.get("chat", {})
        chat_id = chat.get("id")
        first_name = chat.get("first_name", "")
        username = chat.get("username", "")
        text = msg.get("text", "")
        if chat_id and chat_id not in vistos:
            vistos.add(chat_id)
            print(f"  Chat ID: {chat_id}")
            print(f"  Nombre:  {first_name}")
            if username:
                print(f"  @user:   {username}")
            print(f"  Mensaje: {text}")
            print()


def vincular(chat_id: str, email: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"ERROR: No existe usuario con email {email}")
            return
        user.telegram_chat_id = chat_id
        db.commit()
        print(f"OK: {email} vinculado a chat_id {chat_id}")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    comando = sys.argv[1]

    if comando == "listar":
        listar_mensajes()
    elif comando == "vincular":
        if len(sys.argv) < 4:
            print("Uso: python scripts/vincular_telegram.py vincular <chat_id> <email>")
            sys.exit(1)
        vincular(sys.argv[2], sys.argv[3])
    else:
        print(f"Comando desconocido: {comando}")
        print(__doc__)
