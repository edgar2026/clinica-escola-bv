import React, { useEffect, useState } from 'react';
import { MetricCard } from '../../components/common/MetricCard';
import { useAuth } from '../../context/AuthContext';
import { Calendar } from 'lucide-react';
import { apiRequest } from '../../services/api';

export const AlunoDashboardPage = ({ setActiveTab }) => {
  const { usuario } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await apiRequest('/alunos/dashboard');
        setDashboard(data);
      } catch {
        setDashboard(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return <section><div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>Carregando painel...</div></section>;
  }

  const metricas = dashboard?.metricas || {};
  const proximoAgendamento = dashboard?.proximoAgendamento || null;
  const aluno = dashboard?.aluno || null;
  const semRegistro = dashboard?.mensagem || null;

  const cargaMax = Number(metricas.cargaHorariaMaxSemana) || 0;
  const horasCadastradas = Number(metricas.horasCadastradasSemana) || 0;
  const horasCumpridas = Number(metricas.horasCumpridasTotal) || 0;
  const horasPendentes = Math.max(0, cargaMax - horasCadastradas);
  const atrasos = Number(metricas.atrasos) || 0;
  const faltas = Number(metricas.faltas) || 0;
  const percHoras = cargaMax > 0 ? Math.min(100, (horasCadastradas / cargaMax) * 100) : 0;

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Painel do Aluno</h1>
        <p className="page-subtitle">
          Ola, <strong>{usuario?.nome || 'Aluno'}</strong>! Acompanhe sua carga horaria semanal, presenças e frequência.
        </p>
      </div>

      {semRegistro && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10, padding: '1rem', fontSize: '0.88rem', color: '#92400E', marginBottom: '1.5rem' }}>
          {semRegistro}
        </div>
      )}

      <div className="metrics-grid">
        <MetricCard label="Carga Horaria Semanal" value={`${horasCadastradas} de ${cargaMax}h`} accent="accent-yellow">
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${percHoras}%` }} />
          </div>
        </MetricCard>
        <MetricCard label="Horas Cumpridas (Semestre)" value={`${horasCumpridas}h`} accent="accent-green" />
        <MetricCard label="Horas Pendentes" value={`${horasPendentes}h`} accent="accent-yellow" />
        <MetricCard label="Atrasos Registrados" value={String(atrasos)} />
        <MetricCard label="Faltas Nao Justificadas" value={String(faltas)} accent="accent-red" />
      </div>

      {/* Proximo atendimento */}
      <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={20} /> Proximo Atendimento Agendado
        </h3>
        {proximoAgendamento ? (
          <div style={{ backgroundColor: 'var(--status-green-bg)', borderLeft: '4px solid var(--status-green)', padding: '1rem', borderRadius: '6px' }}>
            <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>
              {new Date(proximoAgendamento.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} — {proximoAgendamento.hora_inicio} as {proximoAgendamento.hora_fim}
            </strong>
            <p style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Setor: {proximoAgendamento.setor_nome}
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum registro futuro. Acesse o Calendário de Presença para registrar.</p>
        )}
      </div>

      {/* Perfil academico */}
      {aluno ? (
        <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.75rem' }}>Meu Perfil Academico</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
            <div><strong>Matricula:</strong> {aluno.matricula || '-'}</div>
            <div><strong>Curso:</strong> {aluno.curso_nome || '-'}</div>
            <div><strong>Periodo:</strong> {aluno.periodo_codigo || '-'}</div>
            <div><strong>Turno:</strong> {aluno.turno_codigo || '-'}</div>
            <div><strong>Setor:</strong> {aluno.setor_nome || '-'}</div>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.75rem' }}>Meu Perfil Academico</h4>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum perfil academico vinculado. Solicite ao administrador o cadastro como aluno.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('calendario-vagas')} className="btn-primary">
          Escolher Novos Horarios
        </button>
        <button onClick={() => setActiveTab('meu-horario-firmado')} className="btn-secondary">
          Meu Horario Firmado
        </button>
        <button onClick={() => setActiveTab('espelho-ponto')} className="btn-secondary" style={{ background: '#005691', color: '#FFF' }}>
          Espelho de Ponto
        </button>
        <button onClick={() => setActiveTab('registro-ponto')} className="btn-primary" style={{ backgroundColor: 'var(--status-green)' }}>
          Registrar Ponto
        </button>
      </div>
    </section>
  );
};
