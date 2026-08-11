-- RPC: Supervisão analisa solicitação de ajuste ou justificativa de falta
-- Ações: aprovar, corrigir, rejeitar
-- Na saída esquecida aprovada: registra saída e computa horas
-- Na falta justificada: não computa horas
-- Timezone: usa America/Recife para hora_saida (varchar)

CREATE OR REPLACE FUNCTION analisar_solicitacao(
  p_justificativa_id integer,
  p_acao text,
  p_parecer text,
  p_saida_corrigida text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_j_status text;
  v_j_ponto_id integer;
  v_j_saida_sugerida text;
  v_p_hora_saida text;
  v_p_hora_entrada text;
  v_p_data date;
  v_novo_status text;
  v_minutos integer;
  v_saida_final text;
  v_hora_recife text;
BEGIN
  IF p_acao NOT IN ('aprovar', 'corrigir', 'rejeitar') THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Ação inválida.');
  END IF;
  IF p_parecer IS NULL OR length(trim(p_parecer)) < 5 THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Parecer deve ter pelo menos 5 caracteres.');
  END IF;

  v_hora_recife := TO_CHAR(NOW() AT TIME ZONE 'America/Recife', 'HH24:MI');

  SELECT status, ponto_id, saida_sugerida INTO v_j_status, v_j_ponto_id, v_j_saida_sugerida
  FROM justificativas WHERE id = p_justificativa_id;

  IF v_j_status IS NULL THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Solicitação não encontrada.');
  END IF;
  IF v_j_status != 'pendente' THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Esta solicitação já foi analisada.');
  END IF;

  v_p_hora_saida := NULL;
  v_p_hora_entrada := NULL;
  v_p_data := NULL;
  IF v_j_ponto_id IS NOT NULL THEN
    SELECT hora_saida, hora_entrada, data INTO v_p_hora_saida, v_p_hora_entrada, v_p_data
    FROM pontos WHERE id = v_j_ponto_id;
  END IF;

  IF p_acao = 'aprovar' THEN
    IF v_p_hora_entrada IS NOT NULL AND (v_p_hora_saida IS NULL OR v_p_hora_saida = '00:00') THEN
      v_saida_final := COALESCE(v_j_saida_sugerida, v_hora_recife);
      v_minutos := EXTRACT(EPOCH FROM (
        (v_p_data::text || ' ' || v_saida_final)::timestamp -
        (v_p_data::text || ' ' || v_p_hora_entrada)::timestamp
      ))::integer / 60;
      IF v_minutos < 0 THEN v_minutos := 0; END IF;

      UPDATE pontos
      SET hora_saida = v_saida_final,
          tempo_total_minutos = v_minutos,
          status_frequencia = 'presenca_no_horario',
          observacao = COALESCE(observacao || ' | ', '') || 'Saída ajustada por supervisão'
      WHERE id = v_j_ponto_id;
      v_novo_status := 'aprovado';
    ELSE
      IF v_j_ponto_id IS NOT NULL AND v_p_hora_entrada IS NOT NULL THEN
        UPDATE pontos
        SET status_frequencia = 'falta_justificada',
            observacao = COALESCE(observacao || ' | ', '') || 'Falta justificada por supervisão'
        WHERE id = v_j_ponto_id;
      END IF;
      v_novo_status := 'aprovado';
    END IF;

  ELSIF p_acao = 'corrigir' THEN
    IF p_saida_corrigida IS NULL OR p_saida_corrigida = '' THEN
      RETURN json_build_object('sucesso', false, 'mensagem', 'Informe o horário corrigido.');
    END IF;
    BEGIN
      PERFORM p_saida_corrigida::time;
    EXCEPTION WHEN OTHERS THEN
      RETURN json_build_object('sucesso', false, 'mensagem', 'Horário inválido. Use HH:MM.');
    END;
    IF v_j_ponto_id IS NOT NULL AND v_p_hora_entrada IS NOT NULL THEN
      v_minutos := EXTRACT(EPOCH FROM (
        (v_p_data::text || ' ' || p_saida_corrigida)::timestamp -
        (v_p_data::text || ' ' || v_p_hora_entrada)::timestamp
      ))::integer / 60;
      IF v_minutos < 0 THEN v_minutos := 0; END IF;
      UPDATE pontos
      SET hora_saida = p_saida_corrigida,
          tempo_total_minutos = v_minutos,
          status_frequencia = 'presenca_no_horario',
          observacao = COALESCE(observacao || ' | ', '') || 'Saída corrigida por supervisão'
      WHERE id = v_j_ponto_id;
    END IF;
    v_novo_status := 'aprovado';

  ELSIF p_acao = 'rejeitar' THEN
    IF v_j_ponto_id IS NOT NULL AND v_p_hora_entrada IS NOT NULL THEN
      UPDATE pontos
      SET status_frequencia = 'ausencia',
          observacao = COALESCE(observacao || ' | ', '') || 'Solicitação rejeitada por supervisão'
      WHERE id = v_j_ponto_id;
    END IF;
    v_novo_status := 'rejeitado';
  END IF;

  UPDATE justificativas
  SET status = v_novo_status, parecer_gerencia = p_parecer, analisado_por = NULL, analisado_em = NOW()
  WHERE id = p_justificativa_id;

  INSERT INTO logs_auditoria (acao, entidade, entidade_id, dados_novos, justificativa, criado_em)
  VALUES ('analisar_solicitacao_' || p_acao, 'justificativas', p_justificativa_id,
    json_build_object('status_novo', v_novo_status, 'acao', p_acao)::text, p_parecer, NOW());

  RETURN json_build_object('sucesso', true,
    'mensagem', CASE p_acao WHEN 'aprovar' THEN 'Aprovado.' WHEN 'corrigir' THEN 'Corrigido.' ELSE 'Rejeitado.' END,
    'acao', p_acao, 'novo_status', v_novo_status);
END;
$$;

GRANT EXECUTE ON FUNCTION analisar_solicitacao(integer, text, text, text) TO authenticated;
