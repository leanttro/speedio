"""
functions/leads/main.py
Cloud Function HTTP — Leads (prospecção automática)

Endpoints:
  POST  /leads/search
  GET   /leads
  GET   /leads/{id}
  PATCH /leads/{id}/status
  DELETE /leads/{id}
  POST  /enricher/enrich/{id}
  POST  /enricher/enrich-batch
  GET   /enricher/status/{id}

Deploy:
  gcloud functions deploy leads \
    --runtime python311 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point leads \
    --timeout 540 \
    --set-env-vars DATABASE_URL=...,SECRET_KEY=...,GROQ_API_KEY=...,SERPER_API_KEY=...
"""
import re
import json
import time
import asyncio
import httpx

from shared.db import get_conn, db_one, db_all, db_exec
from shared.auth import get_current_user
from shared.ia import chamar_groq
from shared.http_helpers import cors_preflight, json_response, error_response, parse_body

import os
SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
RECEITAWS_URL  = "https://www.receitaws.com.br/v1/cnpj"


# ── entry point ────────────────────────────────────────────────────────────────

def leads(request):
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
        # POST /leads/search
        if method == "POST" and path.endswith("/leads/search"):
            return _search(request, user, conn)

        # POST /enricher/enrich-batch
        if method == "POST" and path.endswith("/enricher/enrich-batch"):
            return asyncio.run(_enrich_batch(request, user, conn))

        # POST /enricher/enrich/{id}
        m = re.search(r"/enricher/enrich/(\d+)$", path)
        if m and method == "POST":
            return asyncio.run(_enrich_one(user, conn, int(m.group(1))))

        # GET /enricher/status/{id}
        m = re.search(r"/enricher/status/(\d+)$", path)
        if m and method == "GET":
            return _enricher_status(user, conn, int(m.group(1)))

        # GET /leads/{id}
        m = re.search(r"/leads/(\d+)$", path)
        if m:
            lid = int(m.group(1))
            if method == "GET":
                return _get_lead(user, conn, lid)
            if method == "DELETE":
                return _deletar(user, conn, lid)

        # PATCH /leads/{id}/status
        m = re.search(r"/leads/(\d+)/status$", path)
        if m and method == "PATCH":
            return _atualizar_status(request, user, conn, int(m.group(1)))

        # GET /leads | (POST já tratado acima)
        if re.search(r"/leads$", path) and method == "GET":
            return _listar(request, user, conn)

        return error_response("Rota não encontrada", 404)
    finally:
        conn.close()


# ── handlers ───────────────────────────────────────────────────────────────────

def _listar(request, user, conn):
    cidade = request.args.get("cidade")
    nicho  = request.args.get("nicho")
    status = request.args.get("status")

    filtros, params = [], []
    if cidade: filtros.append("cidade ILIKE %s"); params.append(f"%{cidade}%")
    if nicho:  filtros.append("nicho  ILIKE %s"); params.append(f"%{nicho}%")
    if status: filtros.append("status = %s");     params.append(status)

    where = ("WHERE " + " AND ".join(filtros)) if filtros else ""
    rows  = db_all(conn,
        f"SELECT * FROM leads {where} ORDER BY score_ia DESC NULLS LAST, created_at DESC",
        params)
    return json_response([dict(r) for r in rows])


def _get_lead(user, conn, lead_id):
    lead = db_one(conn, "SELECT * FROM leads WHERE id = %s", (lead_id,))
    if not lead:
        return error_response("Lead não encontrado", 404)
    return json_response(dict(lead))


def _atualizar_status(request, user, conn, lead_id):
    b = parse_body(request)
    db_exec(conn, "UPDATE leads SET status=%s, updated_at=NOW() WHERE id=%s",
            (b.get("status"), lead_id))
    return json_response({"ok": True})


def _deletar(user, conn, lead_id):
    db_exec(conn, "DELETE FROM leads WHERE id=%s", (lead_id,))
    return json_response({"ok": True})


