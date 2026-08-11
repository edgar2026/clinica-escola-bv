import { supabase } from './supabaseClient';

export async function getUsuarioId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!usuario) throw new Error('Perfil de usuário não encontrado');
  return usuario.id;
}

export async function getAlunoId(): Promise<string> {
  const usuarioId = await getUsuarioId();
  const { data: aluno } = await supabase
    .from('alunos')
    .select('id')
    .eq('usuario_id', usuarioId)
    .single();

  if (!aluno) throw new Error('Registro de aluno não encontrado');
  return String(aluno.id);
}
