"""
shared/ia.py — Helpers de IA (Groq) e envio de WhatsApp
"""
import os
import re
import httpx

GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL  = "https://api.groq.com/openai/v1/chat/completions"
BAILEYS_URL   = os.getenv("BAILEYS_URL", "http://baileys:3002")

GROQ_MODELOS_FALLBACK = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "gemma2-9b-it",
]

GATILHOS_PARADA_PADRAO = [
    "não quero", "nao quero", "para", "chega", "sai", "remove", "cancelar"
]


# ── Groq ───────────────────────────────────────────────────────────────────────

async def chamar_groq(
    system_prompt: str,
    historico: list,
    groq_key: str,
    temperatura: float,
    modelo: str,
) -> str:
    messages = [{"role": "system", "content": system_prompt}]
    for msg in historico[-10:]:
        role = "assistant" if msg["role"] == "assistant" else "user"
        messages.append({"role": role, "content": msg["content"] or ""})

    headers = {
        "Authorization": f"Bearer {groq_key}",
        "Content-Type":  "application/json",
    }

    modelos_para_tentar = [modelo] if modelo else []
    for m in GROQ_MODELOS_FALLBACK:
        if m not in modelos_para_tentar:
            modelos_para_tentar.append(m)

    ultimo_erro = None
    async with httpx.AsyncClient(timeout=30) as client:
        for m in modelos_para_tentar:
            payload = {
                "model":       m,
                "temperature": float(temperatura or 0.7),
                "max_tokens":  500,
                "messages":    messages,
            }
            try:
                resp = await client.post(GROQ_API_URL, headers=headers, json=payload)
                if resp.status_code == 400:
                    ultimo_erro = resp.json()
                    continue
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"].strip()
            except Exception as e:
                ultimo_erro = str(e)
                continue

    raise Exception(f"Todos os modelos Groq falharam. Último erro: {ultimo_erro}")


def montar_system_prompt(cfg: dict, usuario: dict) -> str:
    persona   = cfg.get("persona_nome") or "Assistente"
    produto   = cfg.get("produto_nome") or "nosso serviço"
    descricao = cfg.get("produto_descricao") or ""
    preco     = cfg.get("produto_preco") or ""
    prompt    = cfg.get("prompt_sistema") or ""

    base = f"""Você é {persona}, assistente de vendas especialista.
Seu objetivo é prospectar clientes e vender: {produto}.
{f'Descrição: {descricao}' if descricao else ''}
{f'Preço: {preco}' if preco else ''}

Instruções importantes:
- Seja natural, humano e objetivo
- Se a pessoa não for o decisor/responsável, pergunte educadamente pelo número ou nome do responsável
- Se identificar interesse real, aprofunde a conversa e tente fechar
- Seja breve nas mensagens (máximo 3 parágrafos)
- Nunca mande listas longas ou textos enormes
- Se a pessoa pedir para parar, agradeça e encerre
- Use APENAS as informações fornecidas. NUNCA use placeholders como [nome da empresa].

{prompt}"""
    return base.strip()


def checar_gatilho_parada(texto: str, gatilhos_str: str) -> bool:
    texto_lower = texto.lower()
    gatilhos    = GATILHOS_PARADA_PADRAO[:]
    if gatilhos_str:
        gatilhos += [g.strip().lower() for g in gatilhos_str.split(",")]
    return any(g in texto_lower for g in gatilhos)


def checar_pedido_responsavel(texto: str) -> bool:
    sinais = ["responsável", "responsavel", "decisor", "quem decide", "falar com"]
    return any(s in texto.lower() for s in sinais)


def get_groq_key(usuario: dict) -> str:
    if usuario.get("usar_ia_propria") and usuario.get("groq_key"):
        return usuario["groq_key"]
    return GROQ_API_KEY


# ── WhatsApp ────────────────────────────────────────────────────────────────────

async def enviar_whatsapp(
    numero: str,
    texto: str = None,
    midia_url: str = None,
    midia_tipo: str = None,
    caption: str = None,
):
    payload = {"number": numero, "message": texto or caption or "", "useFullJid": True}
    if midia_url:
        if midia_tipo == "video":
            payload["videoUrl"] = midia_url
        else:
            payload["imageUrl"] = midia_url
    async with httpx.AsyncClient(timeout=45) as client:
        await client.post(f"{BAILEYS_URL}/disparar", json=payload)
