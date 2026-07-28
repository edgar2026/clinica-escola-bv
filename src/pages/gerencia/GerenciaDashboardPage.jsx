import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MetricCard } from '../../components/common/MetricCard';
import { AlertTriangle, Users, CheckCircle, Clock, FileText, Download, RefreshCw } from 'lucide-react';
import { formatarData } from '../../utils/datas';
import { gerenciaService } from '../../services/gerenciaService';

export const GerenciaDashboardPage = () => {
  const { showToast } = useAuth();
  const [metricas, setMetricas] = useState({
    totalAlunosCadastrados: 0,
    alunosPresentesAgora: 0,
    alunosAtrasadosHoje: 0,
    justificativasPendentes: 0,
    slotsComVagas: 0
  });
  const [presentes, setPresentes] = useState([]);
  const [justificativas, setJustificativas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalItem, setModalItem] = useState(null);
  const [parecer, setParecer] = useState('');

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
        setJustificativas(Array.isArray(res.justificativasPendentes) ? res.justificativasPendentes : []);
      }
    } catch (err) {
      console.error('Erro ao carregar dashboard gerencial:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDashboard();
  }, [carregarDashboard]);

  const handleDecidirJustificativa = async (acao) => {
    if (!parecer || parecer.length < 5) {
      showToast('Insira um parecer/justificativa administrativa (mínimo 5 caracteres).', 'erro');
      return;
    }

    try {
      await gerenciaService.validarForaHorario(modalItem.ponto_id || modalItem.id, acao, parecer);
      showToast(`Solicitação ${acao === 'aprovar' ? 'aprovada' : 'indeferida'} com sucesso!`, 'sucesso');
      await carregarDashboard();
    } catch (err) {
      showToast('Erro ao processar decisão: ' + (err.message || 'Tente novamente.'), 'erro');
    } finally {
      setModalItem(null);
      setParecer('');
    }
  };

  return (
    <section>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Painel Gerencial — Monitoramento & Validacoes</h1>
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
            <MetricCard label="Pendencias / Atestados"   value={justificativas.length}            accent="accent-red" />
            <MetricCard label="Slots com Vagas"          value={metricas.slotsComVagas}           accent="accent-green"  />
          </div>

      {/* Presentes agora */}
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
              <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Nenhum aluno presente no momento.</td></tr>
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

      {/* Fila de Análise de Atestados e Justificativas de Alunos */}
      <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <FileText size={20} /> 📋 Fila de Análise: Atestados & Pedidos de Alteração de Horário
      </h3>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Aluno (Matrícula)</th>
              <th>Curso</th>
              <th>Data Ocorrência</th>
              <th>Motivo / Justificativa</th>
              <th>Atestado / Comprovante</th>
              <th>Ação Requerida</th>
            </tr>
          </thead>
          <tbody>
            {justificativas.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--status-green)', padding: '1.5rem' }}>✅ Nenhuma solicitação de reposição pendente no momento.</td></tr>
            ) : justificativas.map(j => (
              <tr key={j.id} style={{ backgroundColor: '#F0F9FF' }}>
                <td><strong>{j.aluno_nome}</strong> ({j.matricula})</td>
                <td>{j.curso_nome || '-'}</td>
                <td><span className="badge-vaga amarelo">{formatarData(j.data_falta || j.data)}</span></td>
                <td style={{ fontSize: '0.85rem', maxWidth: 280 }}>{j.justificativa || j.descricao || j.motivo}</td>
                <td>
                  {j.anexo_nome || j.arquivo_comprovante ? (
                    <button
                      onClick={() => showToast(`Baixando comprovante: ${j.anexo_nome || j.arquivo_comprovante}`, 'sucesso')}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Download size={13} /> {j.anexo_nome || 'Atestado'}
                    </button>
                  ) : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sem anexo</span>}
                </td>
                <td>
                  <button onClick={() => setModalItem(j)} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                    Analisar & Decidir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}

      {/* Modal de Validacao de Atestado */}
      {modalItem && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)' }}>Análise de Atestado & Autorização de Alteração de Horário</h3>
              <button onClick={() => { setModalItem(null); setParecer(''); }} className="btn-close">&times;</button>
            </div>
            
            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: 8, fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 4px' }}>Aluno: <strong>{modalItem.aluno_nome}</strong> ({modalItem.matricula})</p>
              <p style={{ margin: '0 0 4px' }}>Data da ocorrência: <strong>{formatarData(modalItem.data_falta || modalItem.data)}</strong> ({modalItem.tipo || modalItem.motivo})</p>
              <p style={{ margin: '0 0 4px' }}>Justificativa: <em>"{modalItem.justificativa || modalItem.descricao}"</em></p>
              {modalItem.anexo_nome && <p style={{ margin: 0 }}>Arquivo comprovante: <strong>{modalItem.anexo_nome}</strong></p>}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Parecer Administrativo / Decisão:
              </label>
              <textarea
                rows="3"
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
    </section>
  );
};
