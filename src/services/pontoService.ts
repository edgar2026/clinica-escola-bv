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
    _anexoUrl?: string
  ): Promise<{ mensagem: string }> {
    const { error } = await supabase
      .from('pontos')
      .update({ observacao: `${motivo}: ${descricao}`, status_frequencia: 'aguardando_validacao' } as never)
      .eq('id', pontoId)
      .select()
      .single();

    if (error) throw error;
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

    return (data || []).map((j: Record<string, unknown>) => {
      const ponto = j.pontos as Record<string, unknown> | null;
      const aluno = ponto?.alunos as Record<string, unknown> | null;
      const usuario = aluno?.usuarios as Record<string, unknown> | null;
      return {
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
      } as Ponto;
    });
  },
};
