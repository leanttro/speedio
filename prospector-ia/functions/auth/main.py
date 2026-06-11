"""
functions/auth/main.py
Cloud Function HTTP — Autenticação

Endpoints:
  POST /auth/register
  POST /auth/login
  GET  /auth/me

Deploy:
  gcloud functions deploy auth \
    --runtime python311 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point auth \
    --set-env-vars DATABASE_URL=...,SECRET_KEY=...
"""
import bcrypt
from shared.db import get_conn, db_one, db_exec
from shared.auth import criar_token, get_current_user
from shared.http_helpers import cors_preflight, json_response, error_response, parse_body


def auth(request):
    """Entry point único — roteia pelo método + path."""
    if request.method == "OPTIONS":
        return cors_preflight()

    path = request.path.rstrip("/")

    # POST /auth/register
    if request.method == "POST" and path.endswith("/register"):
        return _register(request)

    # POST /auth/login
    if request.method == "POST" and path.endswith("/login"):
        return _login(request)

    # GET /auth/me
    if request.method == "GET" and path.endswith("/me"):
        return _me(request)

    return error_response("Rota não encontrada", 404)


# ── handlers ───────────────────────────────────────────────────────────────────

def _register(request):
    body = parse_body(request)
    nome  = body.get("nome", "").strip()
    email = body.get("email", "").strip()
    senha = body.get("senha", "")

    if not all([nome, email, senha]):
        return error_response("nome, email e senha são obrigatórios")

    conn = get_conn()
    try:
        if db_one(conn, "SELECT id FROM usuarios WHERE email = %s", (email,)):
            return error_response("Email já cadastrado")

        plano      = db_one(conn, "SELECT id FROM planos WHERE nome = 'Free' LIMIT 1")
        senha_hash = bcrypt.hashpw(senha.encode(), bcrypt.gensalt()).decode()
        user       = db_exec(conn,
            "INSERT INTO usuarios (nome, email, senha_hash, plano_id) VALUES (%s,%s,%s,%s) RETURNING id, nome, email",
            (nome, email, senha_hash, plano["id"] if plano else None))

        token = criar_token(user["id"], user["email"])
        return json_response({"token": token, "user": dict(user)}, 201)
    finally:
        conn.close()


def _login(request):
    body  = parse_body(request)
    email = body.get("email", "").strip()
    senha = body.get("senha", "")

    conn = get_conn()
    try:
        user = db_one(conn, "SELECT * FROM usuarios WHERE email = %s AND ativo = TRUE", (email,))
        if not user or not bcrypt.checkpw(senha.encode(), user["senha_hash"].encode()):
            return error_response("Credenciais inválidas", 401)

        token = criar_token(user["id"], user["email"])
        safe  = {k: v for k, v in dict(user).items() if k != "senha_hash"}
        return json_response({"token": token, "user": safe})
    finally:
        conn.close()


def _me(request):
    conn = get_conn()
    try:
        user = get_current_user(request, conn)
        return json_response({k: v for k, v in user.items() if k != "senha_hash"})
    except ValueError as e:
        return error_response(str(e), 401)
    finally:
        conn.close()
