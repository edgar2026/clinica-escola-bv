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
