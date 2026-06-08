import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

export default function BuscaLeads() {
  const toast = useToast();
  const [nicho, setNicho] = useState('');
  const [cidade, setCidade] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function buscar() {
    if (!nicho.trim() || !cidade.trim()) {
      toast('Preencha nicho e cidade', 'err');
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const r = await apiFetch('/leads/search', {
        method: 'POST',
        body: JSON.stringify({ nicho: nicho.trim(), cidade: cidade.trim() }),
      });
      const d = await r.json();
      if (r.ok) {
        const msg = `${d.encontrados ?? d.inseridos ?? 0} leads encontrados, ${d.duplicatas ?? 0} duplicatas ignoradas`;
        setResultado({ ok: true, msg });
        toast(msg);
      } else {
        const msg = d.detail || 'Erro ao buscar leads';
        setResultado({ ok: false, msg });
        toast(msg, 'err');
      }
    } catch {
      const msg = 'Erro de conexão com a API';
      setResultado({ ok: false, msg });
      toast(msg, 'err');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') buscar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="page-header">
        <div>
          <h2>Busca de Leads</h2>
          <p>Encontre empresas por nicho e cidade</p>
        </div>
      </div>

      <div className="page-body">
        <div
          className="card"
          style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 0 }}
        >
          <div className="form-group">
            <label>Nicho</label>
            <input
              type="text"
              value={nicho}
              onChange={e => setNicho(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Ex: restaurantes'
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Cidade</label>
            <input
              type="text"
              value={cidade}
              onChange={e => setCidade(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Ex: São Paulo'
              disabled={loading}
            />
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={buscar}
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? 'Buscando...' : '🔍 Buscar'}
          </button>

          {resultado && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 13,
                background: resultado.ok ? '#14532d' : '#450a0a',
                border: `1px solid ${resultado.ok ? '#166534' : '#7f1d1d'}`,
                color: resultado.ok ? '#86efac' : '#fca5a5',
              }}
            >
              {resultado.ok ? '✓ ' : '✕ '}{resultado.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
