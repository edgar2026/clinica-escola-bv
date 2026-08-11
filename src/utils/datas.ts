/**
 * Utilitários de Data/Hora em Português do Brasil (pt-BR)
 * Funções centralizadas para formatação consistente em todo o sistema.
 */

/**
 * Converte uma data ISO (YYYY-MM-DD) ou timestamp para DD/MM/YYYY.
 * Ex: '2026-07-28' → '28/07/2026'
 */
export function formatarData(dataStr: string): string {
  if (!dataStr) return '-';
  try {
    // Se já estiver no formato DD/MM/YYYY, retorna diretamente
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) return dataStr;
    // Se estiver no formato DD/MM (sem ano), retorna diretamente
    if (/^\d{2}\/\d{2}$/.test(dataStr)) return dataStr;

    // Para datas ISO (YYYY-MM-DD) — usa parseamento local para evitar offset UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    }

    // Para timestamps completos (com T e fuso)
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dataStr;
  }
}

/**
 * Converte uma data ISO (YYYY-MM-DD) para DD/MM (sem ano).
 * Ex: '2026-07-28' → '28/07'
 */
export function formatarDataCurta(dataStr: string): string {
  if (!dataStr) return '-';
  if (/^\d{2}\/\d{2}$/.test(dataStr)) return dataStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const [, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}`;
  }
  return formatarData(dataStr);
}

/**
 * Converte uma data ISO (YYYY-MM-DD) para formato longo em pt-BR.
 * Ex: '2026-07-28' → 'terça-feira, 28 de julho de 2026'
 */
export function formatarDataExtenso(dataStr: string, opcoes = {}): string {
  if (!dataStr) return '-';
  try {
    const dataNorm = /^\d{4}-\d{2}-\d{2}$/.test(dataStr) ? dataStr + 'T12:00:00' : dataStr;
    return new Date(dataNorm).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      ...opcoes
    });
  } catch {
    return dataStr;
  }
}

/**
 * Retorna o nome do dia da semana abreviado em pt-BR.
 * Ex: '2026-07-28' → 'Ter'
 */
export function formatarDiaSemana(dataStr: string, formato: 'long' | 'short' | 'narrow' = 'short'): string {
  if (!dataStr) return '-';
  try {
    const dataNorm = /^\d{4}-\d{2}-\d{2}$/.test(dataStr) ? dataStr + 'T12:00:00' : dataStr;
    return new Date(dataNorm).toLocaleDateString('pt-BR', { weekday: formato });
  } catch {
    return '-';
  }
}

/**
 * Formata um timestamp ISO completo para data e hora em pt-BR.
 * Ex: '2026-07-28T01:56:35.697555+00' → '28/07/2026, 22:56'
 */
export function formatarDataHora(timestampStr: string): string {
  if (!timestampStr) return '-';
  try {
    return new Date(timestampStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return timestampStr;
  }
}

/**
 * Formata um timestamp ISO para hora apenas em pt-BR.
 * Ex: '2026-07-28T01:56:35+00' → '22:56'
 */
export function formatarHora(timestampStr: string): string {
  if (!timestampStr) return '-';
  try {
    // Se já for HH:MM, retorna diretamente
    if (/^\d{2}:\d{2}$/.test(timestampStr)) return timestampStr;
    return new Date(timestampStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timestampStr;
  }
}

/**
 * Retorna a data de hoje no formato DD/MM/YYYY.
 */
export function hojeFormatado(): string {
  return new Date().toLocaleDateString('pt-BR');
}

/**
 * Retorna a data de hoje no formato ISO (YYYY-MM-DD).
 */
export function hojeISO(): string {
  return new Date().toISOString().split('T')[0];
}
