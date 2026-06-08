import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../lib/api';

/* ─── CSS injetado uma vez ─────────────────────────────────────────── */
const CSS = `
  .adm-root {
    --bg:      #0f0f13;
    --bg2:     #18181f;
    --bg3:     #22222c;
    --accent:  #7c3aed;
    --danger:  #ef4444;
    --success: #22c55e;
    --warn:    #f59e0b;
    --text:    #e2e8f0;
    --muted:   #64748b;
    --border:  #2d2d3a;
    --radius:  10px;
    box-sizing: border-box;
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }
  .adm-root *, .adm-root *::before, .adm-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* LOGIN */
  .adm-login { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .adm-login-box {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 40px; width: 360px;
  }
  .adm-login-box h1 { font-size: 1.4rem; margin-bottom: 8px; }
  .adm-login-box > p { color: var(--muted); font-size: .9rem; margin-bottom: 28px; }
  .adm-login-err { color: var(--danger); font-size: .82rem; margin-top: 10px; }

  /* HEADER */
  .adm-header {
    background: var(--bg2); border-bottom: 1px solid var(--border);
    padding: 16px 28px; display: flex; align-items: center; justify-content: space-between;
  }
  .adm-header h1 { font-size: 1.1rem; display: flex; align-items: center; gap: 10px; }

  /* CONTAINER */
  .adm-container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }

  /* STATS */
  .adm-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .adm-stat-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px; text-align: center;
  }
  .adm-stat-card .num { font-size: 2rem; font-weight: 700; color: var(--accent); }
  .adm-stat-card .num.green { color: var(--success); }
  .adm-stat-card .num.red   { color: var(--danger); }
  .adm-stat-card .lbl { font-size: .8rem; color: var(--muted); margin-top: 4px; }

  /* SECTION */
  .adm-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .adm-section-header h2 { font-size: 1.1rem; }

  /* FORM */
  .adm-form-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
  .adm-form-group { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 140px; }
  .adm-form-group label { font-size: .8rem; color: var(--muted); }

  .adm-root input, .adm-root select {
    background: var(--bg3); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); padding: 9px 12px; font-size: .9rem; outline: none;
    transition: border .2s; width: 100%;
  }
  .adm-root input:focus, .adm-root select:focus { border-color: var(--accent); }

  /* BUTTONS */
  .adm-btn {
    padding: 9px 18px; border-radius: 8px; border: none; font-size: .875rem;
    font-weight: 600; cursor: pointer; transition: opacity .15s, transform .1s;
  }
  .adm-btn:hover { opacity: .88; }
  .adm-btn:active { transform: scale(.97); }
  .adm-btn:disabled { opacity: .5; cursor: not-allowed; }
  .adm-btn-primary { background: var(--accent); color: #fff; }
  .adm-btn-danger  { background: var(--danger);  color: #fff; }
  .adm-btn-success { background: var(--success); color: #000; }
  .adm-btn-warn    { background: var(--warn);    color: #000; }
  .adm-btn-ghost   { background: var(--bg3); color: var(--text); border: 1px solid var(--border); }
  .adm-btn-sm { padding: 5px 11px; font-size: .78rem; }
  .adm-btn-full { width: 100%; margin-top: 8px; }

  /* TABLE */
  .adm-table-wrap { overflow-x: auto; }
  .adm-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
  .adm-table thead th {
    text-align: left; padding: 10px 14px; color: var(--muted);
    font-size: .75rem; text-transform: uppercase; letter-spacing: .05em;
    border-bottom: 1px solid var(--border);
  }
  .adm-table tbody tr { border-bottom: 1px solid var(--border); transition: background .15s; }
  .adm-table tbody tr:hover { background: var(--bg3); }
  .adm-table tbody td { padding: 12px 14px; vertical-align: middle; }
  .adm-empty { color: var(--muted); text-align: center; padding: 24px; }

  /* BADGES */
  .adm-badge { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: .72rem; font-weight: 600; }
  .adm-badge-green  { background: #14532d; color: #86efac; }
  .adm-badge-red    { background: #450a0a; color: #fca5a5; }
  .adm-badge-purple { background: #3b0764; color: #d8b4fe; }

  /* CARD */
  .adm-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 24px; margin-bottom: 28px;
  }

  /* TOAST */
  .adm-toast {
    position: fixed; bottom: 24px; right: 24px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 10px; padding: 13px 20px; font-size: .875rem;
    opacity: 0; transform: translateY(8px);
    transition: all .3s; pointer-events: none; z-index: 999;
    max-width: 320px;
  }
  .adm-toast.show { opacity: 1; transform: translateY(0); }
  .adm-toast.ok   { border-color: var(--success); color: var(--success); }
  .adm-toast.err  { border-color: var(--danger);  color: var(--danger); }

  /* MODAL */
  .adm-modal-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,.65); z-index: 100;
    align-items: center; justify-content: center;
  }
  .adm-modal-overlay.open { display: flex; }
  .adm-modal {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 28px; width: 420px; max-width: 95vw;
  }
  .adm-modal h3 { margin-bottom: 20px; }
  .adm-modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
`;

