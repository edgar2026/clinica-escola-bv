-- ============================================================
-- FIX: Integração entre carga semanal administrativa,
-- seleção da Grade Semanal e Horário Firmado.
-- ============================================================

-- 1) obter_grade_aluno: retorna horas_firmadas e horas_pendentes
--    para que o frontend saiba distinguir firmado vs rascunho.
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
  v_horas_firmadas numeric := 0;
  v_horas_rascunho numeric := 0;
  v_total_geral numeric := 0;
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

  -- Calcula horas firmadas vs rascunho
  SELECT COALESCE(SUM(
    CASE WHEN gs.confirmado THEN
      EXTRACT(HOUR FROM gs.hora_fim::time - gs.hora_inicio::time) +
      EXTRACT(MINUTE FROM gs.hora_fim::time - gs.hora_inicio::time)/60.0
    ELSE 0 END
  ), 0),
  COALESCE(SUM(
    CASE WHEN NOT gs.confirmado THEN
      EXTRACT(HOUR FROM gs.hora_fim::time - gs.hora_inicio::time) +
      EXTRACT(MINUTE FROM gs.hora_fim::time - gs.hora_inicio::time)/60.0
    ELSE 0 END
  ), 0),
  COALESCE(SUM(
    EXTRACT(HOUR FROM gs.hora_fim::time - gs.hora_inicio::time) +
    EXTRACT(MINUTE FROM gs.hora_fim::time - gs.hora_inicio::time)/60.0
  ), 0)
  INTO v_horas_firmadas, v_horas_rascunho, v_total_geral
  FROM grade_semanal_selecoes gs
  WHERE gs.aluno_id = p_aluno_id AND gs.config_id = v_config_id;

  -- Verifica se grade está totalmente confirmada
  SELECT confirmado, confirmado_em INTO v_confirmado, v_confirmado_em
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id AND config_id = v_config_id AND confirmado = true
  LIMIT 1;

  -- Grade totalmente confirmada = todos os slots com confirmado=true
  IF v_confirmado THEN
    DECLARE v_total_sel integer;
    DECLARE v_confirmados integer;
    BEGIN
      SELECT COUNT(*), COUNT(*) FILTER (WHERE confirmado)
      INTO v_total_sel, v_confirmados
      FROM grade_semanal_selecoes
      WHERE aluno_id = p_aluno_id AND config_id = v_config_id;

      v_confirmado := (v_confirmados = v_total_sel);
    END;
  END IF;

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
    'horas_firmadas', v_horas_firmadas,
    'horas_rascunho', v_horas_rascunho,
    'total_horas_selecionadas', v_total_geral,
    'campos_pendentes', v_faltam_campos,
    'pode_exibir_grade', (array_length(v_faltam_campos, 1) IS NULL)
  );
END;
$function$;


