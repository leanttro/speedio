"""
functions/webhook/main.py
Cloud Function HTTP — Webhook de mensagens WhatsApp (Baileys)

Este é o coração da IA: recebe cada mensagem do Baileys e processa a resposta.

Endpoint:
  POST /webhook/mensagem

Deploy:
  gcloud functions deploy webhook \
    --runtime python311 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point webhook \
    --timeout 540 \
    --set-env-vars DATABASE_URL=...,GROQ_API_KEY=...,BAILEYS_URL=...
"""
import re
import asyncio
import json
from datetime import datetime, date, time as time_type

from shared.db import get_conn, db_one, db_all, db_exec
from shared.ia import chamar_groq, enviar_whatsapp, montar_system_prompt, checar_gatilho_parada, get_groq_key
from shared.http_helpers import cors_preflight, json_response, error_response, parse_body


def webhook(request):
    if request.method == "OPTIONS":
        return cors_preflight()

    if request.method != "POST":
        return error_response("Método não permitido", 405)

    payload = parse_body(request)

    # Roda o processamento assíncrono
    try:
        asyncio.run(_processar(payload))
    except Exception as e:
        print(f"Erro no webhook: {e}")

    return json_response({"ok": True})


# ── processador principal ───────────────────────────────────────────────────────

async def _processar(payload: dict):
    print(f"📨 Webhook: {json.dumps({k: v for k, v in payload.items() if k != 'image'})}")

    usuario_id = payload.get("usuario_id")
    jid        = payload.get("remoteJid", "")
    texto      = payload.get("text", "") or ""
    from_me    = payload.get("fromMe", False)

    if from_me or not texto or not usuario_id:
        return

    numero            = jid
    numero_puro       = re.sub(r"@.*", "", jid)
    numero_puro_norm  = numero_puro[1:] if (len(numero_puro) == 13 and numero_puro.startswith("1")) else numero_puro
    sufixo_busca      = numero_puro_norm[-9:]

    conn = get_conn()
    try:
        usuario = db_one(conn, "SELECT * FROM usuarios WHERE id = %s", (usuario_id,))
        if not usuario:
            return
        usuario = dict(usuario)

        cfg = db_one(conn, "SELECT * FROM ai_config WHERE usuario_id = %s", (usuario_id,))
        if not cfg:
            return
        cfg = dict(cfg)

        # Verifica horário de funcionamento
        agora = datetime.now().time()
        try:
            h_ini_raw = cfg.get("horario_inicio")
            h_fim_raw = cfg.get("horario_fim")
            h_ini = h_ini_raw if isinstance(h_ini_raw, time_type) else time_type.fromisoformat(str(h_ini_raw or "08:00"))
            h_fim = h_fim_raw if isinstance(h_fim_raw, time_type) else time_type.fromisoformat(str(h_fim_raw or "18:00"))
            if not (h_ini <= agora <= h_fim):
                print(f"⏰ Fora do horário ({h_ini}–{h_fim})")
                return
        except Exception as e:
            print(f"⚠️ Erro horário: {e}")

        # Busca conversa existente
        conv = db_one(conn,
            "SELECT * FROM conversations WHERE usuario_id=%s AND regexp_replace(jid, '@.*', '') LIKE %s ORDER BY criado_em DESC LIMIT 1",
            (usuario_id, f"%{sufixo_busca}"))
        if not conv:
            conv = db_one(conn,
                "SELECT * FROM conversations WHERE usuario_id=%s AND jid=%s ORDER BY criado_em DESC LIMIT 1",
                (usuario_id, jid))

        if not conv:
            # Nova conversa — busca contato
            contact = db_one(conn,
                "SELECT id FROM contacts WHERE usuario_id=%s AND telefone LIKE %s",
                (usuario_id, f"%{sufixo_busca}%"))
            if not contact:
                push_name = payload.get("pushName", "")
                if push_name:
                    contact = db_one(conn,
                        "SELECT id FROM contacts WHERE usuario_id=%s AND (nome ILIKE %s OR empresa ILIKE %s)",
                        (usuario_id, f"%{push_name}%", f"%{push_name}%"))
            if not contact:
                print(f"🚫 Contato {numero_puro} não está na base — ignorando")
                return
            conv = db_exec(conn,
                "INSERT INTO conversations (usuario_id, contact_id, jid, status, modo) VALUES (%s,%s,%s,'ativa','ia') RETURNING *",
                (usuario_id, contact["id"], jid))
        else:
            conv = dict(conv)
            if conv["jid"] != jid:
                db_exec(conn, "UPDATE conversations SET jid=%s WHERE id=%s", (jid, conv["id"]))

        conv = dict(conv)

        # Modo manual → não responde
        if conv.get("modo") == "manual":
            db_exec(conn,
                "INSERT INTO messages (conversation_id, role, content) VALUES (%s,'user',%s)",
                (conv["id"], texto))
            return

        # Gatilho de parada
        if checar_gatilho_parada(texto, cfg.get("gatilhos_parada", "")):
            db_exec(conn,
                "UPDATE conversations SET status='encerrada', atualizado_em=NOW() WHERE id=%s",
                (conv["id"],))
            db_exec(conn,
                "UPDATE contacts SET status='perdido', atualizado_em=NOW() WHERE id=%s",
                (conv.get("contact_id"),))
            return

        # Salva mensagem do usuário
        db_exec(conn,
            "INSERT INTO messages (conversation_id, role, content) VALUES (%s,'user',%s)",
            (conv["id"], texto))

        # Busca histórico e chama Groq
        historico = db_all(conn,
            "SELECT role, content FROM messages WHERE conversation_id=%s ORDER BY timestamp ASC",
            (conv["id"],))
        historico = [dict(h) for h in historico]

        groq_key      = get_groq_key(usuario)
        system_prompt = montar_system_prompt(cfg, usuario)
        temperatura   = float(cfg.get("temperatura") or 0.7)
        modelo        = cfg.get("modelo") or "llama-3.1-8b-instant"

        delay = int(cfg.get("delay_mensagens") or 3)
        if delay > 0:
            import asyncio as _aio
            await _aio.sleep(delay)

        resposta = await chamar_groq(system_prompt, historico, groq_key, temperatura, modelo)

        await enviar_whatsapp(numero, texto=resposta)
        db_exec(conn,
            "INSERT INTO messages (conversation_id, role, content) VALUES (%s,'assistant',%s)",
            (conv["id"], resposta))
        db_exec(conn,
            "UPDATE conversations SET atualizado_em=NOW() WHERE id=%s",
            (conv["id"],))

        # Analytics
        hoje = date.today()
        db_exec(conn, """
            INSERT INTO analytics_daily (usuario_id, data, msgs_enviadas, msgs_recebidas)
            VALUES (%s, %s, 1, 1)
            ON CONFLICT (usuario_id, data) DO UPDATE SET
                msgs_enviadas  = analytics_daily.msgs_enviadas  + 1,
                msgs_recebidas = analytics_daily.msgs_recebidas + 1
        """, (usuario_id, hoje))

    finally:
        conn.close()
