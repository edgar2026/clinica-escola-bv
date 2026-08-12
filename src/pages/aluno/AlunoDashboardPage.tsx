import { useEffect, useState } from 'react';
import { MetricCard } from '../../components/common/MetricCard';
import { useAuth } from '../../context/AuthContext';
import { Calendar } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import type { Usuario } from '../../types';

export const AlunoDashboardPage = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
  const { usuario } = useAuth();
  const [dashboard, setDashboard] = useState<{
    metricas: Record<string, string | number>;
    proximoAgendamento: any | null;
    aluno: any | null;
    usuario: Usuario | null;
    mensagem?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [inscricaoAberta, setInscricaoAberta] = useState<boolean>(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!usuario?.id) { setLoading(false); return; }
      try {
        const userId = usuario.id;

        const { data: aluno } = await supabase.from('alunos').select('*, cursos(nome), periodos(nome, codigo), turnos(nome, codigo), setores_clinica(nome)').eq('usuario_id', userId).single() as { data: Record<string, unknown> | null };
        const alunoId = aluno?.id;
        if (!alunoId) { setDashboard(null); return; }

        const categoriaCarga = Number(aluno?.carga_horaria_semanal_max) || Number(aluno?.categoria_carga) || 4;

        const { data: statusInscricao } = await supabase.rpc('verificar_inscricao_aberta', { p_aluno_id: Number(alunoId) });
        setInscricaoAberta(statusInscricao?.inscricao_aberta ?? false);

        const hoje = new Date().toISOString().split('T')[0];
        const { data: pontosHoje } = await supabase.from('pontos').select('*').eq('aluno_id', alunoId).gte('data', hoje) as { data: Record<string, unknown>[] | null };
        const { data: agendamento } = await supabase.from('agendamentos').select('*, horarios(*, setores(*, clinicas(*)), vagas_horarios(*)').eq('aluno_id', alunoId).gte('data', hoje).order('data', { ascending: true }).limit(1) as { data: Record<string, unknown>[] | null };

        const temEntradaAberta = pontosHoje?.some(p => !p.hora_saida);
        const statusHoje = !pontosHoje || pontosHoje.length === 0 ? 'nenhum_registro' : (temEntradaAberta ? 'em_andamento' : 'concluido');

        const horasCumpridas = (usuario.total_horas as number) || 0;

        const metricas: Record<string, string | number> = {
          categoriaCarga,
          horasCumpridasTotal: horasCumpridas,
          horasPendentes: Math.max(0, categoriaCarga - horasCumpridas),
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

        setDashboard({ metricas, proximoAgendamento: agendamento?.[0] || null, aluno: alunoComPerfil, usuario });
      } catch {
        setDashboard(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [usuario]);

  if (loading) {
    return <section><div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>Carregando painel...</div></section>;
  }

  const metricas = dashboard?.metricas || {};
  const proximoAgendamento = dashboard?.proximoAgendamento || null;
  const aluno = dashboard?.aluno || null;
  const semRegistro = dashboard?.mensagem || null;

  const categoriaCarga = Number(metricas.categoriaCarga) || 6;
  const horasCumpridas = Number(metricas.horasCumpridasTotal) || 0;
  const horasPendentes = Number(metricas.horasPendentes) || 0;
  const atrasos = Number(metricas.atrasos) || 0;
  const faltas = Number(metricas.faltas) || 0;
  const percHoras = categoriaCarga > 0 ? Math.min(100, (horasCumpridas / categoriaCarga) * 100) : 0;

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Painel do Aluno</h1>
        <p className="page-subtitle">
          Olá, <strong>{usuario?.nome || 'Aluno'}</strong>! Acompanhe sua carga horária semanal, presenças e frequência.
        </p>
      </div>

      {semRegistro && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10, padding: '1rem', fontSize: '0.88rem', color: '#92400E', marginBottom: '1.5rem' }}>
          {semRegistro}
        </div>
      )}

      <div className="metrics-grid">
        <MetricCard label={`Categoria ${categoriaCarga}h Semanais`} value={`${horasCumpridas}h cumpridas`} accent="accent-yellow">
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${percHoras}%` }} />
          </div>
        </MetricCard>
        <MetricCard label="Horas Cumpridas (Semestre)" value={`${horasCumpridas}h`} accent="accent-green" />
        <MetricCard label="Horas Pendentes" value={`${horasPendentes}h`} accent="accent-yellow" />
        <MetricCard label="Atrasos Registrados" value={String(atrasos)} />
        <MetricCard label="Faltas Não Justificadas" value={String(faltas)} accent="accent-red" />
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={20} /> Próximo Atendimento Agendado
        </h3>
        {proximoAgendamento ? (
          <div style={{ backgroundColor: 'var(--status-green-bg)', borderLeft: '4px solid var(--status-green)', padding: '1rem', borderRadius: '6px' }}>
            <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>
              {new Date(proximoAgendamento.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} — {proximoAgendamento.hora_inicio} às {proximoAgendamento.hora_fim}
            </strong>
            <p style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Setor: {proximoAgendamento.setor_nome}
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum registro futuro. Acesse o Calendário de Presença para registrar.</p>
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
        {inscricaoAberta && (
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