def _enricher_status(user, conn, lead_id):
    lead = db_one(conn,
        "SELECT id, status, enriched_at, score_ia FROM leads WHERE id=%s", (lead_id,))
    if not lead:
        return error_response("Lead não encontrado", 404)
    return json_response(dict(lead))


def _search(request, user, conn):
    b      = parse_body(request)
    nicho  = (b.get("nicho") or "").strip()
    cidade = (b.get("cidade") or "").strip()
    bairro = (b.get("bairro") or "").strip()

    if not nicho or not cidade:
        return error_response("nicho e cidade são obrigatórios")

    bairros = [bairro] if bairro else []
    queries = []
    if bairros:
        for bq in bairros:
            queries.append(f"{nicho} em {bq} {cidade}")
    else:
        queries.append(f"{nicho} em {cidade}")
        queries.append(f"{nicho} {cidade} centro")

    vistos, inseridos, duplicatas = set(), 0, 0

    for query in queries:
        lugares = _buscar_maps(query)
        for lugar in lugares:
            nome = lugar.get("title", "").strip()
            if not nome:
                continue

            place_id = lugar.get("placeId") or lugar.get("place_id") or ""
            chave    = place_id or nome
            if chave in vistos:
                continue
            vistos.add(chave)

            telefone = _limpar_telefone(lugar.get("phoneNumber") or lugar.get("phone") or "")
            website  = lugar.get("website", "") or lugar.get("siteUrl", "")
            maps_url = (f"https://www.google.com/maps/place/?q=place_id:{place_id}"
                        if place_id else lugar.get("link", ""))
            rating   = str(lugar.get("rating", ""))
            lat, lng = _extrair_coordenadas(lugar)

            endereco     = lugar.get("address", "")
            bairro_final = ""
            cidade_final = cidade

            if lat and lng:
                geo = _geocodificar(str(lat), str(lng))
                if geo.get("endereco"): endereco     = geo["endereco"]
                if geo.get("bairro"):   bairro_final = geo["bairro"]
                if geo.get("cidade"):   cidade_final = geo["cidade"]
            else:
                bairro_final, cidade_ext = _extrair_bairro_cidade(endereco)
                if cidade_ext: cidade_final = cidade_ext

            try:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO leads
                        (nome, telefone, whatsapp, endereco, bairro, cidade, nicho,
                         place_id, maps_url, website, rating, lat, lng)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (place_id) DO UPDATE SET
                        telefone   = CASE WHEN leads.telefone IS NULL OR leads.telefone = ''
                                         THEN EXCLUDED.telefone ELSE leads.telefone END,
                        whatsapp   = CASE WHEN leads.whatsapp IS NULL OR leads.whatsapp = ''
                                         THEN EXCLUDED.whatsapp ELSE leads.whatsapp END,
                        website    = CASE WHEN leads.website  IS NULL OR leads.website  = ''
                                         THEN EXCLUDED.website  ELSE leads.website  END,
                        updated_at = NOW()
                    RETURNING id
                """, (nome, telefone, telefone, endereco, bairro_final, cidade_final,
                      nicho, place_id or nome, maps_url, website, rating,
                      str(lat), str(lng)))
                row = cur.fetchone()
                conn.commit()
                if row:
                    inseridos += 1
                else:
                    duplicatas += 1
            except Exception:
                conn.rollback()
                duplicatas += 1

            time.sleep(0.4)

    return json_response({
        "encontrados":   inseridos,
        "duplicatas":    duplicatas,
        "total_queries": len(queries),
    })


async def _enrich_one(user, conn, lead_id):
    lead = db_one(conn, "SELECT id FROM leads WHERE id=%s", (lead_id,))
    if not lead:
        return error_response("Lead não encontrado", 404)
    db_exec(conn, "UPDATE leads SET status='enriquecendo', updated_at=NOW() WHERE id=%s", (lead_id,))
    try:
        await _processar_lead(lead_id, conn)
        return json_response({"ok": True})
    except Exception as e:
        db_exec(conn, "UPDATE leads SET status='erro_enrichment', updated_at=NOW() WHERE id=%s", (lead_id,))
        return error_response(str(e), 500)


async def _enrich_batch(request, user, conn):
    args   = request.args
    cidade = args.get("cidade")
    nicho  = args.get("nicho")

    filtros = ["status = 'pendente'"]
    params  = []
    if cidade: filtros.append("cidade ILIKE %s"); params.append(f"%{cidade}%")
    if nicho:  filtros.append("nicho  ILIKE %s"); params.append(f"%{nicho}%")

    where = "WHERE " + " AND ".join(filtros)
    leads = db_all(conn, f"SELECT id FROM leads {where}", params)

    processados = 0
    for lead in leads:
        lid = lead["id"]
        db_exec(conn, "UPDATE leads SET status='enriquecendo', updated_at=NOW() WHERE id=%s", (lid,))
        try:
            await _processar_lead(lid, conn)
            processados += 1
        except Exception:
            db_exec(conn, "UPDATE leads SET status='erro_enrichment', updated_at=NOW() WHERE id=%s", (lid,))

    return json_response({"ok": True, "processados": processados, "total": len(leads)})


# ── enrichment pipeline ────────────────────────────────────────────────────────

async def _processar_lead(lead_id: int, conn):
    lead = db_one(conn, "SELECT * FROM leads WHERE id=%s", (lead_id,))
    if not lead:
        return
    lead = dict(lead)

    cnpj          = lead.get("cnpj") or ""
    dados_receita = {}
    if cnpj:
        dados_receita = _buscar_cnpj(cnpj)
        time.sleep(1)  # respeita rate limit da ReceitaWS

    porte    = dados_receita.get("porte", "") or ""
    socios   = dados_receita.get("qsa", []) or []
    situacao = dados_receita.get("situacao", "") or ""
    cnpj_ok  = dados_receita.get("cnpj", cnpj) or cnpj

    linkedin_url = _buscar_linkedin(lead.get("nome", ""), lead.get("cidade", ""))
    score_data   = await _gerar_score(lead, dados_receita)

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
    """, (cnpj_ok, porte, json.dumps(socios), situacao, linkedin_url,
          score_data["score_ia"], score_data["score_justificativa"],
          score_data["mensagem_wpp"], lead_id))


