import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './dashboard.css';

const NAV_ITEMS = [
  { to: '/dashboard/whatsapp',    label: 'WhatsApp' },
  { to: '/dashboard/config-ia',   label: 'Configurar IA' },
  { to: '/dashboard/chave-ia',    label: 'Chave IA' },
  { to: '/dashboard/busca-leads', label: 'Busca de Leads' },
  { to: '/dashboard/leads',       label: 'Leads' },
  { to: '/dashboard/enricher',    label: 'Enricher' },
  { to: '/dashboard/campanhas',   label: 'Campanhas' },
  { to: '/dashboard/conversas',   label: 'Conversas' },
  { to: '/dashboard/chatbot',     label: 'Chatbot IA' },
  { to: '/dashboard/analytics',   label: 'Analytics' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img
            src="https://speediojobs.vagas.solides.com.br/_next/image?url=https%3A%2F%2Fc5gwmsmjx1.execute-api.us-east-1.amazonaws.com%2Fprod%2Fdados_processo_seletivo%2Flogo_empresa%2F138561%2FIO%20(the%20last%20part%20of%20the%20logo)_AZUL.png&w=828&q=100"
            alt="Logo"
          />
          <div className="sidebar-logo-name">
            <span className="sidebar-logo-highlight">Leanttro Teste Speedio</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <span>{user.nome || user.email || 'Usuário'}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="theme-toggle" onClick={toggleTheme} title="Alternar tema">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={logout}>Sair</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
