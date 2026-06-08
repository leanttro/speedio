import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

const DEFAULT = {
  persona_nome: '', modelo: 'llama-3.1-8b-instant', prompt_sistema: '',
  temperatura: 0.7, produto_nome: '', produto_preco: '', produto_descricao: '',
  midia_abertura_url: '', midia_abertura_tipo: 'imagem', midia_abertura_caption: '',
  midia_fechamento_url: '', midia_fechamento_tipo: 'imagem', midia_fechamento_caption: '',
  gatilhos_parada: '', horario_inicio: '08:00', horario_fim: '18:00',
  delay_mensagens: 3, max_followups: 2, intervalo_followup: 24,
};

export default function ConfigIA() {
  const toast = useToast();
  const [cfg, setCfg] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setCfg(c => ({ ...c, [key]: e.target.value }));
  const setNum = (key) => (e) => setCfg(c => ({ ...c, [key]: parseFloat(e.target.value) }));

  useEffect(() => {
    apiFetch('/ai-config')
      .then(r => r.json())
      .then(d => { if (d && typeof d === 'object') setCfg(c => ({ ...c, ...d })); })
      .catch(() => {});
  }, []);

  async function salvar() {
    setSaving(true);
    try {
      const body = {
        ...cfg,
        temperatura: parseFloat(cfg.temperatura),
        delay_mensagens: parseInt(cfg.delay_mensagens),
        max_followups: parseInt(cfg.max_followups),
        intervalo_followup: parseInt(cfg.intervalo_followup),
      };
      const r = await apiFetch('/ai-config', { method: 'POST', body: JSON.stringify(body) });
      r.ok ? toast('Configurações salvas!') : toast('Erro ao salvar', 'err');
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
          <h2>Configurar IA</h2>
          <p>Persona, produto e comportamento</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={salvar} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      <div className="page-body">
        <div className="config-grid">

          {/* Persona + Modelo */}
          <div className="form-group">
            <label>Nome da persona</label>
            <input type="text" value={cfg.persona_nome} onChange={set('persona_nome')} placeholder="Ex: Ana" />
          </div>
          <div className="form-group">
            <label>Modelo Groq</label>
            <select value={cfg.modelo} onChange={set('modelo')}>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (rápido)</option>
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (mais capaz)</option>
              <option value="gemma2-9b-it">gemma2-9b-it</option>
            </select>
          </div>

          {/* Prompt */}
          <div className="form-group full">
            <label>Prompt do sistema</label>
            <textarea rows={4} value={cfg.prompt_sistema} onChange={set('prompt_sistema')} placeholder="Instruções adicionais para a IA..." />
          </div>

          {/* Temperatura */}
          <div className="form-group full">
            <label>Temperatura: <span>{Number(cfg.temperatura).toFixed(1)}</span></label>
            <div className="range-row">
              <input type="range" min="0" max="1" step="0.1" value={cfg.temperatura} onChange={setNum('temperatura')} />
            </div>
          </div>

          {/* Produto */}
          <div className="full">
            <hr />
            <div className="section-title">Produto</div>
          </div>
          <div className="form-group">
            <label>Nome</label>
            <input type="text" value={cfg.produto_nome} onChange={set('produto_nome')} placeholder="Ex: Software X" />
          </div>
          <div className="form-group">
            <label>Preço</label>
            <input type="text" value={cfg.produto_preco} onChange={set('produto_preco')} placeholder="Ex: R$ 297/mês" />
          </div>
          <div className="form-group full">
            <label>Descrição</label>
            <textarea rows={2} value={cfg.produto_descricao} onChange={set('produto_descricao')} placeholder="Descreva brevemente..." />
          </div>

          {/* Mídia abertura */}
          <div className="full">
            <hr />
            <div className="section-title">Mídia de Abertura</div>
          </div>
          <div className="form-group">
            <label>URL</label>
            <input type="text" value={cfg.midia_abertura_url} onChange={set('midia_abertura_url')} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={cfg.midia_abertura_tipo} onChange={set('midia_abertura_tipo')}>
              <option value="imagem">Imagem</option>
              <option value="video">Vídeo</option>
            </select>
          </div>
          <div className="form-group full">
            <label>Caption</label>
            <input type="text" value={cfg.midia_abertura_caption} onChange={set('midia_abertura_caption')} />
          </div>

          {/* Mídia fechamento */}
          <div className="full">
            <hr />
            <div className="section-title">Mídia de Fechamento</div>
          </div>
          <div className="form-group">
            <label>URL</label>
            <input type="text" value={cfg.midia_fechamento_url} onChange={set('midia_fechamento_url')} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={cfg.midia_fechamento_tipo} onChange={set('midia_fechamento_tipo')}>
              <option value="imagem">Imagem</option>
              <option value="video">Vídeo</option>
            </select>
          </div>
          <div className="form-group full">
            <label>Caption</label>
            <input type="text" value={cfg.midia_fechamento_caption} onChange={set('midia_fechamento_caption')} />
          </div>

          {/* Comportamento */}
          <div className="full">
            <hr />
            <div className="section-title">Comportamento</div>
          </div>
          <div className="form-group full">
            <label>Gatilhos de parada (separados por vírgula)</label>
            <input type="text" value={cfg.gatilhos_parada} onChange={set('gatilhos_parada')} placeholder="não quero, para, chega, remove" />
          </div>
          <div className="form-group">
            <label>Horário início</label>
            <input type="time" value={cfg.horario_inicio} onChange={set('horario_inicio')} />
          </div>
          <div className="form-group">
            <label>Horário fim</label>
            <input type="time" value={cfg.horario_fim} onChange={set('horario_fim')} />
          </div>
          <div className="form-group full">
            <label>Delay entre mensagens: <span>{cfg.delay_mensagens}s</span></label>
            <div className="range-row">
              <input type="range" min="1" max="30" step="1" value={cfg.delay_mensagens} onChange={setNum('delay_mensagens')} />
            </div>
          </div>
          <div className="form-group">
            <label>Máx follow-ups</label>
            <input type="number" value={cfg.max_followups} onChange={setNum('max_followups')} min="0" max="10" />
          </div>
          <div className="form-group">
            <label>Intervalo follow-up (horas)</label>
            <input type="number" value={cfg.intervalo_followup} onChange={setNum('intervalo_followup')} min="1" />
          </div>

        </div>
      </div>
    </div>
  );
}
