import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { Toast } from './components/common/MetricCard';

const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const CadastroAlunoPage = lazy(() => import('./pages/auth/CadastroAlunoPage').then(m => ({ default: m.CadastroAlunoPage })));
const CompletarCadastroAlunoPage = lazy(() => import('./pages/auth/CompletarCadastroAlunoPage').then(m => ({ default: m.CompletarCadastroAlunoPage })));
const AlunoDashboardPage = lazy(() => import('./pages/aluno/AlunoDashboardPage').then(m => ({ default: m.AlunoDashboardPage })));
const CalendarioVagasPage = lazy(() => import('./pages/aluno/CalendarioVagasPage').then(m => ({ default: m.CalendarioVagasPage })));
const MeuHorarioFirmadoPage = lazy(() => import('./pages/aluno/MeuHorarioFirmadoPage').then(m => ({ default: m.MeuHorarioFirmadoPage })));
const RegistroPontoPage = lazy(() => import('./pages/aluno/RegistroPontoPage').then(m => ({ default: m.RegistroPontoPage })));
const EspelhoPontoPage = lazy(() => import('./pages/aluno/EspelhoPontoPage').then(m => ({ default: m.EspelhoPontoPage })));
const GerenciaDashboardPage = lazy(() => import('./pages/gerencia/GerenciaDashboardPage').then(m => ({ default: m.GerenciaDashboardPage })));
const RelatoriosPage = lazy(() => import('./pages/gerencia/RelatoriosPage').then(m => ({ default: m.RelatoriosPage })));
const ConfiguracoesPage = lazy(() => import('./pages/admin/ConfiguracoesPage').then(m => ({ default: m.ConfiguracoesPage })));

const ALUNO_TABS = ['dashboard-aluno', 'calendario-vagas', 'meu-horario-firmado', 'espelho-ponto', 'registro-ponto'];
const GERENCIA_TABS = ['dashboard-gerencia', 'relatorios'];
const ADMIN_TABS = ['dashboard-gerencia', 'admin-configuracoes'];

function isTabValidForProfile(tab, perfil) {
  if (perfil === 'aluno') return ALUNO_TABS.includes(tab);
  if (perfil === 'admin') return ADMIN_TABS.includes(tab);
  return GERENCIA_TABS.includes(tab);
}

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
    <span>Carregando...</span>
  </div>
);

const MainLayout = () => {
  const { usuario, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard-gerencia');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState('login');

  useEffect(() => {
    if (loading) return;
    if (!usuario) { setView('login'); return; }
    if (usuario.perfil === 'aluno' && usuario.primeiroAcesso) { setView('completar-cadastro'); return; }
    const expectedTab = usuario.perfil !== 'aluno' ? 'dashboard-gerencia' : 'dashboard-aluno';
    if (activeTab !== expectedTab && !isTabValidForProfile(activeTab, usuario.perfil)) {
      setActiveTab(expectedTab);
    }
    setView('sistema');
  }, [usuario, loading]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--primary)', color: '#FFF' }}>Carregando Sistema...</div>;
  }

  if (view === 'login') return <Suspense fallback={<PageLoader />}><LoginPage onCadastro={() => setView('cadastro')} /><Toast /></Suspense>;
  if (view === 'cadastro') return <Suspense fallback={<PageLoader />}><CadastroAlunoPage onVoltar={() => setView('login')} /><Toast /></Suspense>;
  if (view === 'completar-cadastro') return <Suspense fallback={<PageLoader />}><CompletarCadastroAlunoPage /><Toast /></Suspense>;

  return (
    <div className="app-wrapper">
      <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="main-layout">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
        />
        <main className="main-content">
          <Suspense fallback={<PageLoader />}>
            {activeTab === 'dashboard-aluno' && <AlunoDashboardPage setActiveTab={setActiveTab} />}
            {activeTab === 'calendario-vagas' && <CalendarioVagasPage setActiveTab={setActiveTab} />}
            {activeTab === 'meu-horario-firmado' && <MeuHorarioFirmadoPage setActiveTab={setActiveTab} />}
            {activeTab === 'espelho-ponto' && <EspelhoPontoPage />}
            {activeTab === 'registro-ponto' && <RegistroPontoPage />}
            {activeTab === 'dashboard-gerencia' && <GerenciaDashboardPage />}
            {activeTab === 'relatorios' && <RelatoriosPage />}
            {activeTab === 'admin-configuracoes' && <ConfiguracoesPage />}
          </Suspense>
        </main>
      </div>
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
