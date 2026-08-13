import { supabase } from './supabaseClient';
import { getAlunoId } from './helpers';
import type { Ponto, HistoricoPontoResponse } from '../types';

export interface RegistrarPresencaResponse {
  acao: 'entrada' | 'saida' | 'bloqueado';
  ponto_id?: number;
  mensagem: string;
  hora?: string;
  segundos_restantantes?: number;
}

export interface FecharPontosResponse {
  registros_fechados: number;
  mensagem: string;
}

export interface SolicitarAjusteResponse {
  sucesso: boolean;
  mensagem: string;
  justificativa_id?: number;
}

export interface AnalisarSolicitacaoResponse {
  sucesso: boolean;
  mensagem: string;
  acao?: string;
  novo_status?: string;
}

export const pontoService = {
  async registrarPonto(alunoId?: string): Promise<RegistrarPresencaResponse> {
    const alunoIdEff = alunoId || await getAlunoId();
    if (!alunoIdEff) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .rpc('registrar_presenca', { p_aluno_id: Number(alunoIdEff) });

    if (error) throw error;
    return data as RegistrarPresencaResponse;
  },

  async fecharPontosAbertos(): Promise<FecharPontosResponse> {
    const { data, error } = await supabase.rpc('fechar_pontos_abertos');
    if (error) throw error;
    return data as FecharPontosResponse;
  },

  async getHistoricoAluno(): Promise<HistoricoPontoResponse> {
    const alunoId = await getAlunoId();

    const { data, error } = await supabase
      .from('pontos')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('data', { ascending: false });

    if (error) throw error;
    return { historico: (data as Ponto[]) || [] };
  },

  async getStatusHoje(): Promise<{ podeRegistrar: boolean; pontoAberto: boolean; mensagem: string; entradaAberta?: Ponto }> {
    const alunoId = await getAlunoId();

    const hoje = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('pontos')
      .select('*')
      .eq('aluno_id', alunoId)
      .eq('data', hoje)
      .order('criado_em', { ascending: false });

    if (error) throw error;

    const pontosHoje = (data || []) as Ponto[];
    const entradaAberta = pontosHoje.find(p => !p.hora_saida);

    return {
      podeRegistrar: true,
      pontoAberto: !!entradaAberta,
      entradaAberta: entradaAberta || undefined,
      mensagem: entradaAberta
        ? 'Você já possui uma entrada aberta. Registre sua saída.'
        : 'Nenhum registro hoje. Bem-vindo!',
    };
  },

  async submeterJustificativa(
    pontoId: string,
    motivo: string,
    descricao: string,
    anexoUrl?: string
  ): Promise<{ mensagem: string }> {
    const { data: ponto, error: pontoError } = await supabase
      .from('pontos')
      .select('aluno_id')
      .eq('id', pontoId)
      .single();

    if (pontoError || !ponto) throw new Error('Registro não encontrado.');

    const { error: justError } = await supabase
      .from('justificativas')
      .insert({
        aluno_id: ponto.aluno_id,
        ponto_id: Number(pontoId),
        motivo,
        descricao,
        arquivo_comprovante: anexoUrl || null,
        status: 'pendente',
      } as never);

    if (justError) throw justError;

    const { error: pontoUpdateError } = await supabase
      .from('pontos')
      .update({ observacao: `${motivo}: ${descricao}`, status_frequencia: 'aguardando_validacao' } as never)
      .eq('id', pontoId);

    if (pontoUpdateError) throw pontoUpdateError;

    return { mensagem: 'Justificativa submetida com sucesso.' };
  },

  async solicitarAjusteSaida(
    pontoId: string,
    saidaSugerida: string,
    justificativa: string
  ): Promise<SolicitarAjusteResponse> {
    const { data, error } = await supabase
      .rpc('solicitar_ajuste_saida', {
        p_ponto_id: Number(pontoId),
        p_saida_sugerida: saidaSugerida,
        p_justificativa: justificativa,
      });

    if (error) throw error;
    return data as SolicitarAjusteResponse;
  },

  async analisarSolicitacao(
    justificativaId: string,
    acao: 'aprovar' | 'corrigir' | 'rejeitar',
    parecer: string,
    saidaCorrigida?: string
  ): Promise<AnalisarSolicitacaoResponse> {
    const { data, error } = await supabase
      .rpc('analisar_solicitacao', {
        p_justificativa_id: Number(justificativaId),
        p_acao: acao,
        p_parecer: parecer,
        p_saida_corrigida: saidaCorrigida || null,
      });

    if (error) throw error;
    return data as AnalisarSolicitacaoResponse;
  },

  async getSolicitacoesPendentes(): Promise<Ponto[]> {
    const { data, error } = await supabase
      .from('justificativas')
      .select('*, pontos(*, alunos(*, usuarios(*)))')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false });

    if (error) throw error;

    const results: Ponto[] = [];

    for (const j of (data || []) as Record<string, unknown>[]) {
      const ponto = j.pontos as Record<string, unknown> | null;
      const aluno = ponto?.alunos as Record<string, unknown> | null;
      const usuario = aluno?.usuarios as Record<string, unknown> | null;

      let horarioFirmadoInicio = '';
      let horarioFirmadoFim = '';

      if (aluno?.id && ponto?.data) {
        const pontoDate = new Date(ponto.data as string + 'T12:00:00');
        let dow = pontoDate.getDay();
        if (dow === 0) dow = 7;

        const { data: gradeData } = await supabase
          .from('grade_semanal_selecoes')
          .select('hora_inicio, hora_fim')
          .eq('aluno_id', Number(aluno.id))
          .eq('confirmado', true)
          .eq('dia_semana', dow)
          .limit(1);

        if (gradeData && gradeData.length > 0) {
          horarioFirmadoInicio = String(gradeData[0].hora_inicio || '');
          horarioFirmadoFim = String(gradeData[0].hora_fim || '');
        }
      }

      results.push({
        id: String(j.id),
        ponto_id: String(j.ponto_id),
        aluno_id: String(aluno?.id || ''),
        data: String(ponto?.data || ''),
        hora_entrada: String(ponto?.hora_entrada || ''),
        hora_saida: String(ponto?.hora_saida || ''),
        status_frequencia: String(ponto?.status_frequencia || ''),
        tempo_total_minutos: Number(ponto?.tempo_total_minutos || 0),
        aluno_nome: String(usuario?.nome || ''),
        matricula: String(usuario?.matricula || ''),
        curso_nome: '',
        setor_nome: '',
        motivo: String(j.motivo || ''),
        descricao: String(j.descricao || ''),
        observacao: String(j.parecer_gerencia || ''),
        data_falta: String(ponto?.data || ''),
        arquivo_comprovante: String(j.arquivo_comprovante || ''),
        tipo: String(j.motivo || ''),
        justificativa: String(j.descricao || ''),
        saida_sugerida: String(j.saida_sugerida || ''),
        horario_firmado_inicio: horarioFirmadoInicio,
        horario_firmado_fim: horarioFirmadoFim,
      } as Ponto);
    }

    return results;
  },
};
