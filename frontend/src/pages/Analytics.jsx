import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

function fmtData(d) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—';
}

export default function Analytics() {
  const toast = useToast();
  const [totais, setTotais] = useState({});
  const [historico, setHistorico] = useState([]);

  async function carregar() {
    try {
      const r = await apiFetch('/analytics');
      const d = await r.json();
      setTotais(d.totais || {});
      setHistorico(Array.isArray(d.historico) ? d.historico : []);
    } catch { toast('Erro ao carregar analytics', 'err'); }
  }

  useEffect(() => { carregar(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="page-header">
        <div>
          <h2>Analytics</h2>
          <p>Últimos 30 dias</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={carregar}>↻ Atualizar</button>
      </div>

      <div className="page-body">
        <div className="cards-row">
          <div className="card">
            <div className="card-label">Total Contatos</div>
            <div className="card-value">{totais.total_contatos ?? '—'}</div>
          </div>
          <div className="card">
            <div className="card-label">Abordados</div>
            <div className="card-value blue">{totais.abordados ?? '—'}</div>
          </div>
          <div className="card">
            <div className="card-label">Qualificados</div>
            <div className="card-value yellow">{totais.qualificados ?? '—'}</div>
          </div>
          <div className="card">
            <div className="card-label">Convertidos</div>
            <div className="card-value green">{totais.convertidos ?? '—'}</div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Abordados</th>
                <th>Responderam</th>
                <th>Qualificados</th>
                <th>Convertidos</th>
                <th>Enviadas</th>
                <th>Recebidas</th>
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">Sem dados ainda</td></tr>
              ) : historico.map((h, i) => (
                <tr key={i}>
                  <td>{fmtData(h.data)}</td>
                  <td>{h.abordados || 0}</td>
                  <td>{h.responderam || 0}</td>
                  <td>{h.qualificados || 0}</td>
                  <td>{h.convertidos || 0}</td>
                  <td>{h.msgs_enviadas || 0}</td>
                  <td>{h.msgs_recebidas || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
