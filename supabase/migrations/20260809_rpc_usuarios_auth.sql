-- RPC: listar_usuarios_completos
CREATE OR REPLACE FUNCTION listar_usuarios_completos()
RETURNS SETOF json AS $$
BEGIN
  RETURN QUERY
  SELECT json_build_object(
    'id',                COALESCE(u.id,  au.id),
    'nome',              COALESCE(u.nome, au.raw_user_meta_data->>'nome', au.email),
    'email',             COALESCE(u.email, au.email),
    'matricula',         COALESCE(u.matricula, ''),
    'cpf',               COALESCE(u.cpf, ''),
    'telefone',          COALESCE(u.telefone, ''),
    'email_pessoal',     COALESCE(u.email_pessoal, ''),
    'endereco',          COALESCE(u.endereco, ''),
    'data_nascimento',   u.data_nascimento,
    'perfil',            COALESCE(u.perfil, 'aluno'),
    'status',            COALESCE(u.status, 'ativo'),
    'primeiro_acesso',   COALESCE(u.primeiro_acesso, false),
    'curso_id',          u.curso_id,
    'auth_user_id',      au.id,
    'criado_em',         COALESCE(u.criado_em, au.created_at),
    'tem_perfil',        (u.id IS NOT NULL)
  )
  FROM auth.users au
  LEFT JOIN usuarios u ON u.auth_user_id = au.id
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION listar_usuarios_completos() TO authenticated;

-- RPC: editar_usuario
CREATE OR REPLACE FUNCTION editar_usuario(
  p_usuario_id integer,
  p_nome text,
  p_email text,
  p_matricula text,
  p_cpf text DEFAULT NULL,
  p_perfil text DEFAULT 'aluno',
  p_telefone text DEFAULT NULL,
  p_email_pessoal text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_data_nascimento date DEFAULT NULL,
  p_curso_id integer DEFAULT NULL
)
RETURNS json AS $$
BEGIN
  UPDATE usuarios SET
    nome = p_nome,
    email = p_email,
    matricula = p_matricula,
    cpf = p_cpf,
    perfil = p_perfil,
    telefone = p_telefone,
    email_pessoal = p_email_pessoal,
    endereco = p_endereco,
    data_nascimento = p_data_nascimento,
    curso_id = p_curso_id,
    atualizado_em = now()
  WHERE id = p_usuario_id;

  RETURN json_build_object('ok', true, 'usuario_id', p_usuario_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION editar_usuario(integer, text, text, text, text, text, text, text, text, date, integer) TO authenticated;

-- RPC: alterar_status_usuario
CREATE OR REPLACE FUNCTION alterar_status_usuario(
  p_usuario_id integer,
  p_novo_status text,
  p_justificativa text DEFAULT ''
)
RETURNS json AS $$
BEGIN
  UPDATE usuarios SET status = p_novo_status, atualizado_em = now() WHERE id = p_usuario_id;

  BEGIN
    INSERT INTO logs_auditoria (usuario_id, acao, entidade, entidade_id, justificativa, criado_em)
    VALUES (p_usuario_id, 'alterar_status', 'usuarios', p_usuario_id, p_justificativa, now());
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true, 'usuario_id', p_usuario_id, 'novo_status', p_novo_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION alterar_status_usuario(integer, text, text) TO authenticated;

-- RPC: salvar_configuracao_com_auditoria
CREATE OR REPLACE FUNCTION salvar_configuracao_com_auditoria(
  p_chave text,
  p_valor text,
  p_grupo text DEFAULT 'geral'
)
RETURNS json AS $$
BEGIN
  INSERT INTO configuracoes (chave, valor, atualizado_em)
  VALUES (p_chave, p_valor, now())
  ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now();

  BEGIN
    INSERT INTO logs_auditoria (usuario_id, acao, entidade, entidade_id, justificativa, criado_em)
    VALUES (0, 'salvar_config', 'configuracoes', 0, p_chave || '=' || p_valor, now());
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true, 'chave', p_chave, 'valor', p_valor);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION salvar_configuracao_com_auditoria(text, text, text) TO authenticated;
