-- RPC: Fechar pontos abertos do dia anterior (transição de dia)
-- Marca como "Saída não registrada" sem computar horas

CREATE OR REPLACE FUNCTION fechar_pontos_abertos()
RETURNS json
AS $$
DECLARE
  v_fechados integer := 0;
BEGIN
  UPDATE pontos
  SET hora_saida = '00:00',
      tempo_total_minutos = 0,
      status_frequencia = 'saida_nao_registrada',
      observacao = COALESCE(observacao || ' | ', '') || 'Fechado automaticamente - saida nao registrada (dia anterior)'
  WHERE data < CURRENT_DATE
    AND hora_saida IS NULL;

  GET DIAGNOSTICS v_fechados = ROW_COUNT;

  INSERT INTO logs_auditoria (acao, entidade, justificativa, criado_em)
  VALUES ('fechar_pontos_abertos', 'pontos',
          json_build_object('registros_fechados', v_fechados, 'data_execucao', NOW()::text)::text,
          NOW());

  RETURN json_build_object(
    'registros_fechados', v_fechados,
    'mensagem', v_fechados || ' registro(s) fechado(s) automaticamente.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fechar_pontos_abertos() TO authenticated;
