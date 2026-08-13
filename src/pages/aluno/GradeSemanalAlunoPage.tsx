import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { getAlunoId } from '../../services/helpers';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Clock, CheckCircle, Lock, AlertTriangle, RefreshCw, Calendar as CalendarIcon, X, ArrowRight } from 'lucide-react';

const DIAS_SEMANA: Record<number, string> = {
  1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado',
};
const DIAS_SEMANA_CURTO: Record<number, string> = {
  1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
};

interface InscricaoStatus {
  aberta: boolean;
  motivo?: string;
  config_id?: number;
  inscricao_inicio?: string;
  inscricao_fim?: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
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
  setor_nome?: string | number;
  capacidade_max?: number;
  vagas_disponiveis?: number;
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
  horas_firmadas: number;
  horas_rascunho: number;
  total_horas_selecionadas: number;
  campos_pendentes?: string[];
  pode_exibir_grade?: boolean;
  confirmado_em?: string;
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
  const [gradeData, setGradeData] = useState<GradeAlunoResponse | null>(null);
  const [categoriaCarga, setCategoriaCarga] = useState(4);
  const [camposPendentes, setCamposPendentes] = useState<string[]>([]);
  const [configId, setConfigId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [diaSelecionadoMobile, setDiaSelecionadoMobile] = useState<number>(1);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalHorasSelecionadas = slots
    .filter(s => selecionados.has(s.id))
    .reduce((acc, s) => acc + calcularDuracaoHoras(s.hora_inicio, s.hora_fim), 0);

  const horasFirmadas = gradeData?.horas_firmadas ?? 0;
  const horasRascunho = gradeData?.horas_rascunho ?? 0;
  const emModoComplemento = horasFirmadas > 0 && horasFirmadas < categoriaCarga && !gradeData?.confirmado;
  const emModoReducao = gradeData && gradeData.selecoes.length > 0 && !gradeData.confirmado
    && horasFirmadas === 0 && horasRascunho > 0 && horasRascunho !== categoriaCarga;
  const gradeFirmada = gradeData?.confirmado === true;
  const podeConfirmar = totalHorasSelecionadas === categoriaCarga && categoriaCarga > 0 && totalHorasSelecionadas > 0;
  const cargaCompleta = totalHorasSelecionadas === categoriaCarga && categoriaCarga > 0;
  const categoriaNaoDefinida = !gradeFirmada && (!categoriaCarga || categoriaCarga <= 0);
  const temRascunho = gradeData && gradeData.selecoes.length > 0 && !gradeData.confirmado && horasRascunho > 0;

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
      };
      setInscricao(status);

      const { data: gd, error: errGrade } = await supabase.rpc('obter_grade_aluno', { p_aluno_id: id });
      if (errGrade) throw errGrade;

      const grade: GradeAlunoResponse = gd;
      setGradeData(grade);

      if (grade?.campos_pendentes && grade.campos_pendentes.length > 0) {
        setCamposPendentes(grade.campos_pendentes);
      } else {
        setCamposPendentes([]);
      }

      if (grade?.categoria_carga) {
        setCategoriaCarga(grade.categoria_carga);
      }

      const effectiveConfigId = grade?.config_id || status.config_id;
      if (effectiveConfigId) {
        setConfigId(effectiveConfigId);
      }

      if (grade?.confirmado) {
        const selSet = new Set<string>(
          grade.selecoes?.map(s => String(s.vaga_horario_id)) || []
        );
        setSelecionados(selSet);
        return;
      }

      const selSet = new Set<string>(
        grade.selecoes?.map(s => String(s.vaga_horario_id)) || []
      );
      setSelecionados(selSet);

