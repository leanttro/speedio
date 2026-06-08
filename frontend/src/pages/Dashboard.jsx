import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

const NAV_ITEMS = [
  { to: '/dashboard/whatsapp',    icon: '📱', label: 'WhatsApp' },
  { to: '/dashboard/config-ia',   icon: '🤖', label: 'Configurar IA' },
  { to: '/dashboard/chave-ia',    icon: '🔑', label: 'Chave IA' },
  { to: '/dashboard/busca-leads', icon: '📍', label: 'Busca de Leads' },
  { to: '/dashboard/leads',       icon: '📋', label: 'Leads' },
  { to: '/dashboard/enricher',    icon: '⚡', label: 'Enricher' },
  { to: '/dashboard/campanhas',   icon: '📢', label: 'Campanhas' },
  { to: '/dashboard/conversas',   icon: '💬', label: 'Conversas' },
  { to: '/dashboard/chatbot',     icon: '🧠', label: 'Chatbot IA' },
  { to: '/dashboard/analytics',   icon: '📊', label: 'Analytics' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">Leanttro WPP</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <span>{user.nome || user.email || 'Usuário'}</span>
          <button onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
