import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pendente',         label: 'Pendente' },
  { value: 'enriquecendo',     label: 'Enriquecendo' },
  { value: 'enriquecido',      label: 'Enriquecido' },
  { value: 'score_gerado',     label: 'Score gerado' },
  { value: 'contato_enviado',  label: 'Contato enviado' },
  { value: 'convertido',       label: 'Convertido' },
  { value: 'perdido',          label: 'Perdido' },
  { value: 'erro_enrichment',  label: 'Erro enrichment' },
];

function ScoreBadge({ score }) {
  if (score == null) return <span className="badge" style={{ background: '#2e2e2e', color: '#888' }}>—</span>;
  const s = Number(score);
  let bg, color;
  if (s >= 70)      { bg = '#14532d'; color = '#22c55e'; }
  else if (s >= 40) { bg = '#451a03'; color = '#f59e0b'; }
  else              { bg = '#450a0a'; color = '#ef4444'; }
  return <span className="badge" style={{ background: bg, color }}>{s}</span>;
}

export default function Leads() {
  const toast = useToast();
  const [leads, setLeads]       = useState([]);
  const [cidade, setCidade]     = useState('');
  const [nicho, setNicho]       = useState('');
  const [status, setStatus]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [enriching, setEnriching] = useState(new Set());

  async function carregar() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cidade.trim()) params.set('cidade', cidade.trim());
      if (nicho.trim())  params.set('nicho', nicho.trim());
      if (status)        params.set('status', status);
      const qs = params.toString();
      const r = await apiFetch(`/leads${qs ? `?${qs}` : ''}`);
      const data = await r.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch { toast('Erro ao carregar leads', 'err'); }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); }, []);

  async function enriquecerLead(id) {
    setEnriching(prev => new Set(prev).add(id));
    try {
      const r = await apiFetch(`/enricher/enrich/${id}`, { method: 'POST' });
      r.ok ? toast('Enriquecimento iniciado!') : toast('Erro ao enriquecer', 'err');
      await carregar();
    } catch { toast('Erro de conexão', 'err'); }
    finally { setEnriching(prev => { const s = new Set(prev); s.delete(id); return s; }); }
  }

  async function deletarLead(id) {
    if (!window.confirm('Deletar este lead?')) return;
    try {
      const r = await apiFetch(`/leads/${id}`, { method: 'DELETE' });
      r.ok ? (toast('Lead removido'), carregar()) : toast('Erro ao deletar', 'err');
    } catch { toast('Erro de conexão', 'err'); }
  }

  async function enriquecerTodos() {
    if (!window.confirm('Enriquecer todos os leads pendentes?')) return;
    try {
      const r = await apiFetch('/enricher/enrich-batch', { method: 'POST' });
      r.ok ? (toast('Enriquecimento em lote iniciado!'), carregar()) : toast('Erro', 'err');
    } catch { toast('Erro de conexão', 'err'); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="page-header">
        <div>
          <h2>Leads</h2>
          <p>{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={enriquecerTodos}>⚡ Enriquecer Todos</button>
          <button className="btn btn-secondary btn-sm" onClick={carregar} disabled={loading}>↻ Atualizar</button>
        </div>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={cidade}
            onChange={e => setCidade(e.target.value)}
            placeholder="Cidade"
            style={{ width: 160 }}
            onKeyDown={e => e.key === 'Enter' && carregar()}
          />
          <input
            type="text"
            value={nicho}
            onChange={e => setNicho(e.target.value)}
            placeholder="Nicho"
            style={{ width: 160 }}
            onKeyDown={e => e.key === 'Enter' && carregar()}
          />
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: 180 }}>
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={carregar} disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cidade</th>
                <th>Nicho</th>
                <th>Score</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty-state">Carregando...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">Nenhum lead encontrado</td></tr>
              ) : leads.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 500 }}>{l.nome || '—'}</td>
                  <td style={{ color: '#aaa' }}>{l.cidade || '—'}</td>
                  <td style={{ color: '#aaa' }}>{l.nicho || '—'}</td>
                  <td><ScoreBadge score={l.score} /></td>
                  <td>
                    <span className={`badge badge-${(l.status || 'pendente').replace(/_/g, '-')}`}>
                      {l.status || 'pendente'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => enriquecerLead(l.id)}
                      disabled={enriching.has(l.id)}
                    >
                      {enriching.has(l.id) ? '...' : '⚡ Enriquecer'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => deletarLead(l.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