function injectStyles() {
  if (document.getElementById('adm-styles')) return;
  const el = document.createElement('style');
  el.id = 'adm-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/* ─── Component ────────────────────────────────────────────────────── */
export default function Admin() {
  useEffect(() => { injectStyles(); }, []);

  const [authed, setAuthed]         = useState(!!sessionStorage.getItem('admin_token'));
  const [tokenInput, setTokenInput] = useState('');
  const [loginErr, setLoginErr]     = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [users, setUsers]   = useState([]);
  const [planos, setPlanos] = useState(['Free']);
  const [stats, setStats]   = useState({ total: '—', ativos: '—', inativos: '—' });

  // Criar usuário
  const [newNome,  setNewNome]  = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSenha, setNewSenha] = useState('');
  const [newPlano, setNewPlano] = useState('Free');

  // Modal plano
  const [modalOpen,   setModalOpen]   = useState(false);
  const [modalUserId, setModalUserId] = useState(null);
  const [modalPlano,  setModalPlano]  = useState('Free');

  // Toast
  const [toast, setToast] = useState({ msg: '', type: 'ok', visible: false });
  const toastTimer = useState(null);

  function showToast(msg, type = 'ok') {
    setToast({ msg, type, visible: true });
    clearTimeout(toastTimer[0]);
    toastTimer[0] = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }

  /* ── API helper (admin usa query param x_admin_token) ── */
  const adminFetch = useCallback(async (path, opts = {}) => {
    const token = sessionStorage.getItem('admin_token');
    const sep = path.includes('?') ? '&' : '?';
    const url = `${API_URL}${path}${sep}x_admin_token=${encodeURIComponent(token || '')}`;
    const r = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || r.status);
    }
    return r.json();
  }, []);

  /* ── Login ── */
  async function fazerLogin() {
    const t = tokenInput.trim();
    if (!t) return;
    setLoginLoading(true);
    setLoginErr(false);
    try {
      const sep = `/admin/usuarios?x_admin_token=${encodeURIComponent(t)}`;
      const r = await fetch(`${API_URL}${sep}`);
      if (!r.ok) throw new Error();
      sessionStorage.setItem('admin_token', t);
      setAuthed(true);
    } catch {
      setLoginErr(true);
    } finally {
      setLoginLoading(false);
    }
  }

  function sair() {
    sessionStorage.removeItem('admin_token');
    setAuthed(false);
    setTokenInput('');
  }

  /* ── Load data on auth ── */
  const carregarPlanos = useCallback(async () => {
    try {
      const data = await adminFetch('/admin/planos');
      if (Array.isArray(data)) {
        const nomes = data.map(p => p.nome);
        setPlanos(nomes);
        if (nomes.length) setNewPlano(nomes[0]);
      }
    } catch {}
  }, [adminFetch]);

  const carregarUsuarios = useCallback(async () => {
    try {
      const data = await adminFetch('/admin/usuarios');
      setUsers(Array.isArray(data) ? data : []);
      setStats({
        total:    data.length,
        ativos:   data.filter(u => u.ativo).length,
        inativos: data.filter(u => !u.ativo).length,
      });
    } catch (e) {
      showToast('Erro ao carregar usuários: ' + e.message, 'err');
    }
  }, [adminFetch]);

  useEffect(() => {
    if (authed) {
      carregarPlanos();
      carregarUsuarios();
    }
  }, [authed, carregarPlanos, carregarUsuarios]);

  /* ── Criar usuário ── */
  async function criarUsuario() {
    if (!newNome || !newEmail || !newSenha) {
      showToast('Preencha todos os campos', 'err');
      return;
    }
    try {
      await adminFetch('/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify({ nome: newNome, email: newEmail, senha: newSenha, plano_nome: newPlano }),
      });
      setNewNome(''); setNewEmail(''); setNewSenha('');
      showToast('Usuário criado com sucesso!');
      carregarUsuarios();
    } catch (e) {
      showToast('Erro: ' + e.message, 'err');
    }
  }

  /* ── Toggle ativo ── */
  async function toggleAtivo(id, ativoAtual) {
    try {
      await adminFetch(`/admin/usuarios/${id}/ativo`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: !ativoAtual }),
      });
      showToast(ativoAtual ? 'Usuário desativado' : 'Usuário ativado');
      carregarUsuarios();
    } catch (e) {
      showToast('Erro: ' + e.message, 'err');
    }
  }

  /* ── Modal plano ── */
  function abrirModalPlano(id, planoAtual) {
    setModalUserId(id);
    setModalPlano(planoAtual || planos[0] || 'Free');
    setModalOpen(true);
  }

  async function confirmarTrocarPlano() {
    try {
      await adminFetch(`/admin/usuarios/${modalUserId}/plano`, {
        method: 'PATCH',
        body: JSON.stringify({ plano_nome: modalPlano }),
      });
      setModalOpen(false);
      showToast('Plano atualizado!');
      carregarUsuarios();
    } catch (e) {
      showToast('Erro: ' + e.message, 'err');
    }
  }

  /* ── Deletar ── */
  async function deletarUsuario(id, nome) {
    if (!window.confirm(`Excluir permanentemente o usuário "${nome}"?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
      await adminFetch(`/admin/usuarios/${id}`, { method: 'DELETE' });
      showToast('Usuário excluído');
      carregarUsuarios();
    } catch (e) {
      showToast('Erro: ' + e.message, 'err');
    }
  }

  /* ─── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div className="adm-root">

      {/* ── LOGIN ── */}
      {!authed && (
        <div className="adm-login">
          <div className="adm-login-box">
            <h1>🛡️ Painel Admin</h1>
            <p>Acesso restrito — somente administradores</p>
            <div className="adm-form-group" style={{ marginBottom: 12 }}>
              <label>Token de Admin</label>
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fazerLogin()}
                placeholder="Cole o ADMIN_TOKEN aqui"
                autoFocus
              />
            </div>
            <button
              className="adm-btn adm-btn-primary adm-btn-full"
              onClick={fazerLogin}
              disabled={loginLoading}
            >
              {loginLoading ? 'Verificando...' : 'Entrar'}
            </button>
            {loginErr && (
              <p className="adm-login-err">Token inválido ou erro de conexão.</p>
            )}
          </div>
        </div>
      )}

      {/* ── PAINEL ── */}
      {authed && (
        <>
          <header className="adm-header">
            <h1><span>🛡️</span> Admin — Leanttro WPP</h1>
            <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={sair}>Sair</button>
          </header>

          <div className="adm-container">

            {/* Stats */}
            <div className="adm-stats">
              <div className="adm-stat-card">
                <div className="num">{stats.total}</div>
                <div className="lbl">Usuários Total</div>
              </div>
              <div className="adm-stat-card">
                <div className="num green">{stats.ativos}</div>
                <div className="lbl">Ativos</div>
              </div>
              <div className="adm-stat-card">
                <div className="num red">{stats.inativos}</div>
                <div className="lbl">Inativos</div>
              </div>
            </div>

            {/* Criar usuário */}
            <div className="adm-card">
              <div className="adm-section-header">
                <h2>➕ Criar Usuário</h2>
              </div>
              <div className="adm-form-row">
                <div className="adm-form-group">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={newNome}
                    onChange={e => setNewNome(e.target.value)}
                    placeholder="João Silva"
                  />
                </div>
                <div className="adm-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="joao@email.com"
                  />
                </div>
                <div className="adm-form-group">
                  <label>Senha</label>
                  <input
                    type="password"
                    value={newSenha}
                    onChange={e => setNewSenha(e.target.value)}
                    placeholder="Senha forte"
                  />
                </div>
                <div className="adm-form-group" style={{ maxWidth: 140 }}>
                  <label>Plano</label>
                  <select value={newPlano} onChange={e => setNewPlano(e.target.value)}>
                    {planos.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="adm-form-group" style={{ maxWidth: 110, justifyContent: 'flex-end' }}>
                  <button className="adm-btn adm-btn-primary" onClick={criarUsuario}>Criar</button>
                </div>
              </div>
            </div>

            {/* Lista usuários */}
            <div className="adm-card">
              <div className="adm-section-header">
                <h2>👥 Usuários</h2>
                <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={carregarUsuarios}>
                  ↻ Atualizar
                </button>
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Plano</th>
                      <th>Status</th>
                      <th>Criado em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="adm-empty">Nenhum usuário ainda</td>
                      </tr>
                    ) : users.map(u => (
                      <tr key={u.id}>
                        <td style={{ color: 'var(--muted)' }}>{u.id}</td>
                        <td><strong>{u.nome}</strong></td>
                        <td style={{ color: 'var(--muted)' }}>{u.email}</td>
                        <td>
                          <span className="adm-badge adm-badge-purple">
                            {u.plano_nome || '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`adm-badge ${u.ativo ? 'adm-badge-green' : 'adm-badge-red'}`}>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: '.8rem' }}>
                          {formatDate(u.criado_em)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              className={`adm-btn adm-btn-sm ${u.ativo ? 'adm-btn-warn' : 'adm-btn-success'}`}
                              onClick={() => toggleAtivo(u.id, u.ativo)}
                            >
                              {u.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                            <button
                              className="adm-btn adm-btn-sm adm-btn-ghost"
                              onClick={() => abrirModalPlano(u.id, u.plano_nome)}
                            >
                              Plano
                            </button>
                            <button
                              className="adm-btn adm-btn-sm adm-btn-danger"
                              onClick={() => deletarUsuario(u.id, u.nome)}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}

      {/* ── MODAL TROCAR PLANO ── */}
      <div
        className={`adm-modal-overlay${modalOpen ? ' open' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
      >
        <div className="adm-modal">
          <h3>Trocar Plano</h3>
          <div className="adm-form-group">
            <label>Novo Plano</label>
            <select value={modalPlano} onChange={e => setModalPlano(e.target.value)}>
              {planos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="adm-modal-actions">
            <button className="adm-btn adm-btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="adm-btn adm-btn-primary" onClick={confirmarTrocarPlano}>Salvar</button>
          </div>
        </div>
      </div>

      {/* ── TOAST ── */}
      <div className={`adm-toast${toast.visible ? ' show' : ''} ${toast.type}`}>
        {toast.msg}
      </div>

    </div>
  );
}
