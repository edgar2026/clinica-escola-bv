-- Migration: refactor_carga_horaria_semanal
-- Remove dependência de categorias_carga_horaria para definição da carga do aluno.
-- A carga é gravada diretamente em alunos.carga_horaria_semanal_max como inteiro.

-- 1. Atualiza listar_usuarios_completos para retornar carga_horaria_semanal diretamente
CREATE OR REPLACE FUNCTION listar_usuarios_completos()
RETURNS SETOF json AS $$
BEGIN
  RETURN QUERY
  SELECT json_build_object(
    'id',                       COALESCE(u.id::text, au.id::text),
    'nome',                     COALESCE(u.nome, au.raw_user_meta_data->>'nome', au.email),
    'email',                    COALESCE(u.email, au.email),
    'matricula',                COALESCE(u.matricula, ''),
    'cpf',                      COALESCE(u.cpf, ''),
    'telefone',                 COALESCE(u.telefone, ''),
    'email_pessoal',            COALESCE(u.email_pessoal, ''),
    'endereco',                 COALESCE(u.endereco, ''),
    'data_nascimento',          u.data_nascimento,
    'perfil',                   COALESCE(u.perfil, 'aluno'),
    'status',                   COALESCE(u.status, 'ativo'),
    'primeiro_acesso',          COALESCE(u.primeiro_acesso, 0),
    'curso_id',                 u.curso_id,
    'auth_user_id',             au.id,
    'criado_em',                COALESCE(u.criado_em, au.created_at),
    'tem_perfil',               (u.id IS NOT NULL),
    -- Dados do aluno
    'aluno_id',                 a.id,
    'carga_horaria_semanal',    a.carga_horaria_semanal_max,
    'periodo_id',               a.periodo_id,
    'periodo_nome',             per.nome,
    'turno_id',                 a.turno_id,
    'turno_nome',               tur.nome,
    'setor_id',                 a.setor_id,
    'setor_nome',               set.nome,
    'situacao_vinculo',         a.situacao,
    'aluno_curso_id',           a.curso_id,
    'aluno_curso_nome',         cur.nome,
    -- Campos legacy mantidos para retrocompatibilidade
    'curso_nome',               cur.nome,
    'categoria_carga_id',       a.categoria_carga_id,
    'categoria_carga_horas',    a.carga_horaria_semanal_max
  )
  FROM auth.users au
  LEFT JOIN usuarios u ON u.auth_user_id = au.id
  LEFT JOIN alunos a ON a.usuario_id = u.id
  LEFT JOIN cursos cur ON cur.id = a.curso_id
  LEFT JOIN periodos per ON per.id = a.periodo_id
  LEFT JOIN turnos tur ON tur.id = a.turno_id
  LEFT JOIN setores_clinica set ON set.id = a.setor_id
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION listar_usuarios_completos() TO authenticated;


