import { supabase } from './supabaseClient';
import { getAlunoId } from './helpers';
import type { SlotDisponibilidade, CalendarioMesResponse, Agendamento, DiaCalendario } from '../types';


export const agendamentoService = {
  async getDisponibilidade(
    setorId = '',
    diaSemana = 1,
    data = ''
  ): Promise<{ slots: SlotDisponibilidade[] }> {
    let query = supabase
      .from('horarios')
      .select('*, setores(nome)')
      .gte('vagas_disponiveis', 1)
      .eq('status', 'ativo')
      .eq('dia_semana', diaSemana);

    if (setorId) query = query.eq('setor_id', setorId);
    if (data) query = query.eq('data', data);

    const { data: rows, error } = await query;
    if (error) throw error;

    const slots: SlotDisponibilidade[] = (rows || []).map((r: Record<string, unknown>) => {
      const capacidade = (r.capacidade_max as number) || 8;
      const disponiveis = (r.vagas_disponiveis as number) || 0;
      const ocupadas = capacidade - disponiveis;
      const razao = capacidade > 0 ? ocupadas / capacidade : 1;
      let indicadorVisual: 'verde' | 'amarelo' | 'vermelho' = 'verde';
      if (razao >= 1) indicadorVisual = 'vermelho';
      else if (razao >= 0.7) indicadorVisual = 'amarelo';

      const setor = r.setores as { nome: string } | null;

      return {
        vaga_id: String(r.id),
        setor_id: String(r.setor_id),
        supervisor_id: String(r.supervisor_id),
        curso_id: '',
        dia_semana: r.dia_semana as number,
        hora_inicio: r.hora_inicio as string,
        hora_fim: r.hora_fim as string,
        capacidade_max: capacidade,
        vagas_disponiveis: disponiveis,
        vagas_ocupadas: ocupadas,
        setor_nome: setor?.nome || '',
        supervisor_nome: '',
        curso_nome: '',
        indicadorVisual,
      };
    });

    return { slots };
  },

  async getCalendarioMes(mes: number, ano: number): Promise<CalendarioMesResponse> {
    const { data, error } = await supabase
      .from('horarios')
      .select('*')
      .eq('status', 'ativo')
      .eq('mes', mes)
      .eq('ano', ano);
    
    if (error) throw error;

    const rows = data || [];
    const diasMap = new Map<string, { totalDisponiveis: number; capacidadeMax: number; diaSemana: number }>();

    for (const r of rows) {
      const key = r.data;
      const existing = diasMap.get(key) || { totalDisponiveis: 0, capacidadeMax: 0, diaSemana: r.dia_semana };
      existing.totalDisponiveis += r.vagas_disponiveis || 0;
      existing.capacidadeMax += r.capacidade_max || 0;
      diasMap.set(key, existing);
    }

    const dias: DiaCalendario[] = [];
    diasMap.forEach((val, dataStr) => {
      const temVagas = val.totalDisponiveis > 0;
      const razao = val.capacidadeMax > 0 ? val.totalDisponiveis / val.capacidadeMax : 0;
      let indicador: DiaCalendario['indicador'] = 'vazio';
      if (razao > 0.3) indicador = 'disponivel';
      else if (razao > 0) indicador = 'quase_lotado';
      else if (val.capacidadeMax > 0) indicador = 'lotado';

      dias.push({ data: dataStr, diaSemana: val.diaSemana, temVagas, indicador, totalDisponiveis: val.totalDisponiveis });
    });

    dias.sort((a, b) => a.data.localeCompare(b.data));
    return { dias, totalVagasAtivas: dias.filter(d => d.temVagas).length };
  },

  async getMeuHorarioFirmado(dataRef = ''): Promise<{ horariosFirmados: Agendamento[] }> {
    const alunoId = await getAlunoId();

    let query = supabase
      .from('agendamentos')
      .select('*, horarios(*, setores(*, clinicas(*)), vagas_horarios(*))')
      .eq('aluno_id', alunoId)
      .order('data', { ascending: true });

    if (dataRef) query = query.gte('data', dataRef);

    const { data, error } = await query;
    if (error) throw error;
    return { horariosFirmados: data || [] };
  },

  async criarAgendamento(vagaHorarioId: string, data: string): Promise<{ mensagem: string; agendamento: Agendamento }> {
    const alunoId = await getAlunoId();

    const horarioId = vagaHorarioId;
    const { data: horario } = await supabase
      .from('horarios')
      .select('setor_id, dia_semana, hora_inicio, hora_fim')
      .eq('id', horarioId)
      .single();

    let vagaHorarioReal = null;
    if (horario) {
      const { data } = await supabase
        .from('vagas_horarios')
        .select('id')
        .eq('setor_id', horario.setor_id)
        .eq('dia_semana', horario.dia_semana)
        .eq('hora_inicio', horario.hora_inicio)
        .eq('hora_fim', horario.hora_fim)
        .limit(1)
        .single();
      vagaHorarioReal = data;
    }

    const insertData: Record<string, unknown> = {
      aluno_id: alunoId,
      data,
      horario_id: horarioId,
    };
    if (vagaHorarioReal) {
      insertData.vaga_horario_id = vagaHorarioReal.id;
    } else {
      const { data: anyVaga } = await supabase.from('vagas_horarios').select('id').limit(1).single();
      if (anyVaga) insertData.vaga_horario_id = anyVaga.id;
    }

    if (horario) {
      insertData.hora_inicio = horario.hora_inicio;
      insertData.hora_fim = horario.hora_fim;
      insertData.dia_semana = horario.dia_semana;
      insertData.horas_computadas = 3;
    }

    const { data: result, error } = await supabase
      .from('agendamentos')
      .insert(insertData as never)
      .select()
      .single();
    
    if (error) throw error;
    return { mensagem: 'Agendamento criado com sucesso.', agendamento: result };
  },

  async cancelarAgendamento(agendamentoId: string): Promise<{ mensagem: string }> {
    const { error } = await supabase
      .from('agendamentos')
      .delete()
      .eq('id', agendamentoId)
      .select()
      .single();
    
    if (error) throw error;
    return { mensagem: 'Agendamento cancelado com sucesso.' };
  },

  async entrarListaEspera(vagaHorarioId: string, data: string): Promise<{ mensagem: string; inscricao: unknown }> {
    const alunoId = await getAlunoId();

    const { data: result, error } = await supabase
      .from('lista_espera')
      .insert({ vaga_horario_id: vagaHorarioId, aluno_id: alunoId, data } as never)
      .select()
      .single();
    
    if (error) throw error;
    return { mensagem: 'Inserido na lista de espera.', inscricao: result };
  },
};
