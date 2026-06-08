import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

export default function Campanhas() {
  const toast = useToast();
  const [campanhas, setCampanhas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [nome, setNome] = useState('');
  const [velocidade, setVelocidade] = useState(60);

  async function carregar() {
    try {
      const r = await apiFetch('/campaigns');
      const data = await r.json();
      setCampanhas(Array.isArray(data) ? data : []);
    } catch {}
  }

  useEffect(() => { carregar(); }, []);

  async function abrirModal() {
    try {
      const r = await apiFetch('/contacts');
      const data = await r.json();
      setContacts(Array.isArray(data) ? data : []);
    } catch { setContacts([]); }
    setNome('');
    setVelocidade(60);
    setSelectedIds([]);
    setModalOpen(true);
  }

  async function salvarCampanha() {
    if (!nome.trim()) return toast('Informe o nome', 'err');
    try {
      const r = await apiFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify({ nome: nome.trim(), velocidade: Number(velocidade), contact_ids: selectedIds }),
      });
      if (r.ok) {
        toast('Campanha criada!');
        setModalOpen(false);
        carregar();
      } else {
        toast('Erro ao criar', 'err');
      }
    } catch { toast('Erro de conexão', 'err'); }
  }

  async function statusCampanha(id, status) {
    try {
      const r = await apiFetch(`/campaigns/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      r.ok ? (toast(`Campanha ${status}!`), carregar()) : toast('Erro', 'err');
    } catch { toast('Erro de conexão', 'err'); }
  }

  async function deletarCampanha(id) {
    if (!window.confirm('Deletar esta campanha?')) return;
    try {
      const r = await apiFetch(`/campaigns/${id}`, { method: 'DELETE' });
      r.ok ? (toast('Removida'), carregar()) : toast('Erro', 'err');
    } catch { toast('Erro de conexão', 'err'); }
  }

  function toggleContact(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function closeOnOverlay(e) {
    if (e.target === e.currentTarget) setModalOpen(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="page-header">
        <div>
          <h2>Campanhas</h2>
          <p>{campanhas.length} campanha{campanhas.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={abrirModal}>+ Nova Campanha</button>
      </div>

      <div className="page-body">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Status</th>
                <th>Progresso</th>
                <th>Velocidade</th>
                <th>Ações</th>
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
                      {['rascunho', 'pausada'].includes(c.status) && (
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

      {/* Modal Nova Campanha */}
      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} onClick={closeOnOverlay}>
        <div className="modal">
          <h3>Nova Campanha</h3>
          <div className="form-group">
            <label>Nome</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Prospecção Maio" />
          </div>
          <div className="form-group">
            <label>Velocidade (segundos entre envios)</label>
            <input type="number" value={velocidade} onChange={e => setVelocidade(e.target.value)} min="10" />
          </div>
          <div className="form-group">
            <label>Contatos</label>
            <div className="contact-check-list">
              {contacts.length === 0 ? (
                <div style={{ color: '#888', fontSize: 12, padding: 8 }}>Nenhum contato disponível</div>
              ) : contacts.map(c => (
                <label key={c.id} className="contact-check-item">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleContact(c.id)}
                  />
                  {c.nome} — {c.telefone}{c.empresa ? ` (${c.empresa})` : ''}
                </label>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarCampanha}>Criar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
