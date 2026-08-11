import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { agendamentoService } from '../../services/agendamentoService';
import type { SlotDisponibilidade, DiaCalendario } from '../../types';

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const CONFIG_INDICADOR = {
  disponivel:   { bg: '#D1FAE5', border: '#10B981', text: '#065F46', label: 'Vagas disponíveis' },
  quase_lotado: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', label: 'Poucas vagas'      },
  lotado:       { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B', label: 'Lotado'             },
  vazio:        { bg: '#F1F5F9', border: '#CBD5E1', text: '#94A3B8', label: 'Sem vagas'          },
};

export const CalendarioVagasPage = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
  const { showToast } = useAuth();

  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [diasCalendario, setDiasCalendario] = useState<DiaCalendario[]>([]);
  const [totalVagasAtivas, setTotalVagasAtivas] = useState(0);
  const [loading, setLoading] = useState(true);

  const [diaAtivo, setDiaAtivo] = useState<DiaCalendario | null>(null);
  const [slots, setSlots] = useState<SlotDisponibilidade[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [modalSlot, setModalSlot] = useState<SlotDisponibilidade | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const fetchCalendario = useCallback(async () => {
    setLoading(true);
    setDiaAtivo(null);
    setSlots([]);
    try {
      const data = await agendamentoService.getCalendarioMes(mesSelecionado, anoSelecionado);
      setDiasCalendario(data.dias || []);
      setTotalVagasAtivas(Number(data.totalVagasAtivas) || 0);
    } catch (err) {
      showToast('Erro ao carregar calendário: ' + (err instanceof Error ? err.message : ''), 'erro');
      setDiasCalendario([]);
    } finally {
      setLoading(false);
    }
  }, [mesSelecionado, anoSelecionado]);

  useEffect(() => { fetchCalendario(); }, [fetchCalendario]);

  const irMesAnterior = () => {
    if (mesSelecionado === 1) { setMesSelecionado(12); setAnoSelecionado(a => a - 1); }
    else setMesSelecionado(m => m - 1);
  };
  const irProximoMes = () => {
    if (mesSelecionado === 12) { setMesSelecionado(1); setAnoSelecionado(a => a + 1); }
    else setMesSelecionado(m => m + 1);
  };

  const handleDiaClick = async (dia: DiaCalendario) => {
    if (!dia.temVagas || dia.indicador === 'lotado') return;
    setDiaAtivo(dia);
    setLoadingSlots(true);
    setSlots([]);
    try {
      const diaSemanaJS = dia.diaSemana;
      const data = await agendamentoService.getDisponibilidade('', diaSemanaJS, dia.data);
      setSlots(data.slots || []);
    } catch (err) {
      showToast('Erro ao carregar horários: ' + (err instanceof Error ? err.message : ''), 'erro');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirmar = async () => {
    if (!modalSlot || !diaAtivo) return;
    setConfirmando(true);
    try {
      await agendamentoService.criarAgendamento(modalSlot.vaga_id, diaAtivo.data);
      showToast(`Presença confirmada! ${diaAtivo.data} às ${modalSlot.hora_inicio}`, 'sucesso');
      setModalSlot(null);
      fetchCalendario();
      setActiveTab('meu-horario-firmado');
    } catch (err) {
      showToast('Erro ao registrar: ' + (err instanceof Error ? err.message : ''), 'erro');
    } finally {
      setConfirmando(false);
    }
  };

  const primeirodiaSemana = diasCalendario.length > 0
    ? new Date(diasCalendario[0].data + 'T12:00:00').getDay()
    : 0;
  const celulasVaziasInicio = Array(primeirodiaSemana).fill(null);
  const hojeStr = hoje.toISOString().split('T')[0];

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Calendário de Vagas</h1>
        <p className="page-subtitle">
          Clique em um dia disponível para ver os horários e reservar sua vaga.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        {Object.entries(CONFIG_INDICADOR).map(([k, c]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: c.text }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: c.bg, border: `2px solid ${c.border}`, display: 'inline-block', flexShrink: 0 }} />
            {c.label}
          </span>
        ))}
      </div>

      <div className={`calendar-layout-container ${diaAtivo ? 'has-active-day' : ''}`}>
        <div style={{ background: '#FFF', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', background: 'var(--primary)', color: '#FFF' }}>
            <button onClick={irMesAnterior} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '0.4rem 0.75rem', cursor: 'pointer', color: '#FFF' }}>
              <ChevronLeft size={20} />
            </button>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              {MESES_PT[mesSelecionado - 1]} {anoSelecionado}
            </h2>
            <button onClick={irProximoMes} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '0.4rem 0.75rem', cursor: 'pointer', color: '#FFF' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E2E8F0' }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ textAlign: 'center', padding: '0.6rem 0', fontSize: '0.76rem', fontWeight: 700, color: d === 'Dom' ? '#EF4444' : '#64748B', background: '#F8FAFC' }}>
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>Carregando calendario...</div>
          ) : totalVagasAtivas === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#64748B' }}>
                Nenhum horario disponivel.
              </p>
              <p style={{ fontSize: '0.9rem' }}>
                Aguarde a configuracao da administracao.
              </p>
            </div>
          ) : diasCalendario.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#94A3B8' }}>
              Nenhum dado de vagas disponivel.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, padding: 10, background: '#F1F5F9' }}>
              {celulasVaziasInicio.map((_, i) => <div key={`emp-${i}`} style={{ minHeight: 76, background: 'transparent' }} />)}

              {diasCalendario.map((dia) => {
                const isHoje = dia.data === hojeStr;
                const isDom = dia.diaSemana === 0;
                const isAtivo = diaAtivo?.data === dia.data;
                const clicavel = dia.temVagas && dia.indicador !== 'lotado';
                const cfgVisual = CONFIG_INDICADOR[dia.indicador] || CONFIG_INDICADOR.vazio;
                const numero = parseInt(dia.data.split('-')[2]);

                return (
                  <div
                    key={dia.data}
                    onClick={() => clicavel && handleDiaClick(dia)}
                    style={{
                      background: isAtivo ? 'var(--primary)' : cfgVisual.bg,
                      border: `2px solid ${isAtivo ? 'var(--primary)' : isHoje ? '#818CF8' : cfgVisual.border}`,
                      borderRadius: 10,
                      minHeight: 76,
                      padding: '6px 4px',
                      cursor: clicavel ? 'pointer' : 'default',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      boxShadow: isAtivo ? '0 6px 18px rgba(16,78,141,0.25)' : clicavel ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      transform: isAtivo ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    <span style={{
                      fontWeight: isHoje ? 800 : 600,
                      fontSize: '0.95rem',
                      color: isAtivo ? '#FFF' : isDom ? '#EF4444' : cfgVisual.text,
                      background: isHoje && !isAtivo ? '#818CF8' : 'transparent',
                      borderRadius: '50%',
                      width: 26, height: 26,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {numero}
                    </span>

                    {dia.temVagas && (
                      <div style={{ textAlign: 'center' }}>
                        {dia.indicador !== 'lotado' ? (
                          <>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: isAtivo ? '#FFF' : cfgVisual.text, lineHeight: 1 }}>
                              {dia.totalDisponiveis}
                            </div>
                            <div style={{ fontSize: '0.58rem', color: isAtivo ? 'rgba(255,255,255,0.85)' : cfgVisual.text, fontWeight: 600 }}>
                              vagas
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#991B1B', background: '#FEE2E2', borderRadius: 4, padding: '1px 5px' }}>
                            LOTADO
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {diaAtivo && (
          <div className="slots-modal-backdrop" onClick={(e) => { if ((e.target as HTMLElement).className === 'slots-modal-backdrop') setDiaAtivo(null); }}>
            <div className="slots-panel-card" style={{ background: '#FFF', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'sticky', top: '1rem' }}>
              <div style={{ background: 'var(--primary)', color: '#FFF', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', textTransform: 'capitalize' }}>
                    {new Date(diaAtivo.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 2 }}>
                    {diaAtivo.totalDisponiveis} vaga{diaAtivo.totalDisponiveis !== 1 ? 's' : ''} disponíve{diaAtivo.totalDisponiveis !== 1 ? 'is' : 'l'}
                  </div>
                </div>
                <button
                  onClick={() => setDiaAtivo(null)}
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Fechar"
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '0.85rem', maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {loadingSlots ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>Carregando horarios...</div>
                ) : slots.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
                    Nenhum horario disponivel para este dia.
                  </div>
                ) : (
                  slots.map(slot => {
                    const cfgSlot = CONFIG_INDICADOR[slot.indicadorVisual === 'verde' ? 'disponivel' : slot.indicadorVisual === 'amarelo' ? 'quase_lotado' : 'lotado'];
                    const disponivel = slot.vagas_disponiveis > 0;

                    return (
                      <div key={slot.vaga_id} style={{ border: `2px solid ${cfgSlot.border}`, borderRadius: 12, padding: '0.85rem', background: cfgSlot.bg }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 800, color: cfgSlot.text, fontSize: '0.9rem' }}>
                            <Clock size={14} />
                            {slot.hora_inicio} – {slot.hora_fim}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: cfgSlot.text, background: '#FFF', padding: '2px 8px', borderRadius: 20, border: `1px solid ${cfgSlot.border}` }}>
                            {disponivel ? `${slot.vagas_disponiveis} livre${slot.vagas_disponiveis !== 1 ? 's' : ''}` : 'LOTADO'}
                          </span>
                        </div>

                        <p style={{ margin: '0 0 2px', fontWeight: 700, color: 'var(--primary)', fontSize: '0.82rem' }}>{slot.setor_nome}</p>

                        <div style={{ marginTop: '0.5rem', background: '#E2E8F0', borderRadius: 999, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${slot.capacidade_max > 0 ? (slot.vagas_ocupadas / slot.capacidade_max) * 100 : 0}%`, height: '100%', background: cfgSlot.border, borderRadius: 999 }} />
                        </div>
                        <p style={{ margin: '3px 0 0.6rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {slot.vagas_ocupadas}/{slot.capacidade_max} ocupadas
                        </p>

                        <button
                          onClick={() => disponivel && setModalSlot(slot)}
                          disabled={!disponivel}
                          style={{
                            width: '100%', padding: '0.55rem',
                            border: 'none', borderRadius: 8,
                            fontWeight: 700, fontSize: '0.82rem',
                            cursor: disponivel ? 'pointer' : 'not-allowed',
                            background: disponivel ? 'var(--primary)' : '#CBD5E1',
                            color: disponivel ? '#FFF' : '#94A3B8',
                          }}
                        >
                          {disponivel ? 'Reservar Este Horário' : 'Horário Lotado'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {modalSlot && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0 }}>Confirmar Presença</h3>
              <button onClick={() => setModalSlot(null)} className="btn-close">&times;</button>
            </div>

            <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: 8, fontSize: '0.9rem', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Data:</strong> {diaAtivo && new Date(diaAtivo.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <p style={{ margin: '0 0 6px' }}><strong>Horário:</strong> {modalSlot.hora_inicio} – {modalSlot.hora_fim}</p>
              <p style={{ margin: '0 0 6px' }}><strong>Setor:</strong> {modalSlot.setor_nome}</p>
            </div>

            <div style={{ background: '#FEF3C7', padding: '0.75rem', borderRadius: 6, fontSize: '0.8rem', color: '#92400E', marginBottom: '1.25rem' }}>
              Presença obrigatória. Atrasos superiores a 15 min serão registrados automaticamente.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalSlot(null)} className="btn-logout" style={{ background: '#E2E8F0', color: '#334155', border: 'none' }}>Cancelar</button>
              <button onClick={handleConfirmar} disabled={confirmando} className="btn-primary">
                {confirmando ? 'Confirmando...' : 'Confirmar Presença'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};