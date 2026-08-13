import type { User } from '@supabase/supabase-js';

export type Perfil = 'aluno' | 'gerencia' | 'admin';
export type StatusUsuario = 'ativo' | 'bloqueado' | 'inativo' | 'suspenso';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  cpf?: string;
  telefone?: string;
  email_pessoal?: string;
  endereco?: string;
  data_nascimento?: string;
  perfil: Perfil;
  status: StatusUsuario;
  primeiroAcesso?: boolean;
  curso_id?: string;
  periodo_id?: string;
  turno_id?: string;
  curso_nome?: string;
  periodo_nome?: string;
  turno_nome?: string;
  periodo_codigo?: string;
  turno_codigo?: string;
  criado_em?: string;
  horas_carga_semana?: number;
  carga_horaria_max?: number;
  total_horas?: number;
  auth_user_id?: string;
  tem_perfil?: boolean;
  troca_senha_obrigatoria?: boolean;
  aluno?: AlunoDetalhes;
}

export interface AlunoDetalhes {
  id: string;
  usuario_id: string;
  matricula: string;
  curso_id: string;
  periodo_id: string;
  turno_id: string;
  setor_id?: string;
  categoria_carga: number;
  categoria_carga_id?: number;
  carga_horaria_semanal_max: number;
  carga_horaria_total: number;
  data_inicio?: string | null;
  data_termino?: string | null;
  situacao: string;
  curso_nome?: string;
  periodo_nome?: string;
  turno_nome?: string;
  setor_nome?: string;
  periodo_codigo?: string;
  turno_codigo?: string;
}

export interface Ponto {
  id: string;
  aluno_id: string;
  data_ponto: string;
  data?: string;
  hora_entrada?: string;
  hora_saida?: string;
  tipo_registro: string;
  acao: 'entrada' | 'saida';
  qr_code_validacao?: string;
  pin_validacao?: string;
  status_frequencia: 'presenca_no_horario' | 'atraso' | 'ausencia' | 'presenca_fora_horario' | 'hora_extra' | string;
  tempo_total_minutos?: number;
  justificativa_motivo?: string;
  justificativa_descricao?: string;
  observacao?: string;
  aluno_nome?: string;
  matricula?: string;
  curso_nome?: string;
  setor_nome?: string;
  ponto_id?: string;
  data_falta?: string;
  anexo_nome?: string;
  arquivo_comprovante?: string;
  tipo?: string;
  descricao?: string;
  motivo?: string;
  justificativa?: string;
  status?: string;
  validacao_parecer?: string;
  saida_sugerida?: string;
  horario_firmado_inicio?: string;
  horario_firmado_fim?: string;
  justificativa_id?: string;
}

export interface HistoricoPontoResponse {
  historico: Ponto[];
}

export interface Agendamento {
  id: string;
  agendamento_id?: string;
  vaga_horario_id: string;
  aluno_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  setor_nome: string;
  supervisor_nome?: string;
  horas_computadas: number;
  status: 'confirmado' | 'cancelado' | 'concluido';
  dia_semana?: number;
  horarios?: HorarioCompleto;
}

export interface HorarioCompleto {
  id: string;
  setor_id: string;
  supervisor_id: string;
  curso_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  capacidade_max: number;
  vagas_disponiveis: number;
  setores?: Setor;
  clinicas?: Clinica;
  vagas_horarios?: VagaHorario[];
}

export interface Setor {
  id: string;
  nome: string;
  unidade_id?: string;
  unidade_nome?: string;
  capacidade_padrao: number;
}

export interface Clinica {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  telefone: string;
  email: string;
}

export interface VagaHorario {
  id: string;
  setor_id: string;
  supervisor_id: string;
  curso_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  capacidade_max: number;
  vagas_disponiveis: number;
  setor_nome?: string;
  supervisor_nome?: string;
  curso_nome?: string;
  status?: 'ativo' | 'suspenso';
}

export interface Curso {
  id: string;
  nome: string;
  codigo: string;
  descricao?: string;
}

export interface Periodo {
  id: string;
  nome: string;
  codigo: string;
}

export interface Turno {
  id: string;
  nome: string;
  codigo: string;
  hora_inicio: string;
  hora_fim: string;
}

export interface Especialidade {
  id: string;
  nome: string;
  descricao?: string;
}

export interface Professor {
  id: string;
  nome: string;
}

export interface Vinculo {
  id: string;
  aluno_nome?: string;
  curso_nome?: string;
  periodo_nome?: string;
  turno_nome?: string;
  setor_nome?: string;
  curso_id?: string;
  periodo_id?: string;
  turno_id?: string;
  setor_id?: string;
  carga_horaria_semanal_max?: number;
  situacao?: string;
}

export interface Supervisor {
  id: string;
  nome: string;
  usuario_nome?: string;
  curso_id: string;
  curso_nome?: string;
}

export interface Unidade {
  id: string;
  nome: string;
}

export interface HorarioFuncionamento {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_intervalo_min: number;
}

export interface Feriado {
  id: string;
  data: string;
  descricao: string;
  tipo: 'feriado' | 'recesso' | 'bloqueio' | 'manutencao';
}

export interface Regra {
  chave: string;
  valor: string;
  categoria?: string;
}

export interface Configuracao {
  id: string;
  chave: string;
  valor: string;
}

export interface AuditoriaLog {
  id: string;
  criado_em: string;
  usuario_nome: string;
  matricula: string;
  acao: string;
  entidade: string;
  entidade_id: string;
  justificativa: string;
  ip: string;
  dispositivo: string;
}

