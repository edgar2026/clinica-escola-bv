import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MetricCard } from '../../components/common/MetricCard';
import { Users, FileText, RefreshCw, CheckCircle, XCircle, RotateCcw, CalendarClock, Radio, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { formatarData } from '../../utils/datas';
import { gerenciaService } from '../../services/gerenciaService';
import { pontoService } from '../../services/pontoService';
import { supabase } from '../../services/supabaseClient';
import type { Ponto, MonitorFaixa, MonitorAlunoFaixa, MonitorPresencas, SituacaoMonitor } from '../../types';

const DIAS_PT: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

const SITUACAO_META: Record<SituacaoMonitor, { label: string; bg: string; color: string; border: string }> = {
  aguardando: { label: 'Aguardando horário', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  presente: { label: 'Presente', bg: '#F0FDF4', color: '#15803D', border: '#86EFAC' },
  atrasado: { label: 'Atrasado', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  finalizado: { label: 'Finalizado', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  ausente: { label: 'Ausente', bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
  saida_nao_registrada: { label: 'Saída não registrada', bg: '#FFF7ED', color: '#C2410C', border: '#FDBA74' },
  em_analise: { label: 'Em análise', bg: '#FAF5FF', color: '#6D28D9', border: '#E9D5FF' },
};

const BadgeSituacao = ({ situacao }: { situacao: SituacaoMonitor }) => {
  const meta = SITUACAO_META[situacao] || SITUACAO_META.aguardando;
  return (
    <span className="badge-vaga" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  );
};

const ContadorBadge = ({ label, valor, color }: { label: string; valor: number; color: string }) => (
  <span className="badge-vaga" style={{ background: `${color}1A`, color, border: `1px solid ${color}40`, whiteSpace: 'nowrap' }}>
    <strong>{valor}</strong> {label}
  </span>
);

export const GerenciaDashboardPage = () => {
  const { showToast } = useAuth();
  const [monitor, setMonitor] = useState<MonitorPresencas | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<'conectando' | 'conectado' | 'fallback'>('conectando');
  const [faixaAberta, setFaixaAberta] = useState<string | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<Ponto[]>([]);
  const [modalSolicitacao, setModalSolicitacao] = useState<Ponto | null>(null);
  const [acaoOcorrencia, setAcaoOcorrencia] = useState<'aprovar' | 'rejeitar' | 'reposicao'>('aprovar');
  const [observacaoOcorrencia, setObservacaoOcorrencia] = useState('');
  const [processandoOcorrencia, setProcessandoOcorrencia] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregarDashboard = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const res = await gerenciaService.getMonitorPresencas();
      setMonitor(res);
      const sols = await pontoService.getSolicitacoesPendentes().catch(() => []);
      setSolicitacoes(sols);
    } catch (err) {
      console.error('Erro ao carregar dashboard gerencial:', err);
      if (!silencioso) {
        showToast('Erro ao carregar o monitor: ' + (err instanceof Error ? err.message : 'Tente novamente.'), 'erro');
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    carregarDashboard();
  }, [carregarDashboard]);

  useEffect(() => {
    let ativo = true;
    const canal = supabase.channel('monitor-ao-vivo');

    const tabelas: Array<{ table: string; filter?: string }> = [
      { table: 'pontos' },
      { table: 'grade_semanal_selecoes' },
      { table: 'justificativas' },
      { table: 'vagas_horarios' },
    ];

    for (const t of tabelas) {
      canal.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: t.table },
        () => { if (ativo) carregarDashboard(true); }
      );
    }

    canal.subscribe((status) => {
      if (!ativo) return;
      if (status === 'SUBSCRIBED') {
        setRealtimeStatus('conectado');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setRealtimeStatus('fallback');
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => { if (ativo) carregarDashboard(true); }, 30000);
        }
      }
    });

    return () => {
      ativo = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      supabase.removeChannel(canal);
    };
  }, [carregarDashboard]);

  const toggleFaixa = (chave: string) => {
    setFaixaAberta(prev => (prev === chave ? null : chave));
  };

  const handleProcessarOcorrencia = async () => {
    if (!modalSolicitacao) return;

    if ((acaoOcorrencia === 'rejeitar' || acaoOcorrencia === 'reposicao') && (!observacaoOcorrencia || observacaoOcorrencia.length < 3)) {
      showToast('Observação obrigatória (mínimo 3 caracteres) para reprovar ou encaminhar para reposição.', 'erro');
      return;
    }

    setProcessandoOcorrencia(true);
    try {
      const justificativaId = modalSolicitacao.justificativa_id || modalSolicitacao.id;
      const res = await pontoService.analisarOcorrencia(
        justificativaId,
        acaoOcorrencia,
        observacaoOcorrencia || undefined
      );

      if (res.sucesso) {
        showToast(res.mensagem, 'sucesso');
        await carregarDashboard();
      } else {
        showToast(res.mensagem, 'erro');
      }
    } catch (err) {
      showToast('Erro ao processar ocorrência: ' + (err instanceof Error ? err.message : 'Tente novamente.'), 'erro');
    } finally {
      setModalSolicitacao(null);
      setObservacaoOcorrencia('');
      setAcaoOcorrencia('aprovar');
      setProcessandoOcorrencia(false);
    }
  };

  const renderFaixa = (faixa: MonitorFaixa) => {
    const chave = `${faixa.hora_inicio}-${faixa.hora_fim}`;
    const aberta = faixaAberta === chave;
    return (
      <div key={chave} style={{ marginBottom: '0.75rem', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden', background: '#FFF' }}>
        <button
          onClick={() => toggleFaixa(chave)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.85rem 1rem', background: aberta ? '#F8FAFC' : '#FFF', border: 'none', cursor: 'pointer',
            textAlign: 'left', flexWrap: 'wrap', gap: '0.5rem'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {aberta ? <ChevronDown size={18} color="var(--primary)" /> : <ChevronRight size={18} color="var(--primary)" />}
            <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>{faixa.hora_inicio} – {faixa.hora_fim}</strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{faixa.setores}</span>
          </span>
          <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <ContadorBadge label="esperados" valor={faixa.alunos_esperados} color="#475569" />
            <ContadorBadge label="presentes agora" valor={faixa.presentes_agora} color="#16A34A" />
            <ContadorBadge label="ainda não chegaram" valor={faixa.ainda_nao_chegaram} color="#64748B" />
            <ContadorBadge label="atrasados" valor={faixa.atrasados} color="#D97706" />
            <ContadorBadge label="saíram" valor={faixa.saidos} color="#2563EB" />
            <ContadorBadge label="ausentes" valor={faixa.ausentes} color="#DC2626" />
            <span className="badge-vaga" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', whiteSpace: 'nowrap' }}>
              {faixa.alunos_esperados}/{faixa.capacidade_total} capacidade
            </span>
          </span>
        </button>

        {aberta && (
          <div style={{ padding: '0 1rem 1rem' }}>
            {faixa.alunos.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Nenhum aluno com horário firmado neste período.</div>
            ) : (
              <div className="table-container" style={{ margin: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Aluno (Matrícula)</th>
                      <th>Curso</th>
                      <th>Entrada</th>
                      <th>Saída</th>
                      <th>Situação Atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faixa.alunos.map((a: MonitorAlunoFaixa) => (
                      <tr key={a.aluno_id}>
                        <td><strong>{a.nome}</strong> ({a.matricula})</td>
                        <td>{a.curso_nome || '-'}</td>
                        <td>{a.hora_entrada || '—'}</td>
                        <td>{a.hora_saida || '—'}</td>
                        <td><BadgeSituacao situacao={a.situacao} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">Painel Gerencial — Monitoramento & Validações</h1>
          <p className="page-subtitle">Dados reais persistidos: apenas alunos (perfil ALUNO) com vínculo ativo, horários firmados e registros de presença.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {monitor && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <Clock size={14} />
              {formatarData(monitor.metricas.hoje_data)} · {DIAS_PT[monitor.metricas.hoje_dia_semana] || 'Domingo'} · {monitor.metricas.hora_atual} (servidor)
            </span>
          )}
          <span
            className="badge-vaga"
            style={{
              background: realtimeStatus === 'conectado' ? '#F0FDF4' : realtimeStatus === 'fallback' ? '#FFFBEB' : '#F1F5F9',
              color: realtimeStatus === 'conectado' ? '#15803D' : realtimeStatus === 'fallback' ? '#B45309' : '#475569',
              border: `1px solid ${realtimeStatus === 'conectado' ? '#BBF7D0' : realtimeStatus === 'fallback' ? '#FDE68A' : '#CBD5E1'}`,
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
            }}
          >
            <Radio size={13} />
            {realtimeStatus === 'conectado' ? 'Tempo real conectado' : realtimeStatus === 'fallback' ? 'Tempo real indisponível — atualização a cada 30s' : 'Conectando...'}
          </span>
          <button onClick={() => carregarDashboard()} disabled={loading} className="btn-secondary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar Painel
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>Carregando dados gerenciais...</div>
      ) : (
        <>
          <div className="metrics-grid">
            <MetricCard label="Alunos Cadastrados" value={monitor?.metricas.total_alunos ?? 0} />
            <MetricCard label="Presentes no Momento" value={monitor?.metricas.presentes_agora ?? 0} accent="accent-green" />
            <MetricCard label="Atrasados Hoje" value={monitor?.metricas.atrasados_hoje ?? 0} accent="accent-yellow" />
            <MetricCard label="Grades Confirmadas" value={monitor?.metricas.grades_confirmadas ?? 0} accent="accent-green" />
            <MetricCard label="Solicitações Pendentes" value={solicitacoes.length} accent="accent-red" />
            <MetricCard label="Slots com Vagas" value={monitor?.metricas.slots_com_vagas ?? 0} accent="accent-green" />
          </div>

          {monitor?.config?.id && (
            <div style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: 10,
              padding: '0.65rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: '#075985',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}>
              <CalendarClock size={16} />
              <strong>Vigência ativa:</strong>
              <span>{new Date(monitor.config.vigencia_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} – {new Date(monitor.config.vigencia_fim + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              <span className="badge-vaga verde" style={{ marginLeft: 4 }}>config #{monitor.config.id}</span>
            </div>
          )}

          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} /> Faixas de Horário de Hoje — Alunos com Horário Firmado
          </h3>
          {monitor && monitor.faixas.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', border: '1px dashed var(--border-color)', borderRadius: 12, marginBottom: '2rem' }}>
              Nenhum horário firmado para hoje ({DIAS_PT[monitor.metricas.hoje_dia_semana] || 'Domingo'}).
            </div>
          ) : (
            <div style={{ marginBottom: '2rem' }}>
              {monitor && monitor.faixas.map(f => renderFaixa(f))}
            </div>
          )}

          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} /> 📋 Fila de Análise: Ajustes de Saída & Justificativas
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Aluno (Matrícula)</th>
                  <th>Data</th>
                  <th>Horário Firmado</th>
                  <th>Entrada Real</th>
                  <th>Saída Solicitada</th>
                  <th>Diferença</th>
                  <th>Tipo</th>
                  <th>Justificativa</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--status-green)', padding: '1.5rem' }}>✅ Nenhuma solicitação pendente no momento.</td></tr>
                ) : solicitacoes.map(s => {
                  const diffMinutos = s.hora_entrada && s.horario_firmado_inicio
                    ? (parseInt(s.hora_entrada.split(':')[0]) * 60 + parseInt(s.hora_entrada.split(':')[1])) -
                      (parseInt(s.horario_firmado_inicio.split(':')[0]) * 60 + parseInt(s.horario_firmado_inicio.split(':')[1]))
                    : null;

                  return (
                    <tr key={s.id} style={{ backgroundColor: '#FFF7ED' }}>
                      <td><strong>{s.aluno_nome}</strong> ({s.matricula})</td>
                      <td><span className="badge-vaga amarelo">{formatarData(s.data || s.data_falta || '')}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>{s.horario_firmado_inicio && s.horario_firmado_fim ? `${s.horario_firmado_inicio}–${s.horario_firmado_fim}` : '-'}</td>
                      <td>{s.hora_entrada || '-'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{s.saida_sugerida || '-'}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {diffMinutos !== null ? (
                          <span style={{ color: diffMinutos > 0 ? '#DC2626' : diffMinutos < 0 ? '#D97706' : '#16A34A', fontWeight: 600 }}>
                            {diffMinutos > 0 ? `+${diffMinutos}min (atraso)` : diffMinutos < 0 ? `${diffMinutos}min (antecipado)` : 'No horário'}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <span className="badge-vaga amarelo" style={{ background: '#FFF7ED', color: '#9A3412', border: '1px solid #FDBA74', whiteSpace: 'nowrap' }}>
                          {s.tipo === 'ajuste_saida' ? '⏰ Ajuste de Saída' : '📝 Justificativa'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 200 }}>{s.descricao || s.justificativa || '-'}</td>
                      <td>
                        <button onClick={() => { setModalSolicitacao(s); setAcaoOcorrencia('aprovar'); setObservacaoOcorrencia(''); }} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                          Analisar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalSolicitacao && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0 }}>Análise de Solicitação</h3>
              <button onClick={() => { setModalSolicitacao(null); setObservacaoOcorrencia(''); setAcaoOcorrencia('aprovar'); }} className="btn-close">&times;</button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
              <div><strong>Aluno:</strong> {modalSolicitacao.aluno_nome} ({modalSolicitacao.matricula})</div>
              <div><strong>Data:</strong> {formatarData(modalSolicitacao.data || '')}</div>
              <div><strong>Horário Firmado:</strong> {modalSolicitacao.horario_firmado_inicio && modalSolicitacao.horario_firmado_fim ? `${modalSolicitacao.horario_firmado_inicio}–${modalSolicitacao.horario_firmado_fim}` : 'Não informado'}</div>
              <div><strong>Entrada Real:</strong> {modalSolicitacao.hora_entrada || '-'}</div>
              <div><strong>Saída Solicitada:</strong> {modalSolicitacao.saida_sugerida || '-'}</div>
              <div><strong>Tipo:</strong> <span style={{ color: '#9A3412', fontWeight: 700 }}>{modalSolicitacao.tipo === 'ajuste_saida' ? 'Ajuste de Saída' : 'Justificativa'}</span></div>
              <div><strong>Justificativa:</strong> <em>"{modalSolicitacao.descricao || modalSolicitacao.justificativa}"</em></div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Decisão:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setAcaoOcorrencia('aprovar')}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: 8, border: acaoOcorrencia === 'aprovar' ? '2px solid #16A34A' : '1px solid var(--border-color)',
                    background: acaoOcorrencia === 'aprovar' ? '#F0FDF4' : '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem', color: '#16A34A'
                  }}
                >
                  <CheckCircle size={16} /> Aprovar
                </button>
                <button
                  onClick={() => setAcaoOcorrencia('reposicao')}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: 8, border: acaoOcorrencia === 'reposicao' ? '2px solid #D97706' : '1px solid var(--border-color)',
                    background: acaoOcorrencia === 'reposicao' ? '#FFFBEB' : '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem', color: '#D97706'
                  }}
                >
                  <RotateCcw size={16} /> Reposição
                </button>
                <button
                  onClick={() => setAcaoOcorrencia('rejeitar')}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: 8, border: acaoOcorrencia === 'rejeitar' ? '2px solid #DC2626' : '1px solid var(--border-color)',
                    background: acaoOcorrencia === 'rejeitar' ? '#FEF2F2' : '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem', color: '#DC2626'
                  }}
                >
                  <XCircle size={16} /> Rejeitar
                </button>
              </div>
            </div>

            {(acaoOcorrencia === 'rejeitar' || acaoOcorrencia === 'reposicao') && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Observação: <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  value={observacaoOcorrencia}
                  onChange={e => setObservacaoOcorrencia(e.target.value)}
                  placeholder={acaoOcorrencia === 'rejeitar' ? 'Informe o motivo da rejeição (obrigatório)...' : 'Informe a justificativa para a reposição (obrigatório)...'}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>
            )}

            {acaoOcorrencia === 'aprovar' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Observação (opcional):
                </label>
                <textarea
                  rows={2}
                  value={observacaoOcorrencia}
                  onChange={e => setObservacaoOcorrencia(e.target.value)}
                  placeholder="Observação administrativa (opcional)..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setModalSolicitacao(null); setObservacaoOcorrencia(''); setAcaoOcorrencia('aprovar'); }} className="btn-secondary" style={{ background: '#E2E8F0', color: '#334155' }}>
                Cancelar
              </button>
              <button
                onClick={handleProcessarOcorrencia}
                disabled={processandoOcorrencia}
                className="btn-primary"
                style={{
                  background: acaoOcorrencia === 'aprovar' ? '#16A34A' : acaoOcorrencia === 'reposicao' ? '#D97706' : '#DC2626'
                }}
              >
                {processandoOcorrencia ? 'Processando...' : (
                  acaoOcorrencia === 'aprovar' ? 'Aprovar Ocorrência' :
                  acaoOcorrencia === 'reposicao' ? 'Encaminhar p/ Reposição' :
                  'Rejeitar Ocorrência'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
