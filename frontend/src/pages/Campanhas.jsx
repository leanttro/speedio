import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

export default function Campanhas() {
  const toast = useToast();

  // ── Abas principais ──────────────────────────────────────────
  const [aba, setAba] = useState('campanhas'); // 'campanhas' | 'contatos'

  // ── Campanhas ────────────────────────────────────────────────
  const [campanhas, setCampanhas] = useState([]);

  // ── Contatos ─────────────────────────────────────────────────
  const [contatos, setContatos] = useState([]);
  const [contatoModal, setContatoModal] = useState(false); // abrir modal add/edit contato
  const [contatoEditando, setContatoEditando] = useState(null); // null = novo
  const [cfNome, setCfNome] = useState('');
  const [cfTelefone, setCfTelefone] = useState('');
  const [cfEmpresa, setCfEmpresa] = useState('');
  const [cfCargo, setCfCargo] = useState('');
  const [cfNotas, setCfNotas] = useState('');

  // ── Modal nova campanha ──────────────────────────────────────
  const [campanhaModal, setCampanhaModal] = useState(false);
  const [leads, setLeads] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [selAba, setSelAba] = useState('contatos'); // aba dentro do modal
  const [nome, setNome] = useState('');
  const [velocidade, setVelocidade] = useState(60);

  // ── Carregamentos ────────────────────────────────────────────
  async function carregarCampanhas() {
    try {
      const r = await apiFetch('/campaigns');
      const data = await r.json();
      setCampanhas(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function carregarContatos() {
    try {
      const r = await apiFetch('/contacts');
      const data = await r.json();
      setContatos(Array.isArray(data) ? data : []);
    } catch { setContatos([]); }
  }

  async function carregarLeads() {
    try {
      const r = await apiFetch('/leads');
      const data = await r.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch { setLeads([]); }
  }

  useEffect(() => {
    carregarCampanhas();
    carregarContatos();
  }, []);

  // ── Campanhas — ações ────────────────────────────────────────
  async function abrirModalCampanha() {
    await carregarLeads();
    setNome('');
    setVelocidade(60);
    setSelectedContactIds([]);
    setSelectedLeadIds([]);
    setSelAba('contatos');
    setCampanhaModal(true);
  }

  async function salvarCampanha() {
    if (!nome.trim()) return toast('Informe o nome', 'err');
    if (selectedContactIds.length === 0 && selectedLeadIds.length === 0)
      return toast('Selecione ao menos um contato ou lead', 'err');

    // Converte leads selecionados em contatos e coleta os IDs
    let novosContactIds = [...selectedContactIds];

    for (const leadId of selectedLeadIds) {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) continue;
      try {
        const r = await apiFetch('/contacts', {
          method: 'POST',
          body: JSON.stringify({
            nome: lead.nome,
            telefone: lead.telefone || lead.whatsapp || '',
            empresa: lead.nome,
            cargo: lead.nicho || '',
            notas: `Importado de lead — ${lead.cidade || ''}`,
          }),
        });
        if (r.ok) {
          const c = await r.json();
          novosContactIds.push(c.id);
        }
      } catch {}
    }

    try {
      const r = await apiFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          nome: nome.trim(),
          velocidade: Number(velocidade),
          contact_ids: novosContactIds,
        }),
      });
      if (r.ok) {
        toast('Campanha criada!');
        setCampanhaModal(false);
        carregarCampanhas();
        carregarContatos();
      } else {
        toast('Erro ao criar campanha', 'err');
      }
    } catch { toast('Erro de conexão', 'err'); }
  }

  async function statusCampanha(id, status) {
    try {
      const r = await apiFetch(`/campaigns/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      r.ok ? (toast(`Campanha ${status}!`), carregarCampanhas()) : toast('Erro', 'err');
    } catch { toast('Erro de conexão', 'err'); }
  }

  async function deletarCampanha(id) {
    if (!window.confirm('Deletar esta campanha?')) return;
    try {
      const r = await apiFetch(`/campaigns/${id}`, { method: 'DELETE' });
      r.ok ? (toast('Removida'), carregarCampanhas()) : toast('Erro', 'err');
    } catch { toast('Erro de conexão', 'err'); }
  }

  // ── Contatos — ações ─────────────────────────────────────────
  function abrirNovoContato() {
    setContatoEditando(null);
    setCfNome(''); setCfTelefone(''); setCfEmpresa(''); setCfCargo(''); setCfNotas('');
    setContatoModal(true);
  }

  function abrirEditarContato(c) {
    setContatoEditando(c);
    setCfNome(c.nome || '');
    setCfTelefone(c.telefone || '');
    setCfEmpresa(c.empresa || '');
    setCfCargo(c.cargo || '');
    setCfNotas(c.notas || '');
    setContatoModal(true);
  }

  async function salvarContato() {
    if (!cfNome.trim()) return toast('Informe o nome', 'err');
    if (!cfTelefone.trim()) return toast('Informe o telefone', 'err');
    const body = JSON.stringify({
      nome: cfNome.trim(),
      telefone: cfTelefone.trim(),
      empresa: cfEmpresa.trim() || null,
      cargo: cfCargo.trim() || null,
      notas: cfNotas.trim() || null,
    });
    try {
      const r = contatoEditando
        ? await apiFetch(`/contacts/${contatoEditando.id}`, { method: 'PUT', body })
        : await apiFetch('/contacts', { method: 'POST', body });
      if (r.ok) {
        toast(contatoEditando ? 'Contato atualizado!' : 'Contato adicionado!');
        setContatoModal(false);
        carregarContatos();
      } else {
        toast('Erro ao salvar', 'err');
      }
    } catch { toast('Erro de conexão', 'err'); }
  }

  async function deletarContato(id) {
    if (!window.confirm('Deletar este contato?')) return;
    try {
      const r = await apiFetch(`/contacts/${id}`, { method: 'DELETE' });
      r.ok ? (toast('Contato removido'), carregarContatos()) : toast('Erro', 'err');
    } catch { toast('Erro de conexão', 'err'); }
  }

  // ── Seleção no modal campanha ────────────────────────────────
  function toggleContact(id) {
    setSelectedContactIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleLead(id) {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function closeOnOverlay(e) {
    if (e.target === e.currentTarget) {
      setCampanhaModal(false);
      setContatoModal(false);
    }
  }

  const totalSelecionados = selectedContactIds.length + selectedLeadIds.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h2>{aba === 'campanhas' ? 'Campanhas' : 'Contatos'}</h2>
          <p>
            {aba === 'campanhas'
              ? `${campanhas.length} campanha${campanhas.length !== 1 ? 's' : ''}`
              : `${contatos.length} contato${contatos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {aba === 'campanhas' && (
            <button className="btn btn-primary btn-sm" onClick={abrirModalCampanha}>+ Nova Campanha</button>
          )}
          {aba === 'contatos' && (
            <button className="btn btn-primary btn-sm" onClick={abrirNovoContato}>+ Novo Contato</button>
          )}
        </div>
      </div>

      {/* ── Abas principais ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #2a2a2a', padding: '0 24px' }}>
        {['campanhas', 'contatos'].map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 18px', fontSize: 14, fontWeight: 500,
              color: aba === a ? '#a855f7' : '#888',
              borderBottom: aba === a ? '2px solid #a855f7' : '2px solid transparent',
              marginBottom: -1, transition: 'color .2s',
              textTransform: 'capitalize',
            }}
          >
            {a === 'campanhas' ? 'Campanhas' : 'Contatos'}
          </button>
        ))}
      </div>

      {/* ── Aba Campanhas ── */}
      {aba === 'campanhas' && (
        <div className="page-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th><th>Status</th><th>Progresso</th><th>Velocidade</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">Nenhuma campanha</td></tr>
                ) : campanhas.map(c => {
                  const pct = c.total_contatos ? Math.round((c.enviados || 0) / c.total_contatos * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td>{c.nome}</td>
                      <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#888' }}>{c.enviados || 0}/{c.total_contatos || 0}</span>
                        </div>
                      </td>
                      <td style={{ color: '#888' }}>{c.velocidade}s</td>
                      <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {['rascunho', 'pausada', 'pendente'].includes(c.status) && (
                          <button className="btn btn-success btn-sm" onClick={() => statusCampanha(c.id, 'ativa')}>▶ Ativar</button>
                        )}
                        {c.status === 'ativa' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => statusCampanha(c.id, 'pausada')}>⏸ Pausar</button>
                        )}
                        {c.status !== 'concluida' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => statusCampanha(c.id, 'concluida')}>■ Encerrar</button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => deletarCampanha(c.id)}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Aba Contatos ── */}
      {aba === 'contatos' && (
        <div className="page-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th><th>Telefone</th><th>Empresa</th><th>Cargo</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contatos.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">Nenhum contato. Clique em "+ Novo Contato" para adicionar.</td></tr>
                ) : contatos.map(c => (
                  <tr key={c.id}>
                    <td>{c.nome}</td>
                    <td style={{ color: '#4ade80' }}>{c.telefone || '—'}</td>
                    <td style={{ color: '#888' }}>{c.empresa || '—'}</td>
                    <td style={{ color: '#888' }}>{c.cargo || '—'}</td>
                    <td><span className={`badge badge-${c.status || 'pendente'}`}>{c.status || 'pendente'}</span></td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirEditarContato(c)}>✏ Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deletarContato(c.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Nova Campanha ── */}
      {campanhaModal && (
        <div className="modal-overlay open" onClick={closeOnOverlay}>
          <div className="modal" style={{ maxWidth: 520, width: '100%' }}>
            <h3>Nova Campanha</h3>

            <div className="form-group">
              <label>Nome</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Prospecção Junho" />
            </div>
            <div className="form-group">
              <label>Velocidade (segundos entre envios)</label>
              <input type="number" value={velocidade} onChange={e => setVelocidade(e.target.value)} min="10" />
            </div>

            {/* Abas contatos / leads */}
            <div className="form-group">
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #2a2a2a', marginBottom: 10 }}>
                {[
                  { key: 'contatos', label: `Contatos${selectedContactIds.length ? ` (${selectedContactIds.length})` : ''}` },
                  { key: 'leads',    label: `Leads${selectedLeadIds.length ? ` (${selectedLeadIds.length})` : ''}` },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelAba(key)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '8px 16px', fontSize: 13, fontWeight: 500,
                      color: selAba === key ? '#a855f7' : '#888',
                      borderBottom: selAba === key ? '2px solid #a855f7' : '2px solid transparent',
                      marginBottom: -1,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="contact-check-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {selAba === 'contatos' && (
                  contatos.length === 0
                    ? <div style={{ color: '#888', fontSize: 12, padding: 8 }}>
                        Nenhum contato. Vá na aba Contatos e adicione.
                      </div>
                    : contatos.map(c => (
                        <label key={c.id} className="contact-check-item">
                          <input
                            type="checkbox"
                            checked={selectedContactIds.includes(c.id)}
                            onChange={() => toggleContact(c.id)}
                          />
                          <span>
                            <strong>{c.nome}</strong>
                            {c.telefone && <span style={{ color: '#4ade80', marginLeft: 6 }}>{c.telefone}</span>}
                            {c.empresa && <span style={{ color: '#888', marginLeft: 6 }}>({c.empresa})</span>}
                          </span>
                        </label>
                      ))
                )}

                {selAba === 'leads' && (
                  leads.length === 0
                    ? <div style={{ color: '#888', fontSize: 12, padding: 8 }}>
                        Nenhum lead encontrado. Use a Busca de Leads primeiro.
                      </div>
                    : leads.map(l => (
                        <label key={l.id} className="contact-check-item" style={{
                          opacity: !l.telefone && !l.whatsapp ? 0.45 : 1,
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(l.id)}
                            onChange={() => toggleLead(l.id)}
                            disabled={!l.telefone && !l.whatsapp}
                          />
                          <span>
                            <strong>{l.nome}</strong>
                            {(l.telefone || l.whatsapp) && (
                              <span style={{ color: '#4ade80', marginLeft: 6 }}>{l.telefone || l.whatsapp}</span>
                            )}
                            {l.cidade && <span style={{ color: '#888', marginLeft: 6 }}>{l.cidade}</span>}
                            {!l.telefone && !l.whatsapp && (
                              <span style={{ color: '#f87171', marginLeft: 6, fontSize: 11 }}>sem telefone</span>
                            )}
                          </span>
                        </label>
                      ))
                )}
              </div>

              {totalSelecionados > 0 && (
                <div style={{ fontSize: 12, color: '#a855f7', marginTop: 6 }}>
                  {totalSelecionados} selecionado{totalSelecionados !== 1 ? 's' : ''}
                  {selectedLeadIds.length > 0 && (
                    <span style={{ color: '#888', marginLeft: 4 }}>
                      (leads serão convertidos em contatos automaticamente)
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCampanhaModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarCampanha}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Contato (add/edit) ── */}
      {contatoModal && (
        <div className="modal-overlay open" onClick={closeOnOverlay}>
          <div className="modal" style={{ maxWidth: 460, width: '100%' }}>
            <h3>{contatoEditando ? 'Editar Contato' : 'Novo Contato'}</h3>

            <div className="form-group">
              <label>Nome *</label>
              <input type="text" value={cfNome} onChange={e => setCfNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="form-group">
              <label>Telefone / WhatsApp *</label>
              <input type="text" value={cfTelefone} onChange={e => setCfTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="form-group">
              <label>Empresa</label>
              <input type="text" value={cfEmpresa} onChange={e => setCfEmpresa(e.target.value)} placeholder="Nome da empresa" />
            </div>
            <div className="form-group">
              <label>Cargo</label>
              <input type="text" value={cfCargo} onChange={e => setCfCargo(e.target.value)} placeholder="Ex: Gerente, Dono..." />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={cfNotas}
                onChange={e => setCfNotas(e.target.value)}
                placeholder="Observações sobre o contato..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setContatoModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarContato}>
                {contatoEditando ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
