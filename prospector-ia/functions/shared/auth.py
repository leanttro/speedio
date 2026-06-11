"""
shared/auth.py — Helpers de autenticação JWT
"""
import os
from datetime import datetime, timedelta

import jwt

from shared.db import db_one

SECRET_KEY = os.getenv("SECRET_KEY", "troca-isso-em-producao")
ALGORITHM  = "HS256"
TOKEN_EXP  = 24  # horas


def criar_token(user_id: int, email: str) -> str:
    payload = {
        "sub":   str(user_id),
        "email": email,
        "exp":   datetime.utcnow() + timedelta(hours=TOKEN_EXP),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(request, conn):
    """
    Extrai e valida o Bearer token do header Authorization.
    Retorna o dict do usuário ou lança ValueError.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise ValueError("Token ausente")

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except Exception:
        raise ValueError("Token inválido")

    user = db_one(conn, "SELECT * FROM usuarios WHERE id = %s AND ativo = TRUE", (user_id,))
    if not user:
        raise ValueError("Usuário não encontrado")
    return dict(user)
