import { apiRequest } from './api';

const post = (url, body) => apiRequest(url, { method: 'POST', body: JSON.stringify(body) });
const put = (url, body) => apiRequest(url, { method: 'PUT', body: JSON.stringify(body) });
const del = (url) => apiRequest(url, { method: 'DELETE' });

export const adminService = {
  async getUsuarios(page = 1, limit = 20) {
    return await apiRequest(`/admin/usuarios?page=${page}&limit=${limit}`);
  },
  async getUsuario(id) { return await apiRequest(`/admin/usuarios/${id}`); },
  async editarUsuario(id, dados) { return await put(`/admin/usuarios/${id}`, dados); },
  async alterarStatusUsuario(usuarioId, status, justificativa) {
    return await post('/admin/usuarios/bloquear-desbloquear', { usuario_id: usuarioId, status, justificativa });
  },
  async getAuditoriaLogs() { return await apiRequest('/admin/auditoria'); },
  async getOpcoesCadastro() { return await apiRequest('/admin/opcoes-cadastro'); },
  async cadastrarAlunoManual(dados) { return await post('/admin/alunos/cadastrar-manual', dados); },
  async importarAlunosEmMassa(listaAlunos) { return await post('/admin/alunos/importar-massa', { listaAlunos }); },
  async criarUsuario(dados) { return await post('/admin/usuarios/criar', dados); },
  async salvarConfiguracao(chave, valor, justificativa) { return await post('/admin/configuracoes', { chave, valor, justificativa }); },
  async getConfiguracoes() { return await apiRequest('/admin/configuracoes'); },

  // Cursos
  async getCursos() { return await apiRequest('/admin/opcoes-cadastro').then(r => r.cursos || []); },
  async cadastrarCurso(dados) { return await post('/admin/cursos', dados); },
  async excluirCurso(id) { return await del(`/admin/cursos/${id}`); },

  // Períodos
  async getPeriodos() { return await apiRequest('/admin/periodos').then(r => r.periodos || []); },
  async cadastrarPeriodo(dados) { return await post('/admin/periodos', dados); },
  async excluirPeriodo(id) { return await del(`/admin/periodos/${id}`); },

  // Turnos
  async getTurnos() { return await apiRequest('/admin/turnos').then(r => r.turnos || []); },
  async cadastrarTurno(dados) { return await post('/admin/turnos', dados); },
  async excluirTurno(id) { return await del(`/admin/turnos/${id}`); },

  // Clínicas
  async getClinicas() { return await apiRequest('/admin/clinicas').then(r => r.clinicas || []); },
  async cadastrarClinica(dados) { return await post('/admin/clinicas', dados); },
  async atualizarClinica(id, dados) { return await put(`/admin/clinicas/${id}`, dados); },
  async excluirClinica(id) { return await del(`/admin/clinicas/${id}`); },

  // Setores
  async getSetores() { return await apiRequest('/admin/setores').then(r => r.setores || []); },
  async cadastrarSetor(dados) { return await post('/admin/setores', dados); },
  async atualizarSetor(id, dados) { return await put(`/admin/setores/${id}`, dados); },
  async excluirSetor(id) { return await del(`/admin/setores/${id}`); },

  // Especialidades
  async getEspecialidades() { return await apiRequest('/admin/especialidades').then(r => r.especialidades || []); },
  async cadastrarEspecialidade(dados) { return await post('/admin/especialidades', dados); },
  async atualizarEspecialidade(id, dados) { return await put(`/admin/especialidades/${id}`, dados); },
  async excluirEspecialidade(id) { return await del(`/admin/especialidades/${id}`); },

  // Professores
  async getProfessores() { return await apiRequest('/admin/professores').then(r => r.professores || []); },
  async cadastrarProfessor(dados) { return await post('/admin/professores', dados); },
  async atualizarProfessor(id, dados) { return await put(`/admin/professores/${id}`, dados); },
  async excluirProfessor(id) { return await del(`/admin/professores/${id}`); },

  // Supervisores
  async getSupervisores() { return await apiRequest('/admin/supervisores').then(r => r.supervisores || []); },
  async cadastrarSupervisor(dados) { return await post('/admin/supervisores', dados); },
  async atualizarSupervisor(id, dados) { return await put(`/admin/supervisores/${id}`, dados); },
  async excluirSupervisor(id) { return await del(`/admin/supervisores/${id}`); },

  // Vínculos Acadêmicos
  async getVinculos() { return await apiRequest('/admin/vinculos').then(r => r.vinculos || []); },
  async atualizarVinculo(id, dados) { return await put(`/admin/vinculos/${id}`, dados); },

  // Unidades
  async getUnidades() { return await apiRequest('/admin/unidades').then(r => r.unidades || []); },
  async cadastrarUnidade(dados) { return await post('/admin/unidades', dados); },

  // Horários de Funcionamento
  async getHorariosFuncionamento() { return await apiRequest('/admin/horarios-funcionamento').then(r => r.horarios || []); },
  async cadastrarHorarioFuncionamento(dados) { return await post('/admin/horarios-funcionamento', dados); },
  async atualizarHorarioFuncionamento(id, dados) { return await put(`/admin/horarios-funcionamento/${id}`, dados); },
  async excluirHorarioFuncionamento(id) { return await del(`/admin/horarios-funcionamento/${id}`); },

  // Vagas por Horário
  async getVagasHorarios() { return await apiRequest('/admin/vagas-horarios').then(r => r.vagas || []); },
  async cadastrarVagaHorario(dados) { return await post('/admin/vagas-horarios', dados); },
  async atualizarVagaHorario(id, dados) { return await put(`/admin/vagas-horarios/${id}`, dados); },
  async excluirVagaHorario(id) { return await del(`/admin/vagas-horarios/${id}`); },

  // Feriados / Bloqueios
  async getFeriados() { return await apiRequest('/admin/feriados').then(r => r.feriados || []); },
  async cadastrarFeriado(dados) { return await post('/admin/feriados', dados); },
  async atualizarFeriado(id, dados) { return await put(`/admin/feriados/${id}`, dados); },
  async excluirFeriado(id) { return await del(`/admin/feriados/${id}`); },

  // Regras do Sistema
  async getRegras(categoria) { 
    const url = categoria ? `/admin/regras?categoria=${encodeURIComponent(categoria)}` : '/admin/regras';
    return await apiRequest(url).then(r => r.regras || []); 
  },
  async atualizarRegra(chave, valor) { return await put(`/admin/regras/${encodeURIComponent(chave)}`, { valor }); },
  async criarRegra(dados) { return await post('/admin/regras', dados); },
  async excluirRegra(chave) { return await del(`/admin/regras/${encodeURIComponent(chave)}`); }
};
