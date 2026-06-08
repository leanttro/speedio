"""
LEANTTRO — Enricher Worker
Microserviço independente que consome a fila Redis `fila_enricher`
e executa o pipeline: ReceitaWS → LinkedIn (Serper) → Score IA (Groq)

NÃO tem FastAPI, NÃO tem rotas, NÃO tem auth.
Só consome fila e grava no banco.

Container: Dockerfile.enricher
Fila:      Redis → fila_enricher
Banco:     PostgreSQL → tabela leads
"""

import os
import json
import re
import asyncio
import time as time_module

import psycopg2
import psycopg2.extras
import httpx
import redis.asyncio as aioredis

# ─────────────────────────────────────────
#  CONFIG — lê do ambiente (mesmo .env da API)
# ─────────────────────────────────────────
DATABASE_URL   = os.getenv("DATABASE_URL", "")
REDIS_URL      = os.getenv("REDIS_URL", "redis://redis:6379")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")

GROQ_API_URL   = "https://api.groq.com/openai/v1/chat/completions"
RECEITAWS_URL  = "https://www.receitaws.com.br/v1/cnpj"

# Modelos Groq em ordem de preferência (fallback automático)
GROQ_MODELOS_FALLBACK = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "gemma2-9b-it",
]

# ─────────────────────────────────────────
#  BANCO
# ─────────────────────────────────────────
def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def db_one(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    return cur.fetchone()

def db_exec(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    conn.commit()
    try:    return cur.fetchone()
    except: return None

# ─────────────────────────────────────────
#  GROQ — chamada com fallback de modelos
# ─────────────────────────────────────────
async def chamar_groq(system_prompt: str, mensagens: list, temperatura: float, modelo: str) -> str:
    messages = [{"role": "system", "content": system_prompt}]
    for msg in mensagens:
        role = "assistant" if msg["role"] == "assistant" else "user"
        messages.append({"role": role, "content": msg["content"] or ""})

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    modelos_para_tentar = [modelo] if modelo else []
    for m in GROQ_MODELOS_FALLBACK:
        if m not in modelos_para_tentar:
            modelos_para_tentar.append(m)

    ultimo_erro = None
    async with httpx.AsyncClient(timeout=30) as client:
        for m in modelos_para_tentar:
            payload = {
                "model": m,
                "temperature": float(temperatura or 0.3),
                "max_tokens": 500,
                "messages": messages
            }
            try:
                resp = await client.post(GROQ_API_URL, headers=headers, json=payload)
                if resp.status_code == 400:
                    print(f"⚠️  Modelo {m} retornou 400 — tentando próximo...")
                    ultimo_erro = resp.json()
                    continue
                resp.raise_for_status()
                data = resp.json()
                if m != modelo:
                    print(f"✅ Usando modelo fallback: {m}")
                return data["choices"][0]["message"]["content"].strip()
            except Exception as e:
                print(f"⚠️  Erro com modelo {m}: {e} — tentando próximo...")
                ultimo_erro = str(e)
                continue

    raise Exception(f"Todos os modelos Groq falharam. Último erro: {ultimo_erro}")

# ─────────────────────────────────────────
#  RECEITAWS — busca CNPJ
# ─────────────────────────────────────────
def buscar_cnpj(cnpj: str) -> dict:
    cnpj_limpo = re.sub(r"\D", "", cnpj)
    if len(cnpj_limpo) != 14:
        return {}
    try:
        r = httpx.get(f"{RECEITAWS_URL}/{cnpj_limpo}", timeout=15)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"⚠️  ReceitaWS erro: {e}")
    return {}

def extrair_cnpj_do_texto(texto: str) -> str:
    match = re.search(r"\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\/]?\d{4}[\-]?\d{2}", texto)
    return match.group(0) if match else ""

# ─────────────────────────────────────────
#  SERPER — busca LinkedIn
# ─────────────────────────────────────────
def buscar_linkedin(empresa: str, cidade: str) -> str:
    try:
        r = httpx.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": f"{empresa} {cidade} site:linkedin.com/company", "gl": "br"},
            timeout=10,
        )
        if r.status_code == 200:
            results = r.json().get("organic", [])
            for item in results:
                link = item.get("link", "")
                if "linkedin.com/company" in link:
                    return link
    except Exception as e:
        print(f"⚠️  Serper LinkedIn erro: {e}")
    return ""

# ─────────────────────────────────────────
#  GROQ SCORE — score 0-100 + justificativa + mensagem WPP
# ─────────────────────────────────────────
async def gerar_score_lead(lead: dict, dados_receita: dict) -> dict:
    nome    = lead.get("nome", "")
    nicho   = lead.get("nicho", "")
    cidade  = lead.get("cidade", "")
    porte   = dados_receita.get("porte", "") or lead.get("porte", "")
    socios  = dados_receita.get("qsa", [])
    rating  = lead.get("rating", "")
    website = lead.get("website", "")

    system = """Você é um especialista em qualificação de leads B2B.
Analise os dados da empresa e retorne APENAS um JSON válido, sem markdown, sem explicação extra.
Formato obrigatório:
{
  "score": <inteiro 0-100>,
  "justificativa": "<2-3 frases explicando o score>",
  "mensagem_wpp": "<mensagem personalizada de prospecção via WhatsApp, máx 3 linhas, natural e humana>"
}"""

    user = f"""Empresa: {nome}
Nicho: {nicho}
Cidade: {cidade}
Porte: {porte}
Avaliação Google: {rating}
Tem website: {"Sim" if website else "Não"}
Sócios: {len(socios)} registrado(s)
Situação cadastral: {dados_receita.get("situacao", "Desconhecida")}"""

    try:
        resultado = await chamar_groq(system, [{"role": "user", "content": user}], 0.3, "llama-3.3-70b-versatile")
        resultado = re.sub(r"```json|```", "", resultado).strip()
        dados = json.loads(resultado)
        return {
            "score_ia":            int(dados.get("score", 0)),
            "score_justificativa": dados.get("justificativa", ""),
            "mensagem_wpp":        dados.get("mensagem_wpp", ""),
        }
    except Exception as e:
        print(f"⚠️  Erro ao gerar score: {e}")
        return {
            "score_ia":            0,
            "score_justificativa": "Erro ao gerar score.",
            "mensagem_wpp":        "",
        }

