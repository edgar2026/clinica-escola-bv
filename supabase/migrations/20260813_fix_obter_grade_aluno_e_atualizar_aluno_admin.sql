-- Correções: obter_grade_aluno (setor_nome, confirmado_em, status config)
-- e atualizar_aluno_admin (categoria de carga + reabertura administrativa da grade).

-- Remove overload antiga de atualizar_aluno_admin que ignorava carga semanal.
DROP FUNCTION IF EXISTS public.atualizar_aluno_admin(integer, integer, integer, integer, integer, integer, character varying);

CREATE OR REPLACE FUNCTION public.obter_grade_aluno(p_aluno_id integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aluno RECORD;
  v_config RECORD;
  v_selecoes json;
  v_confirmado boolean := false;
  v_confirmado_em timestamptz;
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

  SELECT id, inscricao_inicio, inscricao_fim, vigencia_inicio, vigencia_fim, status
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
    'confirmado_em', gs.confirmado_em,
    'setor_nome', sc.nome,
    'setor_id', vh.setor_id,
    'capacidade_max', vh.capacidade_max,
    'vagas_disponiveis', vh.vagas_disponiveis
  )) INTO v_selecoes
  FROM grade_semanal_selecoes gs
  JOIN vagas_horarios vh ON vh.id = gs.vaga_horario_id
  LEFT JOIN setores_clinica sc ON sc.id = vh.setor_id
  WHERE gs.aluno_id = p_aluno_id AND gs.config_id = v_config_id;

  SELECT confirmado, confirmado_em INTO v_confirmado, v_confirmado_em
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id AND config_id = v_config_id AND confirmado = true
  LIMIT 1;

  RETURN json_build_object(
    'sucesso', true,
    'tem_grade', v_selecoes IS NOT NULL AND json_array_length(v_selecoes) > 0,
    'confirmado', COALESCE(v_confirmado, false),
    'confirmado_em', v_confirmado_em,
    'selecoes', COALESCE(v_selecoes, '[]'::json),
    'config_id', v_config.id,
    'inscricao_inicio', v_config.inscricao_inicio,
    'inscricao_fim', v_config.inscricao_fim,
    'vigencia_inicio', v_config.vigencia_inicio,
    'vigencia_fim', v_config.vigencia_fim,
    'config_status', v_config.status,
    'categoria_carga', v_carga_horaria,
    'campos_pendentes', v_faltam_campos,
    'pode_exibir_grade', (array_length(v_faltam_campos, 1) IS NULL)
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.atualizar_aluno_admin(p_aluno_id integer, p_carga_horaria_semanal integer, p_curso_id integer, p_periodo_id integer, p_turno_id integer, p_setor_id integer, p_situacao text, p_categoria_carga_id integer);

CREATE OR REPLACE FUNCTION public.atualizar_aluno_admin(
  p_aluno_id integer,
  p_carga_horaria_semanal integer DEFAULT NULL::integer,
  p_categoria_carga_id integer DEFAULT NULL::integer,
  p_curso_id integer DEFAULT NULL::integer,
  p_periodo_id integer DEFAULT NULL::integer,
  p_turno_id integer DEFAULT NULL::integer,
  p_setor_id integer DEFAULT NULL::integer,
  p_situacao text DEFAULT NULL::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aluno RECORD;
  v_grade_confirmada boolean := false;
  v_carga_mudou boolean := false;
  v_categoria_mudou boolean := false;
BEGIN
  SELECT * INTO v_aluno FROM alunos WHERE id = p_aluno_id;
  IF v_aluno IS NULL THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Aluno não encontrado.');
  END IF;

  IF p_categoria_carga_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM categorias_carga_horaria WHERE id = p_categoria_carga_id AND ativo = true) THEN
      RETURN json_build_object('sucesso', false, 'mensagem', 'Categoria de carga horária não encontrada ou inativa.');
    END IF;
  END IF;

  v_carga_mudou := p_carga_horaria_semanal IS NOT NULL
    AND (v_aluno.carga_horaria_semanal_max IS NULL OR p_carga_horaria_semanal != v_aluno.carga_horaria_semanal_max);
  v_categoria_mudou := p_categoria_carga_id IS NOT NULL AND p_categoria_carga_id != v_aluno.categoria_carga_id;

  UPDATE alunos SET
    carga_horaria_semanal_max = COALESCE(p_carga_horaria_semanal, carga_horaria_semanal_max),
    categoria_carga_id = COALESCE(p_categoria_carga_id, categoria_carga_id),
    categoria_carga = CASE WHEN p_categoria_carga_id IS NOT NULL THEN
        (SELECT horas_semanais FROM categorias_carga_horaria WHERE id = p_categoria_carga_id)
      ELSE categoria_carga END,
    curso_id = COALESCE(p_curso_id, curso_id),
    periodo_id = COALESCE(p_periodo_id, periodo_id),
    turno_id = COALESCE(p_turno_id, turno_id),
    setor_id = COALESCE(p_setor_id, setor_id),
    situacao = COALESCE(p_situacao, situacao)
  WHERE id = p_aluno_id;

  UPDATE usuarios SET curso_id = COALESCE(p_curso_id, curso_id)
  WHERE id = v_aluno.usuario_id;

  SELECT EXISTS (
    SELECT 1 FROM grade_semanal_selecoes
    WHERE aluno_id = p_aluno_id AND confirmado = true
  ) INTO v_grade_confirmada;

  -- Reabertura administrativa: carga/categoria alteradas → grade precisa de ajuste.
  IF v_grade_confirmada AND (v_carga_mudou OR v_categoria_mudou) THEN
    UPDATE grade_semanal_selecoes
    SET confirmado = false, confirmado_em = NULL
    WHERE aluno_id = p_aluno_id;

    RETURN json_build_object(
      'sucesso', true,
      'mensagem', 'Dados atualizados. A carga horária foi alterada e a grade semanal precisa de ajuste pelo aluno.',
      'grade_reaberta', true,
      'carga_anterior', v_aluno.carga_horaria_semanal_max,
      'carga_nova', p_carga_horaria_semanal
    );
  END IF;

  RETURN json_build_object(
    'sucesso', true,
    'mensagem', 'Dados do aluno atualizados com sucesso.',
    'grade_reaberta', false
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.obter_grade_aluno(integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.atualizar_aluno_admin(integer, integer, integer, integer, integer, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_aluno_admin(integer, integer, integer, integer, integer, integer, integer, text) TO authenticated, service_role;
