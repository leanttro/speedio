# Prospector IA - Leandro Teste

Sistema completo de prospecção e vendas automatizadas via WhatsApp com inteligência artificial.

---

## Sobre o Projeto

O **Prospector IA** é uma plataforma SaaS que automatiza todo o funil de prospecção B2B via WhatsApp. A IA entra em contato com leads, mantém conversas de vendas contextualizadas, executa follow-ups automáticos e enriquece dados de empresas via CNPJ — tudo sem intervenção manual.

Desenvolvido como projeto técnico full-stack, o sistema integra frontend React e backend distribuído em **Google Cloud Functions** (Python 3.11), com PostgreSQL, Redis e Baileys (WhatsApp).

---

## Arquitetura — Migração para Cloud Functions

O backend foi refatorado de um único `app.py` (FastAPI monolítico) para uma arquitetura serverless distribuída no **Google Cloud Functions**. Cada domínio virou uma função independente, com deploy e escalabilidade separados.

```
┌──────────────┐     ┌─────────────────────────────────────────┐
│   Frontend   │────▶│           Google Cloud Functions         │
│   (React)    │     │                                         │
└──────────────┘     │  auth │ contacts │ campaigns │ webhook  │
                     │  conversations │ config │ analytics     │
                     │  followups (Pub/Sub + Cloud Scheduler)  │
                     └──────────────┬──────────────────────────┘
                                    │
                          ┌─────────┼──────────┐
                          ▼         ▼          ▼
                    ┌──────────┐ ┌───────┐ ┌────────┐
                    │PostgreSQL│ │ Groq  │ │Baileys │
                    │(Contabo) │ │  API  │ │  (WA)  │
                    └──────────┘ └───────┘ └────────┘
```

### Por que Cloud Functions?

- **Escalabilidade automática** — cada função escala independentemente
- **Sem servidor para gerenciar** — infraestrutura 100% gerenciada pelo GCP
- **Custo zero em baixo volume** — 2 milhões de invocações/mês no free tier
- **Follow-ups via Pub/Sub + Cloud Scheduler** — substitui o worker em loop infinito por um trigger a cada 15 minutos, muito mais eficiente

### Status do deploy

O código está 100% estruturado e pronto para deploy. O deploy em produção está pendente de ativação do billing no GCP (pré-pagamento reembolsável de R$50). Os comandos de deploy estão documentados nos comentários de cada `main.py`.

---

## Estrutura do Projeto

```
prospector-ia/
├── functions/
│   ├── auth/
│   │   ├── main.py           # POST /register, POST /login, GET /me
│   │   └── requirements.txt
│   ├── contacts/
│   │   ├── main.py           # CRUD contatos + import CSV
│   │   └── requirements.txt
│   ├── campaigns/
│   │   ├── main.py           # CRUD campanhas + enfileiramento Redis
│   │   └── requirements.txt
│   ├── conversations/
│   │   ├── main.py           # Listagem, mensagens, modo IA/manual, envio manual
│   │   └── requirements.txt
│   ├── config/
│   │   ├── main.py           # Configuração IA, chave Groq, status WhatsApp, QR code
│   │   └── requirements.txt
│   ├── analytics/
│   │   ├── main.py           # Métricas totais + histórico diário
│   │   └── requirements.txt
│   ├── webhook/
│   │   ├── main.py           # Coração da IA: recebe mensagem Baileys → chama Groq → responde
│   │   └── requirements.txt
│   ├── followups/
│   │   ├── main.py           # Worker Pub/Sub acionado a cada 15min pelo Cloud Scheduler
│   │   └── requirements.txt
│   └── shared/
│       ├── db.py             # Conexão PostgreSQL (psycopg2)
│       ├── auth.py           # JWT helpers
│       ├── ia.py             # Groq API + fallback de modelos + helpers WhatsApp
│       └── http_helpers.py   # CORS, json_response, error_response, parse_body
├── frontend/                 # React (Dashboard)
├── baileys/                  # Node.js — gateway WhatsApp
├── docker-compose.yml
└── README.md
```

---

## Funcionalidades

### WhatsApp & Conversas
- Conexão com WhatsApp via **Baileys** (webhook bidirecional)
- IA responde mensagens automaticamente dentro do horário configurado
- Alternância entre **Modo IA** e **Modo Manual** por conversa
- Histórico completo de mensagens persistido no banco
- Suporte a mídia (imagens e vídeos) nas mensagens de abertura e fechamento

### Inteligência Artificial (Groq)
- Integração com **Groq API** (LLaMA 3.1, LLaMA 3.3, Gemma2)
- **Fallback automático** entre modelos — se um falhar, tenta o próximo
- Suporte a chave Groq própria por usuário
- Prompt de sistema totalmente customizável (persona, produto, preço, instruções)
- Gatilhos de parada configuráveis
- Delay entre mensagens configurável (simula comportamento humano)

### Campanhas
- Criação de campanhas com lista de contatos
- Disparo automático com velocidade configurável
- **Follow-up automático** via Pub/Sub + Cloud Scheduler
- Fila assíncrona via Redis

### Autenticação & Multi-tenant
- JWT (24h), senhas com bcrypt
- Cada usuário tem seus próprios contatos, campanhas e configurações

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.11, Google Cloud Functions |
| Banco de Dados | PostgreSQL (Contabo/Dokploy), psycopg2 |
| Cache / Fila | Redis |
| Agendamento | Cloud Scheduler + Pub/Sub |
| IA | Groq API (LLaMA 3.1 / 3.3, Gemma2) |
| WhatsApp | Baileys (Node.js) |
| Auth | JWT (PyJWT), bcrypt |
| HTTP Client | httpx (async) |
| Frontend | React |

---

## Próximos Passos

- [ ] Ativar billing no GCP e fazer deploy das 8 functions
- [ ] Configurar variáveis de ambiente no GCP (DATABASE_URL, GROQ_API_KEY, BAILEYS_URL, SECRET_KEY)
- [ ] Criar tópico Pub/Sub `followups-tick` e job no Cloud Scheduler
- [ ] Atualizar URLs da API no frontend React
- [ ] Testar fluxo completo em produção

---

Desenvolvido por **Leandro** como projeto técnico para processo seletivo na **Speedio**.