export interface OpcoesCadastro {
  cursos: Curso[];
  periodos: Periodo[];
  turnos: Turno[];
  situacoes?: string[];
}

export interface DashboardMetricas {
  totalAlunosCadastrados: number;
  alunosPresentesAgora: number;
  alunosAtrasadosHoje: number;
  justificativasPendentes: number;
  slotsComVagas: number;
}

export interface DashboardData {
  metricas: DashboardMetricas;
  presentesNoMomento: Ponto[];
  pendenciasForaHorario: Ponto[];
}

export interface RelatorioData {
  tipo: string;
  total: number;
  dados: (Ponto & { aluno_nome: string; matricula: string; curso_nome: string })[];
}

export interface AuthUser extends User {}

export interface ToastMessage {
  mensagem: string;
  tipo: 'sucesso' | 'erro' | 'alerta' | 'info';
}

export interface AuthContextValue {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  showToast: (mensagem: string, tipo?: ToastMessage['tipo']) => void;
  toastMessage: ToastMessage | null;
  setUsuario: React.Dispatch<React.SetStateAction<Usuario | null>>;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
  isPrompt?: boolean;
  promptPlaceholder?: string;
  promptValue?: string;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  accent?: string;
  children?: React.ReactNode;
}

export interface NavbarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export interface CadastroAlunoPageProps {
  onVoltar: () => void;
}

export interface SlotDisponibilidade {
  vaga_id: string;
  setor_id: string;
  supervisor_id: string;
  curso_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  capacidade_max: number;
  vagas_disponiveis: number;
  vagas_ocupadas: number;
  setor_nome: string;
  supervisor_nome: string;
  curso_nome: string;
  indicadorVisual: 'verde' | 'amarelo' | 'vermelho';
}

export interface DiaCalendario {
  data: string;
  diaSemana: number;
  temVagas: boolean;
  indicador: 'disponivel' | 'quase_lotado' | 'lotado' | 'vazio';
  totalDisponiveis: number;
}

export interface CalendarioMesResponse {
  dias: DiaCalendario[];
  totalVagasAtivas: number;
}

export interface SolicitacaoResetSenha {
  id: number;
  usuario_id: number;
  nome_usuario: string;
  email: string;
  matricula: string;
  curso_id: number;
  curso_nome: string;
  motivo: string;
  status: 'pendente' | 'atendida' | 'cancelada';
  criado_em: string;
  atendida_em?: string;
  atendida_por?: number;
  admin_nome?: string;
}

export interface CategoriaCargaHoraria {
  id: number;
  nome: string;
  horas_semanais: number;
  descricao?: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface UsuarioComAluno extends Usuario {
  aluno_id?: number;
  carga_horaria_semanal?: number;
  carga_horaria_total?: number;
  data_inicio?: string | null;
  categoria_carga_id?: number;
  categoria_carga_horas?: number;
  periodo_id?: string;
  periodo_nome?: string;
  turno_id?: string;
  turno_nome?: string;
  setor_id?: string;
  setor_nome?: string;
  situacao_vinculo?: string;
  aluno_curso_id?: string;
  aluno_curso_nome?: string;
}

export interface LoginPageProps {
  onCadastro?: () => void;
  onRedefinirSenha?: () => void;
}

export interface SelecaoGradeFirmada {
  id: number;
  vaga_horario_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  confirmado: boolean;
  confirmado_em?: string | null;
  setor_nome?: string | null;
  setor_id?: number | null;
  vagas_disponiveis?: number;
}

export interface GradeFirmadaInfo {
  sucesso: boolean;
  tem_grade: boolean;
  confirmado: boolean;
  confirmado_em?: string | null;
  selecoes: SelecaoGradeFirmada[];
  config_id: number | null;
  inscricao_inicio?: string | null;
  inscricao_fim?: string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  config_status?: string | null;
  categoria_carga: number;
  horas_firmadas_minutos?: number;
  horas_rascunho_minutos?: number;
  total_horas_selecionadas_minutos?: number;
  campos_pendentes?: string[];
  pode_exibir_grade?: boolean;
}

export type SituacaoMonitor =
  | 'aguardando'
  | 'presente'
  | 'atrasado'
  | 'finalizado'
  | 'ausente'
  | 'saida_nao_registrada'
  | 'em_analise';

export interface MonitorAlunoFaixa {
  aluno_id: number;
  usuario_id: number;
  nome: string;
  matricula: string;
  curso_nome: string | null;
  vaga_horario_id: number;
  setor_nome: string | null;
  hora_entrada: string | null;
  hora_saida: string | null;
  situacao: SituacaoMonitor;
  status_frequencia: string | null;
  tem_justificativa_pendente: boolean;
}

export interface MonitorFaixa {
  hora_inicio: string;
  hora_fim: string;
  setores: string;
  capacidade_total: number;
  alunos_esperados: number;
  presentes_agora: number;
  ainda_nao_chegaram: number;
  atrasados: number;
  saidos: number;
  ausentes: number;
  alunos: MonitorAlunoFaixa[];
}

export interface MonitorPresencas {
  metricas: {
    total_alunos: number;
    alunos_ativos: number;
    presentes_agora: number;
    atrasados_hoje: number;
    solicitacoes_pendentes: number;
    slots_com_vagas: number;
    grades_confirmadas: number;
    hoje_data: string;
    hoje_dia_semana: number;
    hora_atual: string;
  };
  faixas: MonitorFaixa[];
  config: {
    id: number | null;
    vigencia_inicio: string | null;
    vigencia_fim: string | null;
    status: string | null;
  };
}
