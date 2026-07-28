import { apiRequest } from './api';

export const agendamentoService = {
  async getDisponibilidade(setorId = '', diaSemana = 1, data = '') {
    return await apiRequest(`/horarios/disponibilidade?setor_id=${setorId}&dia_semana=${diaSemana}&data=${data}`);
  },

  async getCalendarioMes(mes, ano) {
    return await apiRequest(`/horarios/calendario-mes?mes=${mes}&ano=${ano}`);
  },

  async getMeuHorarioFirmado(dataRef = '') {
    return await apiRequest(`/alunos/meu-horario-firmado?data_referencia=${dataRef}`);
  },

  async criarAgendamento(vagaHorarioId, data) {
    return await apiRequest('/agendamentos', {
      method: 'POST',
      body: JSON.stringify({ vaga_horario_id: vagaHorarioId, data })
    });
  },

  async cancelarAgendamento(agendamentoId) {
    return await apiRequest(`/agendamentos/${agendamentoId}`, {
      method: 'DELETE'
    });
  },

  async entrarListaEspera(vagaHorarioId, data) {
    return await apiRequest('/agendamentos/lista-espera', {
      method: 'POST',
      body: JSON.stringify({ vaga_horario_id: vagaHorarioId, data })
    });
  }
};