-- 2. Atualiza atualizar_aluno_admin para aceitar carga horária como inteiro direto
CREATE OR REPLACE FUNCTION atualizar_aluno_admin(
  p_aluno_id integer,
  p_carga_horaria_semanal integer DEFAULT NULL,
  p_curso_id integer DEFAULT NULL,
  p_periodo_id integer DEFAULT NULL,
  p_turno_id integer DEFAULT NULL,
  p_setor_id integer DEFAULT NULL,
  p_situacao text DEFAULT NULL,
  -- parâmetro legacy mantido para retrocompatibilidade (ignorado)
  p_categoria_carga_id integer DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_aluno_id integer;
  v_grade_confirmada boolean := false;
  v_carga_antiga integer;
  v_resultado json;
BEGIN
  -- Verifica se aluno existe
  SELECT id, carga_horaria_semanal_max INTO v_aluno_id, v_carga_antiga
  FROM alunos WHERE id = p_aluno_id;

  IF NOT FOUND THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Aluno não encontrado.');
  END IF;

  -- Verifica se aluno tem grade confirmada (para sinalizar ajuste)
  SELECT EXISTS (
    SELECT 1 FROM grade_semanal_selecoes
    WHERE aluno_id = p_aluno_id AND confirmado = true
  ) INTO v_grade_confirmada;

  -- Atualiza dados do aluno
  UPDATE alunos SET
    carga_horaria_semanal_max = COALESCE(p_carga_horaria_semanal, carga_horaria_semanal_max),
    curso_id = COALESCE(p_curso_id, curso_id),
    periodo_id = COALESCE(p_periodo_id, periodo_id),
    turno_id = COALESCE(p_turno_id, turno_id),
    setor_id = COALESCE(p_setor_id, setor_id),
    situacao = COALESCE(p_situacao, situacao)
  WHERE id = p_aluno_id;

  -- Se a carga horária mudou e o aluno tem grade confirmada, sinaliza necessidade de ajuste
  IF p_carga_horaria_semanal IS NOT NULL 
     AND p_carga_horaria_semanal != v_carga_antiga 
     AND v_grade_confirmada THEN
    -- Desconfirma as seleções para reabrir a grade
    UPDATE grade_semanal_selecoes
    SET confirmado = false
    WHERE aluno_id = p_aluno_id;

    RETURN json_build_object(
      'sucesso', true,
      'mensagem', 'Dados do aluno atualizados. A carga horária foi alterada e a grade semanal foi reaberta para ajuste.',
      'grade_reaberta', true,
      'carga_anterior', v_carga_antiga,
      'carga_nova', p_carga_horaria_semanal
    );
  END IF;

  RETURN json_build_object(
    'sucesso', true,
    'mensagem', 'Dados do aluno atualizados com sucesso.',
    'grade_reaberta', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION atualizar_aluno_admin(integer, integer, integer, integer, integer, integer, text, integer) TO authenticated;


-- 3. Atualiza obter_grade_aluno para verificar compatibilidade de vagas e config_id flexível
CREATE OR REPLACE FUNCTION obter_grade_aluno(p_aluno_id integer)
RETURNS json AS $$
DECLARE
  v_aluno RECORD;
  v_config RECORD;
  v_selecoes json;
  v_confirmado boolean := false;
  v_carga_horaria integer;
  v_config_id integer;
  v_slots_publicados boolean := false;
  v_faltam_campos text[];
BEGIN
  SELECT id, curso_id, periodo_id, turno_id, situacao, carga_horaria_semanal_max
  INTO v_aluno
  FROM alunos
  WHERE id = p_aluno_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'sucesso', false,
      'tem_grade', false,
      'mensagem', 'Aluno não encontrado.'
    );
  END IF;

  v_faltam_campos := ARRAY[]::text[];

  IF v_aluno.carga_horaria_semanal_max IS NULL OR v_aluno.carga_horaria_semanal_max <= 0 THEN
    v_faltam_campos := array_append(v_faltam_campos, 'Carga horária semanal');
  END IF;
  IF v_aluno.curso_id IS NULL THEN
    v_faltam_campos := array_append(v_faltam_campos, 'Curso');
  END IF;
  IF v_aluno.periodo_id IS NULL THEN
    v_faltam_campos := array_append(v_faltam_campos, 'Período');
  END IF;
  IF v_aluno.turno_id IS NULL THEN
    v_faltam_campos := array_append(v_faltam_campos, 'Turno');
  END IF;
  IF v_aluno.situacao != 'ativo' THEN
    v_faltam_campos := array_append(v_faltam_campos, 'Vínculo acadêmico ativo (situação atual: ' || v_aluno.situacao || ')');
  END IF;

  v_carga_horaria := COALESCE(v_aluno.carga_horaria_semanal_max, 4);

  SELECT config_id INTO v_config_id
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id
  ORDER BY id DESC
  LIMIT 1;

  IF v_config_id IS NULL THEN
    SELECT id INTO v_config_id
    FROM grade_semanal_config
    WHERE status = 'ativa'
    ORDER BY criado_em DESC
    LIMIT 1;
  END IF;

  IF v_config_id IS NULL THEN
    RETURN json_build_object(
      'tem_grade', false,
      'bloqueado', true,
      'campos_pendentes', v_faltam_campos,
      'mensagem', 'Nenhuma grade semanal configurada no momento.',
      'categoria_carga', v_carga_horaria
    );
  END IF;

  SELECT id, inscricao_inicio, inscricao_fim, vigencia_inicio, vigencia_fim
  INTO v_config
  FROM grade_semanal_config
  WHERE id = v_config_id;

  SELECT EXISTS (
    SELECT 1 FROM vagas_horarios
    WHERE (config_id = v_config_id OR config_id IS NULL)
      AND status = 'ativo'
      AND (curso_id = v_aluno.curso_id OR curso_id IS NULL)
  ) INTO v_slots_publicados;

  IF NOT v_slots_publicados THEN
    v_faltam_campos := array_append(v_faltam_campos, 'Horários compatíveis ativos e publicados para este período');
  END IF;

  SELECT json_agg(json_build_object(
    'id', gs.id,
    'vaga_horario_id', gs.vaga_horario_id,
    'dia_semana', gs.dia_semana,
    'hora_inicio', gs.hora_inicio,
    'hora_fim', gs.hora_fim,
    'confirmado', gs.confirmado,
    'setor_nome', vh.setor_id,
    'capacidade_max', vh.capacidade_max,
    'vagas_disponiveis', vh.vagas_disponiveis
  )) INTO v_selecoes
  FROM grade_semanal_selecoes gs
  JOIN vagas_horarios vh ON vh.id = gs.vaga_horario_id
  WHERE gs.aluno_id = p_aluno_id AND gs.config_id = v_config_id;

  SELECT confirmado INTO v_confirmado
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id AND config_id = v_config_id AND confirmado = true
  LIMIT 1;

  RETURN json_build_object(
    'sucesso', true,
    'tem_grade', v_selecoes IS NOT NULL AND json_array_length(v_selecoes) > 0,
    'confirmado', COALESCE(v_confirmado, false),
    'selecoes', COALESCE(v_selecoes, '[]'::json),
    'config_id', v_config.id,
    'inscricao_inicio', v_config.inscricao_inicio,
    'inscricao_fim', v_config.inscricao_fim,
    'vigencia_inicio', v_config.vigencia_inicio,
    'vigencia_fim', v_config.vigencia_fim,
    'categoria_carga', v_carga_horaria,
    'campos_pendentes', v_faltam_campos,
    'pode_exibir_grade', (array_length(v_faltam_campos, 1) IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION obter_grade_aluno(integer) TO authenticated;

