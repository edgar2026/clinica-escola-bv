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

    if (!profile) {
      const meta = user.user_metadata || {};
      const nome = meta.nome || user.email || 'Aluno';
      const matricula = meta.matricula || '';
      const cursoId = meta.curso_id ? Number(meta.curso_id) : null;

      const { data: novoPerfil } = await supabase
        .from('usuarios')
        .upsert({
          auth_user_id: user.id,
          nome,
          email: user.email || '',
          matricula,
          senha_hash: 'managed_by_auth',
          perfil: 'aluno',
          status: 'ativo',
          primeiro_acesso: 1,
          curso_id: cursoId,
        } as never, { onConflict: 'auth_user_id', ignoreDuplicates: false })
        .select()
        .single();

      if (novoPerfil) {
        if ('primeiro_acesso' in novoPerfil) {
          (novoPerfil as Record<string, unknown>).primeiroAcesso = (novoPerfil as Record<string, unknown>).primeiro_acesso;
        }

        const { data: configPadrao } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'carga_horaria_semanal_padrao')
          .maybeSingle();
        const cargaPadrao = configPadrao?.valor ? Number(configPadrao.valor) : 4;

        const { error: alunoError } = await supabase
          .from('alunos')
          .insert({
            usuario_id: novoPerfil.id,
            curso_id: cursoId,
            periodo_id: meta.periodo_id ? Number(meta.periodo_id) : null,
            turno_id: meta.turno_id ? Number(meta.turno_id) : null,
            carga_horaria_semanal_max: cargaPadrao,
            situacao: 'ativo',
          } as never);
        if (alunoError) {
          console.error('Erro ao criar registro de aluno (auto):', alunoError);
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
