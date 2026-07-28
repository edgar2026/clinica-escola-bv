import { apiRequest } from './api';

export const gerenciaService = {
  async getDashboardData() {
    return await apiRequest('/gerencia/dashboard');
  },

  async validarForaHorario(pontoId, acao, parecer) {
    return await apiRequest('/gerencia/validar-fora-horario', {
      method: 'POST',
      body: JSON.stringify({ ponto_id: pontoId, acao, parecer })
    });
  },

  async getRelatorio(tipo, dataIni, dataFim) {
    return await apiRequest(`/gerencia/relatorios?tipo=${encodeURIComponent(tipo)}&data_inicio=${dataIni}&data_fim=${dataFim}`);
  }
};
