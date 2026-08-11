import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MetricCard } from '../../components/common/MetricCard';
import { Users, FileText, RefreshCw, CheckCircle, XCircle, Edit3 } from 'lucide-react';
import { formatarData } from '../../utils/datas';
import { gerenciaService } from '../../services/gerenciaService';
import { pontoService } from '../../services/pontoService';
import type { Ponto } from '../../types';

export const GerenciaDashboardPage = () => {
  const { showToast } = useAuth();
  const [metricas, setMetricas] = useState({
    totalAlunosCadastrados: 0,
    alunosPresentesAgora: 0,
    alunosAtrasadosHoje: 0,
    justificativasPendentes: 0,
    slotsComVagas: 0
  });
  const [presentes, setPresentes] = useState<Ponto[]>([]);
  const [, setJustificativas] = useState<Ponto[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalItem, setModalItem] = useState<Ponto | null>(null);
  const [parecer, setParecer] = useState('');

  const [solicitacoes, setSolicitacoes] = useState<Ponto[]>([]);
  const [modalSolicitacao, setModalSolicitacao] = useState<Ponto | null>(null);
  const [acaoSolicitacao, setAcaoSolicitacao] = useState<'aprovar' | 'corrigir' | 'rejeitar'>('aprovar');
  const [parecerSolicitacao, setParecerSolicitacao] = useState('');
  const [saidaCorrigida, setSaidaCorrigida] = useState('');
  const [processandoSolicitacao, setProcessandoSolicitacao] = useState(false);

  const carregarDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gerenciaService.getDashboardData();
      if (res) {
        setMetricas({
          totalAlunosCadastrados: Number(res.metricas?.totalAlunosCadastrados) || 0,
          alunosPresentesAgora: Number(res.metricas?.alunosPresentesAgora) || 0,
          alunosAtrasadosHoje: Number(res.metricas?.alunosAtrasadosHoje) || 0,
          justificativasPendentes: Number(res.metricas?.justificativasPendentes) || 0,
          slotsComVagas: Number(res.metricas?.slotsComVagas) || 0,
        });
        setPresentes(Array.isArray(res.presentesNoMomento) ? res.presentesNoMomento : []);
        setJustificativas(Array.isArray(res.pendenciasForaHorario) ? res.pendenciasForaHorario : []);
      }

      const sols = await pontoService.getSolicitacoesPendentes().catch(() => []);
      setSolicitacoes(sols);
    } catch (err) {
      console.error('Erro ao carregar dashboard gerencial:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDashboard();
  }, [carregarDashboard]);

  const handleDecidirJustificativa = async (acao: 'aprovar' | 'rejeitar') => {
    if (!parecer || parecer.length < 5) {
      showToast('Insira um parecer/justificativa administrativa (mínimo 5 caracteres).', 'erro');
      return;
    }

    try {
      await gerenciaService.validarForaHorario(modalItem?.ponto_id || modalItem?.id || '', acao, parecer);
      showToast(`Solicitação ${acao === 'aprovar' ? 'aprovada' : 'indeferida'} com sucesso!`, 'sucesso');
      await carregarDashboard();
    } catch (err) {
      showToast('Erro ao processar decisão: ' + (err instanceof Error ? err.message : 'Tente novamente.'), 'erro');
    } finally {
      setModalItem(null);
      setParecer('');
    }
  };

  const handleProcessarSolicitacao = async () => {
    if (!modalSolicitacao) return;
    if (!parecerSolicitacao || parecerSolicitacao.length < 5) {
      showToast('Insira um parecer administrativo (mínimo 5 caracteres).', 'erro');
      return;
    }

    if (acaoSolicitacao === 'corrigir' && !saidaCorrigida) {
      showToast('Para correção, informe o horário de saída corrigido.', 'erro');
      return;
    }

    setProcessandoSolicitacao(true);
    try {
      const res = await pontoService.analisarSolicitacao(
        modalSolicitacao.id,
        acaoSolicitacao,
        parecerSolicitacao,
        acaoSolicitacao === 'corrigir' ? saidaCorrigida : undefined
      );

      if (res.sucesso) {
        showToast(res.mensagem, 'sucesso');
        await carregarDashboard();
      } else {
        showToast(res.mensagem, 'erro');
      }
    } catch (err) {
      showToast('Erro ao processar solicitação: ' + (err instanceof Error ? err.message : 'Tente novamente.'), 'erro');
    } finally {
      setModalSolicitacao(null);
      setParecerSolicitacao('');
      setSaidaCorrigida('');
      setAcaoSolicitacao('aprovar');
      setProcessandoSolicitacao(false);
    }
  };

  return (
    <section>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Painel Gerencial — Monitoramento & Validações</h1>
          <p className="page-subtitle">Acompanhe alunos presentes na clinica em tempo real e analise atestados para autorizacao de horarios.</p>
        </div>
        <button onClick={carregarDashboard} disabled={loading} className="btn-secondary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar Painel
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>Carregando dados gerenciais...</div>
      ) : (
        <>
          <div className="metrics-grid">
            <MetricCard label="Alunos Cadastrados"      value={metricas.totalAlunosCadastrados} />
            <MetricCard label="Presentes no Momento"    value={presentes.length}                  accent="accent-green"  />
            <MetricCard label="Atrasados Hoje"           value={metricas.alunosAtrasadosHoje}    accent="accent-yellow" />
            <MetricCard label="Solicitações Pendentes"   value={solicitacoes.length}              accent="accent-red" />
            <MetricCard label="Slots com Vagas"          value={metricas.slotsComVagas}           accent="accent-green"  />
          </div>

          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} /> 🟢 Alunos Fisicamente Presentes Agora
          </h3>
          <div className="table-container" style={{ marginBottom: '2rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Aluno (Matrícula)</th>
                  <th>Curso</th>
                  <th>Setor / Clínica</th>
                  <th>Horário Entrada</th>
                  <th>Status Frequência</th>
                </tr>
              </thead>
              <tbody>
                {presentes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Nenhum aluno presente no momento.</td></tr>
                ) : presentes.map(p => (
                  <tr key={p.ponto_id || p.id}>
                    <td><strong>{p.aluno_nome}</strong> ({p.matricula})</td>
                    <td>{p.curso_nome}</td>
                    <td>{p.setor_nome}</td>
                    <td><span className="badge-vaga verde">Entrada: {p.hora_entrada}</span></td>
                    <td>
                      <span className={`badge-vaga ${p.status_frequencia === 'atraso' ? 'amarelo' : 'verde'}`}>
                        {p.status_frequencia === 'atraso' ? '⚠️ Atraso' : '✅ No Horário'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} /> 📋 Fila de Análise: Ajustes de Saída & Justificativas
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Aluno (Matrícula)</th>
                  <th>Data</th>
                  <th>Entrada</th>
                  <th>Situação</th>
                  <th>Justificativa do Aluno</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--status-green)', padding: '1.5rem' }}>✅ Nenhuma solicitação pendente no momento.</td></tr>
                ) : solicitacoes.map(s => (
                  <tr key={s.id} style={{ backgroundColor: '#FFF7ED' }}>
                    <td><strong>{s.aluno_nome}</strong> ({s.matricula})</td>
                    <td><span className="badge-vaga amarelo">{formatarData(s.data || s.data_falta || '')}</span></td>
                    <td>{s.hora_entrada || '-'}</td>
                    <td>
                      <span className="badge-vaga amarelo" style={{ background: '#FFF7ED', color: '#9A3412', border: '1px solid #FDBA74' }}>
                        {s.tipo === 'ajuste_saida' ? '⏰ Ajuste de Saída' : '📝 Justificativa'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 280 }}>{s.descricao || s.justificativa || '-'}</td>
                    <td>
                      <button onClick={() => { setModalSolicitacao(s); setAcaoSolicitacao('aprovar'); setParecerSolicitacao(''); setSaidaCorrigida(''); }} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                        Analisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalItem && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)' }}>Análise de Atestado & Autorização de Alteração de Horário</h3>
              <button onClick={() => { setModalItem(null); setParecer(''); }} className="btn-close">&times;</button>
            </div>
            
            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: 8, fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 4px' }}>Aluno: <strong>{modalItem.aluno_nome}</strong> ({modalItem.matricula})</p>
              <p style={{ margin: '0 0 4px' }}>Data da ocorrência: <strong>{formatarData(modalItem.data_falta || modalItem.data || '')}</strong> ({modalItem.tipo || modalItem.motivo})</p>
              <p style={{ margin: '0 0 4px' }}>Justificativa: <em>"{modalItem.justificativa || modalItem.descricao}"</em></p>
              {modalItem.anexo_nome && <p style={{ margin: 0 }}>Arquivo comprovante: <strong>{modalItem.anexo_nome}</strong></p>}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Parecer Administrativo / Decisão:
              </label>
              <textarea
                rows={3}
                value={parecer}
                onChange={e => setParecer(e.target.value)}
                placeholder="Ex: Atestado médico válido apresentado. Deferido com autorização de novo registro para reposição de carga horária."
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => handleDecidirJustificativa('rejeitar')} className="btn-logout" style={{ background: 'var(--status-red)', color: '#FFF' }}>
                Indeferir Pedido
              </button>
              <button onClick={() => handleDecidirJustificativa('aprovar')} className="btn-primary" style={{ background: 'var(--status-green)' }}>
                Aprovar & Liberar Alteração
              </button>
            </div>
          </div>
        </div>
      )}

      {modalSolicitacao && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0 }}>Análise de Solicitação</h3>
              <button onClick={() => { setModalSolicitacao(null); setParecerSolicitacao(''); setSaidaCorrigida(''); }} className="btn-close">&times;</button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
              <div><strong>Aluno:</strong> {modalSolicitacao.aluno_nome} ({modalSolicitacao.matricula})</div>
              <div><strong>Data:</strong> {formatarData(modalSolicitacao.data || '')}</div>
              <div><strong>Entrada:</strong> {modalSolicitacao.hora_entrada || '-'}</div>
              <div><strong>Tipo:</strong> <span style={{ color: '#9A3412', fontWeight: 700 }}>{modalSolicitacao.tipo === 'ajuste_saida' ? 'Ajuste de Saída' : 'Justificativa'}</span></div>
              <div><strong>Saída Sugerida:</strong> {modalSolicitacao.descricao?.includes('ajuste') ? (modalSolicitacao as unknown as Record<string, string>)['saida_sugerida'] || '-' : '-'}</div>
              <div><strong>Justificativa:</strong> <em>"{modalSolicitacao.descricao || modalSolicitacao.justificativa}"</em></div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Decisão:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setAcaoSolicitacao('aprovar')}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: 8, border: acaoSolicitacao === 'aprovar' ? '2px solid #16A34A' : '1px solid var(--border-color)',
                    background: acaoSolicitacao === 'aprovar' ? '#F0FDF4' : '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem', color: '#16A34A'
                  }}
                >
                  <CheckCircle size={16} /> Aprovar
                </button>
                <button
                  onClick={() => setAcaoSolicitacao('corrigir')}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: 8, border: acaoSolicitacao === 'corrigir' ? '2px solid #D97706' : '1px solid var(--border-color)',
                    background: acaoSolicitacao === 'corrigir' ? '#FFFBEB' : '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem', color: '#D97706'
                  }}
                >
                  <Edit3 size={16} /> Corrigir
                </button>
                <button
                  onClick={() => setAcaoSolicitacao('rejeitar')}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: 8, border: acaoSolicitacao === 'rejeitar' ? '2px solid #DC2626' : '1px solid var(--border-color)',
                    background: acaoSolicitacao === 'rejeitar' ? '#FEF2F2' : '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem', color: '#DC2626'
                  }}
                >
                  <XCircle size={16} /> Rejeitar
                </button>
              </div>
            </div>

            {acaoSolicitacao === 'corrigir' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Horário de Saída Corrigido: <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="time"
                  value={saidaCorrigida}
                  onChange={e => setSaidaCorrigida(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Parecer Administrativo: <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={parecerSolicitacao}
                onChange={e => setParecerSolicitacao(e.target.value)}
                placeholder={acaoSolicitacao === 'rejeitar' ? 'Informe o motivo da rejeição (obrigatório)...' : 'Descreva o parecer administrativo...'}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setModalSolicitacao(null); setParecerSolicitacao(''); setSaidaCorrigida(''); }} className="btn-secondary" style={{ background: '#E2E8F0', color: '#334155' }}>
                Cancelar
              </button>
              <button
                onClick={handleProcessarSolicitacao}
                disabled={processandoSolicitacao}
                className="btn-primary"
                style={{
                  background: acaoSolicitacao === 'aprovar' ? '#16A34A' : acaoSolicitacao === 'corrigir' ? '#D97706' : '#DC2626'
                }}
              >
                {processandoSolicitacao ? 'Processando...' : (
                  acaoSolicitacao === 'aprovar' ? 'Aprovar Solicitação' :
                  acaoSolicitacao === 'corrigir' ? 'Aplicar Correção' :
                  'Rejeitar Solicitação'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};