import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Printer, Calendar, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { getAlunoId } from '../../services/helpers';
import type { GradeFirmadaInfo } from '../../types';

const DIAS_SEMANA: Record<number, string> = {
  1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado',
};

const formatarHoras = (minutos: number): string => {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
};

export const MeuHorarioFirmadoPage = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
  const { usuario, showToast } = useAuth();
  const [grade, setGrade] = useState<GradeFirmadaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [inscricaoAberta, setInscricaoAberta] = useState<boolean>(false);

  const carregarHorariosFirmados = useCallback(async () => {
    setLoading(true);
    try {
      const alunoId = await getAlunoId();

      const { data: gradeData, error: errGrade } = await supabase.rpc('obter_grade_aluno', {
        p_aluno_id: Number(alunoId),
      });
      if (errGrade) throw errGrade;
      setGrade(gradeData as GradeFirmadaInfo);

      const { data: statusInscricao } = await supabase.rpc('verificar_inscricao_aberta', {
        p_aluno_id: Number(alunoId),
      });
      setInscricaoAberta(statusInscricao?.inscricao_aberta ?? false);
    } catch (err) {
      showToast('Erro ao carregar horário firmado: ' + (err instanceof Error ? err.message : 'Tente novamente.'), 'erro');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { carregarHorariosFirmados(); }, [carregarHorariosFirmados]);

  const firmado = grade?.confirmado === true;
  const totalHoras = firmado
    ? grade.selecoes.reduce((s, sel) => {
        const [hI, mI] = sel.hora_inicio.split(':').map(Number);
        const [hF, mF] = sel.hora_fim.split(':').map(Number);
        return s + (hF * 60 + mF - hI * 60 - mI) / 60;
      }, 0)
    : 0;

  const horasFirmadas = grade?.horas_firmadas_minutos ?? 0;
  const horasRascunho = grade?.horas_rascunho_minutos ?? 0;
  const temRascunho = grade && grade.selecoes && grade.selecoes.length > 0 && !firmado && horasRascunho > 0;
  const precisaComplemento = !firmado && horasFirmadas > 0 && horasFirmadas < ((grade?.categoria_carga ?? 0) * 60);
  const precisaReducao = !firmado && horasRascunho > 0 && horasRascunho !== ((grade?.categoria_carga ?? 0) * 60) && horasFirmadas === 0;

  const hojeStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const formatarDataFim = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <section>
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>Carregando horário firmado...</div>
      </section>
    );
  }

  return (
    <section>
      <div className="printable-voucher" style={{ background: '#FFF', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <img src="/logo.png" alt="UNINASSAU Logo" style={{ height: '50px', width: 'auto', marginBottom: '0.25rem' }} />
            <h2 style={{ color: 'var(--primary)', marginTop: '0.5rem' }}>Comprovante Oficial de Horário Firmado</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Código: UNINASSAU-{usuario?.matricula || '0000'}-{hojeStr}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={carregarHorariosFirmados} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <RefreshCw size={15} className={loading ? 'spin' : ''} /> Atualizar
            </button>
            {firmado && (
              <button onClick={() => window.print()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Printer size={16} /> Imprimir / PDF
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <div><strong>Aluno:</strong> {usuario?.nome || '-'}</div>
          <div><strong>Matrícula:</strong> {usuario?.matricula || '-'}</div>
          <div><strong>Curso:</strong> {usuario?.aluno?.curso_nome || '-'}</div>
          <div>
            <strong>Total Horas Firmadas:</strong>{' '}
            <span className={`badge-vaga ${firmado ? 'verde' : 'amarelo'}`}>
              {firmado ? `${totalHoras}h / ${grade?.categoria_carga ?? 0}h por semana` : 'Não firmado'}
            </span>
          </div>
        </div>

        {!firmado && !temRascunho && !precisaComplemento && !precisaReducao ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#F8FAFC', borderRadius: 8, color: 'var(--text-muted)' }}>
            <Calendar size={36} color="var(--primary)" style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Você ainda não firmou seu horário semanal.</p>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem' }}>
              Seu horário só aparece aqui depois que você confirmar a Grade Semanal com a carga completa.
            </p>
            {inscricaoAberta ? (
              <button onClick={() => setActiveTab('grade-semanal-aluno')} className="btn-primary">
                Escolher Horários na Grade
              </button>
            ) : (
              <p style={{ margin: 0, fontSize: '0.82rem' }}>
                O período de inscrição está fechado. Contate a administração em caso de dúvidas.
              </p>
            )}
          </div>
        ) : (precisaComplemento || precisaReducao) && !firmado ? (
          /* Ajuste pendente: complemento ou redução */
          <div>
            <div style={{
              background: precisaComplemento ? '#EFF6FF' : '#FEF3C7',
              border: precisaComplemento ? '1px solid #3B82F6' : '1px solid #F59E0B',
              borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <AlertTriangle size={20} color={precisaComplemento ? '#2563EB' : '#D97706'} style={{ flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: precisaComplemento ? '#1E40AF' : '#92400E', fontSize: '0.92rem' }}>
                  {precisaComplemento ? 'Complemento Necessário' : 'Redução Necessária'}
                </p>
                <p style={{ margin: '0.25rem 0 0', color: precisaComplemento ? '#1D4ED8' : '#B45309', fontSize: '0.85rem' }}>
                  {precisaComplemento
                    ? `Sua carga foi aumentada para ${formatarHoras((grade?.categoria_carga ?? 0) * 60)}. Você possui ${formatarHoras(horasFirmadas)} firmadas. Selecione mais ${formatarHoras((grade?.categoria_carga ?? 0) * 60 - horasFirmadas)} na Grade Semanal.`
                    : `Sua carga foi reduzida para ${formatarHoras((grade?.categoria_carga ?? 0) * 60)}. Remova ${formatarHoras(horasRascunho - (grade?.categoria_carga ?? 0) * 60)} na Grade Semanal.`
                  }
                </p>
              </div>
            </div>

            {/* Mostra horários firmados (parcial) */}
            {grade && grade.selecoes && grade.selecoes.length > 0 && (
              <>
                <div style={{ marginBottom: '0.75rem', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                  Horários Selecionados (parcialmente firmados):
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Dia da Semana</th>
                        <th>Horário</th>
                        <th>Clínica / Setor</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grade && [...grade.selecoes]
                        .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))
                        .map(sel => (
                          <tr key={sel.vaga_horario_id}>
                            <td><strong>{DIAS_SEMANA[sel.dia_semana] || `Dia ${sel.dia_semana}`}</strong></td>
                            <td>{sel.hora_inicio} – {sel.hora_fim}</td>
                            <td>{sel.setor_nome || 'Clínica-Escola'}</td>
                            <td>
                              <span className={`badge-vaga ${sel.confirmado ? 'verde' : 'amarelo'}`}>
                                {sel.confirmado ? 'Firmado' : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setActiveTab('grade-semanal-aluno')} className="btn-primary">
                    {precisaComplemento ? 'Complementar Horário' : 'Ajustar Horário'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Grade firmada (totalmente confirmada) */
          <>
            <div style={{
              background: '#D1FAE5', border: '1px solid #10B981', borderRadius: 12,
              padding: '1rem 1.25rem', display: 'flex', alignItems: 'center',
              gap: '0.75rem', marginBottom: '1.5rem',
            }}>
              <Lock size={20} color="#065F46" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, color: '#065F46', fontWeight: 700, fontSize: '0.92rem' }}>
                  Seu horário semanal já está firmado — Carga completa: {totalHoras}h de {grade?.categoria_carga ?? 0}h.
                </p>
                <p style={{ margin: '0.25rem 0 0', color: '#065F46', fontSize: '0.82rem' }}>
                  Vigência: {formatarDataFim(grade?.vigencia_inicio)} até {formatarDataFim(grade?.vigencia_fim)} — alterações somente pela administração.
                  {grade?.confirmado_em ? ` Firmado em ${new Date(grade.confirmado_em).toLocaleString('pt-BR')}.` : ''}
                </p>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Dia da Semana</th>
                    <th>Horário</th>
                    <th>Clínica / Setor</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {grade && [...grade.selecoes]
                    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))
                    .map(sel => (
                      <tr key={sel.vaga_horario_id}>
                        <td><strong>{DIAS_SEMANA[sel.dia_semana] || `Dia ${sel.dia_semana}`}</strong></td>
                        <td>{sel.hora_inicio} – {sel.hora_fim}</td>
                        <td>{sel.setor_nome || 'Clínica-Escola'}</td>
                        <td><span className="badge-vaga verde">Firmado</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={() => setActiveTab('registro-ponto')} className="btn-primary">
                Registrar Presença
              </button>
              <button onClick={() => setActiveTab('espelho-ponto')} className="btn-secondary">
                Histórico de Registros
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
