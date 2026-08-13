-- Correção da persistência da confirmação do Horário Firmado (Grade Semanal).
-- 1) Data/hora da confirmação para rastrear vigência e status.
ALTER TABLE grade_semanal_selecoes
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz;

-- 2) Impede DUAS grades confirmadas para o mesmo aluno (uma única config/vigência)
--    no nível do banco, mesmo em escritas concorrentes diretas.
DROP INDEX IF EXISTS uq_grade_semanal_selecoes_uma_confirmada;
CREATE OR REPLACE FUNCTION public.grade_confirmada_uma_config() RETURNS trigger
LANGUAGE plpgsql AS $t$
DECLARE
  v_duplicados int;
BEGIN
  SELECT COUNT(*) INTO v_duplicados
  FROM (
    SELECT aluno_id
    FROM grade_semanal_selecoes
    WHERE confirmado = true
    GROUP BY aluno_id
    HAVING COUNT(DISTINCT config_id) > 1
  ) d;
  IF v_duplicados > 0 THEN
    RAISE EXCEPTION 'Aluno já possui horário firmado em outra configuração/vigência.';
  END IF;
  RETURN NULL;
END;
$t$;

DROP TRIGGER IF EXISTS trg_grade_confirmada_uma_config ON grade_semanal_selecoes;
CREATE TRIGGER trg_grade_confirmada_uma_config
  AFTER INSERT OR UPDATE ON grade_semanal_selecoes
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.grade_confirmada_uma_config();

-- 3) Segurança: apenas o aluno autenticado dono do registro pode confirmar/selecionar.
REVOKE EXECUTE ON FUNCTION public.confirmar_grade(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.salvar_selecao_grade(integer, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.obter_grade_aluno(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verificar_inscricao_aberta(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_grade(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_selecao_grade(integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_grade_aluno(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verificar_inscricao_aberta(integer) TO authenticated, service_role;

-- 4) confirmar_grade reescrita: guarda de dupla confirmação, lock atômico, dono autenticado,
--    data de confirmação e vigência correta.
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
  v_confirmado boolean := false;
  v_config_confirmada integer;
  v_sel RECORD;
  v_vaga RECORD;
BEGIN
  SELECT usuario_id INTO v_usuario_id FROM alunos WHERE id = p_aluno_id;
  IF NOT FOUND THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Aluno não encontrado.');
  END IF;

  -- Apenas o aluno dono da conta pode confirmar (via API autenticada).
  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM usuarios WHERE id = v_usuario_id AND auth_user_id = auth.uid()
    ) THEN
      RETURN json_build_object('sucesso', false, 'mensagem', 'Você só pode confirmar o horário da sua própria conta.');
    END IF;
  END IF;

  -- Serializa cliques simultâneos do mesmo aluno.
  PERFORM pg_advisory_xact_lock(hashtextextended('confirmar_grade:' || p_aluno_id, 0));

  -- Já firmado em QUALQUER configuração (cross-config) → bloqueia.
  SELECT EXISTS (
    SELECT 1 FROM grade_semanal_selecoes
    WHERE aluno_id = p_aluno_id AND confirmado = true
  ) INTO v_confirmado;

  IF v_confirmado THEN
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

  -- Decrementa vagas atomically.
  FOR v_sel IN
    SELECT vaga_horario_id FROM grade_semanal_selecoes
    WHERE aluno_id = p_aluno_id AND config_id = p_config_id
  LOOP
    UPDATE vagas_horarios
    SET vagas_disponiveis = GREATEST(0, vagas_disponiveis - 1)
    WHERE id = v_sel.vaga_horario_id;
  END LOOP;

  -- Persistência PERMANENTE da confirmação vinculada ao aluno + vigência.
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

-- 5) salvar_selecao_grade reescrita: dono autenticado + bloqueio se já firmado (cross-config).
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
  v_confirmado boolean := false;
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

  -- Grade já firmada em QUALQUER configuração → bloqueia qualquer alteração.
  SELECT EXISTS (
    SELECT 1 FROM grade_semanal_selecoes
    WHERE aluno_id = p_aluno_id AND confirmado = true
  ) INTO v_confirmado;

  IF v_confirmado THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Seu horário semanal já está firmado. Alterações somente pela administração.');
  END IF;

  -- Toggle da seleção.
  SELECT * INTO v_ja_selecionado
  FROM grade_semanal_selecoes
  WHERE aluno_id = p_aluno_id AND config_id = p_config_id AND vaga_horario_id = p_vaga_horario_id;

  IF v_ja_selecionado.id IS NOT NULL THEN
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
    IF v_vaga.status != 'ativo' OR v_vaga.vagas_disponiveis <= 0 THEN
      RETURN json_build_object('sucesso', false, 'mensagem', 'Este horário está indisponível.');
    END IF;

    v_horas_slot := EXTRACT(HOUR FROM v_vaga.hora_fim::time - v_vaga.hora_inicio::time) +
                    EXTRACT(MINUTE FROM v_vaga.hora_fim::time - v_vaga.hora_inicio::time)/60.0;

    SELECT COALESCE(SUM(
      EXTRACT(HOUR FROM gs.hora_fim::time - gs.hora_inicio::time) +
      EXTRACT(MINUTE FROM gs.hora_fim::time - gs.hora_inicio::time)/60.0
    ), 0) INTO v_total_horas
    FROM grade_semanal_selecoes gs
    WHERE gs.aluno_id = p_aluno_id AND gs.config_id = p_config_id;

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
