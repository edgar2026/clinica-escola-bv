import { supabase } from './supabaseClient';
import type { Usuario, OpcoesCadastro, Curso, Periodo, Turno, Clinica, Setor, Especialidade, Professor, Supervisor, Vinculo, Unidade, HorarioFuncionamento, VagaHorario, Feriado, Regra, Configuracao, AuditoriaLog, CategoriaCargaHoraria, UsuarioComAluno } from '../types';


export const adminService = {
  async getUsuarios(page = 1, limit = 20): Promise<{ usuarios: Usuario[]; total: number }> {
    const { data, error } = await supabase.rpc('listar_usuarios_completos');

    if (error) throw error;

    const all: UsuarioComAluno[] = (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      nome: String(row.nome ?? ''),
      email: String(row.email ?? ''),
      matricula: String(row.matricula ?? ''),
      cpf: row.cpf ? String(row.cpf) : undefined,
      perfil: (row.perfil as Usuario['perfil']) || 'aluno',
      status: (row.status as Usuario['status']) || 'ativo',
      auth_user_id: row.auth_user_id ? String(row.auth_user_id) : undefined,
      curso_id: row.curso_id ? String(row.curso_id) : undefined,
      curso_nome: row.curso_nome ? String(row.curso_nome) : undefined,
      primeiroAcesso: Number(row.primeiro_acesso) === 1,
      criado_em: row.criado_em ? String(row.criado_em) : undefined,
      telefone: row.telefone ? String(row.telefone) : undefined,
      email_pessoal: row.email_pessoal ? String(row.email_pessoal) : undefined,
      endereco: row.endereco ? String(row.endereco) : undefined,
      data_nascimento: row.data_nascimento ? String(row.data_nascimento) : undefined,
      tem_perfil: Boolean(row.tem_perfil),
      aluno_id: row.aluno_id ? Number(row.aluno_id) : undefined,
      carga_horaria_semanal: row.carga_horaria_semanal !== undefined && row.carga_horaria_semanal !== null ? Number(row.carga_horaria_semanal) : undefined,
      categoria_carga_horas: row.categoria_carga_horas !== undefined && row.categoria_carga_horas !== null ? Number(row.categoria_carga_horas) : undefined,
      periodo_id: row.periodo_id ? String(row.periodo_id) : undefined,
      periodo_nome: row.periodo_nome ? String(row.periodo_nome) : undefined,
      turno_id: row.turno_id ? String(row.turno_id) : undefined,
      turno_nome: row.turno_nome ? String(row.turno_nome) : undefined,
      setor_id: row.setor_id ? String(row.setor_id) : undefined,
      setor_nome: row.setor_nome ? String(row.setor_nome) : undefined,
      situacao_vinculo: row.situacao_vinculo ? String(row.situacao_vinculo) : undefined,
      aluno_curso_id: row.aluno_curso_id ? String(row.aluno_curso_id) : undefined,
      aluno_curso_nome: row.aluno_curso_nome ? String(row.aluno_curso_nome) : undefined,
    }));

    const total = all.length;
    const from = (page - 1) * limit;
    const usuarios = all.slice(from, from + limit);

    return { usuarios, total };
  },

  async getUsuario(id: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Usuario;
  },

  async editarUsuario(id: string, dados: Partial<Usuario>): Promise<Usuario> {
    const { error } = await supabase.rpc('editar_usuario', {
      p_usuario_id: Number(id),
      p_nome: dados.nome || '',
      p_email: dados.email || '',
      p_matricula: dados.matricula || '',
      p_cpf: dados.cpf || null,
      p_perfil: dados.perfil || 'aluno',
      p_telefone: dados.telefone || null,
      p_email_pessoal: dados.email_pessoal || null,
      p_endereco: dados.endereco || null,
      p_data_nascimento: dados.data_nascimento || null,
      p_curso_id: dados.curso_id ? Number(dados.curso_id) : null,
    });

    if (error) throw error;
    return dados as Usuario;
  },

  async excluirUsuario(authUserId: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/excluir-usuario`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ auth_user_id: authUserId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error || `Erro ${response.status}`);
    }
  },

  async alterarStatusUsuario(usuarioId: string, status: string, justificativa: string): Promise<Usuario> {
    const { error } = await supabase.rpc('alterar_status_usuario', {
      p_usuario_id: Number(usuarioId),
      p_novo_status: status,
      p_justificativa: justificativa,
    });

    if (error) throw error;
    return { id: usuarioId, status: status as Usuario['status'] } as Usuario;
  },

  async getAuditoriaLogs(): Promise<{ logs: AuditoriaLog[] }> {
    const { data, error } = await supabase
      .from('auditoria')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(100);

    if (error) throw error;
    return { logs: (data as AuditoriaLog[]) || [] };
  },

  async getOpcoesCadastro(): Promise<OpcoesCadastro | null> {
    const { data, error } = await supabase
      .from('opcoes_cadastro')
      .select('*')
      .single();

    if (error) throw error;
    return data as OpcoesCadastro;
  },

  async cadastrarAlunoManual(dados: Partial<Usuario>): Promise<Usuario> {
    const { data, error } = await supabase
      .from('alunos')
      .insert(dados as never)
      .select()
      .single();

    if (error) throw error;
    return data as Usuario;
  },

  async criarUsuario(dados: Partial<Usuario>): Promise<Usuario> {
    const { data, error } = await supabase
      .from('usuarios')
      .insert(dados as never)
      .select()
      .single();

    if (error) throw error;
    return data as Usuario;
  },

  async salvarConfiguracao(chave: string, valor: string, justificativa: string): Promise<Configuracao> {
    const { data, error } = await supabase.rpc('salvar_configuracao_com_auditoria', {
      p_chave: chave,
      p_valor: valor,
      p_justificativa: justificativa,
    });

    if (error) throw error;
    return (data as Configuracao) || { id: '', chave, valor };
  },

  async getConfiguracoes(): Promise<Configuracao[]> {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*');

    if (error) throw error;
    return (data as Configuracao[]) || [];
  },

  async getCursos(): Promise<Curso[]> {
    const { data, error } = await supabase.from('cursos').select('*').order('id');
    if (error) throw error;
    return (data as Curso[]) || [];
  },

  async cadastrarCurso(dados: Partial<Curso>): Promise<Curso> {
    const { data, error } = await supabase.from('cursos').insert(dados as never).select().single();
    if (error) throw error;
    return data as Curso;
  },

  async excluirCurso(id: string): Promise<void> {
    const { error } = await supabase.from('cursos').delete().eq('id', id);
    if (error) throw error;
  },

  async atualizarCurso(id: string, dados: Partial<Curso>): Promise<Curso> {
    const { data, error } = await supabase.from('cursos').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Curso;
  },

  async getPeriodos(): Promise<Periodo[]> {
    const { data, error } = await supabase.from('periodos').select('*').order('id');
    if (error) throw error;
    return (data as Periodo[]) || [];
  },

  async cadastrarPeriodo(dados: Partial<Periodo>): Promise<Periodo> {
    const { data, error } = await supabase.from('periodos').insert(dados as never).select().single();
    if (error) throw error;
    return data as Periodo;
  },

  async excluirPeriodo(id: string): Promise<void> {
    const { error } = await supabase.from('periodos').delete().eq('id', id);
    if (error) throw error;
  },

  async atualizarPeriodo(id: string, dados: Partial<Periodo>): Promise<Periodo> {
    const { data, error } = await supabase.from('periodos').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Periodo;
  },

  async getTurnos(): Promise<Turno[]> {
    const { data, error } = await supabase.from('turnos').select('*').order('id');
    if (error) throw error;
    return (data as Turno[]) || [];
  },

  async cadastrarTurno(dados: Partial<Turno>): Promise<Turno> {
    const { data, error } = await supabase.from('turnos').insert(dados as never).select().single();
    if (error) throw error;
    return data as Turno;
  },

  async excluirTurno(id: string): Promise<void> {
    const { error } = await supabase.from('turnos').delete().eq('id', id);
    if (error) throw error;
  },

  async atualizarTurno(id: string, dados: Partial<Turno>): Promise<Turno> {
    const { data, error } = await supabase.from('turnos').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Turno;
  },

  async getClinicas(): Promise<{ clinicas: Clinica[] }> {
    const { data, error } = await supabase.from('clinicas').select('*');
    if (error) throw error;
    return { clinicas: (data as Clinica[]) || [] };
  },

  async cadastrarClinica(dados: Partial<Clinica>): Promise<Clinica> {
    const { data, error } = await supabase.from('clinicas').insert(dados as never).select().single();
    if (error) throw error;
    return data as Clinica;
  },

  async atualizarClinica(id: string, dados: Partial<Clinica>): Promise<Clinica> {
    const { data, error } = await supabase.from('clinicas').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Clinica;
  },

  async excluirClinica(id: string): Promise<void> {
    const { error } = await supabase.from('clinicas').delete().eq('id', id);
    if (error) throw error;
  },

  async getSetores(): Promise<{ setores: Setor[] }> {
    const { data, error } = await supabase.from('setores').select('*');
    if (error) throw error;
    return { setores: (data as Setor[]) || [] };
  },

  async getSetoresClinica(): Promise<Array<{ id: number; nome: string }>> {
    const { data, error } = await supabase.from('setores_clinica').select('*').eq('status', 'ativo').order('nome');
    if (error) throw error;
    return (data || []) as Array<{ id: number; nome: string }>;
  },

  async cadastrarSetor(dados: Partial<Setor>): Promise<Setor> {
    const { data, error } = await supabase.from('setores').insert(dados as never).select().single();
    if (error) throw error;
    return data as Setor;
  },

  async atualizarSetor(id: string, dados: Partial<Setor>): Promise<Setor> {
    const { data, error } = await supabase.from('setores').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Setor;
  },

  async excluirSetor(id: string): Promise<void> {
    const { error } = await supabase.from('setores').delete().eq('id', id);
    if (error) throw error;
  },

  async getEspecialidades(): Promise<{ especialidades: Especialidade[] }> {
    const { data, error } = await supabase.from('especialidades').select('*');
    if (error) throw error;
    return { especialidades: (data as Especialidade[]) || [] };
  },

  async cadastrarEspecialidade(dados: Partial<Especialidade>): Promise<Especialidade> {
    const { data, error } = await supabase.from('especialidades').insert(dados as never).select().single();
    if (error) throw error;
    return data as Especialidade;
  },

  async atualizarEspecialidade(id: string, dados: Partial<Especialidade>): Promise<Especialidade> {
    const { data, error } = await supabase.from('especialidades').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Especialidade;
  },

  async excluirEspecialidade(id: string): Promise<void> {
    const { error } = await supabase.from('especialidades').delete().eq('id', id);
    if (error) throw error;
  },

  async getProfessores(): Promise<{ professores: Professor[] }> {
    const { data, error } = await supabase.from('professores').select('*');
    if (error) throw error;
    return { professores: (data as Professor[]) || [] };
  },

  async cadastrarProfessor(dados: Partial<Professor>): Promise<Professor> {
    const { data, error } = await supabase.from('professores').insert(dados as never).select().single();
    if (error) throw error;
    return data as Professor;
  },

  async atualizarProfessor(id: string, dados: Partial<Professor>): Promise<Professor> {
    const { data, error } = await supabase.from('professores').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Professor;
  },

  async excluirProfessor(id: string): Promise<void> {
    const { error } = await supabase.from('professores').delete().eq('id', id);
    if (error) throw error;
  },

  async getSupervisores(): Promise<{ supervisores: Supervisor[] }> {
    const { data, error } = await supabase.from('supervisores').select('*');
    if (error) throw error;
    return { supervisores: (data as Supervisor[]) || [] };
  },

  async cadastrarSupervisor(dados: Partial<Supervisor>): Promise<Supervisor> {
    const { data, error } = await supabase.from('supervisores').insert(dados as never).select().single();
    if (error) throw error;
    return data as Supervisor;
  },

  async atualizarSupervisor(id: string, dados: Partial<Supervisor>): Promise<Supervisor> {
    const { data, error } = await supabase.from('supervisores').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Supervisor;
  },

  async excluirSupervisor(id: string): Promise<void> {
    const { error } = await supabase.from('supervisores').delete().eq('id', id);
    if (error) throw error;
  },

  async getVinculos(): Promise<{ vinculos: Vinculo[] }> {
    const { data, error } = await supabase.from('vinculos').select('*');
    if (error) throw error;
    return { vinculos: (data as Vinculo[]) || [] };
  },

  async atualizarVinculo(id: string, dados: Partial<Vinculo>): Promise<Vinculo> {
    const { data, error } = await supabase.from('vinculos').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Vinculo;
  },

  async getUnidades(): Promise<{ unidades: Unidade[] }> {
    const { data, error } = await supabase.from('unidades').select('*');
    if (error) throw error;
    return { unidades: (data as Unidade[]) || [] };
  },

  async cadastrarUnidade(dados: Partial<Unidade>): Promise<Unidade> {
    const { data, error } = await supabase.from('unidades').insert(dados as never).select().single();
    if (error) throw error;
    return data as Unidade;
  },

  async getHorariosFuncionamento(): Promise<{ horarios: HorarioFuncionamento[] }> {
    const { data, error } = await supabase.from('horarios_funcionamento').select('*');
    if (error) throw error;
    return { horarios: (data as HorarioFuncionamento[]) || [] };
  },

  async cadastrarHorarioFuncionamento(dados: Partial<HorarioFuncionamento>): Promise<HorarioFuncionamento> {
    const { data, error } = await supabase.from('horarios_funcionamento').insert(dados as never).select().single();
    if (error) throw error;
    return data as HorarioFuncionamento;
  },

  async atualizarHorarioFuncionamento(id: string, dados: Partial<HorarioFuncionamento>): Promise<HorarioFuncionamento> {
    const { data, error } = await supabase.from('horarios_funcionamento').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as HorarioFuncionamento;
  },

  async excluirHorarioFuncionamento(id: string): Promise<void> {
    const { error } = await supabase.from('horarios_funcionamento').delete().eq('id', id);
    if (error) throw error;
  },

  async getVagasHorarios(): Promise<{ vagas: VagaHorario[] }> {
    const { data, error } = await supabase
      .from('vagas_horarios')
      .select('*, setores(nome), supervisores(nome), cursos(nome)');
    if (error) throw error;
    const vagas = (data || []).map((item: Record<string, unknown>) => {
      const supervisor = item.supervisores as { nome: string } | null;
      return {
        ...item,
        supervisor_nome: supervisor?.nome || '',
      } as unknown as VagaHorario;
    });
    return { vagas };
  },

  async cadastrarVagaHorario(dados: Partial<VagaHorario>): Promise<VagaHorario> {
    const { data, error } = await supabase.from('vagas_horarios').insert(dados as never).select().single();
    if (error) throw error;
    return data as VagaHorario;
  },

  async atualizarVagaHorario(id: string, dados: Partial<VagaHorario>): Promise<VagaHorario> {
    const { data, error } = await supabase.from('vagas_horarios').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as VagaHorario;
  },

  async excluirVagaHorario(id: string): Promise<void> {
    const { error } = await supabase.from('vagas_horarios').delete().eq('id', id);
    if (error) throw error;
  },

  async suspenderVagaHorario(id: string): Promise<void> {
    const { data: vaga, error: getErr } = await supabase
      .from('vagas_horarios')
      .select('setor_id, supervisor_id, dia_semana, hora_inicio, hora_fim')
      .eq('id', id)
      .single();
    if (getErr) throw getErr;

    await supabase.from('vagas_horarios').update({ status: 'suspenso' }).eq('id', id);
    const { error: upErr } = await supabase
      .from('horarios')
      .update({ status: 'suspenso', vagas_disponiveis: 0 })
      .eq('setor_id', vaga.setor_id)
      .eq('supervisor_id', vaga.supervisor_id)
      .eq('dia_semana', vaga.dia_semana)
      .eq('hora_inicio', vaga.hora_inicio)
      .eq('hora_fim', vaga.hora_fim);
    if (upErr) throw upErr;
  },

  async reativarVagaHorario(id: string): Promise<void> {
    const { data: vaga, error: getErr } = await supabase
      .from('vagas_horarios')
      .select('setor_id, supervisor_id, dia_semana, hora_inicio, hora_fim, capacidade_max')
      .eq('id', id)
      .single();
    if (getErr) throw getErr;

    await supabase.from('vagas_horarios').update({ status: 'ativo' }).eq('id', id);

    const { data: horarios } = await supabase
      .from('horarios')
      .select('id, capacidade_max')
      .eq('setor_id', vaga.setor_id)
      .eq('supervisor_id', vaga.supervisor_id)
      .eq('dia_semana', vaga.dia_semana)
      .eq('hora_inicio', vaga.hora_inicio)
      .eq('hora_fim', vaga.hora_fim);

    if (horarios && horarios.length > 0) {
      for (const h of horarios) {
        const { count } = await supabase
          .from('agendamentos')
          .select('*', { count: 'exact', head: true })
          .eq('vaga_horario_id', id);

        const vagasDisponiveis = Math.max(0, (h.capacidade_max || vaga.capacidade_max) - (count || 0));
        const { error: upErr } = await supabase
          .from('horarios')
          .update({ status: 'ativo', vagas_disponiveis: vagasDisponiveis })
          .eq('id', h.id);
        if (upErr) throw upErr;
      }
    }
  },

  async getFeriados(): Promise<{ feriados: Feriado[] }> {
    const { data, error } = await supabase.from('feriados').select('*');
    if (error) throw error;
    return { feriados: (data as Feriado[]) || [] };
  },

  async cadastrarFeriado(dados: Partial<Feriado>): Promise<Feriado> {
    const { data, error } = await supabase.from('feriados').insert(dados as never).select().single();
    if (error) throw error;
    return data as Feriado;
  },

  async atualizarFeriado(id: string, dados: Partial<Feriado>): Promise<Feriado> {
    const { data, error } = await supabase.from('feriados').update(dados as never).eq('id', id).select().single();
    if (error) throw error;
    return data as Feriado;
  },

  async excluirFeriado(id: string): Promise<void> {
    const { error } = await supabase.from('feriados').delete().eq('id', id);
    if (error) throw error;
  },

  async getRegras(categoria?: string): Promise<Regra[]> {
    let query = supabase.from('regras').select('*');
    if (categoria) query = query.eq('categoria', categoria);
    const { data, error } = await query;
    if (error) throw error;
    return (data as Regra[]) || [];
  },

  async atualizarRegra(chave: string, valor: string): Promise<Regra> {
    const { data: existing } = await supabase.from('regras').select('id').eq('chave', chave).maybeSingle();
    if (existing) {
      const { data, error } = await supabase.from('regras').update({ valor }).eq('chave', chave).select().single();
      if (error) throw error;
      return data as Regra;
    }
    const { data, error } = await supabase.from('regras').insert({ chave, valor }).select().single();
    if (error) throw error;
    return data as Regra;
  },

  async criarRegra(dados: Partial<Regra>): Promise<Regra> {
    const { data, error } = await supabase.from('regras').insert(dados as never).select().single();
    if (error) throw error;
    return data as Regra;
  },

  async excluirRegra(chave: string): Promise<void> {
    const { error } = await supabase.from('regras').delete().eq('chave', chave);
    if (error) throw error;
  },

  async getConfigGradeSemanal(): Promise<Record<string, unknown> | null> {
    const { data, error } = await supabase
      .from('grade_semanal_config')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async salvarConfigGradeSemanal(config: { inscricao_inicio: string; inscricao_fim: string; vigencia_inicio: string; vigencia_fim: string; status?: string }): Promise<void> {
    const existing = await this.getConfigGradeSemanal();
    if (existing) {
      const { error } = await supabase
        .from('grade_semanal_config')
        .update({ ...config, atualizado_em: new Date().toISOString() })
        .eq('id', existing.id as number);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('grade_semanal_config')
        .insert(config as never);
      if (error) throw error;
    }
  },

  async getExcecoesGrade(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('grade_semanal_excecoes')
      .select('*, alunos(*, usuarios(*))')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    return (data || []) as Record<string, unknown>[];
  },

  async criarExcecaoGrade(alunoId: number, prazoFim: string, justificativa: string): Promise<void> {
    const { data: usuario } = await supabase.from('usuarios').select('id').eq('perfil', 'admin').limit(1).single();
    const { error } = await supabase
      .from('grade_semanal_excecoes')
      .insert({
        aluno_id: alunoId,
        prazo_fim: prazoFim,
        justificativa,
        criado_por: usuario?.id || null,
        status: 'aceita',
      } as never);
    if (error) throw error;
  },

  async atualizarExcecaoGrade(excecaoId: number, status: 'aceita' | 'rejeitada'): Promise<void> {
    const { error } = await supabase
      .from('grade_semanal_excecoes')
      .update({ status })
      .eq('id', excecaoId);
    if (error) throw error;
  },

  async getSelecoesGradeAlunos(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.rpc('listar_selecoes_pendentes');
    if (error) throw error;
    return (data || []) as Record<string, unknown>[];
  },

  // --- Grade Semanal: Configuração por Dia ---

  async getDiasGrade(configId: number): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('grade_semanal_dias')
      .select('*')
      .eq('config_id', configId)
      .order('dia_semana', { ascending: true });
    if (error) throw error;
    return (data || []) as Record<string, unknown>[];
  },

  async salvarDiaGrade(dia: {
    config_id: number;
    dia_semana: number;
    ativo: boolean;
    hora_inicio: string;
    hora_fim: string;
    duracao_slot_min: number;
    vagas: number;
    setor_id: number | null;
    curso_ids?: number[];
    periodo_ids?: number[];
    turno_ids?: number[];
  }): Promise<void> {
    const { error } = await supabase
      .from('grade_semanal_dias')
      .upsert({
        config_id: dia.config_id,
        dia_semana: dia.dia_semana,
        ativo: dia.ativo,
        hora_inicio: dia.hora_inicio,
        hora_fim: dia.hora_fim,
        duracao_slot_min: dia.duracao_slot_min,
        vagas: dia.vagas,
        setor_id: dia.setor_id,
        curso_ids: dia.curso_ids || [],
        periodo_ids: dia.periodo_ids || [],
        turno_ids: dia.turno_ids || [],
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'config_id,dia_semana' });
    if (error) throw error;
  },

  async publicarGrade(configId: number): Promise<{ sucesso: boolean; mensagem: string; novos_slots?: number }> {
    const { data, error } = await supabase.rpc('publicar_grade_semanal', {
      p_config_id: configId,
    });
    if (error) throw error;
    return data as { sucesso: boolean; mensagem: string; novos_slots?: number };
  },

  async getSolicitacoesResetSenha(): Promise<unknown[]> {
    const { data, error } = await supabase.rpc('listar_solicitacoes_reset_senha');
    if (error) throw error;
    return data || [];
  },

  async contarSolicitacoesPendentes(): Promise<number> {
    const { data, error } = await supabase.rpc('contar_solicitacoes_pendentes');
    if (error) throw error;
    return Number(data || 0);
  },

  async redefinirSenhaAdmin(usuarioId: number, authUserId: string, solicitacaoId?: number): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessao nao encontrada.');

    const url = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${url}/functions/v1/redefinir-senha-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        usuario_id: usuarioId,
        auth_user_id: authUserId,
        solicitacao_id: solicitacaoId,
        origem: 'gestao_usuarios',
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(result.error || 'Falha ao redefinir senha.');
    }
  },

  // --- Categorias de Carga Horária ---

  async getCategoriasCargaHoraria(): Promise<CategoriaCargaHoraria[]> {
    const { data, error } = await supabase
      .from('categorias_carga_horaria')
      .select('*')
      .order('horas_semanais', { ascending: true });
    if (error) throw error;
    return (data as CategoriaCargaHoraria[]) || [];
  },

  async criarCategoriaCargaHoraria(dados: { nome: string; horas_semanais: number; descricao?: string }): Promise<CategoriaCargaHoraria> {
    const { data, error } = await supabase
      .from('categorias_carga_horaria')
      .insert(dados as never)
      .select()
      .single();
    if (error) throw error;
    return data as CategoriaCargaHoraria;
  },

  async atualizarCategoriaCargaHoraria(id: number, dados: Partial<CategoriaCargaHoraria>): Promise<CategoriaCargaHoraria> {
    const { data, error } = await supabase
      .from('categorias_carga_horaria')
      .update({ ...dados, atualizado_em: new Date().toISOString() } as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CategoriaCargaHoraria;
  },

  async excluirCategoriaCargaHoraria(id: number): Promise<void> {
    const { count } = await supabase
      .from('alunos')
      .select('*', { count: 'exact', head: true })
      .eq('categoria_carga_id', id);

    if (count && count > 0) {
      throw new Error(`Não é possível excluir esta categoria pois está vinculada a ${count} aluno(s). Use inativar ao invés de excluir.`);
    }

    const { error } = await supabase.from('categorias_carga_horaria').delete().eq('id', id);
    if (error) throw error;
  },

  async inativarCategoriaCargaHoraria(id: number, ativo: boolean): Promise<void> {
    const { error } = await supabase
      .from('categorias_carga_horaria')
      .update({ ativo, atualizado_em: new Date().toISOString() } as never)
      .eq('id', id);
    if (error) throw error;
  },

  // --- Dados Acadêmicos do Aluno (admin) ---

  async atualizarAlunoAdmin(alunoId: number, dados: {
    carga_horaria_semanal?: number | null;
    categoria_carga_id?: number | null;
    curso_id?: number | null;
    periodo_id?: number | null;
    turno_id?: number | null;
    setor_id?: number | null;
    situacao?: string;
  }): Promise<{ sucesso: boolean; mensagem: string; grade_reaberta?: boolean }> {
    const { data, error } = await supabase.rpc('atualizar_aluno_admin', {
      p_aluno_id: alunoId,
      p_carga_horaria_semanal: dados.carga_horaria_semanal ?? null,
      p_categoria_carga_id: dados.categoria_carga_id ?? null,
      p_curso_id: dados.curso_id ?? null,
      p_periodo_id: dados.periodo_id ?? null,
      p_turno_id: dados.turno_id ?? null,
      p_setor_id: dados.setor_id ?? null,
      p_situacao: dados.situacao ?? null,
    });
    if (error) throw error;
    if (data && !data.sucesso) {
      throw new Error(data.mensagem || 'Erro ao atualizar dados do aluno.');
    }
    return data || { sucesso: true, mensagem: 'Atualizado com sucesso.' };
  },

  async getGradeAlunoAdmin(alunoId: number): Promise<Record<string, unknown> | null> {
    const { data, error } = await supabase.rpc('obter_grade_aluno', { p_aluno_id: alunoId });
    if (error) throw error;
    return data;
  },

  // --- Carga Horária Semanal Padrão ---

  async getCargaHorariaPadrao(): Promise<number> {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'carga_horaria_semanal_padrao')
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar carga padrão:', error);
      return 4;
    }
    return data?.valor ? Number(data.valor) : 4;
  },

  async salvarCargaHorariaPadrao(valor: number): Promise<void> {
    const { error } = await supabase.rpc('salvar_configuracao_com_auditoria', {
      p_chave: 'carga_horaria_semanal_padrao',
      p_valor: String(valor),
      p_grupo: 'geral',
    });
    if (error) throw error;
  },

  async getPreviewAplicarCargaPadrao(apenasSemCarga = true): Promise<{
    valor_padrao: number;
    total_afetados: number;
    apenas_sem_carga: boolean;
  }> {
    const { data, error } = await supabase.rpc('obter_preview_aplicar_carga_padrao', {
      p_apenas_sem_carga: apenasSemCarga,
    });
    if (error) throw error;
    return data;
  },

  async aplicarCargaPadraoEmLote(apenasSemCarga = true): Promise<{
    sucesso: boolean;
    total_afetados: number;
    novo_valor: number;
    mensagem: string;
  }> {
    const { data, error } = await supabase.rpc('aplicar_carga_horaria_padrao_em_lote', {
      p_apenas_sem_carga: apenasSemCarga,
    });
    if (error) throw error;
    return data;
  },
};
