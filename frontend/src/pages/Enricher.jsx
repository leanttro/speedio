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
  return <span className="badge" style={{ background: bg, color }}>{s}</span>;
}

function Truncated({ text, maxLen = 60 }) {
  if (!text) return <span style={{ color: '#555' }}>—</span>;
  if (text.length <= maxLen) return <span>{text}</span>;
  return (
    <span title={text} style={{ cursor: 'help' }}>
      {text.slice(0, maxLen)}…
    </span>
  );
}

export default function Enricher() {
  const toast = useToast();
  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState(null); // { nome, mensagem }

  async function carregar() {
    setLoading(true);
    try {
      const r = await apiFetch('/leads?status=enriquecido&status=score_gerado');
      const data = await r.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch { toast('Erro ao carregar', 'err'); }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); }, []);

  function copiar(texto) {
    navigator.clipboard.writeText(texto || '').then(
      () => toast('Copiado!'),
      () => toast('Erro ao copiar', 'err')
    );
  }

  function fecharModal(e) {
    if (e.target === e.currentTarget) setModal(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="page-header">
        <div>
          <h2>Enricher</h2>
          <p>{leads.length} lead{leads.length !== 1 ? 's' : ''} enriquecido{leads.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={carregar} disabled={loading}>
          ↻ Atualizar
        </button>
      </div>

      <div className="page-body">
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
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
                  <td style={{ color: '#aaa', fontSize: 12, whiteSpace: 'nowrap' }}>{l.cnpj || '—'}</td>
                  <td style={{ color: '#aaa' }}>{l.porte || '—'}</td>
                  <td>
                    {l.linkedin
                      ? <a href={l.linkedin} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>↗ Ver</a>
                      : <span style={{ color: '#555' }}>—</span>
                    }
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {l.socios_count != null
                      ? <span className="badge" style={{ background: '#1e3a5f', color: '#3b82f6' }}>{l.socios_count}</span>
                      : <span style={{ color: '#555' }}>—</span>
                    }
                  </td>
                  <td><ScoreBadge score={l.score} /></td>
                  <td style={{ maxWidth: 200 }}>
                    <Truncated text={l.justificativa} maxLen={60} />
                  </td>
                  <td>
                    {l.mensagem_wpp ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setModal({ nome: l.nome, mensagem: l.mensagem_wpp })}
                      >
                        Ver
                      </button>
                    ) : (
                      <span style={{ color: '#555', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal mensagem WPP */}
      <div className={`modal-overlay${modal ? ' open' : ''}`} onClick={fecharModal}>
        <div className="modal">
          <h3>Mensagem WPP — {modal?.nome}</h3>
          <div
            style={{
              background: '#0f0f0f',
              border: '1px solid #2e2e2e',
              borderRadius: 6,
              padding: '14px 16px',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              maxHeight: 320,
              overflowY: 'auto',
              color: '#f0f0f0',
            }}
          >
            {modal?.mensagem}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Fechar</button>
            <button className="btn btn-primary" onClick={() => copiar(modal?.mensagem)}>
              📋 Copiar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
