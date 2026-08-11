-- Atualizar CHECK constraint de status_frequencia para incluir novos valores
ALTER TABLE pontos DROP CONSTRAINT IF EXISTS pontos_status_frequencia_check;

ALTER TABLE pontos
ADD CONSTRAINT pontos_status_frequencia_check
CHECK (status_frequencia::text = ANY (ARRAY[
  'presenca_no_horario'::character varying,
  'entrada_antecipada'::character varying,
  'atraso'::character varying,
  'saida_antecipada'::character varying,
  'hora_extra'::character varying,
  'presenca_fora_horario'::character varying,
  'ausencia'::character varying,
  'falta_justificada'::character varying,
  'ponto_incompleto'::character varying,
  'aguardando_validacao'::character varying,
  'saida_nao_registrada'::character varying
]::text[]));

-- Adicionar coluna saida_sugerida na tabela justificativas
ALTER TABLE justificativas
ADD COLUMN IF NOT EXISTS saida_sugerida character varying;