async def _gerar_score(lead: dict, dados_receita: dict) -> dict:
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

    user_msg = f"""Empresa: {nome}
Nicho: {nicho}
Cidade: {cidade}
Porte: {porte}
Avaliação Google: {rating}
Tem website: {"Sim" if website else "Não"}
Sócios: {len(socos := socios)} registrado(s)
Situação cadastral: {dados_receita.get("situacao", "Desconhecida")}"""

    try:
        resultado = await chamar_groq(
            system, [{"role": "user", "content": user_msg}],
            GROQ_API_KEY, 0.3, "llama-3.3-70b-versatile")
        resultado = re.sub(r"```json|```", "", resultado).strip()
        dados = json.loads(resultado)
        return {
            "score_ia":            int(dados.get("score", 0)),
            "score_justificativa": dados.get("justificativa", ""),
            "mensagem_wpp":        dados.get("mensagem_wpp", ""),
        }
    except Exception as e:
        print(f"⚠️ Erro ao gerar score: {e}")
        return {"score_ia": 0, "score_justificativa": "Erro ao gerar score.", "mensagem_wpp": ""}


# ── helpers externos ───────────────────────────────────────────────────────────

def _limpar_telefone(raw) -> str:
    if not raw: return ""
    if isinstance(raw, dict):
        raw = raw.get("number") or raw.get("value") or str(raw)
    nums = re.sub(r"\D", "", str(raw))
    if nums.startswith("55") and len(nums) >= 12:
        nums = nums[2:]
    if len(nums) == 11: return f"({nums[:2]}) {nums[2:7]}-{nums[7:]}"
    if len(nums) == 10: return f"({nums[:2]}) {nums[2:6]}-{nums[6:]}"
    return nums


