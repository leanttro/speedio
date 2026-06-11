"""
functions/config/main.py
Cloud Function HTTP — Configuração da IA, chave Groq e status do WhatsApp

Endpoints:
  GET  /ai-config
  POST /ai-config
  GET  /ai-config/modelos
  PUT  /config/groq
  GET  /whatsapp/status
  GET  /whatsapp/qrcode
  GET  /whatsapp/qrcode-json

Deploy:
  gcloud functions deploy config \
    --runtime python311 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point config \
    --set-env-vars DATABASE_URL=...,SECRET_KEY=...,BAILEYS_URL=...
"""
import re
import asyncio
import httpx

from shared.db import get_conn, db_one, db_exec
from shared.auth import get_current_user
from shared.http_helpers import cors_preflight, json_response, error_response, parse_body

BAILEYS_URL = __import__("os").getenv("BAILEYS_URL", "http://baileys:3002")

GROQ_MODELOS = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "gemma2-9b-it",
]


def config(request):
    if request.method == "OPTIONS":
        return cors_preflight()

    path   = request.path.rstrip("/")
    method = request.method

    # Rotas de WhatsApp não precisam de auth de usuário, mas validamos mesmo assim
    conn = get_conn()
    try:
        user = get_current_user(request, conn)
    except ValueError as e:
        conn.close()
        return error_response(str(e), 401)

    try:
        # GET /ai-config/modelos
        if method == "GET" and path.endswith("/ai-config/modelos"):
            return json_response({"modelos": GROQ_MODELOS})

        # GET /ai-config
        if method == "GET" and path.endswith("/ai-config"):
            return _get_ai_config(user, conn)

        # POST /ai-config
        if method == "POST" and path.endswith("/ai-config"):
            return _salvar_ai_config(request, user, conn)

        # PUT /config/groq
        if method == "PUT" and path.endswith("/config/groq"):
            return _salvar_groq_key(request, user, conn)

        # GET /whatsapp/status
        if method == "GET" and path.endswith("/whatsapp/status"):
            return _wpp_status()

        # GET /whatsapp/qrcode
        if method == "GET" and path.endswith("/whatsapp/qrcode"):
            return asyncio.run(_wpp_qrcode())

        # GET /whatsapp/qrcode-json
        if method == "GET" and path.endswith("/whatsapp/qrcode-json"):
            return asyncio.run(_wpp_qrcode_json())

        return error_response("Rota não encontrada", 404)
    finally:
        conn.close()


# ── handlers ───────────────────────────────────────────────────────────────────

def _get_ai_config(user, conn):
    cfg = db_one(conn, "SELECT * FROM ai_config WHERE usuario_id = %s", (user["id"],))
    return json_response(dict(cfg) if cfg else {})


def _salvar_ai_config(request, user, conn):
    b = parse_body(request)

    campos_texto = [
        "persona_nome", "prompt_sistema", "modelo",
        "produto_nome", "produto_descricao", "produto_preco",
        "midia_abertura_url", "midia_abertura_tipo", "midia_abertura_caption",
        "midia_fechamento_url", "midia_fechamento_tipo", "midia_fechamento_caption",
        "gatilhos_parada", "horario_inicio", "horario_fim",
    ]
    for campo in campos_texto:
        if b.get(campo) == "":
            b[campo] = None

    # Valores padrão
    b.setdefault("persona_nome",       "Assistente")
    b.setdefault("horario_inicio",     "08:00")
    b.setdefault("horario_fim",        "18:00")
    b.setdefault("temperatura",        0.7)
    b.setdefault("modelo",             "llama-3.1-8b-instant")
    b.setdefault("delay_mensagens",    3)
    b.setdefault("max_followups",      2)
    b.setdefault("intervalo_followup", 24)

    db_exec(conn, """
        INSERT INTO ai_config (
            usuario_id, persona_nome, prompt_sistema, temperatura, modelo,
            produto_nome, produto_descricao, produto_preco,
            midia_abertura_url, midia_abertura_tipo, midia_abertura_caption,
            midia_fechamento_url, midia_fechamento_tipo, midia_fechamento_caption,
            gatilhos_parada, horario_inicio, horario_fim,
            delay_mensagens, max_followups, intervalo_followup
        ) VALUES (
            %s,%s,%s,%s,%s,
            %s,%s,%s,
            %s,%s,%s,
            %s,%s,%s,
            %s,%s,%s,
            %s,%s,%s
        )
        ON CONFLICT (usuario_id) DO UPDATE SET
            persona_nome             = EXCLUDED.persona_nome,
            prompt_sistema           = EXCLUDED.prompt_sistema,
            temperatura              = EXCLUDED.temperatura,
            modelo                   = EXCLUDED.modelo,
            produto_nome             = EXCLUDED.produto_nome,
            produto_descricao        = EXCLUDED.produto_descricao,
            produto_preco            = EXCLUDED.produto_preco,
            midia_abertura_url       = EXCLUDED.midia_abertura_url,
            midia_abertura_tipo      = EXCLUDED.midia_abertura_tipo,
            midia_abertura_caption   = EXCLUDED.midia_abertura_caption,
            midia_fechamento_url     = EXCLUDED.midia_fechamento_url,
            midia_fechamento_tipo    = EXCLUDED.midia_fechamento_tipo,
            midia_fechamento_caption = EXCLUDED.midia_fechamento_caption,
            gatilhos_parada          = EXCLUDED.gatilhos_parada,
            horario_inicio           = EXCLUDED.horario_inicio,
            horario_fim              = EXCLUDED.horario_fim,
            delay_mensagens          = EXCLUDED.delay_mensagens,
            max_followups            = EXCLUDED.max_followups,
            intervalo_followup       = EXCLUDED.intervalo_followup,
            atualizado_em            = NOW()
    """, (
        user["id"],
        b.get("persona_nome"), b.get("prompt_sistema"), b.get("temperatura"), b.get("modelo"),
        b.get("produto_nome"), b.get("produto_descricao"), b.get("produto_preco"),
        b.get("midia_abertura_url"), b.get("midia_abertura_tipo"), b.get("midia_abertura_caption"),
        b.get("midia_fechamento_url"), b.get("midia_fechamento_tipo"), b.get("midia_fechamento_caption"),
        b.get("gatilhos_parada"), b.get("horario_inicio"), b.get("horario_fim"),
        b.get("delay_mensagens"), b.get("max_followups"), b.get("intervalo_followup"),
    ))
    return json_response({"ok": True})


def _salvar_groq_key(request, user, conn):
    b = parse_body(request)
    db_exec(conn,
        "UPDATE usuarios SET groq_key=%s, usar_ia_propria=%s WHERE id=%s",
        (b.get("groq_key"), b.get("usar_ia_propria", False), user["id"]))
    return json_response({"ok": True})


def _wpp_status():
    try:
        r = httpx.get(f"{BAILEYS_URL}/status", timeout=15)
        return json_response(r.json())
    except Exception:
        return json_response({"connected": False, "number": ""})


async def _wpp_qrcode():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r     = await client.get(f"{BAILEYS_URL}/qrcode")
            html  = r.text
            match = re.search(r'src="(data:image[^"]+)"', html)
            return json_response({"qr": match.group(1) if match else None})
    except Exception:
        return json_response({"qr": None})


async def _wpp_qrcode_json():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{BAILEYS_URL}/qrcode-json")
            return json_response(r.json())
    except Exception:
        return json_response({"qr": None})
