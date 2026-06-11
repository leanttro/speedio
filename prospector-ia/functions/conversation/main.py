"""
functions/conversations/main.py
Cloud Function HTTP — Conversas

Endpoints:
  GET   /conversations
  GET   /conversations/{id}/messages
  PATCH /conversations/{id}/modo
  POST  /conversations/send

Deploy:
  gcloud functions deploy conversations \
    --runtime python311 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point conversations \
    --set-env-vars DATABASE_URL=...,SECRET_KEY=...,BAILEYS_URL=...
"""
import re
import asyncio
import httpx

from shared.db import get_conn, db_one, db_all, db_exec
from shared.auth import get_current_user
from shared.http_helpers import cors_preflight, json_response, error_response, parse_body

BAILEYS_URL = __import__("os").getenv("BAILEYS_URL", "http://baileys:3002")


def conversations(request):
    if request.method == "OPTIONS":
        return cors_preflight()

    conn = get_conn()
    try:
        user = get_current_user(request, conn)
    except ValueError as e:
        conn.close()
        return error_response(str(e), 401)

    path   = request.path.rstrip("/")
    method = request.method

    try:
        # POST /conversations/send
        if method == "POST" and path.endswith("/send"):
            return _enviar_manual(request, user, conn)

        # GET /conversations/{id}/messages
        m = re.search(r"/conversations/(\d+)/messages$", path)
        if m and method == "GET":
            return _mensagens(user, conn, int(m.group(1)))

        # PATCH /conversations/{id}/modo
        m = re.search(r"/conversations/(\d+)/modo$", path)
        if m and method == "PATCH":
            return _alterar_modo(request, user, conn, int(m.group(1)))

        # GET /conversations
        if re.search(r"/conversations$", path) and method == "GET":
            return _listar(user, conn)

        return error_response("Rota não encontrada", 404)
    finally:
        conn.close()


# ── handlers ───────────────────────────────────────────────────────────────────

def _listar(user, conn):
    rows = db_all(conn, """
        SELECT c.*, ct.nome as contact_nome, ct.telefone as contact_telefone
        FROM conversations c
        LEFT JOIN contacts ct ON ct.id = c.contact_id
        WHERE c.usuario_id = %s
        ORDER BY c.atualizado_em DESC
    """, (user["id"],))
    return json_response([dict(r) for r in rows])


def _mensagens(user, conn, conv_id):
    conv = db_one(conn, "SELECT id FROM conversations WHERE id=%s AND usuario_id=%s", (conv_id, user["id"]))
    if not conv:
        return error_response("Conversa não encontrada", 404)
    rows = db_all(conn, "SELECT * FROM messages WHERE conversation_id=%s ORDER BY timestamp ASC", (conv_id,))
    return json_response([dict(r) for r in rows])


def _alterar_modo(request, user, conn, conv_id):
    b    = parse_body(request)
    modo = b.get("modo", "")
    if modo not in ("ia", "manual"):
        return error_response("modo deve ser 'ia' ou 'manual'")
    db_exec(conn,
        "UPDATE conversations SET modo=%s, atualizado_em=NOW() WHERE id=%s AND usuario_id=%s",
        (modo, conv_id, user["id"]))
    return json_response({"ok": True})


def _enviar_manual(request, user, conn):
    b = parse_body(request)
    conversation_id = b.get("conversation_id")
    content         = b.get("content", "").strip()
    midia_url       = b.get("midia_url")
    midia_tipo      = b.get("midia_tipo")

    if not conversation_id or not content:
        return error_response("conversation_id e content são obrigatórios")

    conv = db_one(conn, "SELECT * FROM conversations WHERE id=%s AND usuario_id=%s", (conversation_id, user["id"]))
    if not conv:
        return error_response("Conversa não encontrada", 404)
    conv = dict(conv)

    db_exec(conn,
        "INSERT INTO messages (conversation_id, role, content, midia_url, midia_tipo) VALUES (%s,'assistant',%s,%s,%s)",
        (conversation_id, content, midia_url, midia_tipo))

    numero = conv["jid"].replace("@s.whatsapp.net", "").replace("@lid", "")
    try:
        asyncio.run(_post_baileys(numero, content))
    except Exception as e:
        print(f"⚠️ Erro ao enviar via Baileys: {e}")

    return json_response({"ok": True})


async def _post_baileys(numero: str, content: str):
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(f"{BAILEYS_URL}/ia-responder", json={"number": numero, "message": content})
