import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Calendar, FileText, Clock, BarChart3, Settings, FileCheck } from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) => {
  const { usuario } = useAuth();
  if (!usuario) return null;

  const isAluno = usuario.perfil === 'aluno';
  const isAdmin = usuario.perfil === 'admin';
  const isGerencia = usuario.perfil === 'gerencia';
  const isStaff = isAdmin || isGerencia;

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (setSidebarOpen) {
      setSidebarOpen(false); // Fecha o menu no mobile ao clicar
    }
  };

  return (
    <>
      {/* Overlay para fechar sidebar no mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {isAluno && (
          <>
            <div className="nav-section-title">Portal do Aluno</div>
            <button
              onClick={() => handleSelectTab('dashboard-aluno')}
              className={`nav-item ${activeTab === 'dashboard-aluno' ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} /> Meu Dashboard
            </button>
            <button
              onClick={() => handleSelectTab('calendario-vagas')}
              className={`nav-item ${activeTab === 'calendario-vagas' ? 'active' : ''}`}
            >
              <Calendar size={18} /> Calendário de Vagas
            </button>
            <button
              onClick={() => handleSelectTab('meu-horario-firmado')}
              className={`nav-item ${activeTab === 'meu-horario-firmado' ? 'active' : ''}`}
            >
              <FileText size={18} /> Meu Horário Firmado
            </button>
            <button
              onClick={() => handleSelectTab('espelho-ponto')}
              className={`nav-item ${activeTab === 'espelho-ponto' ? 'active' : ''}`}
            >
              <FileCheck size={18} /> Espelho de Ponto
            </button>
            <button
              onClick={() => handleSelectTab('registro-ponto')}
              className={`nav-item ${activeTab === 'registro-ponto' ? 'active' : ''}`}
            >
              <Clock size={18} /> Registrar Ponto
            </button>
          </>
        )}

        {isStaff && (
          <>
            <div className="nav-section-title">Painel Admin</div>
            <button
              onClick={() => handleSelectTab('dashboard-gerencia')}
              className={`nav-item ${activeTab === 'dashboard-gerencia' ? 'active' : ''}`}
            >
              <BarChart3 size={18} /> Monitor ao Vivo
            </button>
            {isGerencia && (
              <button
                onClick={() => handleSelectTab('relatorios')}
                className={`nav-item ${activeTab === 'relatorios' ? 'active' : ''}`}
              >
                <FileText size={18} /> Relatórios Gerenciais
              </button>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => handleSelectTab('admin-configuracoes')}
                  className={`nav-item ${activeTab === 'admin-configuracoes' ? 'active' : ''}`}
                >
                  <Settings size={18} /> Configurações do Sistema
                </button>
              </>
            )}
          </>
        )}
      </nav>
    </>
  );
};