-- 2) atualizar_aluno_admin: diferencia aumento vs redução de carga.
--    Aumento: preserva firmados, limpa rascunhos, retorna complemento necessário.
--    Redução: desconfirma todos, retorna ajuste necessário.
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
  v_carga_mudou boolean := false;
  v_categoria_mudou boolean := false;
  v_carga_antiga integer;
  v_carga_nova integer;
  v_firmados_count integer := 0;
  v_rascunho_count integer := 0;
  v_total_selecoes integer := 0;
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

  v_carga_antiga := v_aluno.carga_horaria_semanal_max;
  v_carga_nova := COALESCE(p_carga_horaria_semanal, v_carga_antiga);

  v_carga_mudou := p_carga_horaria_semanal IS NOT NULL
    AND (v_carga_antiga IS NULL OR p_carga_horaria_semanal != v_carga_antiga);
  v_categoria_mudou := p_categoria_carga_id IS NOT NULL AND p_categoria_carga_id != v_aluno.categoria_carga_id;

  -- Atualiza dados do aluno
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

  -- Conta seleções firmadas e rascunho
  SELECT
    COUNT(*) FILTER (WHERE confirmado = true),
    COUNT(*) FILTER (WHERE confirmado = false),
    COUNT(*)
  INTO v_firmados_count, v_rascunho_count, v_total_selecoes
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id;

  -- Trata grade quando carga muda
  IF v_carga_mudou AND v_firmados_count > 0 THEN
    IF v_carga_nova > v_carga_antiga THEN
      -- AUMENTO: preserva firmados, limpa rascunhos
      DELETE FROM grade_semanal_selecoes
      WHERE aluno_id = p_aluno_id AND confirmado = false;

      RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Carga horária aumentada de ' || v_carga_antiga || 'h para ' || v_carga_nova || 'h. Selecione as ' || (v_carga_nova - v_carga_antiga || 'h restantes.'),
        'grade_reaberta', true,
        'tipo_ajuste', 'aumento',
        'carga_anterior', v_carga_antiga,
        'carga_nova', v_carga_nova,
        'horas_firmadas', v_carga_antiga,
        'horas_necessarias', (v_carga_nova - v_carga_antiga)
      );
    ELSIF v_carga_nova < v_carga_antiga THEN
      -- REDUÇÃO: desconfirma todos, aluno deve remover excesso
      UPDATE grade_semanal_selecoes
      SET confirmado = false, confirmado_em = NULL
      WHERE aluno_id = p_aluno_id;

      RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Carga horária reduzida de ' || v_carga_antiga || 'h para ' || v_carga_nova || 'h. Remova ' || (v_carga_antiga - v_carga_nova || 'h.'),
        'grade_reaberta', true,
        'tipo_ajuste', 'reducao',
        'carga_anterior', v_carga_antiga,
        'carga_nova', v_carga_nova,
        'horas_firmadas', v_carga_antiga,
        'horas_remover', (v_carga_antiga - v_carga_nova)
      );
    ELSE
      -- Carga igual, não altera grade
      RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Dados do aluno atualizados com sucesso.',
        'grade_reaberta', false
      );
    END IF;
  END IF;

  -- Se tem rascunhos (não firmados) e a carga mudou sem firmados, limpa rascunhos
  IF v_carga_mudou AND v_firmados_count = 0 AND v_rascunho_count > 0 THEN
    DELETE FROM grade_semanal_selecoes
    WHERE aluno_id = p_aluno_id AND confirmado = false;
  END IF;

  RETURN json_build_object(
    'sucesso', true,
    'mensagem', 'Dados do aluno atualizados com sucesso.',
    'grade_reaberta', false
  );
END;
$function$;