      if (effectiveConfigId) {
        const { data: alunoData } = await supabase
          .from('alunos')
          .select('curso_id')
          .eq('id', id)
          .single();

        let query = supabase
          .from('vagas_horarios')
          .select('*, setores(nome)')
          .eq('status', 'ativo')
          .or(`config_id.eq.${effectiveConfigId},config_id.is.null`);

        if (alunoData?.curso_id) {
          query = query.or(`curso_id.eq.${alunoData.curso_id},curso_id.is.null`);
        }

        const { data: slotsData, error: errSlots } = await query
          .order('dia_semana', { ascending: true })
          .order('hora_inicio', { ascending: true });

        if (errSlots) throw errSlots;
        const loadedSlots = (slotsData as SlotGrade[]) || [];
        setSlots(loadedSlots);

        if (loadedSlots.length > 0) {
          const diasDisponiveis = Array.from(new Set(loadedSlots.map(s => s.dia_semana))).sort((a, b) => a - b);
          setDiaSelecionadoMobile(prev => diasDisponiveis.includes(prev) ? prev : diasDisponiveis[0]);
        }
      }
    } catch (err) {
      showToast('Erro ao carregar dados: ' + (err instanceof Error ? err.message : ''), 'erro');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const toggleSlot = async (slotId: string) => {
    if (gradeFirmada || !alunoId || !configId) return;

    const slot = slots.find(s => s.id === slotId);
    const jaSelecionado = selecionados.has(slotId);

    if (!jaSelecionado && slot && slot.vagas_disponiveis <= 0) {
      showToast('Este horário está indisponível.', 'erro');
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
      await carregarDados();
    } catch (err) {
      showToast('Erro ao salvar seleção: ' + (err instanceof Error ? err.message : ''), 'erro');
      setSelecionados(selecionados);
    }
  };

  const handleCancelarSelecao = async () => {
    if (!alunoId || !configId || cancelando) return;
    setCancelando(true);
    try {
      const rascunhoSelecoes = gradeData?.selecoes?.filter(s => !s.confirmado) || [];
      for (const sel of rascunhoSelecoes) {
        await supabase.rpc('salvar_selecao_grade', {
          p_aluno_id: alunoId,
          p_config_id: configId,
          p_vaga_horario_id: sel.vaga_horario_id,
        });
      }
      showToast('Seleção cancelada. Apenas os horários firmados foram mantidos.', 'sucesso');
      await carregarDados();
    } catch (err) {
      showToast('Erro ao cancelar: ' + (err instanceof Error ? err.message : ''), 'erro');
    } finally {
      setCancelando(false);
    }
  };

  const handleConfirmarGrade = async () => {
    if (!podeConfirmar || !alunoId || !configId || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('confirmar_grade', {
        p_aluno_id: alunoId,
        p_config_id: configId,
      });
      if (error) throw error;

      const resultado = data;
      if (!resultado || !resultado.sucesso) {
        showToast(resultado?.mensagem || 'Não foi possível firmar o horário. Tente novamente.', 'erro');
        await carregarDados();
        return;
      }

      showToast('Grade semanal confirmada com sucesso! Seu horário está firmado para toda a vigência.', 'sucesso');
      setConfirmModalOpen(false);
      await carregarDados();
    } catch (err) {
      showToast('Erro ao confirmar grade: ' + (err instanceof Error ? err.message : ''), 'erro');
      setConfirmModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const slotsPorDia = slots.reduce<Record<number, SlotGrade[]>>((acc, slot) => {
    if (!acc[slot.dia_semana]) acc[slot.dia_semana] = [];
    acc[slot.dia_semana].push(slot);
    return acc;
  }, {});

  const diasComSlots = Object.keys(slotsPorDia).map(Number).filter(d => DIAS_SEMANA[d]).sort((a, b) => a - b);

  // --- Resumo para modal de confirmação ---
  const resumoPorDia = gradeData?.selecoes?.reduce<Record<number, SelecaoGrade[]>>((acc, s) => {
    if (!acc[s.dia_semana]) acc[s.dia_semana] = [];
    acc[s.dia_semana].push(s);
    return acc;
  }, {}) || {};

  // --- Loading ---
  if (loading) {
    return (
      <section style={{ width: '100%' }}>
        <div style={{ padding: '4rem 1rem', textAlign: 'center', color: '#94A3B8' }}>
          Carregando grade semanal...
        </div>
      </section>
    );
  }

  // --- Campos pendentes ---
  if (camposPendentes.length > 0 && !gradeFirmada) {
    return (
      <section style={{ width: '100%' }}>
        <div className="page-header">
          <h1 className="page-title">Grade Semanal de Prática</h1>
          <p className="page-subtitle">Configurações pendentes para exibição da grade semanal.</p>
        </div>
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={24} color="#D97706" style={{ flexShrink: 0 }} />
            <h3 style={{ margin: 0, color: '#92400E', fontWeight: 700, fontSize: '1rem' }}>
              Configuração Pendente para Exibição da Grade
            </h3>
          </div>
          <p style={{ fontSize: '0.88rem', color: '#92400E', margin: '0 0 0.75rem' }}>
            A exibição da sua grade semanal requer a conclusão dos seguintes itens do seu perfil acadêmico:
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#B45309', fontSize: '0.88rem', fontWeight: 600 }}>
            {camposPendentes.map((item, idx) => <li key={idx} style={{ marginBottom: 4 }}>{item}</li>)}
          </ul>
          <p style={{ fontSize: '0.82rem', color: '#78350F', margin: '1rem 0 0' }}>
            Por favor, solicite à administração a atualização desses dados para liberar a escolha dos seus horários.
          </p>
        </div>
      </section>
    );
  }

  // --- Dados indisponíveis ---
  if (!inscricao) {
    return (
      <section style={{ width: '100%' }}>
        <div className="page-header">
          <h1 className="page-title">Grade Semanal de Prática</h1>
        </div>
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 12, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
          <AlertTriangle size={24} color="#F59E0B" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#92400E' }}>Dados não disponíveis</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#92400E' }}>Não foi possível carregar as informações de inscrição.</p>
          </div>
        </div>
      </section>
    );
  }

  // --- Grade firmada (totalmente confirmada) ---
  if (gradeFirmada) {
    const selecoesPorDia = gradeData?.selecoes?.reduce<Record<number, SelecaoGrade[]>>((acc, s) => {
      if (!acc[s.dia_semana]) acc[s.dia_semana] = [];
      acc[s.dia_semana].push(s);
      return acc;
    }, {}) || {};
    const diasConfirmados = Object.keys(selecoesPorDia).map(Number).sort((a, b) => a - b);

    return (
      <section style={{ width: '100%' }}>
        <div className="page-header">
          <h1 className="page-title">Grade Semanal de Prática</h1>
          <p className="page-subtitle">Sua grade semanal está firmada para toda a vigência.</p>
        </div>

        <div style={{ background: '#D1FAE5', border: '1px solid #10B981', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', width: '100%' }}>
          <Lock size={20} color="#065F46" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, color: '#065F46', fontWeight: 700, fontSize: '0.92rem' }}>
            Horário Firmado — Carga completa: {totalHorasSelecionadas}h de {categoriaCarga}h — Não é possível alterar.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${diasConfirmados.length || 1}, 1fr)`, gap: '1rem', width: '100%' }}>
          {diasConfirmados.map(dia => (
            <div key={dia} style={{ width: '100%' }}>
              <div style={{ background: 'var(--primary)', color: '#FFF', padding: '0.75rem', borderRadius: '10px 10px 0 0', textAlign: 'center', fontWeight: 700, fontSize: '0.88rem' }}>
                {DIAS_SEMANA[dia]}
              </div>
              <div style={{ background: '#FFF', borderRadius: '0 0 10px 10px', border: '1px solid var(--border-color)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selecoesPorDia[dia]?.map(s => (
                  <div key={s.vaga_horario_id} style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 700, fontSize: '0.85rem', color: '#065F46' }}>
                      <Clock size={14} /> {s.hora_inicio} – {s.hora_fim}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}>
                      <CheckCircle size={13} color="#10B981" />
                      <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700 }}>Firmado</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('registro-ponto')} className="btn-primary">Registrar Presença</button>
        </div>
      </section>
    );
  }

  // --- Inscrição não aberta ---
  if (!inscricao.aberta && !temRascunho && !emModoComplemento) {
    return (
      <section style={{ width: '100%' }}>
        <div className="page-header">
          <h1 className="page-title">Grade Semanal de Prática</h1>
        </div>
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 12, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', width: '100%' }}>
          <AlertTriangle size={24} color="#F59E0B" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#92400E' }}>Inscrição Não Aberta</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#92400E' }}>
              {inscricao.motivo || 'O período de inscrição para grade semanal não está aberto no momento.'}
            </p>
          </div>
        </div>
        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid var(--border-color)', padding: '1.25rem', fontSize: '0.88rem', width: '100%' }}>
          <h3 style={{ color: 'var(--primary)', margin: '0 0 0.75rem', fontWeight: 700 }}>Próximo Período de Inscrição</h3>
          {inscricao.inscricao_inicio && inscricao.inscricao_fim && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
              <div><strong>Início:</strong> {new Date(inscricao.inscricao_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              <div><strong>Fim:</strong> {new Date(inscricao.inscricao_fim + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              {inscricao.vigencia_inicio && (
                <div><strong>Vigência:</strong> {new Date(inscricao.vigencia_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} – {inscricao.vigencia_fim ? new Date(inscricao.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</div>
              )}
            </div>
          )}
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <button onClick={() => setActiveTab('meu-horario-firmado')} className="btn-secondary">Ver Horário Firmado</button>
        </div>
      </section>
    );
  }

  // --- Renderização do Card de Vaga ---
  const renderSlotCard = (slot: SlotGrade) => {
    const isSelected = selecionados.has(slot.id);
    const isFirmado = gradeData?.selecoes?.some(s => s.vaga_horario_id === Number(slot.id) && s.confirmado) ?? false;
    const duracao = calcularDuracaoHoras(slot.hora_inicio, slot.hora_fim);
    const lotado = slot.vagas_disponiveis <= 0 && !isSelected;
    const bloqueado = (cargaCompleta && !isSelected && !isFirmado) || lotado;

    let statusText = 'Disponível';
    let badgeBg = '#ECFDF5';
    let badgeColor = '#047857';
    let cardBg = '#FFF';
    let cardBorder = '2px solid #E2E8F0';

    if (isFirmado) {
      statusText = 'Firmado';
      badgeBg = '#065F46';
      badgeColor = '#FFF';
      cardBg = '#F0FDF4';
      cardBorder = '2px solid #10B981';
    } else if (isSelected) {
      statusText = 'Selecionado';
      badgeBg = 'var(--primary)';
      badgeColor = '#FFF';
      cardBg = '#F0F9FF';
      cardBorder = '2px solid var(--primary)';
    } else if (bloqueado) {
      statusText = lotado ? 'Indisponível' : 'Bloqueado';
      badgeBg = lotado ? '#FEF2F2' : '#F1F5F9';
      badgeColor = lotado ? '#EF4444' : '#94A3B8';
      cardBg = '#F8FAFC';
      cardBorder = '2px solid #CBD5E1';
    }

    return (
      <button
        key={slot.id}
        onClick={() => !isFirmado && toggleSlot(slot.id)}
        disabled={bloqueado || isFirmado}
        style={{
          width: '100%', background: cardBg, border: cardBorder, borderRadius: 10,
          padding: '0.85rem 1rem', cursor: (bloqueado || isFirmado) ? 'not-allowed' : 'pointer',
          textAlign: 'left', transition: 'all 0.15s ease',
          boxShadow: isSelected ? '0 3px 10px rgba(0,43,73,0.15)' : 'none',
          opacity: bloqueado && !isSelected ? 0.7 : 1,
          display: 'flex', flexDirection: 'column', gap: 6, outline: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.92rem',
            color: isFirmado ? '#065F46' : isSelected ? 'var(--primary)' : bloqueado ? '#64748B' : '#1E293B',
          }}>
            <Clock size={15} color={isFirmado ? '#10B981' : isSelected ? 'var(--primary)' : '#64748B'} />
            {slot.hora_inicio} – {slot.hora_fim}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginLeft: 2 }}>({duracao}h)</span>
          </div>
          <span style={{
            background: badgeBg, color: badgeColor, padding: '0.25rem 0.65rem', borderRadius: 20,
            fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {isFirmado && <Lock size={11} color="#FFF" />}
            {isSelected && !isFirmado && <CheckCircle size={12} color="#FFF" />}
            {statusText}
          </span>
        </div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: isFirmado ? '#065F46' : isSelected ? 'var(--primary)' : '#64748B' }}>
          {slot.setores?.nome || 'Clínica-Escola'}
        </div>
      </button>
    );
  };

  // --- Interface principal: seleção / complemento / redução ---
  return (
    <section style={{ width: '100%', paddingBottom: isMobile ? '5rem' : '1rem' }}>
      <div className="page-header">
        <h1 className="page-title">Grade Semanal de Prática</h1>
        <p className="page-subtitle">
          {emModoComplemento
            ? `Complemento: selecione mais ${(categoriaCarga - horasFirmadas).toFixed(0)}h para completar sua carga de ${categoriaCarga}h.`
            : emModoReducao
              ? `Ajuste: remova ${(horasRascunho - categoriaCarga).toFixed(0)}h para atingir sua carga de ${categoriaCarga}h.`
              : `Selecione os horários de prática conforme sua carga semanal (${categoriaCarga}h).`
          }
        </p>
      </div>

      {/* Banner de complemento (aumento) */}
      {emModoComplemento && (
        <div style={{ background: '#EFF6FF', border: '2px solid #3B82F6', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 2px 8px rgba(59,130,246,0.15)', width: '100%' }}>
          <ArrowRight size={24} color="#2563EB" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, color: '#1E40AF', fontSize: '0.95rem' }}>Modo Complemento — Aumento de Carga</div>
            <div style={{ fontSize: '0.85rem', color: '#1D4ED8', marginTop: 2 }}>
              Sua carga foi aumentada para <strong>{categoriaCarga}h</strong>. Você já possui <strong>{horasFirmadas.toFixed(0)}h firmadas</strong> (bloqueadas). Selecione mais <strong>{(categoriaCarga - horasFirmadas).toFixed(0)}h</strong> e confirme o complemento.
            </div>
          </div>
        </div>
      )}

      {/* Banner de redução */}
      {emModoReducao && (
        <div style={{ background: '#FEF3C7', border: '2px solid #F59E0B', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 2px 8px rgba(245,158,11,0.2)', width: '100%' }}>
          <AlertTriangle size={24} color="#D97706" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, color: '#92400E', fontSize: '0.95rem' }}>Modo Ajuste — Redução de Carga</div>
            <div style={{ fontSize: '0.85rem', color: '#B45309', marginTop: 2 }}>
              Sua carga foi reduzida para <strong>{categoriaCarga}h</strong>. Você possui <strong>{horasRascunho.toFixed(0)}h selecionadas</strong>. Remova <strong>{(horasRascunho - categoriaCarga).toFixed(0)}h</strong> e confirme com o total exato.
            </div>
          </div>
        </div>
      )}

      {categoriaNaoDefinida && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 12, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', width: '100%' }}>
          <AlertTriangle size={24} color="#F59E0B" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#92400E' }}>Carga horária não configurada</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#92400E' }}>Sua carga horária semanal ainda não foi configurada pela administração.</p>
          </div>
        </div>
      )}

      {/* Card Informativo */}
      <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid var(--border-color)', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.88rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', width: '100%' }}>
        <div>
          <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Período de Inscrição</span>
          <div style={{ fontWeight: 700, color: '#1E293B', marginTop: 2 }}>
            {inscricao.inscricao_inicio ? new Date(inscricao.inscricao_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} – {inscricao.inscricao_fim ? new Date(inscricao.inscricao_fim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
          </div>
        </div>
        <div>
          <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Vigência</span>
          <div style={{ fontWeight: 700, color: '#1E293B', marginTop: 2 }}>
            {inscricao.vigencia_inicio ? new Date(inscricao.vigencia_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} – {inscricao.vigencia_fim ? new Date(inscricao.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
          </div>
        </div>
        <div>
          <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Carga Semanal</span>
          <div style={{ fontWeight: 700, color: cargaCompleta ? '#10B981' : categoriaCarga > 0 ? 'var(--primary)' : '#F59E0B', marginTop: 2 }}>
            {categoriaCarga > 0 ? `${categoriaCarga}h semanais` : 'Não definida'}
          </div>
        </div>
        {horasFirmadas > 0 && !gradeFirmada && (
          <div>
            <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Firmadas</span>
            <div style={{ fontWeight: 700, color: '#065F46', marginTop: 2 }}>{horasFirmadas.toFixed(0)}h</div>
          </div>
        )}
      </div>

      {slots.length === 0 ? (
        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid var(--border-color)', padding: '3rem 1.5rem', textAlign: 'center', color: '#94A3B8', width: '100%' }}>
          <CalendarIcon size={36} color="#CBD5E1" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
          <p style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: '#475569' }}>Nenhum horário disponível</p>
          <p style={{ fontSize: '0.85rem' }}>Não existem horários de prática configurados e publicados para o seu curso no momento.</p>
        </div>
      ) : isMobile ? (
        <div style={{ width: '100%', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {diasComSlots.map(dia => {
              const isActive = dia === diaSelecionadoMobile;
              const horasNoDia = (slotsPorDia[dia] || []).filter(s => selecionados.has(s.id)).reduce((sum, s) => sum + calcularDuracaoHoras(s.hora_inicio, s.hora_fim), 0);
              return (
                <button key={dia} onClick={() => setDiaSelecionadoMobile(dia)} style={{
                  padding: '0.55rem 0.9rem', borderRadius: 20,
                  border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isActive ? 'var(--primary)' : '#FFF',
                  color: isActive ? '#FFF' : 'var(--text-dark)',
                  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  boxShadow: isActive ? '0 2px 6px rgba(0,43,73,0.2)' : 'none',
                }}>
                  {DIAS_SEMANA_CURTO[dia] || DIAS_SEMANA[dia]}
                  {horasNoDia > 0 && (
                    <span style={{ background: isActive ? 'var(--secondary)' : '#E2E8F0', color: isActive ? 'var(--primary-dark)' : 'var(--primary)', borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 800 }}>
                      {horasNoDia}h
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid var(--border-color)', padding: '1rem', width: '100%' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{DIAS_SEMANA[diaSelecionadoMobile]}</span>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>{slotsPorDia[diaSelecionadoMobile]?.length || 0} horário(s)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
              {slotsPorDia[diaSelecionadoMobile]?.map(slot => renderSlotCard(slot))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${diasComSlots.length || 1}, 1fr)`, gap: '1rem', marginBottom: '1.5rem', width: '100%' }}>
          {diasComSlots.map(dia => (
            <div key={dia} style={{ width: '100%' }}>
              <div style={{ background: 'var(--primary)', color: '#FFF', padding: '0.75rem', borderRadius: '10px 10px 0 0', textAlign: 'center', fontWeight: 700, fontSize: '0.88rem' }}>
                {DIAS_SEMANA[dia]}
              </div>
              <div style={{ background: '#FFF', borderRadius: '0 0 10px 10px', border: '1px solid var(--border-color)', borderTop: 'none', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                {slotsPorDia[dia].map(slot => renderSlotCard(slot))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barra de Resumo (Sticky) */}
      <div style={{
        position: 'sticky', bottom: 0, background: '#FFF', borderRadius: 12,
        border: cargaCompleta ? '2px solid #10B981' : '1px solid var(--border-color)',
        padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', zIndex: 90, width: '100%',
      }}>
        <div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Total Selecionado</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontSize: '1.4rem', fontWeight: 800,
              color: cargaCompleta ? '#10B981' : totalHorasSelecionadas > categoriaCarga ? '#EF4444' : 'var(--primary)',
            }}>
              {totalHorasSelecionadas}h
            </span>
            <span style={{ fontSize: '0.9rem', color: '#94A3B8', fontWeight: 600 }}>/ {categoriaCarga > 0 ? `${categoriaCarga}h` : '?'}</span>
          </div>
          {cargaCompleta && (
            <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, marginTop: 2 }}>
              Carga completa: {totalHorasSelecionadas}h de {categoriaCarga}h
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={carregarDados} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 0.85rem', fontSize: '0.82rem' }}>
            <RefreshCw size={14} /> <span className="hide-mobile">Atualizar</span>
          </button>

          {temRascunho && !emModoComplemento && (
            <button onClick={handleCancelarSelecao} disabled={cancelando} style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 0.85rem',
              borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', color: '#64748B',
              fontWeight: 600, fontSize: '0.82rem', cursor: cancelando ? 'not-allowed' : 'pointer',
            }}>
              <X size={14} /> {cancelando ? 'Cancelando...' : 'Cancelar Seleção'}
            </button>
          )}

          {podeConfirmar && (
            <button onClick={() => setConfirmModalOpen(true)} disabled={saving} className="btn-primary" style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#10B981',
              boxShadow: '0 2px 8px rgba(16,185,129,0.3)', opacity: saving ? 0.7 : 1,
              cursor: saving ? 'not-allowed' : 'pointer', padding: '0.55rem 1rem', fontSize: '0.88rem',
            }}>
              {saving ? 'Confirmando...' : <><CheckCircle size={16} /> Confirmar Horário</>}
            </button>
          )}

          {!podeConfirmar && totalHorasSelecionadas > 0 && totalHorasSelecionadas !== categoriaCarga && (
            <span style={{
              fontSize: '0.78rem', fontWeight: 700,
              color: totalHorasSelecionadas > categoriaCarga ? '#EF4444' : '#F59E0B',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <AlertTriangle size={14} />
              {totalHorasSelecionadas > categoriaCarga
                ? `Excedeu ${totalHorasSelecionadas - categoriaCarga}h`
                : `Faltam ${categoriaCarga - totalHorasSelecionadas}h`
              }
            </span>
          )}
        </div>
      </div>

      {/* Modal de Confirmação com Resumo */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        title="Confirmar Horário Firmado"
        message={
          `Tem certeza que deseja confirmar este horário?\n\n` +
          `Resumo:\n` +
          Object.entries(resumoPorDia).map(([dia, sels]) =>
            `${DIAS_SEMANA[Number(dia)]}: ${sels.map(s => `${s.hora_inicio}–${s.hora_fim}`).join(', ')}`
          ).join('\n') +
          `\n\nTotal: ${totalHorasSelecionadas}h de ${categoriaCarga}h\n\n` +
          `Após a confirmação, o horário será firmado para toda a vigência e não poderá ser alterado.`
        }
        confirmText="Sim, Confirmar Horário"
        cancelText="Voltar e Editar"
        confirmVariant="success"
        onConfirm={handleConfirmarGrade}
        onCancel={() => setConfirmModalOpen(false)}
      />
    </section>
  );
};
