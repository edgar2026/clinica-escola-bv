import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Printer, Download, Calendar, Upload, FileText, Clock } from 'lucide-react';
import { pontoService } from '../../services/pontoService';
import { uploadAtestado } from '../../services/supabaseClient';
import { formatarData } from '../../utils/datas';
import type { Ponto } from '../../types';

const OPCOES_IMPREVISTOS = [
  { value: 'consulta_medica', label: '🏥 Consulta Médica / Exame / Atestado Médico', exigeAnexo: true },
  { value: 'transporte',       label: '🚗 Problema no Transporte / Trânsito',           exigeAnexo: false },
  { value: 'pessoal',          label: '🏠 Imprevisto Familiar / Pessoal',              exigeAnexo: false },
  { value: 'outros',           label: '📝 Outros Motivos (Análise do Administrador)',  exigeAnexo: false },
];

export const EspelhoPontoPage = () => {
  const { usuario, showToast } = useAuth();
  const [registros, setRegistros] = useState<Ponto[]>([]);
  const [_loading, setLoading] = useState(false);
  const [mesAno, setMesAno] = useState(new Date().toISOString().substring(0, 7));

  const [itemParaJustificar, setItemParaJustificar] = useState<Ponto | null>(null);
  const [tipoMotivo, setTipoMotivo] = useState('consulta_medica');
  const [textoJustificativa, setTextoJustificativa] = useState('');
  const [arquivoAnexo, setArquivoAnexo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [itemParaAjustar, setItemParaAjustar] = useState<Ponto | null>(null);
  const [saidaSugerida, setSaidaSugerida] = useState('');
  const [justificativaAjuste, setJustificativaAjuste] = useState('');
  const [enviandoAjuste, setEnviandoAjuste] = useState(false);

  const opcaoSelecionada = OPCOES_IMPREVISTOS.find(o => o.value === tipoMotivo);

  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pontoService.getHistoricoAluno();
      if (res && res.historico) {
        setRegistros(res.historico);
      }
    } catch {
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  const registrosFiltrados = registros.filter(r => {
    if (!mesAno) return true;
    return r.data && r.data.startsWith(mesAno);
  });

  const totalMinutos = registrosFiltrados.reduce((sum, r) => sum + (r.tempo_total_minutos || 0), 0);
  const totalHorasCalculadas = `${Math.floor(totalMinutos / 60)}h ${totalMinutos % 60}m`;
  const totalDiasPresentes = new Set(registrosFiltrados.filter(r => r.hora_entrada).map(r => r.data)).size;
  const totalAtrasos = registrosFiltrados.filter(r => r.status_frequencia === 'atraso').length;
  const totalFaltas = registrosFiltrados.filter(r => r.status_frequencia === 'ausencia').length;

  const handleSubmeterJustificativa = async (e: FormEvent) => {
    e.preventDefault();

    if (!textoJustificativa || textoJustificativa.trim().length < 5) {
      showToast('Por favor, informe a justificativa detalhada (mínimo 5 caracteres).', 'erro');
      return;
    }

    if (opcaoSelecionada?.exigeAnexo && !arquivoAnexo) {
      showToast('Para Consulta Médica, é obrigatório anexar o Atestado Médico ou Declaração.', 'erro');
      return;
    }

    setEnviando(true);
    try {
      let anexoUrl: string | undefined;

      if (arquivoAnexo) {
        const uploaded = await uploadAtestado(arquivoAnexo);
        anexoUrl = uploaded.publicUrl;
      }

      await pontoService.submeterJustificativa(
        itemParaJustificar!.id,
        tipoMotivo,
        textoJustificativa,
        anexoUrl
      );

      showToast('Justificativa enviada à administração para análise!', 'sucesso');
      await carregarHistorico();
    } catch (err) {
      showToast('Erro ao enviar justificativa: ' + (err instanceof Error ? err.message : 'Tente novamente.'), 'erro');
    } finally {
      setEnviando(false);
      setItemParaJustificar(null);
      setTextoJustificativa('');
      setArquivoAnexo(null);
    }
  };

  const handleSolicitarAjusteSaida = async (e: FormEvent) => {
    e.preventDefault();

    if (!saidaSugerida) {
      showToast('Informe o horário de saída que deseja registrar.', 'erro');
      return;
    }

    if (!justificativaAjuste || justificativaAjuste.trim().length < 5) {
      showToast('Informe a justificativa (mínimo 5 caracteres).', 'erro');
      return;
    }

    setEnviandoAjuste(true);
    try {
      const res = await pontoService.solicitarAjusteSaida(
        itemParaAjustar!.id,
        saidaSugerida,
        justificativaAjuste
      );

      if (res.sucesso) {
        showToast(res.mensagem, 'sucesso');
        await carregarHistorico();
      } else {
        showToast(res.mensagem, 'erro');
      }
    } catch (err) {
      showToast('Erro ao solicitar ajuste: ' + (err instanceof Error ? err.message : 'Tente novamente.'), 'erro');
    } finally {
      setEnviandoAjuste(false);
      setItemParaAjustar(null);
      setSaidaSugerida('');
      setJustificativaAjuste('');
    }
  };

  const handleExportCSV = () => {
    const header = 'Data,Entrada,Saida,HorasComputadas,Status,Observacao\n';
    const rows = registrosFiltrados.map(r =>
      `${formatarData(r.data || '')},${r.hora_entrada || '-'},${r.hora_saida || '-'},${r.tempo_total_minutos || 0}min,${r.status_frequencia},"${r.observacao || ''}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico-registros-${usuario?.matricula || 'aluno'}-${mesAno}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Histórico de registros baixado em formato CSV!', 'sucesso');
  };

  return (
    <section>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Histórico de Registros Individual</h1>
          <p className="page-subtitle">Relatório oficial de marcações de frequência e justificativas para reposição de horários.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#FFF', padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Calendar size={16} color="var(--primary)" />
            <input
              type="month"
              value={mesAno}
              onChange={e => setMesAno(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: '0.88rem', color: 'var(--primary)', outline: 'none' }}
            />
          </div>

          <button onClick={() => window.print()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Printer size={16} /> Imprimir PDF
          </button>
          <button onClick={handleExportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Download size={16} /> CSV
          </button>
        </div>
      </div>

      <div className="printable-voucher" style={{ background: '#FFFFFF', padding: '2.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid var(--primary)', paddingBottom: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <img src="/logo.png" alt="UNINASSAU Logo" style={{ height: '55px', width: 'auto', marginBottom: '0.4rem' }} />
            <h2 style={{ color: 'var(--primary)', fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              CLÍNICA-ESCOLA UNINASSAU — HISTÓRICO DE REGISTROS INDIVIDUAL
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              Relatório de Auditoria de Frequência Acadêmica de Estágio / Prática
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>CÓDIGO DE AUTENTICIDADE</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: '#F1F5F9', padding: '3px 8px', borderRadius: 4, marginTop: 4 }}>
              NASSAU-REGISTRO-{usuario?.matricula || '0000'}-{mesAno}
            </div>
            <div style={{ marginTop: 4 }}>Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-main)', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
          <div><strong>Aluno:</strong> {usuario?.nome || '-'}</div>
          <div><strong>Matrícula:</strong> {usuario?.matricula || '-'}</div>
          <div><strong>Curso:</strong> {usuario?.aluno?.curso_nome || '-'}</div>
          <div><strong>E-mail:</strong> {usuario?.email || '-'}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#EEF9F4', border: '1px solid #A7F3D0', padding: '0.85rem 1rem', borderRadius: 8 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>Total Horas Cumpridas</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#065F46', marginTop: 2 }}>{totalHorasCalculadas}</div>
          </div>
          <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '0.85rem 1rem', borderRadius: 8 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369A1', textTransform: 'uppercase' }}>Dias Presente</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0369A1', marginTop: 2 }}>{totalDiasPresentes} dias</div>
          </div>
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '0.85rem 1rem', borderRadius: 8 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Atrasos Registrados</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#92400E', marginTop: 2 }}>{totalAtrasos}</div>
          </div>
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '0.85rem 1rem', borderRadius: 8 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>Faltas Registradas</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#991B1B', marginTop: 2 }}>{totalFaltas}</div>
          </div>
        </div>

        <div className="table-container" style={{ marginBottom: '2rem' }}>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Tempo Total</th>
                <th>Situação</th>
                <th>Ações de Justificativa / Reposição</th>
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.length === 0 ? (
                <tr>
                   <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Nenhum registro encontrado para este período.
                  </td>
                </tr>
              ) : (
                registrosFiltrados.map((r) => (
                  <tr key={r.id} style={{ backgroundColor: r.status_frequencia === 'ausencia' ? '#FEF2F2' : r.status_frequencia === 'atraso' ? '#FFFBEB' : r.status_frequencia === 'saida_nao_registrada' ? '#FFF7ED' : 'transparent' }}>
                    <td><strong>{formatarData(r.data || '')}</strong></td>
                    <td><strong style={{ color: !r.hora_entrada ? '#991B1B' : 'var(--text-dark)' }}>{r.hora_entrada || '-'}</strong></td>
                    <td>
                      <strong style={{ color: !r.hora_saida || r.hora_saida === '00:00' ? '#991B1B' : 'var(--text-dark)' }}>
                        {(!r.hora_saida || r.hora_saida === '00:00') ? 'Saída não registrada' : r.hora_saida}
                      </strong>
                    </td>
                    <td><span className="badge-vaga verde" style={{ fontSize: '0.75rem' }}>{r.tempo_total_minutos ? `${Math.floor(r.tempo_total_minutos / 60)}h ${r.tempo_total_minutos % 60}m` : '-'}</span></td>
                    <td>
                      {r.status_frequencia === 'presenca_no_horario' && <span className="badge-vaga verde">✅ No Horário</span>}
                      {r.status_frequencia === 'atraso' && <span className="badge-vaga amarelo">⚠️ Atraso</span>}
                      {r.status_frequencia === 'ausencia' && <span className="badge-vaga vermelho">🔴 Ausente</span>}
                      {r.status_frequencia === 'presenca_fora_horario' && <span className="badge-vaga amarelo" style={{ background: '#E0F2FE', color: '#0369A1', border: '1px solid #7DD3FC' }}>⏳ Fora do Horário</span>}
                      {r.status_frequencia === 'saida_nao_registrada' && <span className="badge-vaga amarelo" style={{ background: '#FFF7ED', color: '#9A3412', border: '1px solid #FDBA74' }}>⏰ Saída Não Registrada</span>}
                      {r.status_frequencia === 'aguardando_validacao' && <span className="badge-vaga amarelo" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>⏳ Aguardando Análise</span>}
                      {r.status_frequencia === 'falta_justificada' && <span className="badge-vaga verde" style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #86EFAC' }}>✅ Falta Justificada</span>}
                    </td>
                    <td>
                      {(r.status_frequencia === 'atraso' || r.status_frequencia === 'ausencia') && (
                        <button
                          onClick={() => { setItemParaJustificar(r); setTextoJustificativa(''); setArquivoAnexo(null); setTipoMotivo('consulta_medica'); }}
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#005691' }}
                        >
                          <Upload size={13} /> Justificar Ocorrência
                        </button>
                      )}
                      {r.status_frequencia === 'saida_nao_registrada' && (
                        <button
                          onClick={() => { setItemParaAjustar(r); setSaidaSugerida(''); setJustificativaAjuste(''); }}
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#9A3412' }}
                        >
                          <Clock size={13} /> Solicitar Ajuste de Saída
                        </button>
                      )}
                      {r.status_frequencia !== 'atraso' && r.status_frequencia !== 'ausencia' && r.status_frequencia !== 'saida_nao_registrada' && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px dashed #CBD5E1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #000', marginBottom: '0.5rem', width: '80%', margin: '0 auto 0.5rem' }}></div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary)' }}>{usuario?.nome}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assinatura do Aluno (Estagiário)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #000', marginBottom: '0.5rem', width: '80%', margin: '0 auto 0.5rem' }}></div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary)' }}>Coordenação Clínica-Escola</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assinatura do Coordenador / Supervisor</div>
          </div>
        </div>
      </div>

      {itemParaJustificar && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} color="var(--primary)" /> Justificativa de Ocorrência
              </h3>
              <button onClick={() => setItemParaJustificar(null)} className="btn-close">&times;</button>
            </div>

            <form onSubmit={handleSubmeterJustificativa}>
              <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                <div><strong>Data da Ocorrência:</strong> {formatarData(itemParaJustificar.data || '')}</div>
                <div><strong>Entrada Registrada:</strong> {itemParaJustificar.hora_entrada || '-'}</div>
                <div><strong>Tipo Registrado:</strong> <span style={{ color: '#991B1B', fontWeight: 700 }}>{(itemParaJustificar.status_frequencia || 'ocorrência').toUpperCase()}</span></div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-dark)' }}>
                  Selecione o Tipo de Imprevisto:
                </label>
                <select
                  value={tipoMotivo}
                  onChange={e => setTipoMotivo(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none', background: '#FFF' }}
                >
                  {OPCOES_IMPREVISTOS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {opcaoSelecionada?.exigeAnexo ? (
                <div style={{ marginBottom: '1.25rem', background: '#F0F9FF', padding: '1rem', borderRadius: 10, border: '1.5px dashed #0284C7' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0369A1' }}>
                    📎 Anexar Atestado Médico ou Declaração Oficial (Obrigatório):
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={e => setArquivoAnexo(e.target.files?.[0] || null)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 6,
                      border: '1px solid #BAE6FD',
                      background: '#FFF',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  />
                  {arquivoAnexo && (
                    <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, marginTop: 6 }}>
                      ✅ Anexo carregado: {arquivoAnexo.name}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: '#FFFBEB', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #FDE68A', fontSize: '0.82rem', color: '#92400E', marginBottom: '1.25rem' }}>
                  ℹ️ Para este motivo, descreva os detalhes abaixo. A solicitação será analisada individualmente pelo Administrador.
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-dark)' }}>
                  Descreva a Justificativa Detalhada:
                </label>
                <textarea
                  rows={3}
                  required
                  value={textoJustificativa}
                  onChange={e => setTextoJustificativa(e.target.value)}
                  placeholder="Escreva os detalhes e o motivo da ocorrência..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setItemParaJustificar(null)} className="btn-secondary" style={{ background: '#E2E8F0', color: '#334155' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviando} className="btn-primary">
                  {enviando ? 'Submetendo...' : 'Enviar para Análise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemParaAjustar && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 style={{ color: '#9A3412', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} color="#9A3412" /> Solicitar Ajuste de Saída
              </h3>
              <button onClick={() => setItemParaAjustar(null)} className="btn-close">&times;</button>
            </div>

            <form onSubmit={handleSolicitarAjusteSaida}>
              <div style={{ background: '#FFF7ED', padding: '0.85rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid #FDBA74' }}>
                <div><strong>Data do Registro:</strong> {formatarData(itemParaAjustar.data || '')}</div>
                <div><strong>Entrada Registrada:</strong> {itemParaAjustar.hora_entrada || '-'}</div>
                <div><strong>Situação:</strong> <span style={{ color: '#9A3412', fontWeight: 700 }}>SAÍDA NÃO REGISTRADA</span></div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-dark)' }}>
                  Horário de Saída que Deseja Registrar: <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="time"
                  required
                  value={saidaSugerida}
                  onChange={e => setSaidaSugerida(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none', background: '#FFF' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-dark)' }}>
                  Justificativa Obrigatória: <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={justificativaAjuste}
                  onChange={e => setJustificativaAjuste(e.target.value)}
                  placeholder="Explique o motivo de não ter registrado a saída no horário (mínimo 5 caracteres)..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setItemParaAjustar(null)} className="btn-secondary" style={{ background: '#E2E8F0', color: '#334155' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviandoAjuste} className="btn-primary" style={{ background: '#9A3412' }}>
                  {enviandoAjuste ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};