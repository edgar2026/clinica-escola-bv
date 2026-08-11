-- RPC: Aluno solicita ajuste de saída para registro com "Saída não registrada"
-- Cria registro em justificativas com status 'pendente'

CREATE OR REPLACE FUNCTION solicitar_ajuste_saida(
  p_ponto_id integer,
  p_saida_sugerida text,
  p_justificativa text
)
RETURNS json
AS $$
DECLARE
  v_ponto RECORD;
  v_aluno_id integer;
  v_justificativa_id integer;
  v_saida_time time;
BEGIN
  IF p_saida_sugerida IS NULL OR p_saida_sugerida = '' THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Horário de saída sugerido é obrigatório.');
  END IF;

  IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 5 THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Justificativa deve ter pelo menos 5 caracteres.');
  END IF;

  BEGIN
    v_saida_time := p_saida_sugerida::time;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Formato de horário inválido. Use HH:MM.');
  END;

  SELECT * INTO v_ponto FROM pontos WHERE id = p_ponto_id;
  IF v_ponto IS NULL THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Registro não encontrado.');
  END IF;

  v_aluno_id := v_ponto.aluno_id;

  IF v_ponto.hora_saida IS NOT NULL AND v_ponto.hora_saida != '00:00' THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Este registro já possui saída registrada.');
  END IF;

  IF EXISTS (SELECT 1 FROM justificativas WHERE ponto_id = p_ponto_id AND status = 'pendente') THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Já existe uma solicitação pendente para este registro.');
  END IF;

  INSERT INTO justificativas (aluno_id, ponto_id, motivo, descricao, saida_sugerida, status, criado_em)
  VALUES (v_aluno_id, p_ponto_id, 'ajuste_saida', p_justificativa, p_saida_sugerida, 'pendente', NOW())
  RETURNING id INTO v_justificativa_id;

  UPDATE pontos
  SET status_frequencia = 'aguardando_validacao',
      observacao = COALESCE(observacao || ' | ', '') || 'Solicitação de ajuste de saída enviada'
  WHERE id = p_ponto_id;

  INSERT INTO logs_auditoria (usuario_id, acao, entidade, entidade_id, dados_novos, criado_em)
  VALUES (
    (SELECT usuario_id FROM alunos WHERE id = v_aluno_id),
    'solicitar_ajuste_saida', 'justificativas', v_justificativa_id,
    json_build_object('ponto_id', p_ponto_id, 'saida_sugerida', p_saida_sugerida, 'justificativa', p_justificativa)::text,
    NOW()
  );

  RETURN json_build_object('sucesso', true,
    'mensagem', 'Solicitação de ajuste enviada com sucesso. Aguardando análise da supervisão.',
    'justificativa_id', v_justificativa_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION solicitar_ajuste_saida(integer, text, text) TO authenticated;
