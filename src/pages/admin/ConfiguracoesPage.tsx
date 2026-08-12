import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { formatarData } from '../../utils/datas';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { GestaoUsuariosPage } from './GestaoUsuariosPage';
import { GradeSemanalPage } from './GradeSemanalPage';
import { CategoriasCargaHorariaPage } from './CategoriasCargaHorariaPage';
import {
  Plus, Trash2, Edit2, AlertTriangle,
  Save
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ToastMessage } from '../../types';

interface DiaSemana {
  id: number;
  nome: string;
}

const DIAS_SEMANA: DiaSemana[] = [
  { id: 1, nome: 'Segunda-feira' },
  { id: 2, nome: 'Terca-feira' },
  { id: 3, nome: 'Quarta-feira' },
  { id: 4, nome: 'Quinta-feira' },
  { id: 5, nome: 'Sexta-feira' },
  { id: 6, nome: 'Sabado' },
];

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  borderRadius: 8,
  border: '1.5px solid var(--border-color)',
  fontSize: '0.9rem',
  color: 'var(--text-dark)',
  background: '#FFF',
  outline: 'none',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-dark)',
  marginBottom: 4,
  display: 'block',
};

const SECTION_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 12,
  border: '1px solid var(--border-color)',
  padding: '1.25rem',
  marginBottom: '1rem',
};

interface InlineRegraFieldProps {
  label: string;
  descricao?: string;
  chave: string;
  valor: string;
  onSalvar: (chave: string, valor: string) => Promise<void>;
}

const InlineRegraField = ({ label, descricao, chave, valor, onSalvar }: InlineRegraFieldProps) => {
  const [localValor, setLocalValor] = useState(valor || '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setLocalValor(valor || '');
  }, [valor]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await onSalvar(chave, localValor);
    } catch {} finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ ...CARD_STYLE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{label}</div>
        {descricao && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{descricao}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="number"
          value={localValor}
          onChange={e => setLocalValor(e.target.value)}
          style={{ ...INPUT_STYLE, width: 120, textAlign: 'center', fontWeight: 700 }}
        />
        <button
          onClick={handleSalvar}
          disabled={salvando || localValor === valor}
          className="btn-primary"
          style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, opacity: salvando || localValor === valor ? 0.5 : 1 }}
        >
          <Save size={14} /> {salvando ? '...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
};

interface CrudSectionColuna {
  chave: string;
  label: string;
  render?: (value: unknown, item: Record<string, unknown>) => ReactNode;
}

interface CrudSectionCampo {
  chave: string;
  label: string;
  tipo?: string;
  obrigatorio?: boolean;
  placeholder?: string;
  valorInicial?: string;
  fullWidth?: boolean;
  opcoes?: Array<{ value: string | number; label: string }>;
}

interface CrudSectionProps {
  titulo: string;
  itens: Record<string, unknown>[];
  colunas: CrudSectionColuna[];
  camposForm: CrudSectionCampo[];
  onNovo: (form: Record<string, unknown>) => Promise<void>;
  onEditar: (id: string, form: Record<string, unknown>) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
  nomeItem: string;
  showToast?: (msg: string, tipo?: ToastMessage['tipo']) => void;
  renderAcoes?: (item: Record<string, unknown>) => ReactNode;
}

