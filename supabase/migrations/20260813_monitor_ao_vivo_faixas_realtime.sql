-- Monitor ao Vivo administrativo reorganizado por faixas de horário.
-- Regras:
--   1) Somente usuários com perfil = 'aluno' E vínculo acadêmico ativo (alunos.situacao = 'ativo')
--      aparecem no monitor (administradores e gerencias NUNCA aparecem).
--   2) Faixas do dia atual (dia da semana em America/Recife) agrupadas por (hora_inicio, hora_fim),
--      derivadas exclusivamente de horários firmados (grade_semanal_selecoes.confirmado = true).
--   3) Situações calculadas com o horário do PostgreSQL (America/Recife) e registros reais de pontos:
--      aguardando | presente | atrasado | finalizado | ausente | saida_nao_registrada | em_analise.
--   4) "Presente agora" = entrada registrada e sem saída (data = CURRENT_DATE).
--   5) Presença no horário firmado é validada automaticamente (presenca_no_horario) já em registrar_presenca.
--   6) Realtime: publicação supabase_realtime passa a incluir pontos, grade_semanal_selecoes,
--      justificativas e vagas_horarios para atualização automática do painel.

ALTER PUBLICATION supabase_realtime ADD TABLE public.pontos, public.grade_semanal_selecoes, public.justificativas, public.vagas_horarios;

CREATE OR REPLACE FUNCTION public.monitor_presencas()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := CURRENT_DATE;
  v_dia_semana integer;
  v_hora_atual text;
  v_config RECORD;
  v_total_alunos integer;
  v_presentes_agora integer;
  v_solicitacoes_pendentes integer;
  v_slots_com_vagas integer;
  v_grades_confirmadas integer;
  v_result json;
