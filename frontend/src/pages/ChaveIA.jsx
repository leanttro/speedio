import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

export default function ChaveIA() {
  const toast = useToast();
  const [usarPropria, setUsarPropria] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/auth/me')
      .then(r => r.json())
      .then(d => {
        setUsarPropria(!!d.usar_ia_propria);
        setGroqKey(d.groq_key || '');
      })
      .catch(() => {});
  }, []);

  async function salvar() {
    setSaving(true);
    try {
      const r = await apiFetch('/config/groq', {
        method: 'PUT',
        body: JSON.stringify({ usar_ia_propria: usarPropria, groq_key: groqKey.trim() || null }),
      });
      r.ok ? toast('Chave salva!') : toast('Erro ao salvar', 'err');
    } catch {
      toast('Erro de conexão', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="page-header">
        <div>
          <h2>Chave IA</h2>
          <p>Configure sua chave Groq</p>
        </div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 460 }}>
          <div className="toggle-row">
            <input
              type="checkbox"
              id="usar-propria"
              checked={usarPropria}
              onChange={e => setUsarPropria(e.target.checked)}
            />
            <label htmlFor="usar-propria">
              Usar minha chave Groq (ao invés da chave do plano)
            </label>
          </div>

          {usarPropria && (
            <div className="form-group">
              <label>Chave Groq</label>
              <input
                type="text"
                value={groqKey}
                onChange={e => setGroqKey(e.target.value)}
                placeholder="gsk_..."
              />
            </div>
          )}

          <button className="btn btn-primary" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