# ─────────────────────────────────────────
#  PIPELINE PRINCIPAL — processa 1 lead
# ─────────────────────────────────────────
async def processar_enrichment(lead_id: int):
    """
    1. Busca lead no banco
    2. ReceitaWS  → CNPJ, porte, sócios, situação
    3. Serper     → LinkedIn
    4. Groq       → score + justificativa + mensagem WPP
    5. Salva tudo no banco, status = 'enriquecido'
    """
    conn = get_conn()
    try:
        lead = db_one(conn, "SELECT * FROM leads WHERE id = %s", (lead_id,))
        if not lead:
            print(f"⚠️  Lead {lead_id} não encontrado no banco")
            return
        lead = dict(lead)

        print(f"🔍 [{lead_id}] Enriquecendo: {lead.get('nome')} — {lead.get('cidade')}")

        # ── 1. CNPJ ─────────────────────────────────────────────────
        cnpj = lead.get("cnpj") or ""
        if not cnpj and lead.get("website"):
            cnpj = extrair_cnpj_do_texto(lead.get("website", ""))

        dados_receita = {}
        if cnpj:
            print(f"   📋 Buscando CNPJ {cnpj}...")
            dados_receita = buscar_cnpj(cnpj)
            time_module.sleep(1)  # respeita rate limit da ReceitaWS (1 req/s grátis)

        porte           = dados_receita.get("porte", "") or ""
        socios          = dados_receita.get("qsa", []) or []
        situacao        = dados_receita.get("situacao", "") or ""
        cnpj_confirmado = dados_receita.get("cnpj", cnpj) or cnpj

        # ── 2. LinkedIn ──────────────────────────────────────────────
        print(f"   🔗 Buscando LinkedIn...")
        linkedin_url = buscar_linkedin(lead.get("nome", ""), lead.get("cidade", ""))

        # ── 3. Score IA ──────────────────────────────────────────────
        print(f"   🤖 Gerando score IA...")
        score_data = await gerar_score_lead(lead, dados_receita)

        # ── 4. Salva no banco ────────────────────────────────────────
        db_exec(conn, """
            UPDATE leads SET
                cnpj                = %s,
                porte               = %s,
                socios              = %s,
                situacao_cadastral  = %s,
                linkedin_url        = %s,
                score_ia            = %s,
                score_justificativa = %s,
                mensagem_wpp        = %s,
                status              = 'enriquecido',
                enriched_at         = NOW(),
                updated_at          = NOW()
            WHERE id = %s
        """, (
            cnpj_confirmado,
            porte,
            json.dumps(socios),
            situacao,
            linkedin_url,
            score_data["score_ia"],
            score_data["score_justificativa"],
            score_data["mensagem_wpp"],
            lead_id,
        ))

        print(f"   ✅ Lead {lead_id} enriquecido! Score: {score_data['score_ia']}/100")

    except Exception as e:
        print(f"🔴 Erro ao enriquecer lead {lead_id}: {e}")
        try:
            db_exec(conn, "UPDATE leads SET status='erro_enrichment', updated_at=NOW() WHERE id=%s", (lead_id,))
        except:
            pass
    finally:
        conn.close()

# ─────────────────────────────────────────
#  WORKER LOOP — consome Redis infinitamente
# ─────────────────────────────────────────
async def worker_enricher():
    print("🚀 Enricher Worker iniciado")
    print(f"   Redis: {REDIS_URL}")
    print(f"   Banco: {DATABASE_URL[:40]}...")
    print(f"   Groq:  {'✅ configurado' if GROQ_API_KEY else '❌ ausente'}")
    print(f"   Serper: {'✅ configurado' if SERPER_API_KEY else '❌ ausente'}")
    print("   Aguardando jobs na fila fila_enricher...\n")

    redis = await aioredis.from_url(REDIS_URL)

    while True:
        try:
            # blpop bloqueia até chegar um job (timeout=5s para não travar forever)
            job = await redis.blpop("fila_enricher", timeout=5)
            if not job:
                continue

            data    = json.loads(job[1])
            lead_id = data.get("lead_id")
            if not lead_id:
                print(f"⚠️  Job sem lead_id: {data}")
                continue

            print(f"📥 Job recebido — lead_id={lead_id}")
            await processar_enrichment(lead_id)

        except Exception as e:
            print(f"🔴 Erro no worker loop: {e}")
            await asyncio.sleep(5)  # pausa antes de tentar reconectar

# ─────────────────────────────────────────
#  ENTRYPOINT
# ─────────────────────────────────────────
if __name__ == "__main__":
    asyncio.run(worker_enricher())
