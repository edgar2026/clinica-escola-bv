import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Calendar, FileText, Clock, BarChart3, Users,
  BookOpen, ChevronDown, ChevronRight, Shield, FileCheck
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { getAlunoId } from '../../services/helpers';
import type { SidebarProps } from '../../types';

interface ConfigGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: { id: string; label: string }[];
}

const CONFIG_GROUPS: ConfigGroup[] = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: <BookOpen size={15} />,
    items: [
      { id: 'config-cursos', label: 'Cursos' },
      { id: 'config-periodos', label: 'Periodos' },
      { id: 'config-turnos', label: 'Turnos' },
      { id: 'config-supervisores', label: 'Supervisores' },
      { id: 'config-categorias-carga', label: 'Categorias de Carga' },
    ],
  },
  {
    id: 'funcionamento',
    label: 'Funcionamento',
    icon: <Clock size={15} />,
    items: [
      { id: 'config-horarios', label: 'Dias e Horarios' },
      { id: 'config-duracao-atendimento', label: 'Duracao dos Atendimentos' },
      { id: 'config-vagas-horarios', label: 'Vagas por Horario' },
    ],
  },
  {
    id: 'regras',
    label: 'Regras',
    icon: <Shield size={15} />,
    items: [
      { id: 'config-limite-semanal', label: 'Limite Semanal' },
      { id: 'config-datas-vigencia', label: 'Datas de Vigencia' },
      { id: 'config-tolerancia-atraso', label: 'Tolerancia de Atraso' },
      { id: 'config-regras-agendamento', label: 'Regras de Presenca' },
    ],
  },
  {
    id: 'calendario',
    label: 'Calendario',
    icon: <Calendar size={15} />,
    items: [
      { id: 'config-feriados', label: 'Feriados' },
      { id: 'config-recessos', label: 'Recessos' },
      { id: 'config-bloqueios', label: 'Datas Bloqueadas' },
    ],
  },
  {
    id: 'grade',
    label: 'Grade Semanal',
    icon: <Calendar size={15} />,
    items: [
      { id: 'config-grade-semanal', label: 'Configurar Grade' },
    ],
  },
];

export const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }: SidebarProps) => {
  const { usuario } = useAuth();

  const isAluno = usuario?.perfil === 'aluno';
  const isAdmin = usuario?.perfil === 'admin';
  const isGerencia = usuario?.perfil === 'gerencia';
  const isStaff = isAdmin || isGerencia;

  const [inscricaoAberta, setInscricaoAberta] = useState<boolean | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
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
              <FileText size={18} /> Meu Horario Firmado
            </button>
            <button
              onClick={() => handleSelectTab('espelho-ponto')}
              className={`nav-item ${activeTab === 'espelho-ponto' ? 'active' : ''}`}
            >
              <FileCheck size={18} /> Historico de Registros
            </button>
            <button
              onClick={() => handleSelectTab('registro-ponto')}
              className={`nav-item ${activeTab === 'registro-ponto' ? 'active' : ''}`}
            >
              <Clock size={18} /> Registrar Presenca
            </button>
          </>
        )}

        {isStaff && (
          <>
            <div className="nav-section-title">Painel</div>
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
                <FileText size={18} /> Relatorios Gerenciais
              </button>
            )}

            {isAdmin && (
              <>
                <div className="nav-section-title">Acessos</div>
                <button
                  onClick={() => handleSelectTab('gestao-usuarios')}
                  className={`nav-item ${activeTab === 'gestao-usuarios' ? 'active' : ''}`}
                >
                  <Users size={18} /> Gestao de Usuarios
                </button>

                {CONFIG_GROUPS.map((group) => {
                  const isExpanded = expandedGroups[group.id] ?? false;
                  const hasActive = group.items.some(i => i.id === activeTab);
                  return (
                    <div key={group.id}>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={`nav-item nav-group-header ${hasActive ? 'active-group' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          width: '100%',
                          padding: '0.55rem 1rem',
                          border: 'none',
                          background: hasActive ? 'rgba(0,43,73,0.06)' : 'transparent',
                          color: hasActive ? 'var(--primary)' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {group.icon}
                        <span style={{ flex: 1, textAlign: 'left' }}>{group.label}</span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {isExpanded && (
                        <div className="nav-group-items">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handleSelectTab(item.id)}
                              className={`nav-item nav-item-sub ${activeTab === item.id ? 'active' : ''}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                width: '100%',
                                padding: '0.48rem 1rem 0.48rem 2.2rem',
                                border: 'none',
                                background: activeTab === item.id ? 'rgba(0,43,73,0.08)' : 'transparent',
                                color: activeTab === item.id ? 'var(--primary)' : 'var(--text-muted)',
                                fontSize: '0.82rem',
                                fontWeight: activeTab === item.id ? 700 : 500,
                                cursor: 'pointer',
                                textAlign: 'left',
                                borderLeft: activeTab === item.id ? '3px solid var(--secondary)' : '3px solid transparent',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <ChevronRight size={11} style={{ opacity: activeTab === item.id ? 1 : 0.4 }} />
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </nav>
    </>
  );
};
