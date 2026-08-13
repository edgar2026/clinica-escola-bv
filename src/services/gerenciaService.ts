import { supabase } from './supabaseClient';
import type { DashboardData, RelatorioData, Ponto, MonitorPresencas } from '../types';


export const gerenciaService = {
  async getMonitorPresencas(): Promise<MonitorPresencas> {
    const { data, error } = await supabase.rpc('monitor_presencas');
    if (error) throw error;
    return data as MonitorPresencas;
  },

  async getDashboardData(): Promise<DashboardData> {
    const { data: alunos } = await supabase.from('alunos').select('*');
    const hoje = new Date().toISOString().split('T')[0];
    const { data: pontos } = await supabase.from('pontos').select('*').gte('data', hoje);
    const { data: pendentes } = await supabase.from('pontos').select('*').eq('status_frequencia', 'aguardando_validacao');

    return {
      metricas: {
        totalAlunosCadastrados: alunos?.length || 0,
        alunosPresentesAgora: pontos?.filter((p: Record<string, unknown>) => p.hora_saida === null).length || 0,
        alunosAtrasadosHoje: pontos?.filter((p: Record<string, unknown>) => p.status_frequencia === 'atraso').length || 0,
        justificativasPendentes: pendentes?.length || 0,
        slotsComVagas: 0,
      },
      presentesNoMomento: (pontos as Ponto[]) || [],
      pendenciasForaHorario: (pendentes as Ponto[]) || [],
    };
  },

  async validarForaHorario(
    pontoId: string,
    acao: 'aprovar' | 'rejeitar',
    parecer: string
  ): Promise<{ mensagem: string }> {
    const novoStatus = acao === 'aprovar' ? 'presenca_no_horario' : 'ausencia';
    const { error } = await supabase
      .from('pontos')
      .update({ status_frequencia: novoStatus, observacao: parecer } as never)
      .eq('id', pontoId)
      .select()
      .single();

    if (error) throw error;
    return { mensagem: `Presença ${acao === 'aprovar' ? 'aprovada' : 'rejeitada'} com sucesso.` };
  },

  async getRelatorio(tipo: string, dataIni: string, dataFim: string): Promise<RelatorioData> {
    let query = supabase
      .from('pontos')
      .select('*, alunos(nome, matricula, curso_nome), horarios(hora_inicio, hora_fim)')
      .gte('data', dataIni)
      .lte('data', dataFim);

    const { data, error } = await query;
    if (error) throw error;

    let dados = (data || []) as (Ponto & { aluno_nome: string; matricula: string; curso_nome: string })[];
    if (tipo === 'Atrasos e Faltas') {
      dados = dados.filter(d => d.status_frequencia === 'atraso' || d.status_frequencia === 'ausencia');
    } else if (tipo === 'Presenças Fora do Horário') {
      dados = dados.filter(d => d.status_frequencia === 'presenca_fora_horario');
    }

    return {
      tipo,
      total: dados.length,
      dados,
    };
  },
};
