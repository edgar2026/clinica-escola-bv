import { apiRequest } from './api';

export const pontoService = {
  async registrarPonto(tipoRegistro, acao = 'entrada', qrCode = '', pin = '', alunoId = null) {
    const body = {
      tipo_registro: tipoRegistro,
      acao
    };
    if (qrCode) body.qr_code_validacao = qrCode;
    if (pin) body.pin_validacao = pin;
    if (alunoId) body.aluno_id = alunoId;

    return await apiRequest('/pontos/registrar', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  async getHistoricoAluno() {
    return await apiRequest('/alunos/historico-frequencia');
  },

  async getStatusHoje() {
    return await apiRequest('/pontos/status-hoje');
  },


  async submeterJustificativa(pontoId, motivo, descricao) {
    return await apiRequest('/pontos/justificativa', {
      method: 'POST',
      body: JSON.stringify({ ponto_id: pontoId, motivo, descricao })
    });
  }
};
