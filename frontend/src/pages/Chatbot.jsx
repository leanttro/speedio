import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/api';

function fmtHora(d) {
  return d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
}

function MsgBubble({ msg }) {
  const [open, setOpen] = useState(false);
  const isUser = msg.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 4,
      }}
    >
      <div
        className={`msg-bubble ${isUser ? 'assistant' : 'user'}`}
        style={{ maxWidth: '70%' }}
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        <div className="msg-time">{fmtHora(msg.ts)}</div>
      </div>

      {/* Detalhes colapsáveis só na resposta da IA */}
      {!isUser && (msg.sql || msg.total != null) && (
        <div style={{ maxWidth: '70%', width: '100%' }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {open ? '▾' : '▸'} Detalhes
            {msg.total != null && (
              <span style={{ color: '#555' }}>({msg.total} resultado{msg.total !== 1 ? 's' : ''})</span>
            )}
          </button>

          {open && (
            <div
              style={{
                background: '#0f0f0f',
                border: '1px solid #2e2e2e',
                borderRadius: 6,
                padding: '10px 14px',
                marginTop: 4,
              }}
            >
              {msg.total != null && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: msg.sql ? 8 : 0 }}>
                  Total de resultados: <span style={{ color: '#f0f0f0' }}>{msg.total}</span>
                </div>
              )}
              {msg.sql && (
                <>
                  <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>SQL gerado</div>
                  <pre
                    style={{
                      fontSize: 12,
                      color: '#a855f7',
                      overflowX: 'auto',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >{msg.sql}</pre>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: 'Olá! Sou o assistente de análise do Leanttro. Pergunte-me sobre seus leads, conversas, campanhas ou qualquer dado do sistema.',
      ts: new Date(),
    },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const endRef                = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function enviar() {
    const pergunta = input.trim();
    if (!pergunta || loading) return;

    const userMsg = { role: 'user', content: pergunta, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const r = await apiFetch('/chatbot/query', {
        method: 'POST',
        body: JSON.stringify({ pergunta }),
      });
      const d = await r.json();

      const botMsg = {
        role: 'bot',
        content: d.resposta || d.answer || d.message || 'Sem resposta.',
        sql: d.sql || null,
        total: d.total ?? d.count ?? null,
        ts: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: 'Erro de conexão com a API.', ts: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h2>Chatbot IA</h2>
          <p>Consulte seus dados em linguagem natural</p>
        </div>
      </div>

      {/* Área de mensagens */}
      <div
        className="messages-area"
        style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', gap: 16 }}
      >
        {messages.map((msg, i) => (
          <MsgBubble key={i} msg={msg} />
        ))}

        {loading && (
          <div style={{ alignSelf: 'flex-start' }}>
            <div
              className="msg-bubble user"
              style={{ display: 'flex', gap: 6, alignItems: 'center' }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: '#7c3aed',
                  animation: 'pulse 1s infinite',
                }}
              />
              <span style={{ color: '#888', fontSize: 13 }}>Consultando...</span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div
        className="conv-input-area"
        style={{ padding: '12px 28px', borderTop: '1px solid #2e2e2e', flexShrink: 0 }}
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') enviar(); }}
          placeholder="Ex: Quantos leads temos em São Paulo?"
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={enviar}
          disabled={loading || !input.trim()}
        >
          Enviar
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
