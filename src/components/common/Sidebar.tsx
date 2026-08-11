import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Calendar, FileText, Clock, BarChart3, Settings, FileCheck, Users } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { getAlunoId } from '../../services/helpers';
import type { SidebarProps } from '../../types';

export const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }: SidebarProps) => {
  const { usuario } = useAuth();

  const isAluno = usuario?.perfil === 'aluno';
  const isAdmin = usuario?.perfil === 'admin';
  const isGerencia = usuario?.perfil === 'gerencia';
  const isStaff = isAdmin || isGerencia;

  const [inscricaoAberta, setInscricaoAberta] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAluno) return;
    const check = async () => {
      try {
        const alunoId = await getAlunoId();
        if (!alunoId) { setInscricaoAberta(false); return; }
        const { data } = await supabase.rpc('verificar_inscricao_aberta', { p_aluno_id: Number(alunoId) });
        setInscricaoAberta(data?.inscricao_aberta ?? false);
      } catch {
        setInscricaoAberta(false);
      }
    };
    check();
  }, [isAluno]);

  const handleSelectTab = (tab: string) => {
    setActiveTab(tab);
    if (setSidebarOpen) {
      setSidebarOpen(false);
    }
  };

  if (!usuario) return null;

  return (
    <>
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
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
            {(inscricaoAberta === null || inscricaoAberta) && (
              <button
                onClick={() => handleSelectTab('grade-semanal-aluno')}
                className={`nav-item ${activeTab === 'grade-semanal-aluno' ? 'active' : ''}`}
              >
                <Calendar size={18} /> Grade Semanal
              </button>
            )}
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
              <FileCheck size={18} /> Histórico de Registros
            </button>
            <button
              onClick={() => handleSelectTab('registro-ponto')}
              className={`nav-item ${activeTab === 'registro-ponto' ? 'active' : ''}`}
            >
              <Clock size={18} /> Registrar Presença
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
                  onClick={() => handleSelectTab('gestao-usuarios')}
                  className={`nav-item ${activeTab === 'gestao-usuarios' ? 'active' : ''}`}
                >
                  <Users size={18} /> Gestao de Usuarios
                </button>
                <button
                  onClick={() => handleSelectTab('admin-configuracoes')}
                  className={`nav-item ${activeTab === 'admin-configuracoes' ? 'active' : ''}`}
                >
                  <Settings size={18} /> Configuracoes do Sistema
                </button>
              </>
            )}
          </>
        )}
      </nav>
    </>
  );
};