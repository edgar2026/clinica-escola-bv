-- Fluxo de cadastro e primeiro acesso do aluno em etapa unica.
-- Causa raiz corrigida: corrida entre o auto-repair do getMe (SIGNED_IN do signUp)
-- e o insert do formulario gerava unique violation e mensagem de erro incorreta,
-- alem de primeiro_acesso=1 exibir "Complete seu cadastro" com dados ja salvos.
-- A RPC abaixo e idempotente: nunca duplica, completa dados faltantes e controla
-- primeiro_acesso conforme o vinculo academico (curso/periodo/turno).

CREATE OR REPLACE FUNCTION public.cadastrar_aluno_inicial(
  p_auth_user_id uuid,
  p_nome text,
  p_email text,
  p_matricula text,
  p_curso_id integer,
  p_periodo_id integer,
  p_turno_id integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_usuario_id integer;
  v_usuario_antes integer;
  v_carga integer;
  v_campos_faltantes text[];
  v_autenticado boolean;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Identificador da conta de autenticacao ausente.');
  END IF;
  IF p_nome IS NULL OR p_nome = '' THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Nome completo e obrigatorio.');
  END IF;
  IF p_email IS NULL OR p_email = '' THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'E-mail e obrigatorio.');
  END IF;
  IF p_matricula IS NULL OR p_matricula = '' THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Matricula e obrigatoria.');
  END IF;
  IF p_curso_id IS NULL THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Curso e obrigatorio.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_auth_user_id AND u.email = p_email) THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Conta de autenticacao nao encontrada. Recarregue a pagina e tente novamente.');
  END IF;

  v_autenticado := (auth.role() = 'authenticated');
  IF v_autenticado AND auth.uid() IS NOT NULL AND auth.uid() <> p_auth_user_id THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Sessao incompativel com este cadastro.');
  END IF;

  IF EXISTS (SELECT 1 FROM usuarios WHERE matricula = p_matricula AND auth_user_id IS DISTINCT FROM p_auth_user_id) THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Esta matricula ja esta cadastrada.');
  END IF;
  IF EXISTS (SELECT 1 FROM usuarios WHERE email = p_email AND auth_user_id IS DISTINCT FROM p_auth_user_id) THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Este e-mail ja esta cadastrado.');
  END IF;

  SELECT id INTO v_usuario_antes FROM usuarios WHERE auth_user_id = p_auth_user_id;

  v_campos_faltantes := ARRAY[]::text[];
  IF p_periodo_id IS NULL THEN
    v_campos_faltantes := array_append(v_campos_faltantes, 'período');
  END IF;
  IF p_turno_id IS NULL THEN
    v_campos_faltantes := array_append(v_campos_faltantes, 'turno');
  END IF;

  SELECT COALESCE(
    (SELECT NULLIF(valor, '')::integer FROM configuracoes WHERE chave = 'carga_horaria_semanal_padrao'),
    4
  ) INTO v_carga;

  IF v_usuario_antes IS NULL THEN
    INSERT INTO usuarios (auth_user_id, nome, email, matricula, senha_hash, perfil, status, primeiro_acesso, curso_id)
    VALUES (p_auth_user_id, p_nome, p_email, p_matricula, 'managed_by_auth', 'aluno', 'ativo',
            CASE WHEN cardinality(v_campos_faltantes) = 0 THEN 0 ELSE 1 END,
            p_curso_id)
    RETURNING id INTO v_usuario_id;
  ELSE
    v_usuario_id := v_usuario_antes;
    UPDATE usuarios SET
      nome = p_nome,
      email = p_email,
      matricula = p_matricula,
      curso_id = p_curso_id,
      perfil = 'aluno',
      status = 'ativo',
      primeiro_acesso = CASE WHEN cardinality(v_campos_faltantes) = 0 THEN 0 ELSE 1 END
    WHERE id = v_usuario_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alunos WHERE usuario_id = v_usuario_id) THEN
    INSERT INTO alunos (usuario_id, curso_id, periodo_id, turno_id, carga_horaria_semanal_max, situacao)
    VALUES (v_usuario_id, p_curso_id, p_periodo_id, p_turno_id, v_carga, 'ativo');
  ELSE
    UPDATE alunos SET
      curso_id = p_curso_id,
      periodo_id = p_periodo_id,
      turno_id = p_turno_id,
      situacao = 'ativo'
    WHERE usuario_id = v_usuario_id;
  END IF;

  RETURN json_build_object(
    'sucesso', true,
    'dados_completos', (cardinality(v_campos_faltantes) = 0),
    'campos_faltantes', v_campos_faltantes,
    'mensagem', CASE WHEN cardinality(v_campos_faltantes) = 0
      THEN 'Conta criada com sucesso! Você já pode entrar no sistema.'
      ELSE 'Cadastro salvo. Dados faltantes: ' || array_to_string(v_campos_faltantes, ', ') || '.' END,
    'usuario_id', v_usuario_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cadastrar_aluno_inicial(uuid, text, text, text, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cadastrar_aluno_inicial(uuid, text, text, text, integer, integer, integer) TO authenticated, service_role;
