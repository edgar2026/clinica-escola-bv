import { useEffect, useState, useCallback } from 'react';
import { MetricCard } from '../../components/common/MetricCard';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Lock, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import type { Usuario, GradeFirmadaInfo } from '../../types';

export const AlunoDashboardPage = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
  const { usuario } = useAuth();
  const [dashboard, setDashboard] = useState<{
    metricas: Record<string, string | number>;
    aluno: any | null;
    usuario: Usuario | null;
  } | null>(null);
  const [gradeFirmada, setGradeFirmada] = useState<GradeFirmadaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [inscricaoAberta, setInscricaoAberta] = useState<boolean>(false);

  const carregarDados = useCallback(async () => {
    if (!usuario?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const userId = usuario.id;

      const { data: aluno } = await supabase.from('alunos').select('*, cursos(nome), periodos(nome, codigo), turnos(nome, codigo), setores_clinica(nome)').eq('usuario_id', userId).single() as { data: Record<string, unknown> | null };
      const alunoId = aluno?.id;
      if (!alunoId) { setDashboard(null); return; }

      const categoriaCarga = Number(aluno?.carga_horaria_semanal_max) || Number(aluno?.categoria_carga) || 4;
      const cargaHorariaTotal = Number(aluno?.carga_horaria_total) || 40;

      const { data: statusInscricao } = await supabase.rpc('verificar_inscricao_aberta', { p_aluno_id: Number(alunoId) });
      setInscricaoAberta(statusInscricao?.inscricao_aberta ?? false);

      const { data: gradeData } = await supabase.rpc('obter_grade_aluno', { p_aluno_id: Number(alunoId) });
      setGradeFirmada((gradeData as GradeFirmadaInfo | null) ?? null);

      const hoje = new Date().toISOString().split('T')[0];
      const { data: pontosHoje } = await supabase.from('pontos').select('*').eq('aluno_id', alunoId).gte('data', hoje) as { data: Record<string, unknown>[] | null };
      const { data: todosPontos } = await supabase.from('pontos').select('tempo_total_minutos, status_frequencia').eq('aluno_id', alunoId) as { data: Record<string, unknown>[] | null };

      const temEntradaAberta = pontosHoje?.some(p => !p.hora_saida);
      const statusHoje = !pontosHoje || pontosHoje.length === 0 ? 'nenhum_registro' : (temEntradaAberta ? 'em_andamento' : 'concluido');

      const minutosValidados = (todosPontos || [])
        .filter(p => ['presenca_no_horario', 'atraso', 'saida_nao_registrada', 'falta_justificada'].includes(p.status_frequencia as string))
        .reduce((soma, p) => soma + (Number(p.tempo_total_minutos) || 0), 0);
      const horasCumpridas = Math.round(minutosValidados / 60);

      const semanasNecessarias = categoriaCarga > 0 ? Math.ceil(cargaHorariaTotal / categoriaCarga) : 0;
      const horasPendentes = Math.max(0, cargaHorariaTotal - horasCumpridas);

      const totalHorasFirmadas = gradeFirmada?.confirmado
        ? gradeFirmada.selecoes.reduce((soma, sel) => {
            const [hI, mI] = sel.hora_inicio.split(':').map(Number);
            const [hF, mF] = sel.hora_fim.split(':').map(Number);
            return soma + (hF * 60 + mF - hI * 60 - mI) / 60;
          }, 0)
        : 0;

      const metricas: Record<string, string | number> = {
        categoriaCarga,
        cargaHorariaTotal,
        horasCumpridasTotal: horasCumpridas,
        horasPendentes,
        semanasNecessarias,
        totalHorasFirmadas,
        atrasos: pontosHoje?.filter(p => p.status_frequencia === 'atraso').length || 0,
        faltas: pontosHoje?.filter(p => p.status_frequencia === 'ausencia').length || 0,
        statusHoje,
      };

      const curso = aluno?.cursos as Record<string, unknown> | null;
      const periodo = aluno?.periodos as Record<string, unknown> | null;
      const turno = aluno?.turnos as Record<string, unknown> | null;
      const setor = aluno?.setores_clinica as Record<string, unknown> | null;

      const alunoComPerfil = {
        ...aluno,
        matricula: usuario.matricula,
        curso_nome: curso?.nome || null,
        periodo_nome: periodo?.nome || null,
        periodo_codigo: periodo?.codigo || null,
        turno_nome: turno?.nome || null,
        turno_codigo: turno?.codigo || null,
        setor_nome: setor?.nome || null,
      };

      setDashboard({ metricas, aluno: alunoComPerfil, usuario });
    } catch (err) {
      console.error('Erro ao carregar painel do aluno:', err);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  if (loading) {
    return <section><div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>Carregando painel...</div></section>;
  }

  const metricas = dashboard?.metricas || {};
  const aluno = dashboard?.aluno || null;

  const categoriaCarga = Number(metricas.categoriaCarga) || 6;
  const cargaHorariaTotal = Number(metricas.cargaHorariaTotal) || 40;
  const horasCumpridas = Number(metricas.horasCumpridasTotal) || 0;
  const horasPendentes = Number(metricas.horasPendentes) || 0;
  const semanasNecessarias = Number(metricas.semanasNecessarias) || 0;
  const totalHorasFirmadas = Number(metricas.totalHorasFirmadas) || 0;
  const atrasos = Number(metricas.atrasos) || 0;
  const faltas = Number(metricas.faltas) || 0;
  const percHoras = cargaHorariaTotal > 0 ? Math.min(100, (horasCumpridas / cargaHorariaTotal) * 100) : 0;

  const firmado = gradeFirmada?.confirmado === true;

  return (
    <section>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Painel do Aluno</h1>
          <p className="page-subtitle">
            Olá, <strong>{usuario?.nome || 'Aluno'}</strong>! Acompanhe sua carga horária semanal, horário firmado, presenças e frequência.
          </p>
        </div>
        <button onClick={carregarDados} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {firmado && (
        <div style={{
          background: '#D1FAE5',
          border: '1px solid #10B981',
          borderRadius: 12,
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}>
          <Lock size={20} color="#065F46" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, color: '#065F46', fontWeight: 700, fontSize: '0.92rem' }}>
              Seu horário semanal já está firmado ({totalHorasFirmadas}h — vigência {gradeFirmada?.vigencia_inicio ? new Date(gradeFirmada.vigencia_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} até {gradeFirmada?.vigencia_fim ? new Date(gradeFirmada.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}).
            </p>
            <p style={{ margin: '0.25rem 0 0', color: '#065F46', fontSize: '0.82rem' }}>
              Alterações somente pela administração. Acesse "Meu Horário Firmado" para imprimir o comprovante.
            </p>
          </div>
          <button onClick={() => setActiveTab('meu-horario-firmado')} className="btn-primary" style={{ background: '#059669' }}>
            Ver Horário Firmado
          </button>
        </div>
      )}

      <div className="metrics-grid">
        <MetricCard label={`Carga Total: ${cargaHorariaTotal}h`} value={`${horasCumpridas}h realizadas`} accent="accent-yellow">
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${percHoras}%` }} />
          </div>
        </MetricCard>
        <MetricCard label="Carga Semanal Firmada" value={firmado ? `${totalHorasFirmadas}h / ${categoriaCarga}h` : 'Não firmado'} accent={firmado ? 'accent-green' : ''} />
        <MetricCard label="Semanas Previstas" value={`${semanasNecessarias} semanas`} accent="accent-green" />
        <MetricCard label="Horas Realizadas" value={`${horasCumpridas}h de ${cargaHorariaTotal}h`} accent="accent-green" />
        <MetricCard label="Horas Pendentes" value={`${horasPendentes}h`} accent="accent-yellow" />
        <MetricCard label="Atrasos" value={String(atrasos)} />
        <MetricCard label="Faltas" value={String(faltas)} accent="accent-red" />
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={20} /> Próximo Atendimento Agendado
        </h3>
        {firmado && gradeFirmada?.selecoes?.length ? (
          <div style={{ backgroundColor: 'var(--status-green-bg)', borderLeft: '4px solid var(--status-green)', padding: '1rem', borderRadius: '6px' }}>
            <strong style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>
              {gradeFirmada.selecoes.length} horário(s) firmado(s) por semana ({totalHorasFirmadas}h)
            </strong>
            <p style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Dias: {[...gradeFirmada.selecoes]
                .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))
                .map(s => `Dia ${s.dia_semana} ${s.hora_inicio}–${s.hora_fim}`)
                .join(' · ')}
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {inscricaoAberta
              ? 'Você ainda não firmou seu horário semanal. Acesse a Grade Semanal para escolher seus horários de prática.'
              : 'Nenhum horário firmado. O período de inscrição está fechado — contate a administração.'}
          </p>
        )}
      </div>

      {aluno ? (
        <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.75rem' }}>Meu Perfil Acadêmico</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
            <div><strong>Matrícula:</strong> {aluno.matricula || '-'}</div>
            <div><strong>Curso:</strong> {aluno.curso_nome || '-'}</div>
            <div><strong>Período:</strong> {aluno.periodo_codigo || '-'}</div>
            <div><strong>Turno:</strong> {aluno.turno_codigo || '-'}</div>
            <div><strong>Setor:</strong> {aluno.setor_nome || '-'}</div>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.75rem' }}>Meu Perfil Acadêmico</h4>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum perfil acadêmico vinculado. Solicite ao administrador o cadastro como aluno.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {inscricaoAberta && !firmado && (
          <button onClick={() => setActiveTab('grade-semanal-aluno')} className="btn-primary">
            Escolher Horários na Grade
          </button>
        )}
        <button onClick={() => setActiveTab('meu-horario-firmado')} className="btn-secondary">
          Meu Horário Firmado
        </button>
        <button onClick={() => setActiveTab('espelho-ponto')} className="btn-secondary" style={{ background: '#005691', color: '#FFF' }}>
          Histórico de Registros
        </button>
        <button onClick={() => setActiveTab('registro-ponto')} className="btn-primary" style={{ backgroundColor: 'var(--status-green)' }}>
          Registrar Presença
        </button>
      </div>
    </section>
  );
};
