"""
functions/contacts/main.py
Cloud Function HTTP — Contatos

Endpoints:
  GET    /contacts
  POST   /contacts
  PUT    /contacts/{id}
  PATCH  /contacts/{id}/status
  DELETE /contacts/{id}
  POST   /contacts/import-csv

Deploy:
  gcloud functions deploy contacts \
    --runtime python311 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point contacts \
    --set-env-vars DATABASE_URL=...,SECRET_KEY=...
"""
import csv
import io
import re

from shared.db import get_conn, db_one, db_all, db_exec
from shared.auth import get_current_user
from shared.http_helpers import cors_preflight, json_response, error_response, parse_body


def contacts(request):
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
        # POST /contacts/import-csv
        if method == "POST" and path.endswith("/import-csv"):
            return _import_csv(request, user, conn)

        # GET /contacts  |  POST /contacts
        if re.search(r"/contacts$", path):
            if method == "GET":
                return _listar(request, user, conn)
            if method == "POST":
                return _criar(request, user, conn)

        # /contacts/{id}/status
        m = re.search(r"/contacts/(\d+)/status$", path)
        if m and method == "PATCH":
            return _atualizar_status(request, user, conn, int(m.group(1)))

        # /contacts/{id}
        m = re.search(r"/contacts/(\d+)$", path)
        if m:
            cid = int(m.group(1))
            if method == "PUT":
                return _atualizar(request, user, conn, cid)
            if method == "DELETE":
                return _deletar(user, conn, cid)

        return error_response("Rota não encontrada", 404)
    finally:
        conn.close()


# ── handlers ───────────────────────────────────────────────────────────────────

def _listar(request, user, conn):
    status = request.args.get("status")
    if status:
        rows = db_all(conn,
            "SELECT * FROM contacts WHERE usuario_id=%s AND status=%s ORDER BY criado_em DESC",
            (user["id"], status))
    else:
        rows = db_all(conn,
            "SELECT * FROM contacts WHERE usuario_id=%s ORDER BY criado_em DESC",
            (user["id"],))
    return json_response([dict(r) for r in rows])


def _criar(request, user, conn):
    b = parse_body(request)
    if not b.get("nome") or not b.get("telefone"):
        return error_response("nome e telefone são obrigatórios")
    row = db_exec(conn,
        "INSERT INTO contacts (usuario_id, nome, telefone, empresa, cargo, notas) VALUES (%s,%s,%s,%s,%s,%s) RETURNING *",
        (user["id"], b["nome"], b["telefone"], b.get("empresa"), b.get("cargo"), b.get("notas")))
    return json_response(dict(row), 201)


def _atualizar(request, user, conn, contact_id):
    b = parse_body(request)
    db_exec(conn,
        "UPDATE contacts SET nome=%s, telefone=%s, empresa=%s, cargo=%s, notas=%s, atualizado_em=NOW() WHERE id=%s AND usuario_id=%s",
        (b.get("nome"), b.get("telefone"), b.get("empresa"), b.get("cargo"), b.get("notas"), contact_id, user["id"]))
    return json_response({"ok": True})


def _atualizar_status(request, user, conn, contact_id):
    b = parse_body(request)
    db_exec(conn,
        "UPDATE contacts SET status=%s, atualizado_em=NOW() WHERE id=%s AND usuario_id=%s",
        (b.get("status"), contact_id, user["id"]))
    return json_response({"ok": True})


def _deletar(user, conn, contact_id):
    db_exec(conn, "DELETE FROM contacts WHERE id=%s AND usuario_id=%s", (contact_id, user["id"]))
    return json_response({"ok": True})


def _import_csv(request, user, conn):
    uploaded = request.files.get("file")
    if not uploaded:
        return error_response("Arquivo CSV não enviado")

    content  = uploaded.read().decode("utf-8")
    reader   = csv.DictReader(io.StringIO(content))
    inseridos, erros = 0, []

    for i, row in enumerate(reader):
        try:
            telefone = row.get("telefone") or row.get("phone") or row.get("numero")
            nome     = row.get("nome") or row.get("name") or "Sem nome"
            if not telefone:
                erros.append(f"Linha {i+2}: telefone ausente")
                continue
            db_exec(conn,
                "INSERT INTO contacts (usuario_id, nome, telefone, empresa, cargo) VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                (user["id"], nome, telefone,
                 row.get("empresa") or row.get("company"),
                 row.get("cargo")   or row.get("role")))
            inseridos += 1
        except Exception as e:
            erros.append(f"Linha {i+2}: {str(e)}")

    return json_response({"inseridos": inseridos, "erros": erros})
