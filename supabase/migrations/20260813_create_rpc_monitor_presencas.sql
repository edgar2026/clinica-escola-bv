-- RPC monitor_presencas: painel administrativo/gerência com DADOS REAIS persistidos,
-- relacionando usuário, aluno, carga semanal, horários firmados (grade confirmada)
-- e registros de presença. Sem arrays/mocks/valores simulados.

CREATE OR REPLACE FUNCTION public.monitor_presencas()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config RECORD;
  v_metricas json;
  v_alunos json;
BEGIN
  SELECT id, vigencia_inicio, vigencia_fim, status INTO v_config
  FROM grade_semanal_config
  WHERE status = 'ativa'
  ORDER BY criado_em DESC
  LIMIT 1;

  WITH grade_confirmada AS (
    SELECT aluno_id,
           max(confirmado_em) AS confirmado_em,
           string_agg(
             'dia ' || gs.dia_semana || ' ' || gs.hora_inicio || '-' || gs.hora_fim,
             ', ' ORDER BY gs.dia_semana, gs.hora_inicio
           ) AS horarios_firmados
    FROM grade_semanal_selecoes gs
    WHERE gs.confirmado = true
    GROUP BY aluno_id
  ),
  presencas AS (
    SELECT aluno_id,
           COUNT(*)::integer AS total_presencas,
           COALESCE(SUM(tempo_total_minutos), 0)::integer AS minutos_totais,
           COALESCE(SUM(tempo_total_minutos) FILTER (WHERE status_frequencia = 'presenca_no_horario'), 0)::integer AS minutos_validados,
           MAX(data) AS ultima_data,
           COUNT(*) FILTER (WHERE data = CURRENT_DATE)::integer AS presencas_hoje,
           COUNT(*) FILTER (WHERE data = CURRENT_DATE AND hora_saida IS NULL)::integer AS presente_agora,
           COUNT(*) FILTER (WHERE data = CURRENT_DATE AND status_frequencia = 'atraso')::integer AS atrasos_hoje
    FROM pontos
    GROUP BY aluno_id
  )
  SELECT json_agg(x.obj) INTO v_alunos
  FROM (
    SELECT json_build_object(
      'aluno_id', a.id,
      'usuario_id', u.id,
      'nome', u.nome,
      'matricula', u.matricula,
      'email', u.email,
      'curso_id', a.curso_id,
      'curso_nome', c.nome,
      'periodo_nome', p.nome,
      'turno_nome', t.nome,
      'setor_id', a.setor_id,
      'setor_nome', sc.nome,
      'carga_horaria_semanal', COALESCE(a.carga_horaria_semanal_max, 4),
      'categoria_carga_horas', cch.horas_semanais,
      'situacao', a.situacao,
      'grade_confirmada', COALESCE(gc.confirmado_em IS NOT NULL, false),
      'confirmado_em', gc.confirmado_em,
      'horarios_firmados', gc.horarios_firmados,
      'config_id', v_config.id,
      'vigencia_inicio', v_config.vigencia_inicio,
      'vigencia_fim', v_config.vigencia_fim,
      'config_status', v_config.status,
      'total_presencas', COALESCE(pr.total_presencas, 0),
      'horas_cumpridas', round(COALESCE(pr.minutos_validados, 0) / 60.0, 1),
      'ultima_presenca_data', pr.ultima_data,
      'presencas_hoje', COALESCE(pr.presencas_hoje, 0),
      'presente_agora', COALESCE(pr.presente_agora, 0) > 0,
      'atrasos_hoje', COALESCE(pr.atrasos_hoje, 0)
    ) AS obj
    FROM alunos a
    JOIN usuarios u ON u.id = a.usuario_id
    LEFT JOIN cursos c ON c.id = a.curso_id
    LEFT JOIN periodos p ON p.id = a.periodo_id
    LEFT JOIN turnos t ON t.id = a.turno_id
    LEFT JOIN setores_clinica sc ON sc.id = a.setor_id
    LEFT JOIN categorias_carga_horaria cch ON cch.id = a.categoria_carga_id
    LEFT JOIN grade_confirmada gc ON gc.aluno_id = a.id
    LEFT JOIN presencas pr ON pr.aluno_id = a.id
    ORDER BY u.nome
  ) x;

  v_metricas := json_build_object(
    'total_alunos', (SELECT COUNT(*)::integer FROM alunos),
    'alunos_ativos', (SELECT COUNT(*)::integer FROM alunos WHERE situacao = 'ativo'),
    'presentes_agora', COALESCE((SELECT COUNT(*)::integer FROM pontos WHERE data = CURRENT_DATE AND hora_saida IS NULL), 0),
    'atrasados_hoje', COALESCE((SELECT COUNT(*)::integer FROM pontos WHERE data = CURRENT_DATE AND status_frequencia = 'atraso'), 0),
    'solicitacoes_pendentes', COALESCE((SELECT COUNT(*)::integer FROM justificativas WHERE status = 'pendente'), 0),
    'slots_com_vagas', COALESCE((SELECT COUNT(*)::integer FROM vagas_horarios WHERE status = 'ativo' AND vagas_disponiveis > 0), 0),
    'grades_confirmadas', COALESCE((SELECT COUNT(*)::integer FROM (SELECT DISTINCT aluno_id FROM grade_semanal_selecoes WHERE confirmado = true) g), 0)
  );

  RETURN json_build_object(
    'metricas', v_metricas,
    'alunos', COALESCE(v_alunos, '[]'::json),
    'config', json_build_object(
      'id', v_config.id,
      'vigencia_inicio', v_config.vigencia_inicio,
      'vigencia_fim', v_config.vigencia_fim,
      'status', v_config.status
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.monitor_presencas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monitor_presencas() TO authenticated, service_role;
