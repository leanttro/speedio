import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './hooks/useToast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WhatsApp from './pages/WhatsApp';
import ConfigIA from './pages/ConfigIA';
import ChaveIA from './pages/ChaveIA';
import BuscaLeads from './pages/BuscaLeads';
import Leads from './pages/Leads';
import Enricher from './pages/Enricher';
import Campanhas from './pages/Campanhas';
import Conversas from './pages/Conversas';
import Chatbot from './pages/Chatbot';
import Analytics from './pages/Analytics';

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard/whatsapp" replace />} />
          <Route path="whatsapp"    element={<WhatsApp />} />
          <Route path="config-ia"   element={<ConfigIA />} />
          <Route path="chave-ia"    element={<ChaveIA />} />
          <Route path="busca-leads" element={<BuscaLeads />} />
          <Route path="leads"       element={<Leads />} />
          <Route path="enricher"    element={<Enricher />} />
          <Route path="campanhas"   element={<Campanhas />} />
          <Route path="conversas"   element={<Conversas />} />
          <Route path="chatbot"     element={<Chatbot />} />
          <Route path="analytics"   element={<Analytics />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
