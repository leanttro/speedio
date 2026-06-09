import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

function ScoreBadge({ score }) {
  if (score == null) return <span className="badge" style={{ background: '#2e2e2e', color: '#888' }}>—</span>;
  const s = Number(score);
  let bg, color;
  if (s >= 70)      { bg = '#14532d'; color = '#22c55e'; }
  else if (s >= 40) { bg = '#451a03'; color = '#f59e0b'; }
  else              { bg = '#450a0a'; color = '#ef4444'; }
  return <span className="badge" style={{ background: bg, color }}>{s}/100</span>;
}

function Truncated({ text, maxLen = 80 }) {
  if (!text) return <span style={{ color: '#555' }}>—</span>;
  if (text.length <= maxLen) return <span>{text}</span>;
  return <span title={text} style={{ cursor: 'help' }}>{text.slice(0, maxLen)}…</span>;
}

export default function Enricher() {
  const toast = useToast();
  const [leads, setLeads]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [enriching, setEnriching]   = useState({}); // { [id]: true }
  const [batchLoading, setBatch]    = useState(false);
  const [modal, setModal]           = useState(null);
  const [aba, setAba]               = useState('pendentes'); // pendentes | enriquecidos

  async function carregar() {
    setLoading(true);
    try {
      const status = aba === 'pendentes' ? 'pendente' : 'enriquecido';
      const r = await apiFetch(`/leads?status=${status}`);
      const data = await r.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch { toast('Erro ao carregar', 'err'); }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); }, [aba]);

  async function enriquecer(id) {
    setEnriching(e => ({ ...e, [id]: true }));
    try {
      const r = await apiFetch(`/enricher/enrich/${id}`, { method: 'POST' });
      if (r.ok) {
        toast('Lead enriquecido!');
        carregar();
      } else {
        toast('Erro ao enriquecer', 'err');
      }
    } catch { toast('Erro de conexão', 'err'); }
    finally { setEnriching(e => ({ ...e, [id]: false })); }
  }

  async function enriquecerTodos() {
    setBatch(true);
    try {
      const r = await apiFetch('/enricher/enrich-batch', { method: 'POST' });
      const d = await r.json();
      if (r.ok) {
        toast(`${d.processados} leads enriquecidos!`);
        carregar();
      } else {
        toast('Erro ao enriquecer lote', 'err');
      }
    } catch { toast('Erro de conexão', 'err'); }
    finally { setBatch(false); }
  }

  function copiar(texto) {
    navigator.clipboard.writeText(texto || '').then(
      () => toast('Copiado!'),
      () => toast('Erro ao copiar', 'err')
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="page-header">
        <div>
          <h2>Enricher</h2>
          <p>{leads.length} lead{leads.length !== 1 ? 's' : ''} {aba === 'pendentes' ? 'pendentes' : 'enriquecidos'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {aba === 'pendentes' && leads.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={enriquecerTodos} disabled={batchLoading}>
              {batchLoading ? '⏳ Enriquecendo...' : `⚡ Enriquecer todos (${leads.length})`}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={carregar} disabled={loading}>↻ Atualizar</button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid #1e1e1e' }}>
        {['pendentes', 'enriquecidos'].map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: aba === a ? '2px solid #7c3aed' : '2px solid transparent',
              background: 'transparent',
              color: aba === a ? '#a78bfa' : '#666',
              cursor: 'pointer',
              fontWeight: aba === a ? 600 : 400,
              fontSize: 13,
              textTransform: 'capitalize',
            }}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="page-body">
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          {aba === 'pendentes' ? (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cidade</th>
                  <th>Bairro</th>
                  <th>Nicho</th>
                  <th>Telefone</th>
                  <th>Rating</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="empty-state">Carregando...</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">Nenhum lead pendente</td></tr>
                ) : leads.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 500 }}>{l.nome || '—'}</td>
                    <td style={{ color: '#aaa' }}>{l.cidade || '—'}</td>
                    <td style={{ color: '#aaa' }}>{l.bairro || '—'}</td>
                    <td style={{ color: '#aaa' }}>{l.nicho || '—'}</td>
                    <td style={{ color: '#aaa', fontSize: 12 }}>{l.telefone || '—'}</td>
                    <td style={{ color: '#aaa' }}>{l.rating || '—'}</td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => enriquecer(l.id)}
                        disabled={enriching[l.id] || batchLoading}
                      >
                        {enriching[l.id] ? '⏳' : '⚡ Enriquecer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CNPJ</th>
                  <th>Porte</th>
                  <th>LinkedIn</th>
                  <th>Sócios</th>
                  <th>Score IA</th>
                  <th>Justificativa</th>
                  <th>Mensagem WPP</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="empty-state">Carregando...</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">Nenhum lead enriquecido ainda</td></tr>
                ) : leads.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{l.nome || '—'}</td>
                    <td style={{ color: '#aaa', fontSize: 12 }}>{l.cnpj || '—'}</td>
                    <td style={{ color: '#aaa' }}>{l.porte || '—'}</td>
                    <td>
                      {l.linkedin_url
                        ? <a href={l.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>↗ Ver</a>
                        : <span style={{ color: '#555' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {l.socios
                        ? <span className="badge" style={{ background: '#1e3a5f', color: '#3b82f6' }}>
                            {(() => { try { return JSON.parse(l.socios).length; } catch { return '?'; } })()}
                          </span>
                        : <span style={{ color: '#555' }}>—</span>}
                    </td>
                    <td><ScoreBadge score={l.score_ia} /></td>
                    <td style={{ maxWidth: 200 }}>
                      <Truncated text={l.score_justificativa} maxLen={80} />
                    </td>
                    <td>
                      {l.mensagem_wpp ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ nome: l.nome, mensagem: l.mensagem_wpp })}>
                          Ver
                        </button>
                      ) : <span style={{ color: '#555', fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal mensagem WPP */}
      <div className={`modal-overlay${modal ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
        <div className="modal">
          <h3>Mensagem WPP — {modal?.nome}</h3>
          <div style={{
            background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 6,
            padding: '14px 16px', fontSize: 13, lineHeight: 1.6,
            whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto', color: '#f0f0f0',
          }}>
            {modal?.mensagem}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Fechar</button>
            <button className="btn btn-primary" onClick={() => copiar(modal?.mensagem)}>📋 Copiar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
