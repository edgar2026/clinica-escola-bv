-- RPC atômica para registro de presença
-- Regra: sem entrada aberta → criar ENTRADA; com entrada sem saída → atualizar com SAÍDA
-- Proteção: 60 segundos mínimos entre entrada e saída
-- Atômico: pg_advisory_xact_lock previne dupla entrada simultânea
-- Timezone: usa America/Recife para hora_entrada/hora_saida (varchar)

CREATE OR REPLACE FUNCTION registrar_presenca(p_aluno_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entrada_aberta RECORD;
  v_saida_min timestamp;
  v_novo_id integer;
  v_result json;
  v_hora_recife text;
BEGIN
  PERFORM pg_advisory_xact_lock(p_aluno_id);

  v_hora_recife := TO_CHAR(NOW() AT TIME ZONE 'America/Recife', 'HH24:MI');

  SELECT * INTO v_entrada_aberta
  FROM pontos
  WHERE aluno_id = p_aluno_id
    AND data = CURRENT_DATE
    AND hora_saida IS NULL
  ORDER BY criado_em DESC
  LIMIT 1
  FOR UPDATE;

  IF v_entrada_aberta IS NULL THEN
    INSERT INTO pontos (aluno_id, data, hora_entrada, tipo_registro, status_frequencia, tempo_total_minutos)
    VALUES (p_aluno_id, CURRENT_DATE, v_hora_recife, 'botao', 'aguardando_validacao', 0)
    RETURNING id INTO v_novo_id;

    v_result := json_build_object(
      'acao', 'entrada',
      'ponto_id', v_novo_id,
      'mensagem', 'Entrada registrada com sucesso.',
      'hora', v_hora_recife
    );
  ELSE
    v_saida_min := v_entrada_aberta.criado_em + INTERVAL '60 seconds';

    IF NOW() < v_saida_min THEN
      v_result := json_build_object(
        'acao', 'bloqueado',
        'mensagem', 'Aguarde pelo menos 1 minuto após a entrada para registrar a saída.',
        'segundos_restantantes', EXTRACT(EPOCH FROM (v_saida_min - NOW()))::integer
      );
    ELSE
      UPDATE pontos
      SET hora_saida = v_hora_recife,
          tempo_total_minutos = EXTRACT(EPOCH FROM (NOW() - v_entrada_aberta.criado_em))::integer / 60
      WHERE id = v_entrada_aberta.id;

      v_result := json_build_object(
        'acao', 'saida',
        'ponto_id', v_entrada_aberta.id,
        'mensagem', 'Saída registrada com sucesso.',
        'hora', v_hora_recife
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_presenca(integer) TO authenticated;