-- 3) salvar_selecao_grade: suporte a modo complemento.
--    Quando existem firmados e total < carga → permite adicionar, bloqueia remoção de firmados.
CREATE OR REPLACE FUNCTION public.salvar_selecao_grade(p_aluno_id integer, p_config_id integer, p_vaga_horario_id integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vaga RECORD;
  v_usuario_id integer;
  v_ja_selecionado RECORD;
  v_total_horas numeric := 0;
  v_carga_max integer;
  v_horas_slot numeric;
  v_firmados_count integer := 0;
  v_total_sel_count integer := 0;
  v_em_modo_complemento boolean := false;
BEGIN
  SELECT usuario_id INTO v_usuario_id FROM alunos WHERE id = p_aluno_id;
  IF NOT FOUND THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Aluno não encontrado.');
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM usuarios WHERE id = v_usuario_id AND auth_user_id = auth.uid()
    ) THEN
      RETURN json_build_object('sucesso', false, 'mensagem', 'Você só pode editar o horário da sua própria conta.');
    END IF;
  END IF;

  -- Bloqueia a vaga para atualização concorrente atômica.
  SELECT * INTO v_vaga
  FROM vagas_horarios
  WHERE id = p_vaga_horario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Vaga de horário não encontrada.');
  END IF;

  SELECT carga_horaria_semanal_max INTO v_carga_max FROM alunos WHERE id = p_aluno_id;
  v_carga_max := COALESCE(v_carga_max, 4);

  -- Conta firmados e total de seleções
  SELECT
    COUNT(*) FILTER (WHERE confirmado = true),
    COUNT(*)
  INTO v_firmados_count, v_total_sel_count
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id AND config_id = p_config_id;

  -- Calcula total de horas selecionadas (firmados + rascunho)
  SELECT COALESCE(SUM(
    EXTRACT(HOUR FROM gs.hora_fim::time - gs.hora_inicio::time) +
    EXTRACT(MINUTE FROM gs.hora_fim::time - gs.hora_inicio::time)/60.0
  ), 0) INTO v_total_horas
  FROM grade_semanal_selecoes gs
  WHERE gs.aluno_id = p_aluno_id AND gs.config_id = p_config_id;

  -- Detecta modo complemento: existem firmados E total < carga (aumento)
  v_em_modo_complemento := (v_firmados_count > 0 AND v_total_horas < v_carga_max);

  -- Se grade totalmente firmada (todos confirmados E total >= carga) → bloqueia
  IF v_firmados_count > 0 AND NOT v_em_modo_complemento AND v_total_horas >= v_carga_max THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Seu horário semanal já está firmado. Alterações somente pela administração.');
  END IF;

  -- Toggle da seleção.
  SELECT * INTO v_ja_selecionado
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id AND config_id = p_config_id AND vaga_horario_id = p_vaga_horario_id;

  IF v_ja_selecionado.id IS NOT NULL THEN
    -- Tentando remover uma seleção
    -- No modo complemento, bloqueia remoção de firmados
    IF v_em_modo_complemento AND v_ja_selecionado.confirmado = true THEN
      RETURN json_build_object('sucesso', false, 'mensagem', 'Este horário já está firmado e não pode ser removido. Apenas horários novos podem ser ajustados.');
    END IF;

    DELETE FROM grade_semanal_selecoes WHERE id = v_ja_selecionado.id;

    SELECT COALESCE(SUM(
      EXTRACT(HOUR FROM gs.hora_fim::time - gs.hora_inicio::time) +
      EXTRACT(MINUTE FROM gs.hora_fim::time - gs.hora_inicio::time)/60.0
    ), 0) INTO v_total_horas
    FROM grade_semanal_selecoes gs
    WHERE gs.aluno_id = p_aluno_id AND gs.config_id = p_config_id;

    RETURN json_build_object(
      'sucesso', true,
      'acao', 'removida',
      'mensagem', 'Vaga removida.',
      'horas_selecionadas', v_total_horas,
      'categoria_carga', v_carga_max
    );
  ELSE
    -- Tentando adicionar uma seleção
    IF v_vaga.status != 'ativo' OR v_vaga.vagas_disponiveis <= 0 THEN
      RETURN json_build_object('sucesso', false, 'mensagem', 'Este horário está indisponível.');
    END IF;

    v_horas_slot := EXTRACT(HOUR FROM v_vaga.hora_fim::time - v_vaga.hora_inicio::time) +
                    EXTRACT(MINUTE FROM v_vaga.hora_fim::time - v_vaga.hora_inicio::time)/60.0;

    IF (v_total_horas + v_horas_slot) > v_carga_max THEN
      RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Limite de ' || v_carga_max || 'h semanais excedido (atual: ' || v_total_horas || 'h).'
      );
    END IF;

    INSERT INTO grade_semanal_selecoes (
      aluno_id, config_id, vaga_horario_id, dia_semana, hora_inicio, hora_fim, confirmado
    ) VALUES (
      p_aluno_id, p_config_id, p_vaga_horario_id, v_vaga.dia_semana, v_vaga.hora_inicio, v_vaga.hora_fim, false
    );

    v_total_horas := v_total_horas + v_horas_slot;

    RETURN json_build_object(
      'sucesso', true,
      'acao', 'adicionada',
      'mensagem', 'Vaga adicionada.',
      'horas_selecionadas', v_total_horas,
      'categoria_carga', v_carga_max
    );
  END IF;
END;
$function$;


