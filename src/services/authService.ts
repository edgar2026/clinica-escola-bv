import { supabase } from './supabaseClient';
import type { Usuario } from '../types';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

export const authService = {
  async login(email: string, password: string): Promise<{ user: User; session: Session }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user || !data.session) throw new Error('Falha na autenticacao');
    return { user: data.user, session: data.session };
  },

  async getMe(authUser?: User): Promise<{ user: User; profile: Usuario | null }> {
    let user: User;
    if (authUser) {
      user = authUser;
    } else {
      const { data: { user: fetched } } = await supabase.auth.getUser();
      if (!fetched) throw new Error('Usuario nao autenticado');
      user = fetched;
    }

    const { data: profile } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (profile && 'primeiro_acesso' in profile) {
      (profile as Record<string, unknown>).primeiroAcesso = (profile as Record<string, unknown>).primeiro_acesso;
    }

    if (profile && profile.primeiro_acesso === 1 && profile.perfil === 'aluno') {
      const { data: vinculo } = await supabase
        .from('alunos')
        .select('id, curso_id, periodo_id, turno_id, categoria_carga, categoria_carga_id, carga_horaria_semanal_max, situacao')
        .eq('usuario_id', profile.id)
        .maybeSingle();

      if (vinculo) {
        (profile as Record<string, unknown>).aluno = vinculo;
        const completo = vinculo.curso_id && vinculo.periodo_id && vinculo.turno_id;
        if (completo) {
          await supabase.from('usuarios').update({ primeiro_acesso: 0 } as never).eq('id', profile.id);
          (profile as Record<string, unknown>).primeiro_acesso = 0;
          (profile as Record<string, unknown>).primeiroAcesso = false;
        }
      }
    }

    if (!profile) {
      const meta = user.user_metadata || {};
      const nome = meta.nome || user.email || 'Aluno';
      const matricula = meta.matricula || '';
      const cursoId = meta.curso_id ? Number(meta.curso_id) : null;

      const { data: rpcResult, error: rpcError } = await supabase.rpc('cadastrar_aluno_inicial', {
        p_auth_user_id: user.id,
        p_nome: nome,
        p_email: user.email || '',
        p_matricula: matricula,
        p_curso_id: cursoId,
        p_periodo_id: meta.periodo_id ? Number(meta.periodo_id) : null,
        p_turno_id: meta.turno_id ? Number(meta.turno_id) : null,
      });

      if (rpcError || !rpcResult || !rpcResult.sucesso) {
        console.error('Erro ao reparar perfil automaticamente:', rpcError?.message || rpcResult?.mensagem);
        return { user, profile: null };
      }

      const { data: novoPerfil } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (novoPerfil) {
        if ('primeiro_acesso' in novoPerfil) {
          (novoPerfil as Record<string, unknown>).primeiroAcesso = (novoPerfil as Record<string, unknown>).primeiro_acesso;
        }
        return { user, profile: novoPerfil as Usuario };
      }

      return { user, profile: null };
    }

    return { user, profile: profile as Usuario };
  },

  async criarSolicitacaoResetSenha(email: string, motivo: string): Promise<{ sucesso: boolean; mensagem: string }> {
    const { data, error } = await supabase.rpc('criar_solicitacao_reset_senha', {
      p_email: email,
      p_motivo: motivo,
    });
    if (error) throw error;
    return data as { sucesso: boolean; mensagem: string };
  },

  async confirmarTrocaSenha(): Promise<void> {
    const { data, error } = await supabase.rpc('confirmar_troca_senha');
    if (error) throw error;
    if (data && typeof data === 'object' && 'sucesso' in data && !data.sucesso) {
      throw new Error(data.mensagem || 'Erro ao confirmar troca de senha.');
    }
  },

  async atualizarSenha(novaSenha: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw error;
  },

  async atualizarPerfil(dados: Partial<Usuario>): Promise<Usuario> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario nao autenticado');

    const { data, error } = await supabase
      .from('usuarios')
      .update(dados as never)
      .eq('auth_user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data as Usuario;
  },

  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },

  logout(): void {
    supabase.auth.signOut();
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
