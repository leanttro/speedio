import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';

const BAILEYS_URL = 'http://localhost:3001';

export default function WhatsApp() {
  const toast = useToast();
  const [status, setStatus] = useState({ connected: false, number: '' });
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);

  async function carregarWpp() {
    setLoading(true);
    try {
      const r = await apiFetch('/whatsapp/status');
      const d = await r.json();
      setStatus({ connected: d.connected, number: d.number || '' });
      if (!d.connected) {
        const qrR = await apiFetch('/whatsapp/qrcode');
        const qrD = await qrR.json();
        setQr(qrD.qr || '');
      } else {
        setQr('');
      }
    } catch {
      toast('Erro ao verificar WPP', 'err');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarWpp();

    const socket = io(BAILEYS_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('qr_code', (data) => {
      setQr(data.qr || data);
      setStatus(s => ({ ...s, connected: false }));
    });

    socket.on('connected', (data) => {
      setStatus({ connected: true, number: data?.number || '' });
      setQr('');
    });

    socket.on('disconnected', () => {
      setStatus({ connected: false, number: '' });
    });

    return () => socket.disconnect();
  }, []);

  const badgeClass = `badge badge-${status.connected ? 'conectado' : 'desconectado'}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="page-header">
        <div>
          <h2>WhatsApp</h2>
          <p>Status da conexão</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={carregarWpp} disabled={loading}>
          ↻ Atualizar
        </button>
      </div>

      <div className="page-body">
        <div className="wpp-box">
          <div className="wpp-row">
            <div className={`wpp-dot${status.connected ? ' on' : ''}`} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 'bold' }}>
                {status.connected ? 'Conectado' : 'Desconectado'}
              </div>
              {status.number && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  Número: {status.number}
                </div>
              )}
            </div>
            <span className={badgeClass} style={{ marginLeft: 'auto' }}>
              {status.connected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>

          {!status.connected && (
            <div className="qr-wrap">
              <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
                Escaneie o QR Code com o WhatsApp
              </p>
              {qr ? (
                <img id="qr-img" src={qr} alt="QR Code" />
              ) : (
                <div style={{ color: '#555', fontSize: 13 }}>Aguardando QR Code...</div>
              )}
              <p style={{ fontSize: 11, color: '#555', marginTop: 10 }}>
                Atualize a cada 30s se expirar
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
