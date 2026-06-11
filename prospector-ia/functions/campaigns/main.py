"""
functions/campaigns/main.py
Cloud Function HTTP — Campanhas

Endpoints:
  GET    /campaigns
  POST   /campaigns
  PATCH  /campaigns/{id}/status
  DELETE /campaigns/{id}

Nota: ao ativar uma campanha (status=ativa), esta função apenas enfileira os
contatos no Redis. O worker_campanhas.py (VPS/Contabo) consome essa fila e
dispara as mensagens com o intervalo configurado.

Deploy:
  gcloud functions deploy campaigns \
    --runtime python311 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point campaigns \
    --set-env-vars DATABASE_URL=...,SECRET_KEY=...,REDIS_URL=...
"""
import re
import json
import redis

from shared.db import get_conn, db_one, db_all, db_exec
from shared.auth import get_current_user
from shared.http_helpers import cors_preflight, json_response, error_response, parse_body

REDIS_URL = __import__("os").getenv("REDIS_URL", "redis://localhost:6379")


def campaigns(request):
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
        # PATCH /campaigns/{id}/status
        m = re.search(r"/campaigns/(\d+)/status$", path)
        if m and method == "PATCH":
            return _atualizar_status(request, user, conn, int(m.group(1)))

        # DELETE /campaigns/{id}
        m = re.search(r"/campaigns/(\d+)$", path)
        if m and method == "DELETE":
            return _deletar(user, conn, int(m.group(1)))

        # GET /campaigns | POST /campaigns
        if re.search(r"/campaigns$", path):
            if method == "GET":
                return _listar(user, conn)
            if method == "POST":
                return _criar(request, user, conn)

        return error_response("Rota não encontrada", 404)
    finally:
        conn.close()


# ── handlers ───────────────────────────────────────────────────────────────────

def _listar(user, conn):
    rows = db_all(conn, "SELECT * FROM campaigns WHERE usuario_id=%s ORDER BY criado_em DESC", (user["id"],))
    return json_response([dict(r) for r in rows])


def _criar(request, user, conn):
    b = parse_body(request)
    nome        = b.get("nome", "").strip()
    velocidade  = b.get("velocidade", 60)
    contact_ids = b.get("contact_ids", [])

    if not nome:
        return error_response("nome é obrigatório")

    camp = db_exec(conn,
        "INSERT INTO campaigns (usuario_id, nome, velocidade, total_contatos, status) VALUES (%s,%s,%s,%s,'rascunho') RETURNING *",
        (user["id"], nome, velocidade, len(contact_ids)))

    for cid in contact_ids:
        try:
            db_exec(conn,
                "INSERT INTO campaign_contacts (campaign_id, contact_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                (camp["id"], cid))
        except Exception:
            pass

    return json_response(dict(camp), 201)


def _atualizar_status(request, user, conn, campaign_id):
    b      = parse_body(request)
    status = b.get("status", "")

    db_exec(conn,
        "UPDATE campaigns SET status=%s, atualizado_em=NOW() WHERE id=%s AND usuario_id=%s",
        (status, campaign_id, user["id"]))

    # Ao ativar: enfileira contatos no Redis para o worker do VPS consumir
    if status == "ativa":
        camp = db_one(conn, "SELECT * FROM campaigns WHERE id=%s AND usuario_id=%s", (campaign_id, user["id"]))
        if camp:
            _enfileirar_campanha(campaign_id, user["id"], camp["velocidade"], conn)

    return json_response({"ok": True})


def _deletar(user, conn, campaign_id):
    db_exec(conn, "DELETE FROM campaigns WHERE id=%s AND usuario_id=%s", (campaign_id, user["id"]))
    return json_response({"ok": True})


def _enfileirar_campanha(campaign_id: int, usuario_id: int, velocidade: int, conn):
    """Publica os jobs na fila Redis. O worker_campanhas.py no VPS consome."""
    contatos = db_all(conn, """
        SELECT cc.contact_id FROM campaign_contacts cc
        WHERE cc.campaign_id=%s AND cc.status='pendente'
    """, (campaign_id,))

    if not contatos:
        return 0

    r = redis.from_url(REDIS_URL)
    for c in contatos:
        job = json.dumps({
            "campaign_id": campaign_id,
            "contact_id":  c["contact_id"],
            "usuario_id":  usuario_id,
            "velocidade":  velocidade,
        })
        r.rpush("fila_campanha", job)
    r.close()
    return len(contatos)
