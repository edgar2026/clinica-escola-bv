import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { getAlunoId } from '../../services/helpers';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Clock, CheckCircle, Lock, AlertTriangle, RefreshCw } from 'lucide-react';

const DIAS_SEMANA: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

interface InscricaoStatus {
  aberta: boolean;
  motivo?: string;
  config_id?: number;
  inscricao_inicio?: string;
  inscricao_fim?: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  categoria_carga?: number;
}

interface SlotGrade {
  id: string;
  setor_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  capacidade_max: number;
  vagas_disponiveis: number;
  setores: { nome: string } | null;
  status: string;
}

interface SelecaoGrade {
  id: number;
  vaga_horario_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  confirmado: boolean;
  setor_nome: number;
  capacidade_max: number;
  vagas_disponiveis: number;
}

interface GradeAlunoResponse {
  tem_grade: boolean;
  confirmado: boolean;
  selecoes: SelecaoGrade[];
  config_id: number;
  inscricao_inicio: string;
  inscricao_fim: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  categoria_carga: number;
}

const calcularDuracaoHoras = (inicio: string, fim: string): number => {
  const [hI, mI] = inicio.split(':').map(Number);
  const [hF, mF] = fim.split(':').map(Number);
  return (hF * 60 + mF - hI * 60 - mI) / 60;
};

