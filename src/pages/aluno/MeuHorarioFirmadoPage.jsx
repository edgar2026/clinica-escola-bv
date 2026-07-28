import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Printer, Mail, Trash2, Calendar, RefreshCw } from 'lucide-react';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { formatarData } from '../../utils/datas';
import { agendamentoService } from '../../services/agendamentoService';

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const MeuHorarioFirmadoPage = ({ setActiveTab }) => {
  const { usuario, showToast } = useAuth();
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cargaMax, setCargaMax] = useState(6);
  const [cancelarId, setCancelarId] = useState(null);

  const carregarHorariosFirmados = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agendamentoService.getMeuHorarioFirmado();
      if (res) {
        if (res.horariosFirmados) setHorarios(res.horariosFirmados);
        if (res.cargaHorariaMax) setCargaMax(res.cargaHorariaMax);
      }
    } catch {
      setHorarios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarHorariosFirmados();
  }, [carregarHorariosFirmados]);

  const totalHoras = horarios.reduce((s, h) => s + (h.horas_computadas || 1), 0);

  const handleConfirmarCancelamento = async () => {
    if (!cancelarId) return;
    try {
      await agendamentoService.cancelarAgendamento(cancelarId);
      showToast('Presença cancelada com sucesso.', 'sucesso');
      await carregarHorariosFirmados();
    } catch (err) {
      showToast(err.message || 'Erro ao cancelar presença.', 'erro');
    } finally {
      setCancelarId(null);
    }
  };

  const hojeStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

  return (
    <section>
      <div className="printable-voucher" style={{ background: '#FFF', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>

        {/* Cabeçalho */}
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
            <button onClick={() => window.print()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Printer size={16} /> Imprimir / PDF
            </button>
            <button onClick={() => showToast('Comprovante enviado por e-mail com sucesso!', 'sucesso')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Mail size={16} /> Enviar por E-mail
            </button>
          </div>
        </div>

        {/* Dados do aluno */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <div><strong>Aluno:</strong> {usuario?.nome || '-'}</div>
          <div><strong>Matrícula:</strong> {usuario?.matricula || '-'}</div>
          <div><strong>Curso:</strong> {usuario?.aluno?.curso_nome || '-'}</div>
          <div>
            <strong>Total Horas Firmadas:</strong>{' '}
            <span className={`badge-vaga ${totalHoras > cargaMax ? 'vermelho' : 'verde'}`}>
              {totalHoras}h / {cargaMax}h por semana
            </span>
          </div>
        </div>

        {/* Tabela de horários */}
        {horarios.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#F8FAFC', borderRadius: 8, color: 'var(--text-muted)' }}>
            <Calendar size={36} color="var(--primary)" style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Você ainda não possui presenças confirmadas para esta semana.</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Acesse a aba <strong>"Reservar Vaga no Calendário"</strong> para escolher seus horários de prática na Clínica-Escola.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Dia</th>
                  <th>Horário</th>
                  <th>Clínica / Setor</th>
                  <th>Professor Responsável</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {horarios.sort((a, b) => (a.data || '').localeCompare(b.data || '')).map(h => {
                  const diaIdx = h.dia_semana ? h.dia_semana : (h.data ? new Date(h.data + 'T12:00:00').getDay() : 0);
                  return (
                    <tr key={h.agendamento_id || h.id}>
                      <td><strong>{formatarData(h.data)}</strong></td>
                      <td>{DIAS_PT[diaIdx] || 'Dia'}</td>
                      <td>{h.hora_inicio} – {h.hora_fim}</td>
                      <td>{h.setor_nome || 'Clínica-Escola'}</td>
                      <td>{h.supervisor_nome || 'Supervisor'}</td>
                      <td><span className="badge-vaga verde">Confirmado ({h.horas_computadas || 1}h)</span></td>
                      <td>
                        <button onClick={() => setCancelarId(h.agendamento_id || h.id)} className="btn-logout" style={{ padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Trash2 size={14} /> Cancelar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      <ConfirmModal
        isOpen={!!cancelarId}
        title="Cancelar Horário Agendado"
        message="Tem certeza que deseja cancelar esta vaga reservada na Clínica-Escola? O horário será liberado para outros alunos."
        confirmText="Sim, Cancelar Vaga"
        cancelText="Manter Vaga"
        confirmVariant="danger"
        onConfirm={handleConfirmarCancelamento}
        onCancel={() => setCancelarId(null)}
      />
    </section>
  );
};