const CrudSection = ({ titulo, itens, colunas, camposForm, onNovo, onEditar, onExcluir, nomeItem, showToast, renderAcoes }: CrudSectionProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Record<string, unknown> | null>(null);

  const abrirNovo = () => {
    setEditando(null);
    const inicial: Record<string, string> = {};
    camposForm.forEach(c => { inicial[c.chave] = c.valorInicial || ''; });
    setForm(inicial);
    setModalOpen(true);
  };

  const abrirEditar = (item: Record<string, unknown>) => {
    setEditando(item);
    const inicial: Record<string, string> = {};
    camposForm.forEach(c => { inicial[c.chave] = (item[c.chave] as string) ?? ''; });
    setForm(inicial);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (editando) {
        await onEditar(editando.id as string, form);
      } else {
        await onNovo(form);
      }
      setModalOpen(false);
    } catch (err) {
      if (showToast) showToast('Erro ao salvar: ' + ((err as Error).message || 'Tente novamente.'), 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!confirmDelete) return;
    try {
      await onExcluir(confirmDelete.id as string);
    } catch (err) {
      if (showToast) showToast('Erro ao excluir: ' + ((err as Error).message || 'Tente novamente.'), 'erro');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{titulo}</h3>
        <button onClick={abrirNovo} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.5rem 1rem', fontSize: '0.82rem' }}>
          <Plus size={14} /> Novo {nomeItem}
        </button>
      </div>

      {itens.length === 0 ? (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <AlertTriangle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>
            Nenhum {nomeItem.toLowerCase()} cadastrado. Clique em 'Novo {nomeItem}' para comecar a configuracao do sistema.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {colunas.map(col => (
                  <th key={col.chave}>{col.label}</th>
                ))}
                <th style={{ width: 140 }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {itens.map(item => (
                <tr key={item.id as string}>
                  {colunas.map(col => (
                    <td key={col.chave}>
                      {col.render ? col.render(item[col.chave], item) : ((item[col.chave] as ReactNode) ?? '-')}
                    </td>
                  ))}
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {renderAcoes?.(item)}
                      <button onClick={() => abrirEditar(item)} style={{ background: '#E0F2FE', border: 'none', color: '#0284C7', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }} title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setConfirmDelete(item)} style={{ background: '#FEE2E2', border: 'none', color: '#DC2626', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }} title="Excluir">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {editando ? <Edit2 size={18} /> : <Plus size={18} />}
                {editando ? `Editar ${nomeItem}` : `Novo ${nomeItem}`}
              </h3>
              <button onClick={() => setModalOpen(false)} className="btn-close">&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: camposForm.length > 2 ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                {camposForm.map(campo => (
                  <div key={campo.chave} style={campo.fullWidth ? { gridColumn: '1 / -1' } : {}}>
                    <label style={LABEL_STYLE}>{campo.label} {campo.obrigatorio && '*'}</label>
                    {campo.tipo === 'select' ? (
                      <select required={campo.obrigatorio} value={form[campo.chave] || ''} onChange={e => setForm({ ...form, [campo.chave]: e.target.value })} style={{ ...INPUT_STYLE, background: '#FFF' }}>
                        <option value="">Selecione...</option>
                        {(campo.opcoes || []).map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    ) : campo.tipo === 'textarea' ? (
                      <textarea required={campo.obrigatorio} rows={3} value={form[campo.chave] || ''} onChange={e => setForm({ ...form, [campo.chave]: e.target.value })} style={{ ...INPUT_STYLE, resize: 'vertical' }} placeholder={campo.placeholder || ''} />
                    ) : (
                      <input type={campo.tipo || 'text'} required={campo.obrigatorio} value={form[campo.chave] || ''} onChange={e => setForm({ ...form, [campo.chave]: e.target.value })} style={INPUT_STYLE} placeholder={campo.placeholder || ''} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Cancelar</button>
                <button type="submit" disabled={salvando} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen={true}
          title={`Excluir ${nomeItem}`}
          message={`Deseja realmente excluir este ${nomeItem.toLowerCase()}? Esta acao nao pode ser desfeita.`}
          confirmText="Excluir"
          cancelText="Cancelar"
          confirmVariant="danger"
          onConfirm={handleExcluir}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

interface PanelProps {
  showToast: (msg: string, tipo?: ToastMessage['tipo']) => void;
}

const PanelCursos = ({ showToast }: PanelProps) => {
  const [cursos, setCursos] = useState<Record<string, unknown>[]>([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getCursos();
      setCursos(Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : []);
    } catch (err) {
      showToast('Erro ao carregar cursos: ' + (err as Error).message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form: Record<string, unknown>) => {
    await adminService.cadastrarCurso(form);
    showToast('Curso cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id: string, form: Record<string, unknown>) => {
    await adminService.atualizarCurso(id, form);
    showToast('Curso atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id: string) => {
    await adminService.excluirCurso(id);
    showToast('Curso excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Cursos"
      itens={cursos}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'codigo', label: 'Codigo', render: (v) => <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{String(v)}</code> },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome do Curso', obrigatorio: true, placeholder: 'Ex: Enfermagem' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Curso"
      showToast={showToast}
    />
  );
};

const PanelPeriodos = ({ showToast }: PanelProps) => {
  const [periodos, setPeriodos] = useState<Record<string, unknown>[]>([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getPeriodos();
      setPeriodos(Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : []);
    } catch (err) {
      showToast('Erro ao carregar periodos: ' + (err as Error).message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form: Record<string, unknown>) => {
    await adminService.cadastrarPeriodo(form);
    showToast('Periodo cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id: string, form: Record<string, unknown>) => {
    await adminService.atualizarPeriodo(id, form);
    showToast('Periodo atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id: string) => {
    await adminService.excluirPeriodo(id);
    showToast('Periodo excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Periodos"
      itens={periodos}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'codigo', label: 'Codigo', render: (v) => <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{String(v)}</code> },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome do Periodo', obrigatorio: true, placeholder: 'Ex: 1o Semestre 2026' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Periodo"
      showToast={showToast}
    />
  );
};

const PanelTurnos = ({ showToast }: PanelProps) => {
  const [turnos, setTurnos] = useState<Record<string, unknown>[]>([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getTurnos();
      setTurnos(Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : []);
    } catch (err) {
      showToast('Erro ao carregar turnos: ' + (err as Error).message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form: Record<string, unknown>) => {
    await adminService.cadastrarTurno(form);
    showToast('Turno cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id: string, form: Record<string, unknown>) => {
    await adminService.atualizarTurno(id, form);
    showToast('Turno atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id: string) => {
    await adminService.excluirTurno(id);
    showToast('Turno excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Turnos"
      itens={turnos}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'codigo', label: 'Codigo', render: (v) => <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{String(v)}</code> },
        { chave: 'hora_inicio', label: 'Inicio' },
        { chave: 'hora_fim', label: 'Fim' },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome do Turno', obrigatorio: true, placeholder: 'Ex: Manha, Tarde ou Noite' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Turno"
      showToast={showToast}
    />
  );
};

const PanelSupervisores = ({ showToast }: PanelProps) => {
  const [supervisores, setSupervisores] = useState<Record<string, unknown>[]>([]);
  const [cursos, setCursos] = useState<Record<string, unknown>[]>([]);
  const carregar = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([adminService.getSupervisores(), adminService.getCursos()]);
      setSupervisores(Array.isArray(s.supervisores) ? (s.supervisores as unknown as Record<string, unknown>[]) : []);
      setCursos(Array.isArray(c) ? (c as unknown as Record<string, unknown>[]) : []);
    } catch (err) {
      showToast('Erro ao carregar supervisores: ' + (err as Error).message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form: Record<string, unknown>) => {
    await adminService.cadastrarSupervisor(form);
    showToast('Supervisor cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id: string, form: Record<string, unknown>) => {
    await adminService.atualizarSupervisor(id, form);
    showToast('Supervisor atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id: string) => {
    await adminService.excluirSupervisor(id);
    showToast('Supervisor excluido com sucesso!', 'sucesso');
    await carregar();
  };

  const opcoesCursos = cursos.map(c => ({ value: c.id as string | number, label: c.nome as string }));

  return (
    <CrudSection
      titulo="Supervisores"
      itens={supervisores}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'curso_nome', label: 'Curso' },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome Completo', obrigatorio: true, placeholder: 'Nome do supervisor' },
        { chave: 'curso_id', label: 'Curso', tipo: 'select', opcoes: opcoesCursos, obrigatorio: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Supervisor"
      showToast={showToast}
    />
  );
};

const PanelHorarios = ({ showToast }: PanelProps) => {
  const [horarios, setHorarios] = useState<Record<string, unknown>[]>([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getHorariosFuncionamento();
      setHorarios(Array.isArray(data.horarios) ? (data.horarios as unknown as Record<string, unknown>[]) : []);
    } catch (err) {
      showToast('Erro ao carregar horarios: ' + (err as Error).message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form: Record<string, unknown>) => {
    await adminService.cadastrarHorarioFuncionamento(form);
    showToast('Horario cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id: string, form: Record<string, unknown>) => {
    await adminService.atualizarHorarioFuncionamento(id, form);
    showToast('Horario atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id: string) => {
    await adminService.excluirHorarioFuncionamento(id);
    showToast('Horario excluido com sucesso!', 'sucesso');
    await carregar();
  };

  const opcoesDias = DIAS_SEMANA.map(d => ({ value: d.id, label: d.nome }));

  return (
    <CrudSection
      titulo="Dias e Horarios de Funcionamento"
      itens={horarios}
      colunas={[
        { chave: 'dia_semana', label: 'Dia', render: (v) => DIAS_SEMANA.find(d => d.id === v)?.nome || String(v) },
        { chave: 'hora_inicio', label: 'Inicio' },
        { chave: 'hora_fim', label: 'Fim' },
        { chave: 'duracao_intervalo_min', label: 'Intervalo (min)' },
      ]}
      camposForm={[
        { chave: 'dia_semana', label: 'Dia da Semana', tipo: 'select', opcoes: opcoesDias, obrigatorio: true },
        { chave: 'hora_inicio', label: 'Horario Inicio', tipo: 'time', obrigatorio: true },
        { chave: 'hora_fim', label: 'Horario Fim', tipo: 'time', obrigatorio: true },
        { chave: 'duracao_intervalo_min', label: 'Duracao do Intervalo (min)', tipo: 'number' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Horario"
      showToast={showToast}
    />
  );
};

interface PanelRegrasProps {
  showToast: (msg: string, tipo?: ToastMessage['tipo']) => void;
  regras: Record<string, string>;
  onSalvar: (chave: string, valor: string) => Promise<void>;
}

const PanelDuracaoAtendimento = ({ regras, onSalvar }: PanelRegrasProps) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Duracao dos Atendimentos</h3>
      <InlineRegraField
        label="Duracao padrao do atendimento"
        descricao="Tempo em minutos de cada sessao de atendimento."
        chave="duracao_atendimento_minutos"
        valor={regras.duracao_atendimento_minutos}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelVagasHorarios = ({ showToast }: PanelProps) => {
  const [vagas, setVagas] = useState<Record<string, unknown>[]>([]);
  const [setores, setSetores] = useState<Record<string, unknown>[]>([]);
  const [supervisores, setSupervisores] = useState<Record<string, unknown>[]>([]);
  const [cursos, setCursos] = useState<Record<string, unknown>[]>([]);

  const carregar = useCallback(async () => {
    try {
      const [v, s, sup, c] = await Promise.all([
        adminService.getVagasHorarios(),
        adminService.getSetores(),
        adminService.getSupervisores(),
        adminService.getCursos(),
      ]);
      setVagas(Array.isArray(v.vagas) ? (v.vagas as unknown as Record<string, unknown>[]) : []);
      setSetores(Array.isArray(s.setores) ? (s.setores as unknown as Record<string, unknown>[]) : []);
      setSupervisores(Array.isArray(sup.supervisores) ? (sup.supervisores as unknown as Record<string, unknown>[]) : []);
      setCursos(Array.isArray(c) ? (c as unknown as Record<string, unknown>[]) : []);
    } catch (err) {
      showToast('Erro ao carregar vagas por horario: ' + (err as Error).message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const fixedSetor = setores.find(s => {
    const nome = String(s.nome || '').toLowerCase();
    return nome.includes('psicologia');
  });
  const fixedSetorId = fixedSetor?.id as string | undefined;

  const handleNovo = async (form: Record<string, unknown>) => {
    await adminService.cadastrarVagaHorario({ ...form, setor_id: fixedSetorId });
    showToast('Vaga por horario cadastrada com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id: string, form: Record<string, unknown>) => {
    await adminService.atualizarVagaHorario(id, { ...form, setor_id: fixedSetorId });
    showToast('Vaga por horario atualizada!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id: string) => {
    await adminService.excluirVagaHorario(id);
    showToast('Vaga por horario excluida com sucesso!', 'sucesso');
    await carregar();
  };

  const opcoesSupervisores = supervisores.map(s => ({ value: s.id as string | number, label: (s.usuario_nome || s.nome) as string }));
  const opcoesCursos = cursos.map(c => ({ value: c.id as string | number, label: c.nome as string }));
  const opcoesDias = DIAS_SEMANA.map(d => ({ value: d.id, label: d.nome }));

  const getSetorNome = (_v: unknown, item: Record<string, unknown>): string => {
    return (item.setor_nome as string) || (fixedSetor?.nome as string) || 'Clinica de Psicologia';
  };
  const getSupervisorNome = (_v: unknown, item: Record<string, unknown>): string => {
    const supervisor = item.supervisor_id ? supervisores.find(s => s.id === item.supervisor_id) : null;
    return (item.supervisor_nome as string) || (supervisor?.usuario_nome as string) || (supervisor?.nome as string) || '-';
  };
  const getCursoNome = (_v: unknown, item: Record<string, unknown>): string => {
    const curso = item.curso_id ? cursos.find(c => c.id === item.curso_id) : null;
    return (item.curso_nome as string) || (curso?.nome as string) || '-';
  };

  const handleSuspender = async (id: string) => {
    try {
      await adminService.suspenderVagaHorario(id);
      showToast('Vaga suspensa com sucesso!', 'sucesso');
      await carregar();
    } catch (err) {
      showToast('Erro ao suspender vaga: ' + (err as Error).message, 'erro');
    }
  };

  const handleReativar = async (id: string) => {
    try {
      await adminService.reativarVagaHorario(id);
      showToast('Vaga reativada com sucesso!', 'sucesso');
      await carregar();
    } catch (err) {
      showToast('Erro ao reativar vaga: ' + (err as Error).message, 'erro');
    }
  };

  return (
    <CrudSection
      titulo="Vagas por Horario"
      itens={vagas}
      colunas={[
        { chave: 'setor_id', label: 'Setor', render: getSetorNome },
        { chave: 'supervisor_id', label: 'Supervisor', render: getSupervisorNome },
        { chave: 'curso_id', label: 'Curso', render: getCursoNome },
        { chave: 'dia_semana', label: 'Dia', render: (v) => DIAS_SEMANA.find(d => d.id === v)?.nome || String(v) },
        { chave: 'hora_inicio', label: 'Inicio' },
        { chave: 'hora_fim', label: 'Fim' },
        { chave: 'capacidade_max', label: 'Capacidade' },
        { chave: 'status', label: 'Status', render: (v) => {
          if (v === 'suspenso') return <span style={{ color: '#DC2626', fontWeight: 600 }}>Suspenso</span>;
          return <span style={{ color: '#16A34A', fontWeight: 600 }}>Ativo</span>;
        }},
      ]}
      camposForm={[
        { chave: 'supervisor_id', label: 'Supervisor', tipo: 'select', opcoes: opcoesSupervisores, obrigatorio: true },
        { chave: 'curso_id', label: 'Curso', tipo: 'select', opcoes: opcoesCursos, obrigatorio: true },
        { chave: 'dia_semana', label: 'Dia da Semana', tipo: 'select', opcoes: opcoesDias, obrigatorio: true },
        { chave: 'hora_inicio', label: 'Horario Inicio', tipo: 'time', obrigatorio: true },
        { chave: 'hora_fim', label: 'Horario Fim', tipo: 'time', obrigatorio: true },
        { chave: 'capacidade_max', label: 'Capacidade Maxima', tipo: 'number', obrigatorio: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Vaga"
      showToast={showToast}
      renderAcoes={(item) => {
        const id = item.id as string;
        const suspenso = item.status === 'suspenso';
        return (
          <button
            onClick={() => suspenso ? handleReativar(id) : handleSuspender(id)}
            style={{
              background: suspenso ? '#DCFCE7' : '#FEF3C7',
              border: 'none',
              color: suspenso ? '#16A34A' : '#D97706',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
            title={suspenso ? 'Reativar' : 'Suspender'}
          >
            {suspenso ? 'Reativar' : 'Suspender'}
          </button>
        );
      }}
    />
  );
};
const PanelFeriados = ({ showToast }: PanelProps) => {
  const [feriados, setFeriados] = useState<Record<string, unknown>[]>([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getFeriados();
      setFeriados((Array.isArray(data.feriados) ? (data.feriados as unknown as Record<string, unknown>[]) : []).filter(f => f.tipo === 'feriado'));
    } catch (err) {
      showToast('Erro ao carregar feriados: ' + (err as Error).message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form: Record<string, unknown>) => {
    await adminService.cadastrarFeriado({ ...form, tipo: 'feriado' });
    showToast('Feriado cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id: string, form: Record<string, unknown>) => {
    await adminService.atualizarFeriado(id, form);
    showToast('Feriado atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id: string) => {
    await adminService.excluirFeriado(id);
    showToast('Feriado excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Feriados"
      itens={feriados}
      colunas={[
        { chave: 'data', label: 'Data', render: (v) => formatarData(v as string) },
        { chave: 'descricao', label: 'Descricao' },
      ]}
      camposForm={[
        { chave: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
        { chave: 'descricao', label: 'Descricao', fullWidth: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Feriado"
      showToast={showToast}
    />
  );
};

const PanelRecessos = ({ showToast }: PanelProps) => {
  const [recessos, setRecessos] = useState<Record<string, unknown>[]>([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getFeriados();
      setRecessos((Array.isArray(data.feriados) ? (data.feriados as unknown as Record<string, unknown>[]) : []).filter(f => f.tipo === 'recesso'));
    } catch (err) {
      showToast('Erro ao carregar recessos: ' + (err as Error).message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form: Record<string, unknown>) => {
    await adminService.cadastrarFeriado({ ...form, tipo: 'recesso' });
    showToast('Recesso cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id: string, form: Record<string, unknown>) => {
    await adminService.atualizarFeriado(id, form);
    showToast('Recesso atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id: string) => {
    await adminService.excluirFeriado(id);
    showToast('Recesso excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Recessos"
      itens={recessos}
      colunas={[
        { chave: 'data', label: 'Data', render: (v) => formatarData(v as string) },
        { chave: 'descricao', label: 'Descricao' },
      ]}
      camposForm={[
        { chave: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
        { chave: 'descricao', label: 'Descricao', fullWidth: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Recesso"
      showToast={showToast}
    />
  );
};

const PanelBloqueios = ({ showToast }: PanelProps) => {
  const [bloqueios, setBloqueios] = useState<Record<string, unknown>[]>([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getFeriados();
      setBloqueios((Array.isArray(data.feriados) ? (data.feriados as unknown as Record<string, unknown>[]) : []).filter(f => f.tipo === 'manutencao'));
    } catch (err) {
      showToast('Erro ao carregar datas bloqueadas: ' + (err as Error).message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form: Record<string, unknown>) => {
    await adminService.cadastrarFeriado({ ...form, tipo: 'manutencao' });
    showToast('Data bloqueada cadastrada com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id: string, form: Record<string, unknown>) => {
    await adminService.atualizarFeriado(id, form);
    showToast('Data bloqueada atualizada!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id: string) => {
    await adminService.excluirFeriado(id);
    showToast('Data bloqueada excluida com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Datas Bloqueadas"
      itens={bloqueios}
      colunas={[
        { chave: 'data', label: 'Data', render: (v) => formatarData(v as string) },
        { chave: 'descricao', label: 'Descricao' },
      ]}
      camposForm={[
        { chave: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
        { chave: 'descricao', label: 'Descricao', fullWidth: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Data Bloqueada"
      showToast={showToast}
    />
  );
};

const PanelLimiteSemanal = ({ regras, onSalvar }: PanelRegrasProps) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Limite Semanal de Horas</h3>
      <InlineRegraField
        label="Limite padrao de horas semanais"
        descricao="Numero maximo de horas que um aluno pode registrar por semana."
        chave="limite_horas_semanais_padrao"
        valor={regras.limite_horas_semanais_padrao}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelDatasVigencia = ({ regras, onSalvar }: PanelRegrasProps) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Datas de Vigencia</h3>
      <InlineRegraField
        label="Antecedencia para registro (dias)"
        descricao="Numero minimo de dias de antecedencia para criar um registro."
        chave="antecedencia_agendamento_dias"
        valor={regras.antecedencia_agendamento_dias}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelToleranciaAtraso = ({ regras, onSalvar }: PanelRegrasProps) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Tolerancia de Atraso</h3>
      <InlineRegraField
        label="Tolerancia de atraso (minutos)"
        descricao="Tempo em minutos apos o inicio do atendimento em que o aluno ainda pode registrar presenca."
        chave="tolerancia_atraso_minutos"
        valor={regras.tolerancia_atraso_minutos}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelRegrasAgendamento = ({ regras, onSalvar }: PanelRegrasProps) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Regras de Presenca</h3>
      <InlineRegraField
        label="Antecedencia para cancelamento (horas)"
        descricao="Horas minimas de antecedencia para cancelar um registro sem penalidade."
        chave="antecedencia_cancelamento_horas"
        valor={regras.antecedencia_cancelamento_horas}
        onSalvar={onSalvar}
      />
      <InlineRegraField
        label="Maximo de cancelamentos por aluno no mes"
        descricao="Numero maximo de cancelamentos que um aluno pode realizar por mes."
        chave="max_cancelamentos_aluno_mes"
        valor={regras.max_cancelamentos_aluno_mes}
        onSalvar={onSalvar}
      />
    </div>
  );
};

interface Regra {
  chave: string;
  valor: string;
}

interface ConfiguracoesPageProps {
  section?: string;
}

const SECTION_LABELS: Record<string, string> = {
  'gestao-usuarios': 'Gestao de Usuarios',
  'config-cursos': 'Cursos',
  'config-periodos': 'Periodos',
  'config-turnos': 'Turnos',
  'config-supervisores': 'Supervisores',
  'config-categorias-carga': 'Categorias de Carga Horaria',
  'config-horarios': 'Dias e Horarios',
  'config-duracao-atendimento': 'Duracao dos Atendimentos',
  'config-vagas-horarios': 'Vagas por Horario',
  'config-limite-semanal': 'Limite Semanal',
  'config-datas-vigencia': 'Datas de Vigencia',
  'config-tolerancia-atraso': 'Tolerancia de Atraso',
  'config-regras-agendamento': 'Regras de Presenca',
  'config-feriados': 'Feriados',
  'config-recessos': 'Recessos',
  'config-bloqueios': 'Datas Bloqueadas',
  'config-grade-semanal': 'Configurar Grade',
};

const SECTION_TO_CONFIG: Record<string, string> = {
  'gestao-usuarios': 'usuarios',
  'config-cursos': 'cursos',
  'config-periodos': 'periodos',
  'config-turnos': 'turnos',
  'config-supervisores': 'supervisores',
  'config-categorias-carga': 'categorias_carga',
  'config-horarios': 'horarios',
  'config-duracao-atendimento': 'duracao_atendimento',
  'config-vagas-horarios': 'vagas_horarios',
  'config-limite-semanal': 'limite_semanal',
  'config-datas-vigencia': 'datas_vigencia',
  'config-tolerancia-atraso': 'tolerancia_atraso',
  'config-regras-agendamento': 'regras_agendamento',
  'config-feriados': 'feriados',
  'config-recessos': 'recessos',
  'config-bloqueios': 'bloqueios',
  'config-grade-semanal': 'grade_semanal',
};

export const ConfiguracoesPage = ({ section }: ConfiguracoesPageProps) => {
  const { showToast } = useAuth();
  const [regras, setRegras] = useState<Record<string, string>>({});
  const [loadingRegras, setLoadingRegras] = useState(true);

  const configKey = SECTION_TO_CONFIG[section || ''] || 'cursos';

  const carregarRegras = useCallback(async () => {
    setLoadingRegras(true);
    try {
      const data = await adminService.getRegras();
      const map: Record<string, string> = {};
      if (Array.isArray(data)) {
        data.forEach((r: Regra) => { map[r.chave] = r.valor; });
      }
      setRegras(map);
    } catch (err) {
      showToast('Erro ao carregar regras: ' + (err as Error).message, 'erro');
    } finally {
      setLoadingRegras(false);
    }
  }, [showToast]);

  useEffect(() => { carregarRegras(); }, [carregarRegras]);

  const handleSalvarRegra = async (chave: string, valor: string) => {
    try {
      await adminService.atualizarRegra(chave, valor);
      setRegras(prev => ({ ...prev, [chave]: valor }));
      showToast('Regra salva com sucesso!', 'sucesso');
    } catch (err) {
      showToast('Erro ao salvar regra: ' + (err as Error).message, 'erro');
    }
  };

  const renderPanel = () => {
    if (loadingRegras && ['duracao_atendimento', 'limite_semanal', 'datas_vigencia', 'tolerancia_atraso', 'regras_agendamento'].includes(configKey)) {
      return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando configuracoes...</div>;
    }

    switch (configKey) {
      case 'usuarios': return <GestaoUsuariosPage />;
      case 'cursos': return <PanelCursos showToast={showToast} />;
      case 'periodos': return <PanelPeriodos showToast={showToast} />;
      case 'turnos': return <PanelTurnos showToast={showToast} />;
      case 'supervisores': return <PanelSupervisores showToast={showToast} />;
      case 'categorias_carga': return <CategoriasCargaHorariaPage />;
      case 'horarios': return <PanelHorarios showToast={showToast} />;
      case 'duracao_atendimento': return <PanelDuracaoAtendimento showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'vagas_horarios': return <PanelVagasHorarios showToast={showToast} />;
      case 'limite_semanal': return <PanelLimiteSemanal showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'datas_vigencia': return <PanelDatasVigencia showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'tolerancia_atraso': return <PanelToleranciaAtraso showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'regras_agendamento': return <PanelRegrasAgendamento showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'feriados': return <PanelFeriados showToast={showToast} />;
      case 'recessos': return <PanelRecessos showToast={showToast} />;
      case 'bloqueios': return <PanelBloqueios showToast={showToast} />;
      case 'grade_semanal': return <GradeSemanalPage />;
      default: return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Selecione um item no menu ao lado.</div>;
    }
  };

  const label = SECTION_LABELS[section || ''] || 'Configuracoes';

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">{label}</h1>
        <p className="page-subtitle">Gerencie as configuracoes administrativas do sistema clinica-escola.</p>
      </div>
      {renderPanel()}
    </section>
  );
};
