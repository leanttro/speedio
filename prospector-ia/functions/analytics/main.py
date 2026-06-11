"""
functions/analytics/main.py
Cloud Function HTTP — Analytics

Endpoints:
  GET /analytics

Deploy:
  gcloud functions deploy analytics \
    --runtime python311 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point analytics \
    --set-env-vars DATABASE_URL=...,SECRET_KEY=...
"""
from shared.db import get_conn, db_one, db_all
from shared.auth import get_current_user
from shared.http_helpers import cors_preflight, json_response, error_response


def analytics(request):
    if request.method == "OPTIONS":
        return cors_preflight()

    conn = get_conn()
    try:
        user = get_current_user(request, conn)
    except ValueError as e:
        conn.close()
        return error_response(str(e), 401)

    try:
        totais = db_one(conn, """
            SELECT
                COUNT(DISTINCT c.id)                                              AS total_contatos,
                COUNT(DISTINCT CASE WHEN c.status != 'pendente'    THEN c.id END) AS abordados,
                COUNT(DISTINCT CASE WHEN c.status = 'qualificado'  THEN c.id END) AS qualificados,
                COUNT(DISTINCT CASE WHEN c.status = 'convertido'   THEN c.id END) AS convertidos
            FROM contacts c WHERE c.usuario_id = %s
        """, (user["id"],))

        historico = db_all(conn, """
            SELECT data, abordados, responderam, qualificados, convertidos, msgs_enviadas, msgs_recebidas
            FROM analytics_daily WHERE usuario_id = %s ORDER BY data DESC LIMIT 30
        """, (user["id"],))

        return json_response({
            "totais":    dict(totais),
            "historico": [dict(r) for r in historico],
        })
    finally:
        conn.close()
