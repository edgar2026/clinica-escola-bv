import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { supabase } from '../../services/supabaseClient';
import { formatarData } from '../../utils/datas';
import {
  Calendar, Clock, CheckCircle, XCircle, AlertTriangle,
  Search, Plus, Save, ChevronDown, ChevronUp,
  User, BookOpen, Loader2, Settings, Play
} from 'lucide-react';
import type { ToastMessage } from '../../types';

const DIAS_SEMANA: Record<number, string> = {
  1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
};

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 12,
  border: '1px solid var(--border-color)',
  padding: '1.25rem',
  marginBottom: '1rem',
};

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

const BADGE_STYLE = (variante: 'sucesso' | 'erro' | 'alerta' | 'info'): React.CSSProperties => {
  const cores: Record<string, { bg: string; color: string }> = {
    sucesso: { bg: '#DCFCE7', color: '#16A34A' },
    erro: { bg: '#FEE2E2', color: '#DC2626' },
    alerta: { bg: '#FEF3C7', color: '#D97706' },
    info: { bg: '#E0F2FE', color: '#0284C7' },
  };
  const c = cores[variante] || cores.info;
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: '0.75rem',
    fontWeight: 700,
    background: c.bg,
    color: c.color,
  };
};

interface ConfigGrade {
  id?: string;
  inscricao_inicio: string;
  inscricao_fim: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  status: string;
}

interface ExcecaoGrade {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  matricula: string;
  prazo_fim: string;
  justificativa: string;
  status: string;
  criado_em: string;
}

interface SelecaoAluno {
  aluno_id: string;
  aluno_nome: string;
  matricula: string;
  curso_nome: string;
  carga_horaria: number;
  total_horas: number;
  selecoes: Array<{ dia: number; hora_inicio: string; hora_fim: string }>;
  status: string;
}

const INITIAL_CONFIG: ConfigGrade = {
  inscricao_inicio: '',
  inscricao_fim: '',
  vigencia_inicio: '',
  vigencia_fim: '',
  status: 'rascunho',
};