-- 4) confirmar_grade: suporte a modo complemento.
--    Se todos já estão confirmados → bloqueia.
--    Se alguns confirmados e outros não (complemento) → valida total, confirma todos.
CREATE OR REPLACE FUNCTION public.confirmar_grade(p_aluno_id integer, p_config_id integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_usuario_id integer;
  v_carga_max integer;
  v_total_horas numeric := 0;
  v_count integer;
  v_firmados_count integer := 0;
  v_total_sel integer := 0;
  v_config_confirmada integer;
  v_sel RECORD;
  v_vaga RECORD;
BEGIN
  SELECT usuario_id INTO v_usuario_id FROM alunos WHERE id = p_aluno_id;
  IF NOT FOUND THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Aluno não encontrado.');
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM usuarios WHERE id = v_usuario_id AND auth_user_id = auth.uid()
    ) THEN
      RETURN json_build_object('sucesso', false, 'mensagem', 'Você só pode confirmar o horário da sua própria conta.');
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('confirmar_grade:' || p_aluno_id, 0));

  -- Verifica se grade já está totalmente firmada (todos confirmados)
  SELECT COUNT(*), COUNT(*) FILTER (WHERE confirmado)
  INTO v_total_sel, v_firmados_count
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id AND config_id = p_config_id;

  IF v_firmados_count > 0 AND v_firmados_count = v_total_sel THEN
    SELECT config_id INTO v_config_confirmada
    FROM grade_semanal_selecoes
    WHERE aluno_id = p_aluno_id AND confirmado = true
    LIMIT 1;
    RETURN json_build_object(
      'sucesso', false,
      'mensagem', 'Seu horário semanal já está firmado. Alterações somente pela administração.',
      'config_id', v_config_confirmada
    );
  END IF;

  -- Configuração/vigência ativa.
  IF NOT EXISTS (SELECT 1 FROM grade_semanal_config WHERE id = p_config_id AND status = 'ativa') THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'A configuração da grade semanal não está ativa.');
  END IF;

  SELECT carga_horaria_semanal_max INTO v_carga_max FROM alunos WHERE id = p_aluno_id;
  v_carga_max := COALESCE(v_carga_max, 4);

  -- Calcula total de horas (firmados + rascunho)
  SELECT COUNT(*), COALESCE(SUM(
    EXTRACT(HOUR FROM hora_fim::time - hora_inicio::time) +
    EXTRACT(MINUTE FROM hora_fim::time - hora_inicio::time)/60.0
  ), 0) INTO v_count, v_total_horas
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id AND config_id = p_config_id;

  IF v_count = 0 THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Nenhum horário selecionado.');
  END IF;

  IF v_total_horas != v_carga_max THEN
    RETURN json_build_object(
      'sucesso', false,
      'mensagem', 'Você deve selecionar exatamente ' || v_carga_max || 'h semanais (atual: ' || v_total_horas || 'h).'
    );
  END IF;

  -- Bloqueia slots (FOR UPDATE) e valida disponibilidade.
  FOR v_sel IN
    SELECT vaga_horario_id FROM grade_semanal_selecoes
    WHERE aluno_id = p_aluno_id AND config_id = p_config_id
  LOOP
    SELECT * INTO v_vaga
    FROM vagas_horarios
    WHERE id = v_sel.vaga_horario_id
    FOR UPDATE;

    IF v_vaga.id IS NULL OR v_vaga.status != 'ativo' OR v_vaga.vagas_disponiveis <= 0 THEN
      RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Um dos horários selecionados ficou indisponível no momento. Por favor, ajuste suas escolhas.'
      );
    END IF;
  END LOOP;

  -- Decrementa vagas APENAS para seleções novas (confirmado = false)
  FOR v_sel IN
    SELECT vaga_horario_id FROM grade_semanal_selecoes
    WHERE aluno_id = p_aluno_id AND config_id = p_config_id AND confirmado = false
  LOOP
    UPDATE vagas_horarios
    SET vagas_disponiveis = GREATEST(0, vagas_disponiveis - 1)
    WHERE id = v_sel.vaga_horario_id;
  END LOOP;

  -- Marca TODAS as seleções como confirmadas
  UPDATE grade_semanal_selecoes
  SET confirmado = true, confirmado_em = NOW()
  WHERE aluno_id = p_aluno_id AND config_id = p_config_id;

  RETURN json_build_object(
    'sucesso', true,
    'mensagem', 'Grade confirmada com sucesso! Seu horário está firmado para toda a vigência.',
    'total_horas', v_total_horas,
    'categoria_carga', v_carga_max,
    'config_id', p_config_id
  );
END;
$function$;


-- 5) GRANTs para as funções atualizadas
GRANT EXECUTE ON FUNCTION public.obter_grade_aluno(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_selecao_grade(integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_grade(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_aluno_admin(integer, integer, integer, integer, integer, integer, integer, text) TO authenticated, service_role;