export const GradeSemanalAlunoPage = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
  const { showToast } = useAuth();

  const [loading, setLoading] = useState(true);
  const [alunoId, setAlunoId] = useState<number | null>(null);
  const [inscricao, setInscricao] = useState<InscricaoStatus | null>(null);
  const [slots, setSlots] = useState<SlotGrade[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [gradeConfirmada, setGradeConfirmada] = useState<GradeAlunoResponse | null>(null);
  const [categoriaCarga, setCategoriaCarga] = useState(6);
  const [configId, setConfigId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const totalHorasSelecionadas = slots
    .filter(s => selecionados.has(s.id))
    .reduce((acc, s) => acc + calcularDuracaoHoras(s.hora_inicio, s.hora_fim), 0);

  const podeConfirmar = totalHorasSelecionadas > 0 && totalHorasSelecionadas === categoriaCarga;

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const id = await getAlunoId();
      setAlunoId(id ? Number(id) : null);

      const { data: statusInscricao, error: errInscricao } = await supabase.rpc('verificar_inscricao_aberta', {
        p_aluno_id: id,
      });

      if (errInscricao) throw errInscricao;

      const status: InscricaoStatus = {
        aberta: statusInscricao?.inscricao_aberta ?? false,
        motivo: statusInscricao?.mensagem,
        config_id: statusInscricao?.config_id,
        inscricao_inicio: statusInscricao?.inscricao_inicio,
        inscricao_fim: statusInscricao?.inscricao_fim,
        vigencia_inicio: statusInscricao?.vigencia_inicio,
        vigencia_fim: statusInscricao?.vigencia_fim,
        categoria_carga: 6,
      };

      setInscricao(status);

      const { data: gradeData, error: errGrade } = await supabase.rpc('obter_grade_aluno', {
        p_aluno_id: id,
      });

      if (errGrade) throw errGrade;

      const grade: GradeAlunoResponse = gradeData;

      if (grade?.tem_grade) {
        setCategoriaCarga(grade.categoria_carga ?? 6);
        setConfigId(grade.config_id);

        if (grade.confirmado) {
          setGradeConfirmada(grade);
          return;
        }

        const selecionadosAtuais = new Set<string>(
          grade.selecoes?.map(s => String(s.vaga_horario_id)) || []
        );
        setSelecionados(selecionadosAtuais);
      } else if (grade?.categoria_carga) {
        setCategoriaCarga(grade.categoria_carga);
      }

      if (status.config_id) {
        setConfigId(status.config_id);
      }

      const effectiveConfigId = grade?.config_id || status.config_id;

      const { data: slotsData, error: errSlots } = await supabase
        .from('vagas_horarios')
        .select('*, setores(nome)')
        .eq('status', 'ativo')
        .eq('config_id', effectiveConfigId)
        .order('dia_semana', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (errSlots) throw errSlots;
      setSlots((slotsData as SlotGrade[]) || []);
    } catch (err) {
      showToast('Erro ao carregar dados: ' + (err instanceof Error ? err.message : ''), 'erro');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const toggleSlot = async (slotId: string) => {
    if (gradeConfirmada || !alunoId || !configId) return;

    const slot = slots.find(s => s.id === slotId);
    const jaSelecionado = selecionados.has(slotId);

    if (!jaSelecionado && slot && slot.vagas_disponiveis <= 0) {
      showToast('Este horário não possui vagas disponíveis.', 'erro');
      return;
    }

    const novosSelecionados = new Set(selecionados);

    if (jaSelecionado) {
      novosSelecionados.delete(slotId);
    } else {
      novosSelecionados.add(slotId);
    }

    setSelecionados(novosSelecionados);

    try {
      const { data, error } = await supabase.rpc('salvar_selecao_grade', {
        p_aluno_id: alunoId,
        p_config_id: configId,
        p_vaga_horario_id: Number(slotId),
      });

      if (error) throw error;

      const resultado = data;
      if (resultado && !resultado.sucesso) {
        showToast(resultado.mensagem || 'Erro ao salvar seleção', 'erro');
        setSelecionados(selecionados);
        return;
      }

      if (resultado && resultado.vagas_disponiveis !== undefined) {
        setSlots(prev => prev.map(s =>
          s.id === slotId ? { ...s, vagas_disponiveis: resultado.vagas_disponiveis } : s
        ));
      }
    } catch (err) {
      showToast('Erro ao salvar seleção: ' + (err instanceof Error ? err.message : ''), 'erro');
      setSelecionados(selecionados);
    }
  };

  const handleConfirmarGrade = async () => {
    if (!podeConfirmar || !alunoId || !configId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('confirmar_grade', {
        p_aluno_id: alunoId,
        p_config_id: configId,
      });

      if (error) throw error;

      const resultado = data;
      if (resultado && !resultado.sucesso) {
        showToast(resultado.mensagem || 'Erro ao confirmar grade', 'erro');
        return;
      }

      showToast('Grade semanal confirmada com sucesso! Seu horário está firmado para toda a vigência.', 'sucesso');
      setConfirmModalOpen(false);
      await carregarDados();
    } catch (err) {
      showToast('Erro ao confirmar grade: ' + (err instanceof Error ? err.message : ''), 'erro');
    } finally {
      setSaving(false);
    }
  };

  const slotsPorDia = slots.reduce<Record<number, SlotGrade[]>>((acc, slot) => {
    if (!acc[slot.dia_semana]) {
      acc[slot.dia_semana] = [];
    }
    acc[slot.dia_semana].push(slot);
    return acc;
  }, {});

  const diasComSlots = Object.keys(slotsPorDia)
    .map(Number)
    .filter(d => DIAS_SEMANA[d])
    .sort((a, b) => a - b);

  if (loading) {
    return (
      <section>
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>
          Carregando grade semanal...
        </div>
      </section>
    );
  }

  if (!inscricao) {
    return (
      <section>
        <div className="page-header">
          <h1 className="page-title">Grade Semanal de Prática</h1>
        </div>
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: 12,
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <AlertTriangle size={24} color="#F59E0B" />
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#92400E' }}>Dados não disponíveis</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#92400E' }}>
              Não foi possível carregar as informações de inscrição.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!inscricao.aberta && !gradeConfirmada) {
    return (
      <section>
        <div className="page-header">
          <h1 className="page-title">Grade Semanal de Prática</h1>
        </div>
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: 12,
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
        }}>
          <AlertTriangle size={24} color="#F59E0B" />
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#92400E' }}>Inscrição Não Aberta</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#92400E' }}>
              {inscricao.motivo || 'O período de inscrição para grade semanal não está aberto no momento.'}
            </p>
          </div>
        </div>

        <div style={{
          background: '#FFF',
          borderRadius: 12,
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          fontSize: '0.9rem',
        }}>
          <h3 style={{ color: 'var(--primary)', margin: '0 0 0.75rem', fontWeight: 700 }}>
            Próximo Período de Inscrição
          </h3>
          {inscricao.inscricao_inicio && inscricao.inscricao_fim && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              <div><strong>Início:</strong> {new Date(inscricao.inscricao_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              <div><strong>Fim:</strong> {new Date(inscricao.inscricao_fim + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              {inscricao.vigencia_inicio && (
                <div><strong>Vigência:</strong> {new Date(inscricao.vigencia_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} – {inscricao.vigencia_fim ? new Date(inscricao.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <button onClick={() => setActiveTab('meu-horario-firmado')} className="btn-secondary">
            Ver Horário Firmado
          </button>
        </div>
      </section>
    );
  }

  if (gradeConfirmada) {
    const selecoesPorDia = gradeConfirmada.selecoes?.reduce<Record<number, SelecaoGrade[]>>((acc, s) => {
      if (!acc[s.dia_semana]) acc[s.dia_semana] = [];
      acc[s.dia_semana].push(s);
      return acc;
    }, {}) || {};

    const diasConfirmados = Object.keys(selecoesPorDia).map(Number).sort((a, b) => a - b);

    return (
      <section>
        <div className="page-header">
          <h1 className="page-title">Grade Semanal de Prática</h1>
          <p className="page-subtitle">Sua grade semanal está firmada para toda a vigência.</p>
        </div>

        <div style={{
          background: '#D1FAE5',
          border: '1px solid #10B981',
          borderRadius: 12,
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          <Lock size={20} color="#065F46" />
          <p style={{ margin: 0, color: '#065F46', fontWeight: 700, fontSize: '0.95rem' }}>
            Horário Firmado — Categoria {categoriaCarga}h semanais — Não é possível alterar.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${diasConfirmados.length || 1}, 1fr)`,
          gap: '1rem',
        }}>
          {diasConfirmados.map(dia => (
            <div key={dia}>
              <div style={{
                background: 'var(--primary)',
                color: '#FFF',
                padding: '0.75rem',
                borderRadius: '10px 10px 0 0',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.88rem',
              }}>
                {DIAS_SEMANA[dia]}
              </div>
              <div style={{
                background: '#FFF',
                borderRadius: '0 0 10px 10px',
                border: '1px solid var(--border-color)',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                {selecoesPorDia[dia]?.map(s => (
                  <div
                    key={s.vaga_horario_id}
                    style={{
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: 8,
                      padding: '0.65rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 700, fontSize: '0.82rem', color: '#065F46' }}>
                      <Clock size={13} />
                      {s.hora_inicio} – {s.hora_fim}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 4 }}>
                      <CheckCircle size={12} color="#10B981" />
                      <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Firmado</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('registro-ponto')} className="btn-primary">
            Registrar Presença
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Grade Semanal de Prática</h1>
        <p className="page-subtitle">
          Selecione os horários de prática conforme sua categoria ({categoriaCarga}h semanais).
        </p>
      </div>

      <div style={{
        background: '#FFF',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.25rem',
        fontSize: '0.88rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div>
          <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Período de Inscrição
          </span>
          <div style={{ fontWeight: 700, color: '#1E293B' }}>
            {inscricao.inscricao_inicio ? new Date(inscricao.inscricao_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
            {' – '}
            {inscricao.inscricao_fim ? new Date(inscricao.inscricao_fim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
          </div>
        </div>
        <div>
          <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Vigência
          </span>
          <div style={{ fontWeight: 700, color: '#1E293B' }}>
            {inscricao.vigencia_inicio ? new Date(inscricao.vigencia_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
            {' – '}
            {inscricao.vigencia_fim ? new Date(inscricao.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
          </div>
        </div>
        <div>
          <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Categoria
          </span>
          <div style={{ fontWeight: 700, color: '#1E293B' }}>
            {categoriaCarga}h semanais
          </div>
        </div>
      </div>

      {slots.length === 0 ? (
        <div style={{
          background: '#FFF',
          borderRadius: 12,
          border: '1px solid var(--border-color)',
          padding: '4rem',
          textAlign: 'center',
          color: '#94A3B8',
        }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#64748B' }}>
            Nenhum horário disponível
          </p>
          <p style={{ fontSize: '0.9rem' }}>
            Aguarde a administração configurar os horários de prática.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${diasComSlots.length || 1}, 1fr)`,
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          {diasComSlots.map(dia => (
            <div key={dia}>
              <div style={{
                background: 'var(--primary)',
                color: '#FFF',
                padding: '0.75rem',
                borderRadius: '10px 10px 0 0',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.88rem',
              }}>
                {DIAS_SEMANA[dia]}
              </div>
              <div style={{
                background: '#FFF',
                borderRadius: '0 0 10px 10px',
                border: '1px solid var(--border-color)',
                borderTop: 'none',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                {slotsPorDia[dia].map(slot => {
                  const isSelected = selecionados.has(slot.id);
                  const duracao = calcularDuracaoHoras(slot.hora_inicio, slot.hora_fim);
                  const lotado = slot.vagas_disponiveis <= 0 && !isSelected;

                  return (
                    <button
                      key={slot.id}
                      onClick={() => toggleSlot(slot.id)}
                      disabled={lotado}
                      style={{
                        background: isSelected ? 'var(--primary)' : lotado ? '#F1F5F9' : '#FFF',
                        border: isSelected ? '2px solid var(--primary)' : lotado ? '2px solid #CBD5E1' : '2px solid #E2E8F0',
                        borderRadius: 8,
                        padding: '0.75rem',
                        cursor: lotado ? 'not-allowed' : 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(16,78,141,0.25)' : 'none',
                        opacity: lotado ? 0.6 : 1,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: isSelected ? '#FFF' : lotado ? '#94A3B8' : '#1E293B',
                      }}>
                        <Clock size={13} />
                        {slot.hora_inicio} – {slot.hora_fim}
                      </div>
                      <div style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: isSelected ? 'rgba(255,255,255,0.85)' : lotado ? '#94A3B8' : '#047857',
                        marginTop: 3,
                      }}>
                        {slot.setores?.nome || 'Clínica-Escola'}
                      </div>
                      <div style={{
                        fontSize: '0.68rem',
                        color: isSelected ? 'rgba(255,255,255,0.7)' : lotado ? '#EF4444' : '#94A3B8',
                        marginTop: 3,
                        fontWeight: lotado ? 700 : 400,
                      }}>
                        {lotado ? 'Lotado' : `${slot.vagas_disponiveis} de ${slot.capacidade_max} vagas`}
                      </div>
                      <div style={{
                        fontSize: '0.68rem',
                        color: isSelected ? 'rgba(255,255,255,0.7)' : '#94A3B8',
                        marginTop: 2,
                      }}>
                        {duracao}h
                      </div>
                      {isSelected && (
                        <div style={{ marginTop: 4 }}>
                          <CheckCircle size={14} color="#FFF" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        position: 'sticky',
        bottom: 0,
        background: '#FFF',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        padding: '1rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
      }}>
        <div>
          <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, marginBottom: 2 }}>
            Horas selecionadas
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: totalHorasSelecionadas === categoriaCarga
                ? '#10B981'
                : totalHorasSelecionadas > categoriaCarga
                  ? '#EF4444'
                  : 'var(--primary)',
            }}>
              {totalHorasSelecionadas}h
            </span>
            <span style={{ fontSize: '0.95rem', color: '#94A3B8', fontWeight: 600 }}>
              / {categoriaCarga}h
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={carregarDados}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={15} /> Atualizar
          </button>

          {podeConfirmar && (
            <button
              onClick={() => setConfirmModalOpen(true)}
              disabled={saving}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#10B981',
                boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                opacity: saving ? 0.7 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Confirmando...' : <><CheckCircle size={16} /> Confirmar Horário Firmado</>}
            </button>
          )}

          {!podeConfirmar && totalHorasSelecionadas > 0 && totalHorasSelecionadas !== categoriaCarga && (
            <span style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: totalHorasSelecionadas > categoriaCarga ? '#EF4444' : '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <AlertTriangle size={14} />
              {totalHorasSelecionadas > categoriaCarga
                ? `Excedeu por ${totalHorasSelecionadas - categoriaCarga}h`
                : `Faltam ${categoriaCarga - totalHorasSelecionadas}h`
              }
            </span>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModalOpen}
        title="Confirmar Horário Firmado"
        message={`Tem certeza que deseja confirmar esta grade? Você selecionou ${totalHorasSelecionadas}h em ${selecionados.size} horário(s). Após a confirmação, o horário será firmado para toda a vigência e não poderá ser alterado.`}
        confirmText="Sim, Firmar Horário"
        cancelText="Voltar e Editar"
        confirmVariant="success"
        onConfirm={handleConfirmarGrade}
        onCancel={() => setConfirmModalOpen(false)}
      />
    </section>
  );
};
