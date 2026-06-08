import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

const BAILEYS_URL = 'http://localhost:3001';

function fmtHora(d) {
  return d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
}

export default function Conversas() {
  const toast = useToast();
  const [conversas, setConversas] = useState([]);
  const [currentConv, setCurrentConv] = useState(null); // { id, nome, tel, modo }
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  async function carregarConversas() {
    try {
      const r = await apiFetch('/conversations');
      const data = await r.json();
      setConversas(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function abrirConversa(conv) {
    setCurrentConv(conv);
    try {
      const r = await apiFetch(`/conversations/${conv.id}/messages`);
      const msgs = await r.json();
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch { setMessages([]); }
    carregarConversas();
  }

  async function toggleModo() {
    if (!currentConv) return;
    const novoModo = currentConv.modo === 'ia' ? 'manual' : 'ia';
    try {
      const r = await apiFetch(`/conversations/${currentConv.id}/modo`, {
        method: 'PATCH',
        body: JSON.stringify({ modo: novoModo }),
      });
      if (r.ok) {
        setCurrentConv(c => ({ ...c, modo: novoModo }));
        toast(`Modo: ${novoModo}`);
        carregarConversas();
      }
    } catch { toast('Erro', 'err'); }
  }

  async function enviarMsg() {
    const content = msgInput.trim();
    if (!content || !currentConv) return;
    try {
      const r = await apiFetch('/conversations/send', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: currentConv.id, content }),
      });
      if (r.ok) {
        setMsgInput('');
        const msgs = await (await apiFetch(`/conversations/${currentConv.id}/messages`)).json();
        setMessages(Array.isArray(msgs) ? msgs : []);
      } else {
        toast('Erro ao enviar', 'err');
      }
    } catch { toast('Erro de conexão', 'err'); }
  }

  useEffect(() => {
    carregarConversas();

    const socket = io(BAILEYS_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('nova_mensagem', (data) => {
      setCurrentConv(current => {
        if (current && data.conversation_id === current.id) {
          setMessages(prev => [...prev, data]);
        }
        return current;
      });
      carregarConversas();
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h2>Conversas</h2>
          <p>Gerencie os atendimentos</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={carregarConversas}>↻ Atualizar</button>
      </div>

      <div className="conv-layout">
        {/* Lista esquerda */}
        <div className="conv-list">
          {conversas.length === 0 ? (
            <div className="empty-state">Nenhuma conversa</div>
          ) : conversas.map(c => (
            <div
              key={c.id}
              className={`conv-item${currentConv?.id === c.id ? ' active' : ''}`}
              onClick={() => abrirConversa({ id: c.id, nome: c.contact_nome || c.jid, tel: c.contact_telefone || c.jid, modo: c.modo })}
            >
              <div className="conv-item-meta">
                <span className="conv-item-name">{c.contact_nome || c.jid}</span>
                <span className={`badge badge-${c.modo}`}>{c.modo === 'ia' ? 'IA' : 'Manual'}</span>
              </div>
              <div className="conv-item-preview">{c.contact_telefone || c.jid}</div>
            </div>
          ))}
        </div>

        {/* Chat direito */}
        <div className="conv-main">
          {!currentConv ? (
            <div className="conv-empty">← Selecione uma conversa</div>
          ) : (
            <>
              <div className="conv-header">
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 14 }}>{currentConv.nome}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{currentConv.tel}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge badge-${currentConv.modo}`}>
                    {currentConv.modo === 'ia' ? 'IA' : 'Manual'}
                  </span>
                  <button className="btn btn-sm btn-secondary" onClick={toggleModo}>
                    {currentConv.modo === 'ia' ? 'Assumir' : 'Devolver pra IA'}
                  </button>
                </div>
              </div>

              <div className="messages-area">
                {messages.length === 0 ? (
                  <div style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 20 }}>Sem mensagens</div>
                ) : messages.map((m, i) => (
                  <div key={i} className={`msg-bubble ${m.role}`}>
                    {m.midia_url && (
                      m.midia_tipo === 'video'
                        ? <video src={m.midia_url} controls />
                        : <img src={m.midia_url} alt="imagem" />
                    )}
                    {m.content && <div>{m.content}</div>}
                    <div className="msg-time">{fmtHora(m.timestamp)}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {currentConv.modo === 'manual' && (
                <div className="conv-input-area">
                  <input
                    type="text"
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    onKeyDown={e => { if (e.key === 'Enter') enviarMsg(); }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={enviarMsg}>Enviar</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
