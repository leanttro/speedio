# Prospector IA - Leandro Teste

Sistema completo de prospecção e vendas automatizadas via WhatsApp com inteligência artificial.

---

## Sobre o Projeto

O **Prospector IA** é uma plataforma SaaS que automatiza todo o funil de prospecção B2B via WhatsApp. A IA entra em contato com leads, mantém conversas de vendas contextualizadas, executa follow-ups automáticos e enriquece dados de empresas via CNPJ — tudo sem intervenção manual.

Desenvolvido como projeto técnico full-stack, o sistema integra backend Python (FastAPI), frontend React e infraestrutura dockerizada com PostgreSQL, Redis e Baileys (WhatsApp).

---

## Funcionalidades

### WhatsApp & Conversas
- Conexão com WhatsApp via **Baileys** (webhook bidirecional)
- IA responde mensagens automaticamente dentro do horário configurado
- Alternância entre **Modo IA** e **Modo Manual** por conversa
- Histórico completo de mensagens persistido no banco
- Suporte a mídia (imagens e vídeos) nas mensagens de abertura e fechamento
- Reconhecimento inteligente de JID (`@s.whatsapp.net` e `@lid`) com normalização de prefixos BR

### Inteligência Artificial (Groq)
- Integração com **Groq API** (LLaMA 3.1, LLaMA 3.3, Gemma2)
- **Fallback automático** entre modelos — se um falhar, tenta o próximo
- Suporte a chave Groq própria por usuário (`usar_ia_propria`)
- Prompt de sistema totalmente customizável por usuário (persona, produto, preço, instruções)
- Gatilhos de parada configuráveis (ex: "não quero", "para", "cancela")
- Horário de funcionamento — IA não responde fora da janela definida
- Delay entre mensagens configurável (simula comportamento humano)

### Campanhas
- Criação de campanhas com lista de contatos
- Disparo automático com velocidade configurável (intervalo em segundos)
- **Follow-up automático** para contatos sem resposta (quantidade e intervalo configuráveis)
- Fila assíncrona via Redis para processamento em background
- Status por campanha: `rascunho → ativa → pausada → concluída`

### Prospecção de Leads
- Busca de empresas no **Google Maps** por nicho e cidade
- Enriquecimento automático via **ReceitaWS** (CNPJ, porte, sócios, situação cadastral)
- **Score de qualificação 0–100** gerado pela IA com justificativa
- Geração de mensagem personalizada de WhatsApp por lead
- Pipeline de status: `pendente → enriquecendo → enriquecido → score_gerado → contato_enviado → convertido/perdido`

### Analytics
- Painel de métricas diárias: mensagens enviadas, recebidas, leads abordados
- Dados por usuário com agregação diária no banco

### Chatbot NL→SQL
- Assistente interno que responde perguntas em linguagem natural
- Classifica automaticamente entre dúvidas sobre o sistema ou consultas de dados
- Gera SQL seguro via IA e executa contra o banco em tempo real
- Proteção contra comandos destrutivos (`DROP`, `DELETE`, `TRUNCATE`, etc.)

### Autenticação & Multi-tenant
- Registro e login com JWT (24h de expiração)
- Senhas com **bcrypt**
- Sistema multi-tenant: cada usuário tem seus próprios contatos, campanhas, conversas e configurações
- Painel admin com listagem e gestão de usuários

---

## Arquitetura

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   FastAPI    │────▶│  PostgreSQL  │
│   (React)    │     │   (app.py)   │     │              │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                  ┌─────────┼──────────┐
                  ▼         ▼          ▼
            ┌─────────┐ ┌───────┐ ┌────────┐
            │  Redis  │ │ Groq  │ │Baileys │
            │  (fila) │ │  API  │ │  (WA)  │
            └─────────┘ └───────┘ └────────┘
```

**Backend:** Python 3.11 + FastAPI (assíncrono), tudo em um único `app.py` (backend + fila + IA unificados)

**Banco de dados:** PostgreSQL com psycopg2

**Fila:** Redis para processamento assíncrono de campanhas

**IA:** Groq API com fallback automático entre modelos LLaMA/Gemma

**WhatsApp:** Baileys (Node.js) comunicando via HTTP com o backend

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.11, FastAPI, Uvicorn |
| Banco de Dados | PostgreSQL, psycopg2 |
| Cache / Fila | Redis |
| IA | Groq API (LLaMA 3.1 / 3.3, Gemma2) |
| WhatsApp | Baileys (Node.js) |
| Auth | JWT (PyJWT), bcrypt |
| HTTP Client | httpx (async) |
| Frontend | React, React Router v6 |
| Deploy | Docker / Docker Compose |

---

## 📡 Principais Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/register` | Cadastro de usuário |
| `POST` | `/login` | Autenticação JWT |
| `GET/POST` | `/ai-config` | Configuração da IA |
| `GET/POST` | `/contacts` | Gestão de contatos |
| `GET/POST` | `/campaigns` | Gestão de campanhas |
| `POST` | `/campaigns/{id}/disparar` | Disparo de campanha |
| `GET` | `/conversations` | Listagem de conversas |
| `POST` | `/webhook/whatsapp` | Webhook de mensagens |
| `POST` | `/leads/buscar` | Busca leads no Maps |
| `POST` | `/enricher/enriquecer/{id}` | Enriquecimento de lead |
| `POST` | `/chatbot/query` | Chatbot NL→SQL |
| `GET` | `/analytics/dashboard` | Métricas do painel |

---

## 🔒 Segurança

- Senhas armazenadas com `bcrypt`
- Autenticação via `Bearer Token` (JWT) em todos os endpoints protegidos
- CORS configurado para origens explícitas
- Credenciais via variáveis de ambiente (sem hardcode)
- Proteção contra SQL injection nas queries parametrizadas
- Chatbot NL→SQL bloqueia comandos destrutivos no nível da aplicação

---

## 📁 Estrutura do Projeto

```
prospector-ia/
├── app.py              # Backend unificado (API + IA + fila)
├── docker-compose.yml  
├── Dockerfile          
├── .env.example        
└── frontend/
    └── src/
        ├── Dashboard.jsx
        └── dashboard.css
```

---


Desenvolvido por **Leandro** como projeto técnico para processo seletivo na **Speedio**.