BEGIN
  v_dia_semana := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Recife'))::integer;
  IF v_dia_semana = 0 THEN
    v_dia_semana := 7;
  END IF;
  v_hora_atual := TO_CHAR(NOW() AT TIME ZONE 'America/Recife', 'HH24:MI');

  SELECT * INTO v_config FROM grade_semanal_config WHERE status = 'ativa' ORDER BY id DESC LIMIT 1;

  v_total_alunos := (
    SELECT COUNT(*)::integer
    FROM usuarios u
    JOIN alunos a ON a.usuario_id = u.id
    WHERE u.perfil = 'aluno' AND a.situacao = 'ativo'
  );

  v_presentes_agora := (
    SELECT COUNT(DISTINCT p.aluno_id)::integer
    FROM pontos p
    JOIN alunos a ON a.id = p.aluno_id
    JOIN usuarios u ON u.id = a.usuario_id
    WHERE p.data = v_hoje
      AND p.hora_saida IS NULL
      AND u.perfil = 'aluno' AND a.situacao = 'ativo'
  );

  v_solicitacoes_pendentes := (SELECT COUNT(*)::integer FROM justificativas WHERE status = 'pendente');

  v_slots_com_vagas := (SELECT COUNT(*)::integer FROM vagas_horarios WHERE status = 'ativo' AND vagas_disponiveis > 0);

  v_grades_confirmadas := (
    SELECT COUNT(DISTINCT gs.aluno_id)::integer
    FROM grade_semanal_selecoes gs
    JOIN alunos a ON a.id = gs.aluno_id
    JOIN usuarios u ON u.id = a.usuario_id
    WHERE gs.confirmado AND u.perfil = 'aluno' AND a.situacao = 'ativo'
  );

  WITH firmados AS (
    SELECT gs.aluno_id, gs.vaga_horario_id, gs.dia_semana, gs.hora_inicio, gs.hora_fim,
           sc.nome AS setor_nome, vh.capacidade_max
    FROM grade_semanal_selecoes gs
    JOIN vagas_horarios vh ON vh.id = gs.vaga_horario_id
    LEFT JOIN setores_clinica sc ON sc.id = vh.setor_id
    WHERE gs.confirmado
  ),
  situacoes AS (
    SELECT f.aluno_id, u.id AS usuario_id, u.nome, u.matricula, c.nome AS curso_nome,
           f.vaga_horario_id, f.dia_semana, f.hora_inicio, f.hora_fim, f.setor_nome,
           ph.hora_entrada, ph.hora_saida, ph.status_frequencia, ph.id AS ponto_id,
           COALESCE(
             ph.status_frequencia = 'aguardando_validacao'
             OR EXISTS (SELECT 1 FROM justificativas j WHERE j.ponto_id = ph.id AND j.status = 'pendente'),
             false
           ) AS tem_justificativa_pendente,
           CASE
             WHEN ph.id IS NOT NULL AND (
               ph.status_frequencia = 'aguardando_validacao'
               OR EXISTS (SELECT 1 FROM justificativas j WHERE j.ponto_id = ph.id AND j.status = 'pendente')
             ) THEN 'em_analise'
             WHEN ph.hora_entrada IS NOT NULL AND ph.hora_saida IS NULL AND v_hora_atual::time > f.hora_fim::time THEN 'saida_nao_registrada'
             WHEN ph.hora_entrada IS NOT NULL AND ph.hora_saida IS NULL THEN
               CASE WHEN ph.hora_entrada::time > f.hora_inicio::time THEN 'atrasado' ELSE 'presente' END
             WHEN ph.hora_entrada IS NOT NULL AND ph.hora_saida IS NOT NULL THEN 'finalizado'
             WHEN v_hora_atual::time > f.hora_fim::time THEN 'ausente'
             WHEN v_hora_atual::time > f.hora_inicio::time THEN 'atrasado'
             ELSE 'aguardando'
           END AS situacao
    FROM firmados f
    JOIN alunos a ON a.id = f.aluno_id
    JOIN usuarios u ON u.id = a.usuario_id
    LEFT JOIN cursos c ON c.id = a.curso_id
    LEFT JOIN LATERAL (
      SELECT p.id, p.hora_entrada, p.hora_saida, p.status_frequencia
      FROM pontos p
      WHERE p.aluno_id = f.aluno_id AND p.data = v_hoje
      ORDER BY p.id DESC
      LIMIT 1
    ) ph ON true
    WHERE u.perfil = 'aluno' AND a.situacao = 'ativo'
  ),
  capacidades AS (
    SELECT vh.hora_inicio, vh.hora_fim, SUM(vh.capacidade_max)::integer AS capacidade_total
    FROM vagas_horarios vh
    WHERE vh.status = 'ativo'
      AND vh.dia_semana = v_dia_semana
      AND EXISTS (SELECT 1 FROM firmados f WHERE f.vaga_horario_id = vh.id)
    GROUP BY vh.hora_inicio, vh.hora_fim
  )
  SELECT json_build_object(
    'metricas', json_build_object(
      'total_alunos', v_total_alunos,
      'alunos_ativos', v_total_alunos,
      'presentes_agora', v_presentes_agora,
      'atrasados_hoje', COALESCE((SELECT COUNT(DISTINCT s.aluno_id)::integer FROM situacoes s WHERE s.situacao = 'atrasado' AND s.dia_semana = v_dia_semana), 0),
      'solicitacoes_pendentes', v_solicitacoes_pendentes,
      'slots_com_vagas', v_slots_com_vagas,
      'grades_confirmadas', v_grades_confirmadas,
      'hoje_data', v_hoje,
      'hoje_dia_semana', v_dia_semana,
      'hora_atual', v_hora_atual
    ),
    'faixas', COALESCE((
      SELECT json_agg(x.obj ORDER BY x.hora_inicio)
      FROM (
        SELECT s.hora_inicio, s.hora_fim,
          json_build_object(
            'hora_inicio', s.hora_inicio,
            'hora_fim', s.hora_fim,
            'setores', COALESCE(string_agg(DISTINCT NULLIF(s.setor_nome, ''), ', '), 'Clínica-Escola'),
            'capacidade_total', COALESCE(c.capacidade_total, 0),
            'alunos_esperados', COUNT(*)::integer,
            'presentes_agora', COUNT(*) FILTER (WHERE s.hora_entrada IS NOT NULL AND s.hora_saida IS NULL)::integer,
            'ainda_nao_chegaram', COUNT(*) FILTER (WHERE s.situacao = 'aguardando')::integer,
            'atrasados', COUNT(*) FILTER (WHERE s.situacao = 'atrasado')::integer,
            'saidos', COUNT(*) FILTER (WHERE s.situacao = 'finalizado')::integer,
            'ausentes', COUNT(*) FILTER (WHERE s.situacao = 'ausente')::integer,
            'alunos', json_agg(json_build_object(
              'aluno_id', s.aluno_id,
              'usuario_id', s.usuario_id,
              'nome', s.nome,
              'matricula', s.matricula,
              'curso_nome', s.curso_nome,
              'vaga_horario_id', s.vaga_horario_id,
              'setor_nome', s.setor_nome,
              'hora_entrada', s.hora_entrada,
              'hora_saida', s.hora_saida,
              'situacao', s.situacao,
              'status_frequencia', s.status_frequencia,
              'tem_justificativa_pendente', s.tem_justificativa_pendente
            ) ORDER BY s.nome)
          ) AS obj
        FROM situacoes s
        LEFT JOIN capacidades c ON c.hora_inicio = s.hora_inicio AND c.hora_fim = s.hora_fim
        WHERE s.dia_semana = v_dia_semana
        GROUP BY s.hora_inicio, s.hora_fim, c.capacidade_total
      ) x
    ), '[]'::json),
    'config', CASE
      WHEN v_config.id IS NULL THEN NULL::json
      ELSE json_build_object(
        'id', v_config.id,
        'vigencia_inicio', v_config.vigencia_inicio,
        'vigencia_fim', v_config.vigencia_fim,
        'status', v_config.status
      )
    END
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.monitor_presencas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monitor_presencas() TO authenticated, service_role;