// ─── Section 1: Configuração da Grade Semanal ───
const SectionConfigGrade = ({
  config,
  setConfig,
  showToast,
}: {
  config: ConfigGrade;
  setConfig: (c: ConfigGrade) => void;
  showToast: (msg: string, tipo?: ToastMessage['tipo']) => void;
}) => {
  const [salvando, setSalvando] = useState(false);
  const [local, setLocal] = useState<ConfigGrade>(config);

  useEffect(() => { setLocal(config); }, [config]);

  const handleSalvar = async () => {
    if (!local.inscricao_inicio || !local.inscricao_fim || !local.vigencia_inicio || !local.vigencia_fim) {
      showToast('Preencha todos os campos de data.', 'erro');
      return;
    }
    setSalvando(true);
    try {
      await adminService.salvarConfigGradeSemanal({
        inscricao_inicio: local.inscricao_inicio,
        inscricao_fim: local.inscricao_fim,
        vigencia_inicio: local.vigencia_inicio,
        vigencia_fim: local.vigencia_fim,
        status: local.status,
      });
      const updated = await adminService.getConfigGradeSemanal();
      if (updated) setConfig(updated as unknown as ConfigGrade);
      showToast('Configuração da grade salva com sucesso!', 'sucesso');
    } catch (err) {
      showToast('Erro ao salvar configuração: ' + ((err as Error).message || 'Tente novamente.'), 'erro');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} /> Configuração da Grade Semanal
        </h3>
      </div>

      <div style={CARD_STYLE}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={LABEL_STYLE}>Início das Inscrições *</label>
            <input
              type="date"
              value={local.inscricao_inicio}
              onChange={e => setLocal({ ...local, inscricao_inicio: e.target.value })}
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Fim das Inscrições *</label>
            <input
              type="date"
              value={local.inscricao_fim}
              onChange={e => setLocal({ ...local, inscricao_fim: e.target.value })}
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Início da Vigência *</label>
            <input
              type="date"
              value={local.vigencia_inicio}
              onChange={e => setLocal({ ...local, vigencia_inicio: e.target.value })}
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Fim da Vigência *</label>
            <input
              type="date"
              value={local.vigencia_fim}
              onChange={e => setLocal({ ...local, vigencia_fim: e.target.value })}
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Status</label>
            <select
              value={local.status}
              onChange={e => setLocal({ ...local, status: e.target.value })}
              style={{ ...INPUT_STYLE, background: '#FFF' }}
            >
              <option value="rascunho">Rascunho</option>
              <option value="ativa">Ativa</option>
              <option value="encerrada">Encerrada</option>
            </select>
          </div>
        </div>

        {config.id && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#F1F5F9', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>Configuração atual:</strong> {formatarData(config.vigencia_inicio)} até {formatarData(config.vigencia_fim)} | Inscrições: {formatarData(config.inscricao_inicio)} até {formatarData(config.inscricao_fim)} | Status: <span style={BADGE_STYLE(config.status === 'ativa' ? 'sucesso' : config.status === 'encerrada' ? 'erro' : 'info')}>{config.status}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, opacity: salvando ? 0.5 : 1 }}
          >
            <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Section 2: Configuração de Dias da Grade ───
const SectionDiasGrade = ({
  configId,
  showToast,
  onRecarregar,
}: {
  configId: number;
  showToast: (msg: string, tipo?: ToastMessage['tipo']) => void;
  onRecarregar: () => void;
}) => {
  const [dias, setDias] = useState<Array<{
    id?: number;
    dia_semana: number;
    ativo: boolean;
    hora_inicio: string;
    hora_fim: string;
    duracao_slot_min: number;
    vagas: number;
    setor_id: number | null;
    curso_ids: number[];
    periodo_ids: number[];
    turno_ids: number[];
  }>>([]);
  const [cursos, setCursos] = useState<Array<{ id: number; nome: string }>>([]);
  const [periodos, setPeriodos] = useState<Array<{ id: number; nome: string }>>([]);
  const [turnos, setTurnos] = useState<Array<{ id: number; nome: string }>>([]);
  const [setores, setSetores] = useState<Array<{ id: number; nome: string }>>([]);
  const [salvando, setSalvando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [expandido, setExpandido] = useState<number | null>(null);

  useEffect(() => {
    const carregar = async () => {
      try {
        const [diasData, cursosData, periodosData, turnosData, setoresData] = await Promise.all([
          adminService.getDiasGrade(configId),
          adminService.getCursos(),
          adminService.getPeriodos(),
          adminService.getTurnos(),
          adminService.getSetoresClinica(),
        ]);
        setDias(diasData.map(d => ({
          id: d.id as number,
          dia_semana: d.dia_semana as number,
          ativo: d.ativo as boolean,
          hora_inicio: d.hora_inicio as string,
          hora_fim: d.hora_fim as string,
          duracao_slot_min: d.duracao_slot_min as number,
          vagas: d.vagas as number,
          setor_id: d.setor_id as number | null,
          curso_ids: (d.curso_ids as number[]) || [],
          periodo_ids: (d.periodo_ids as number[]) || [],
          turno_ids: (d.turno_ids as number[]) || [],
        })));
        setCursos((cursosData as unknown as Array<{ id: number; nome: string }>).map(c => ({ id: c.id, nome: c.nome })));
        setPeriodos((periodosData as unknown as Array<{ id: number; nome: string }>).map(p => ({ id: p.id, nome: p.nome })));
        setTurnos((turnosData as unknown as Array<{ id: number; nome: string }>).map(t => ({ id: t.id, nome: t.nome })));
        setSetores((setoresData as Array<{ id: number; nome: string }>).map(s => ({ id: s.id, nome: s.nome })));
      } catch (err) {
        showToast('Erro ao carregar configuração de dias: ' + (err as Error).message, 'erro');
      }
    };
    carregar();
  }, [configId, showToast]);

  const atualizarDia = (diaSemana: number, campo: string, valor: unknown) => {
    setDias(prev => {
      const existente = prev.find(d => d.dia_semana === diaSemana);
      if (existente) {
        return prev.map(d => d.dia_semana === diaSemana ? { ...d, [campo]: valor } : d);
      } else {
        return [...prev, {
          dia_semana: diaSemana,
          ativo: true,
          hora_inicio: '07:00',
          hora_fim: '17:00',
          duracao_slot_min: 60,
          vagas: 8,
          setor_id: null,
          curso_ids: [],
          periodo_ids: [],
          turno_ids: [],
          [campo]: valor,
        }];
      }
    });
  };

  const handleSalvarDias = async () => {
    setSalvando(true);
    try {
      for (const dia of dias) {
        await adminService.salvarDiaGrade({
          config_id: configId,
          dia_semana: dia.dia_semana,
          ativo: dia.ativo,
          hora_inicio: dia.hora_inicio,
          hora_fim: dia.hora_fim,
          duracao_slot_min: dia.duracao_slot_min,
          vagas: dia.vagas,
          setor_id: dia.setor_id,
          curso_ids: dia.curso_ids,
          periodo_ids: dia.periodo_ids,
          turno_ids: dia.turno_ids,
        });
      }
      showToast('Configuração de dias salva com sucesso!', 'sucesso');
    } catch (err) {
      showToast('Erro ao salvar configuração de dias: ' + (err as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const handlePublicar = async () => {
    setPublicando(true);
    try {
      const resultado = await adminService.publicarGrade(configId);
      if (resultado.sucesso) {
        showToast(resultado.mensagem, 'sucesso');
        onRecarregar();
      } else {
        showToast(resultado.mensagem, 'erro');
      }
    } catch (err) {
      showToast('Erro ao publicar grade: ' + (err as Error).message, 'erro');
    } finally {
      setPublicando(false);
    }
  };

  const DIAS_COMPLETOS: Record<number, string> = {
    1: 'Segunda-feira',
    2: 'Terça-feira',
    3: 'Quarta-feira',
    4: 'Quinta-feira',
    5: 'Sexta-feira',
    6: 'Sábado',
  };

  const toggleArrayItem = (arr: number[], item: number): number[] => {
    return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
  };

  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={18} /> Configuração de Dias da Grade
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSalvarDias}
            disabled={salvando || !configId}
            className="btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, opacity: salvando || !configId ? 0.5 : 1 }}
          >
            <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar Dias'}
          </button>
          <button
            onClick={handlePublicar}
            disabled={publicando || !configId}
            className="btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, opacity: publicando || !configId ? 0.5 : 1, background: '#10B981' }}
          >
            <Play size={14} /> {publicando ? 'Publicando...' : 'Publicar Grade'}
          </button>
        </div>
      </div>

      {!configId && (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '1.5rem', color: '#F59E0B' }}>
          <AlertTriangle size={20} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: '0.88rem' }}>Salve a configuração de períodos primeiro para configurar os dias.</p>
        </div>
      )}

      {configId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3, 4, 5, 6].map(diaSemana => {
            const dia = dias.find(d => d.dia_semana === diaSemana);
            const isExpandido = expandido === diaSemana;

            return (
              <div key={diaSemana} style={CARD_STYLE}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                  onClick={() => setExpandido(isExpandido ? null : diaSemana)}
                >
                  <input
                    type="checkbox"
                    checked={dia?.ativo ?? false}
                    onChange={e => { e.stopPropagation(); atualizarDia(diaSemana, 'ativo', e.target.checked); }}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: dia?.ativo ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {DIAS_COMPLETOS[diaSemana]}
                    </span>
                    {dia?.ativo && (
                      <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {dia.hora_inicio} – {dia.hora_fim} | {dia.duracao_slot_min}min | {dia.vagas} vagas | {setores.find(s => s.id === dia.setor_id)?.nome || 'Sem setor'}
                      </span>
                    )}
                  </div>
                  {isExpandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {isExpandido && dia?.ativo && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={LABEL_STYLE}>Hora Início</label>
                        <input
                          type="time"
                          value={dia.hora_inicio}
                          onChange={e => atualizarDia(diaSemana, 'hora_inicio', e.target.value)}
                          style={INPUT_STYLE}
                        />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Hora Fim</label>
                        <input
                          type="time"
                          value={dia.hora_fim}
                          onChange={e => atualizarDia(diaSemana, 'hora_fim', e.target.value)}
                          style={INPUT_STYLE}
                        />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Duração Slot (min)</label>
                        <input
                          type="number"
                          value={dia.duracao_slot_min}
                          onChange={e => atualizarDia(diaSemana, 'duracao_slot_min', Number(e.target.value))}
                          min={15}
                          max={240}
                          step={15}
                          style={INPUT_STYLE}
                        />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Vagas por Slot</label>
                        <input
                          type="number"
                          value={dia.vagas}
                          onChange={e => atualizarDia(diaSemana, 'vagas', Number(e.target.value))}
                          min={1}
                          style={INPUT_STYLE}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={LABEL_STYLE}>Clínica / Setor</label>
                      <select
                        value={dia.setor_id ?? ''}
                        onChange={e => atualizarDia(diaSemana, 'setor_id', e.target.value ? Number(e.target.value) : null)}
                        style={{ ...INPUT_STYLE, background: '#FFF' }}
                      >
                        <option value="">Selecione o setor...</option>
                        {setores.map(s => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={LABEL_STYLE}>Cursos Compatíveis (deixe vazio = todos)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {cursos.map(c => (
                          <button
                            key={c.id}
                            onClick={() => atualizarDia(diaSemana, 'curso_ids', toggleArrayItem(dia.curso_ids, c.id))}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: dia.curso_ids.includes(c.id) ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                              background: dia.curso_ids.includes(c.id) ? '#E0F2FE' : '#FFF',
                              color: dia.curso_ids.includes(c.id) ? 'var(--primary)' : 'var(--text-muted)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {c.nome}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={LABEL_STYLE}>Períodos Compatíveis (deixe vazio = todos)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {periodos.map(p => (
                          <button
                            key={p.id}
                            onClick={() => atualizarDia(diaSemana, 'periodo_ids', toggleArrayItem(dia.periodo_ids, p.id))}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: dia.periodo_ids.includes(p.id) ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                              background: dia.periodo_ids.includes(p.id) ? '#E0F2FE' : '#FFF',
                              color: dia.periodo_ids.includes(p.id) ? 'var(--primary)' : 'var(--text-muted)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {p.nome}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={LABEL_STYLE}>Turnos Compatíveis (deixe vazio = todos)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {turnos.map(t => (
                          <button
                            key={t.id}
                            onClick={() => atualizarDia(diaSemana, 'turno_ids', toggleArrayItem(dia.turno_ids, t.id))}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: dia.turno_ids.includes(t.id) ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                              background: dia.turno_ids.includes(t.id) ? '#E0F2FE' : '#FFF',
                              color: dia.turno_ids.includes(t.id) ? 'var(--primary)' : 'var(--text-muted)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {t.nome}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#F1F5F9', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <strong>Preview:</strong> {dia.hora_inicio} – {dia.hora_fim} | Faixas de {dia.duracao_slot_min}min | {(() => {
                        const [hI, mI] = dia.hora_inicio.split(':').map(Number);
                        const [hF, mF] = dia.hora_fim.split(':').map(Number);
                        const totalMin = (hF * 60 + mF) - (hI * 60 + mI);
                        return Math.floor(totalMin / dia.duracao_slot_min);
                      })()} slots por dia
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Section 3: Exceções Individuais ───
const SectionExcecoes = ({
  excecoes,
  setExcecoes,
  showToast,
  onRecarregar,
}: {
  excecoes: ExcecaoGrade[];
  setExcecoes: (e: ExcecaoGrade[]) => void;
  showToast: (msg: string, tipo?: ToastMessage['tipo']) => void;
  onRecarregar: () => void;
}) => {
  const [buscaAluno, setBuscaAluno] = useState('');
  const [alunosEncontrados, setAlunosEncontrados] = useState<Array<{ id: string; nome: string; matricula: string }>>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<{ id: string; nome: string; matricula: string } | null>(null);
  const [prazoFim, setPrazoFim] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);

  const buscarAlunos = useCallback(async () => {
    if (buscaAluno.trim().length < 2) {
      setAlunosEncontrados([]);
      return;
    }
    setBuscando(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, matricula')
        .eq('perfil', 'aluno')
        .or(`nome.ilike.%${buscaAluno}%,matricula.ilike.%${buscaAluno}%`)
        .limit(10);
      if (error) throw error;
      setAlunosEncontrados((data || []).map((a: Record<string, unknown>) => ({
        id: String(a.id),
        nome: String(a.nome),
        matricula: String(a.matricula),
      })));
    } catch {
      setAlunosEncontrados([]);
    } finally {
      setBuscando(false);
    }
  }, [buscaAluno]);

  useEffect(() => {
    const timeout = setTimeout(buscarAlunos, 400);
    return () => clearTimeout(timeout);
  }, [buscarAlunos]);

  const handleCriarExcecao = async () => {
    if (!alunoSelecionado || !prazoFim || !justificativa.trim()) {
      showToast('Selecione um aluno, informe o prazo e a justificativa.', 'erro');
      return;
    }
    setCriando(true);
    try {
      await adminService.criarExcecaoGrade(Number(alunoSelecionado.id), prazoFim, justificativa.trim());
      onRecarregar();
      setAlunoSelecionado(null);
      setBuscaAluno('');
      setPrazoFim('');
      setJustificativa('');
      setMostrarForm(false);
      showToast('Exceção criada com sucesso!', 'sucesso');
    } catch (err) {
      showToast('Erro ao criar exceção: ' + ((err as Error).message || 'Tente novamente.'), 'erro');
    } finally {
      setCriando(false);
    }
  };

  const handleAprovarExcecao = async (excecao: ExcecaoGrade) => {
    try {
      await adminService.atualizarExcecaoGrade(Number(excecao.id), 'aceita');
      setExcecoes(excecoes.map(e => e.id === excecao.id ? { ...e, status: 'aceita' } : e));
      showToast('Exceção aprovada com sucesso!', 'sucesso');
    } catch (err) {
      showToast('Erro ao aprovar exceção: ' + ((err as Error).message || 'Tente novamente.'), 'erro');
    }
  };

  const handleRejeitarExcecao = async (excecao: ExcecaoGrade) => {
    try {
      await adminService.atualizarExcecaoGrade(Number(excecao.id), 'rejeitada');
      setExcecoes(excecoes.map(e => e.id === excecao.id ? { ...e, status: 'rejeitada' } : e));
      showToast('Exceção rejeitada.', 'info');
    } catch (err) {
      showToast('Erro ao rejeitar exceção: ' + ((err as Error).message || 'Tente novamente.'), 'erro');
    }
  };

  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} /> Exceções Individuais
        </h3>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.5rem 1rem', fontSize: '0.82rem' }}
        >
          <Plus size={14} /> Nova Exceção
        </button>
      </div>

      {mostrarForm && (
        <div style={{ ...CARD_STYLE, background: '#F8FAFC', borderColor: 'var(--primary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL_STYLE}>Buscar Aluno (nome ou matrícula)</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={buscaAluno}
                  onChange={e => { setBuscaAluno(e.target.value); setAlunoSelecionado(null); }}
                  style={{ ...INPUT_STYLE, paddingLeft: 32 }}
                  placeholder="Digite o nome ou matrícula..."
                />
                {alunosEncontrados.length > 0 && !alunoSelecionado && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#FFF', border: '1px solid var(--border-color)', borderRadius: 8, zIndex: 10, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {alunosEncontrados.map(a => (
                      <button
                        key={a.id}
                        onClick={() => { setAlunoSelecionado(a); setBuscaAluno(`${a.nome} (${a.matricula})`); setAlunosEncontrados([]); }}
                        style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #F1F5F9' }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.background = '#F1F5F9'; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
                      >
                        <strong>{a.nome}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>— {a.matricula}</span>
                      </button>
                    ))}
                  </div>
                )}
                {buscando && <Loader2 size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }} />}
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>Prazo Final *</label>
              <input
                type="date"
                value={prazoFim}
                onChange={e => setPrazoFim(e.target.value)}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Justificativa *</label>
              <input
                type="text"
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                style={INPUT_STYLE}
                placeholder="Motivo da exceção..."
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button onClick={() => setMostrarForm(false)} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>Cancelar</button>
            <button
              onClick={handleCriarExcecao}
              disabled={criando || !alunoSelecionado || !prazoFim || !justificativa.trim()}
              className="btn-primary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, opacity: criando || !alunoSelecionado || !prazoFim || !justificativa.trim() ? 0.5 : 1 }}
            >
              <Save size={13} /> {criando ? 'Criando...' : 'Criar Exceção'}
            </button>
          </div>
        </div>
      )}

      {excecoes.length === 0 ? (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <AlertTriangle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>Nenhuma exceção individual registrada.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Matrícula</th>
                <th>Prazo Fim</th>
                <th>Justificativa</th>
                <th>Status</th>
                <th style={{ width: 160 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {excecoes.map(ex => (
                <tr key={ex.id}>
                  <td style={{ fontWeight: 600 }}>{ex.aluno_nome}</td>
                  <td><code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{ex.matricula}</code></td>
                  <td>{formatarData(ex.prazo_fim)}</td>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.justificativa}</td>
                  <td>
                    <span style={BADGE_STYLE(ex.status === 'aprovada' ? 'sucesso' : ex.status === 'rejeitada' ? 'erro' : 'alerta')}>
                      {ex.status === 'aprovada' ? 'Aprovada' : ex.status === 'rejeitada' ? 'Rejeitada' : 'Pendente'}
                    </span>
                  </td>
                  <td>
                    {ex.status === 'pendente' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleAprovarExcecao(ex)}
                          style={{ background: '#DCFCE7', border: 'none', color: '#16A34A', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.78rem', fontWeight: 600 }}
                          title="Aprovar"
                        >
                          <CheckCircle size={13} /> Aprovar
                        </button>
                        <button
                          onClick={() => handleRejeitarExcecao(ex)}
                          style={{ background: '#FEE2E2', border: 'none', color: '#DC2626', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.78rem', fontWeight: 600 }}
                          title="Rejeitar"
                        >
                          <XCircle size={13} /> Rejeitar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Section 3: Seleções dos Alunos ───
const SectionSelecoes = ({
  selecoes,
}: {
  selecoes: SelecaoAluno[];
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={18} /> Seleções dos Alunos
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selecoes.length} aluno(s)</span>
      </div>

      {selecoes.length === 0 ? (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <BookOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>Nenhum aluno selecionou horários ainda.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Aluno</th>
                <th>Matrícula</th>
                <th>Curso</th>
                <th>Carga Horária</th>
                <th>Total Horas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {selecoes.map(sel => {
                const horasCombinam = Math.abs(sel.total_horas - sel.carga_horaria) < 0.01;
                const isOpen = expandedId === sel.aluno_id;
                return (
                  <>
                    <tr key={sel.aluno_id} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isOpen ? null : sel.aluno_id)}>
                      <td>
                        {isOpen ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                      </td>
                      <td style={{ fontWeight: 600 }}>{sel.aluno_nome}</td>
                      <td><code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{sel.matricula}</code></td>
                      <td>{sel.curso_nome || '-'}</td>
                      <td>{sel.carga_horaria}h</td>
                      <td style={{ color: horasCombinam ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                        {sel.total_horas.toFixed(1)}h
                        {!horasCombinam && (
                          <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>
                            ({sel.total_horas > sel.carga_horaria ? '+' : ''}{(sel.total_horas - sel.carga_horaria).toFixed(1)}h)
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={BADGE_STYLE(sel.status === 'confirmado' ? 'sucesso' : 'alerta')}>
                          {sel.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${sel.aluno_id}-detail`}>
                        <td colSpan={7} style={{ padding: '0.75rem 1rem', background: '#F8FAFC', borderBottom: '2px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem' }}>
                            <Clock size={13} color="var(--text-muted)" />
                            <strong style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>Horários Selecionados</strong>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {sel.selecoes.map((s, i) => (
                              <span
                                key={i}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: '#E0F2FE',
                                  color: '#0284C7',
                                }}
                              >
                                {DIAS_SEMANA[s.dia]} {s.hora_inicio}-{s.hora_fim}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ───
export const GradeSemanalPage = () => {
  const { showToast } = useAuth();
  const [config, setConfig] = useState<ConfigGrade>(INITIAL_CONFIG);
  const [excecoes, setExcecoes] = useState<ExcecaoGrade[]>([]);
  const [selecoes, setSelecoes] = useState<SelecaoAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configResult, excecoesResult, selecoesResult] = await Promise.allSettled([
        adminService.getConfigGradeSemanal(),
        adminService.getExcecoesGrade(),
        adminService.getSelecoesGradeAlunos(),
      ]);

      if (configResult.status === 'fulfilled' && configResult.value) {
        setConfig(configResult.value as unknown as ConfigGrade);
      }

      if (excecoesResult.status === 'fulfilled' && Array.isArray(excecoesResult.value)) {
        const mapped = excecoesResult.value.map((e: Record<string, unknown>) => {
          const aluno = e.alunos as Record<string, unknown> | null;
          const usuario = aluno?.usuarios as Record<string, unknown> | null;
          return {
            id: String(e.id),
            aluno_id: String(e.aluno_id),
            aluno_nome: (usuario?.nome as string) || '-',
            matricula: (usuario?.matricula as string) || '-',
            prazo_fim: String(e.prazo_fim || ''),
            justificativa: String(e.justificativa || ''),
            status: String(e.status || 'pendente'),
            criado_em: String(e.criado_em || ''),
          } as ExcecaoGrade;
        });
        setExcecoes(mapped);
      }

      if (selecoesResult.status === 'fulfilled' && Array.isArray(selecoesResult.value)) {
        const mapped = selecoesResult.value.map((s: Record<string, unknown>) => {
          return {
            aluno_id: String(s.aluno_id),
            aluno_nome: String(s.aluno_nome || '-'),
            matricula: String(s.matricula || '-'),
            curso_nome: String(s.curso_nome || '-'),
            carga_horaria: Number(s.carga_horaria || 0),
            total_horas: Number(s.total_horas || 0),
            selecoes: Array.isArray(s.selecoes) ? s.selecoes : [],
            status: s.confirmado ? 'confirmado' : 'pendente',
          } as SelecaoAluno;
        });
        setSelecoes(mapped);
      }
    } catch (err) {
      setError('Erro ao carregar dados da grade semanal.');
      showToast('Erro ao carregar dados: ' + ((err as Error).message || 'Tente novamente.'), 'erro');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  if (loading) {
    return (
      <section>
        <div className="page-header">
          <h1 className="page-title">Grade Semanal</h1>
          <p className="page-subtitle">Configuração e gestão da grade semanal de atendimentos.</p>
        </div>
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Carregando dados da grade semanal...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <div className="page-header">
          <h1 className="page-title">Grade Semanal</h1>
          <p className="page-subtitle">Configuração e gestão da grade semanal de atendimentos.</p>
        </div>
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '2rem', borderColor: '#FEE2E2' }}>
          <AlertTriangle size={32} style={{ marginBottom: 8, color: '#DC2626', opacity: 0.6 }} />
          <p style={{ color: '#DC2626', fontSize: '0.9rem', margin: 0 }}>{error}</p>
          <button onClick={carregarDados} className="btn-primary" style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Tentar Novamente</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Grade Semanal</h1>
        <p className="page-subtitle">Configuração e gestão da grade semanal de atendimentos.</p>
      </div>

      <SectionConfigGrade config={config} setConfig={setConfig} showToast={showToast} />

      <SectionDiasGrade
        configId={config.id ? Number(config.id) : 0}
        showToast={showToast}
        onRecarregar={carregarDados}
      />

      <SectionExcecoes excecoes={excecoes} setExcecoes={setExcecoes} showToast={showToast} onRecarregar={carregarDados} />

      <SectionSelecoes selecoes={selecoes} />
    </section>
  );
};
