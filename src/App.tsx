import { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { Toast } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const CadastroAlunoPage = lazy(() => import('./pages/auth/CadastroAlunoPage').then(m => ({ default: m.CadastroAlunoPage })));
const CompletarCadastroAlunoPage = lazy(() => import('./pages/auth/CompletarCadastroAlunoPage').then(m => ({ default: m.CompletarCadastroAlunoPage })));
const RedefinirSenhaPage = lazy(() => import('./pages/auth/RedefinirSenhaPage').then(m => ({ default: m.RedefinirSenhaPage })));
const AlunoDashboardPage = lazy(() => import('./pages/aluno/AlunoDashboardPage').then(m => ({ default: m.AlunoDashboardPage })));
const CalendarioVagasPage = lazy(() => import('./pages/aluno/CalendarioVagasPage').then(m => ({ default: m.CalendarioVagasPage })));
const GradeSemanalAlunoPage = lazy(() => import('./pages/aluno/GradeSemanalAlunoPage').then(m => ({ default: m.GradeSemanalAlunoPage })));
const MeuHorarioFirmadoPage = lazy(() => import('./pages/aluno/MeuHorarioFirmadoPage').then(m => ({ default: m.MeuHorarioFirmadoPage })));
const RegistroPontoPage = lazy(() => import('./pages/aluno/RegistroPontoPage').then(m => ({ default: m.RegistroPontoPage })));
const EspelhoPontoPage = lazy(() => import('./pages/aluno/EspelhoPontoPage').then(m => ({ default: m.EspelhoPontoPage })));
const GerenciaDashboardPage = lazy(() => import('./pages/gerencia/GerenciaDashboardPage').then(m => ({ default: m.GerenciaDashboardPage })));
const RelatoriosPage = lazy(() => import('./pages/gerencia/RelatoriosPage').then(m => ({ default: m.RelatoriosPage })));
const ConfiguracoesPage = lazy(() => import('./pages/admin/ConfiguracoesPage').then(m => ({ default: m.ConfiguracoesPage })));

const ALUNO_TABS = ['dashboard-aluno', 'calendario-vagas', 'grade-semanal-aluno', 'meu-horario-firmado', 'espelho-ponto', 'registro-ponto'];
const GERENCIA_TABS = ['dashboard-gerencia', 'relatorios'];
const CONFIG_TABS = [
  'gestao-usuarios',
  'config-cursos', 'config-periodos', 'config-turnos', 'config-supervisores',
  'config-horarios', 'config-duracao-atendimento', 'config-vagas-horarios',
  'config-limite-semanal', 'config-datas-vigencia', 'config-tolerancia-atraso', 'config-regras-agendamento',
  'config-feriados', 'config-recessos', 'config-bloqueios',
  'config-grade-semanal',
];
const ADMIN_TABS = ['dashboard-gerencia', ...CONFIG_TABS];

function isTabValidForProfile(tab: string, perfil: string): boolean {
  if (perfil === 'aluno') return ALUNO_TABS.includes(tab);
  if (perfil === 'admin') return ADMIN_TABS.includes(tab);
  return GERENCIA_TABS.includes(tab);
}

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
    <span>Carregando...</span>
  </div>
);

const MainLayout: React.FC = () => {
  const { usuario, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard-gerencia');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [view, setView] = useState<'login' | 'cadastro' | 'completar-cadastro' | 'redefinir-senha' | 'sistema'>('login');

  useEffect(() => {
    if (loading) return;
    if (!usuario) { setView('login'); return; }

    if (usuario.troca_senha_obrigatoria) {
      setView('redefinir-senha');
      return;
    }

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

  if (view === 'login') return <ErrorBoundary fallbackLabel="Login"><Suspense fallback={<PageLoader />}><LoginPage onCadastro={() => setView('cadastro')} /><Toast /></Suspense></ErrorBoundary>;
  if (view === 'cadastro') return <ErrorBoundary fallbackLabel="Cadastro"><Suspense fallback={<PageLoader />}><CadastroAlunoPage onVoltar={() => setView('login')} /><Toast /></Suspense></ErrorBoundary>;
  if (view === 'completar-cadastro') return <ErrorBoundary fallbackLabel="Completar Cadastro"><Suspense fallback={<PageLoader />}><CompletarCadastroAlunoPage /><Toast /></Suspense></ErrorBoundary>;
  if (view === 'redefinir-senha') return <ErrorBoundary fallbackLabel="Redefinir Senha"><Suspense fallback={<PageLoader />}><RedefinirSenhaPage /><Toast /></Suspense></ErrorBoundary>;

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
          <ErrorBoundary fallbackLabel="Pagina">
          <Suspense fallback={<PageLoader />}>
            {activeTab === 'dashboard-aluno' && <AlunoDashboardPage setActiveTab={setActiveTab} />}
            {activeTab === 'calendario-vagas' && <CalendarioVagasPage setActiveTab={setActiveTab} />}
            {activeTab === 'grade-semanal-aluno' && <GradeSemanalAlunoPage setActiveTab={setActiveTab} />}
            {activeTab === 'meu-horario-firmado' && <MeuHorarioFirmadoPage setActiveTab={setActiveTab} />}
            {activeTab === 'espelho-ponto' && <EspelhoPontoPage />}
            {activeTab === 'registro-ponto' && <RegistroPontoPage />}
            {activeTab === 'dashboard-gerencia' && <GerenciaDashboardPage />}
            {activeTab === 'relatorios' && <RelatoriosPage />}
            {activeTab === 'gestao-usuarios' && <ConfiguracoesPage section="gestao-usuarios" />}
            {CONFIG_TABS.filter(t => t.startsWith('config-')).includes(activeTab) && (
              <ConfiguracoesPage section={activeTab} />
            )}
          </Suspense>
          </ErrorBoundary>
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
