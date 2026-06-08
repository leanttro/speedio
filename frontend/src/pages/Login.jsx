import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  async function fazerLogin() {
    if (!email.trim() || !senha) {
      setError('Preencha todos os campos');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const r = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), senha }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.detail || 'Erro ao entrar');
        return;
      }
      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      navigate('/dashboard');
    } catch {
      setError('Erro de conexão com a API');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') fazerLogin();
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authBox}>
        <div className={styles.logo}>Leanttro WPP</div>

        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.subtitle}>Acesse sua conta</p>

        {error && <div className={styles.alert}>{error}</div>}

        <div className={styles.formGroup}>
          <label>Email</label>
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Senha</label>
          <input
            type="password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button className={styles.btn} onClick={fazerLogin} disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}