def _extrair_coordenadas(lugar: dict) -> tuple:
    lat = lugar.get("latitude") or lugar.get("lat") or ""
    lng = lugar.get("longitude") or lugar.get("lng") or ""
    if lat and lng: return lat, lng
    for campo in ("coordinates", "position", "location"):
        sub = lugar.get(campo)
        if isinstance(sub, dict):
            lat = sub.get("lat") or sub.get("latitude") or ""
            lng = sub.get("lng") or sub.get("longitude") or ""
            if lat and lng: return lat, lng
    return "", ""


def _geocodificar(lat: str, lng: str) -> dict:
    try:
        r = httpx.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "json", "addressdetails": 1},
            headers={"User-Agent": "speedio-app/1.0"},
            timeout=8,
        )
        if r.status_code == 200:
            addr   = r.json().get("address", {})
            rua    = addr.get("road") or addr.get("pedestrian") or addr.get("street") or ""
            numero = addr.get("house_number", "")
            end_fmt = f"{rua}, {numero}".strip(", ") if rua else ""
            bairro  = (addr.get("suburb") or addr.get("neighbourhood") or
                       addr.get("quarter") or addr.get("district") or
                       addr.get("city_district") or "")
            cidade  = addr.get("city") or addr.get("town") or addr.get("municipality") or ""
            return {"endereco": end_fmt, "bairro": bairro, "cidade": cidade}
    except Exception:
        pass
    return {}


def _extrair_bairro_cidade(endereco: str) -> tuple:
    if not endereco: return "", ""
    limpo  = re.sub(r",?\s*\d{5}-\d{3}", "", endereco)
    limpo  = re.sub(r",?\s*Brasil\s*$", "", limpo, flags=re.IGNORECASE).strip()
    partes = [p.strip() for p in limpo.split(",")]
    bairro, cidade = "", ""
    if len(partes) >= 2:
        ultima = partes[-1]
        cidade = re.split(r"\s*-\s*[A-Z]{2}$", ultima)[0].strip()
        primeira = partes[0]
        if " - " in primeira:
            bairro = primeira.split(" - ", 1)[-1].strip()
        elif len(partes) >= 3:
            bairro = partes[-2].strip()
    return bairro, cidade


def _buscar_maps(query: str) -> list:
    try:
        r = httpx.post(
            "https://google.serper.dev/places",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "gl": "br", "hl": "pt-br"},
            timeout=15,
        )
        lugares = r.json().get("places", []) if r.status_code == 200 else []
        for lugar in lugares:
            if not lugar.get("phoneNumber") and not lugar.get("phone"):
                place_id = lugar.get("placeId") or lugar.get("place_id") or ""
                if place_id:
                    det = _buscar_place_details(place_id)
                    if det.get("phoneNumber"):
                        lugar["phoneNumber"] = det["phoneNumber"]
                    if not lugar.get("website") and det.get("website"):
                        lugar["website"] = det["website"]
        return lugares
    except Exception:
        return []


def _buscar_place_details(place_id: str) -> dict:
    try:
        r = httpx.post(
            "https://google.serper.dev/maps",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": f"place_id:{place_id}", "gl": "br", "hl": "pt-br"},
            timeout=10,
        )
        if r.status_code == 200:
            places = r.json().get("places", [])
            if places:
                return places[0]
    except Exception:
        pass
    return {}


def _buscar_cnpj(cnpj: str) -> dict:
    cnpj_limpo = re.sub(r"\D", "", cnpj)
    if len(cnpj_limpo) != 14:
        return {}
    try:
        r = httpx.get(f"{RECEITAWS_URL}/{cnpj_limpo}", timeout=15)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return {}


def _buscar_linkedin(empresa: str, cidade: str) -> str:
    try:
        r = httpx.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": f"{empresa} {cidade} site:linkedin.com/company", "gl": "br"},
            timeout=10,
        )
        if r.status_code == 200:
            for item in r.json().get("organic", []):
                link = item.get("link", "")
                if "linkedin.com/company" in link:
                    return link
    except Exception:
        pass
    return ""
