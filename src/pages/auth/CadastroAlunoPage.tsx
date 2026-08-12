import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { UserPlus, ArrowLeft } from 'lucide-react';
import type { CadastroAlunoPageProps } from '../../types';

export const CadastroAlunoPage = ({ onVoltar }: CadastroAlunoPageProps) => {
  const { showToast } = useAuth();
  const [form, setForm] = useState({ nome: '', email: '', matricula: '', curso_id: '', periodo_id: '', turno_id: '', senha: '', confirmaSenha: '' });
  const [salvando, setSalvando] = useState(false);
  const [cursos, setCursos] = useState<Array<{ id: string; nome: string }>>([]);
  const [periodos, setPeriodos] = useState<Array<{ id: string; nome: string }>>([]);
  const [turnos, setTurnos] = useState<Array<{ id: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = useCallback(async () => {
    try {
      const [cursosRes, periodosRes, turnosRes] = await Promise.all([
        supabase.from('cursos').select('id, nome'),
        supabase.from('periodos').select('id, nome').eq('status', 'ativo'),
        supabase.from('turnos').select('id, nome').eq('status', 'ativo'),
      ]);
      if (!cursosRes.error && cursosRes.data) setCursos(cursosRes.data);
      if (!periodosRes.error && periodosRes.data) setPeriodos(periodosRes.data);
      if (!turnosRes.error && turnosRes.data) setTurnos(turnosRes.data);
    } catch {
      // Silencioso
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.nome || !form.email || !form.matricula || !form.curso_id || !form.periodo_id || !form.turno_id || !form.senha) {
      showToast('Preencha todos os campos obrigatorios.', 'erro');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      showToast('Informe um e-mail valido.', 'erro');
      return;
    }

    if (form.senha !== form.confirmaSenha) {
      showToast('As senhas nao conferem.', 'erro');
      return;
    }
    if (form.senha.length < 6) {
      showToast('A senha deve ter pelo menos 6 caracteres.', 'erro');
      return;
    }

    setSalvando(true);
    try {
      const { data: matriculaExistente } = await supabase
        .from('usuarios')
        .select('id')
        .eq('matricula', form.matricula)
        .maybeSingle();

      if (matriculaExistente) {
        showToast('Esta matricula ja esta cadastrada.', 'erro');
        setSalvando(false);
        return;
      }

      const { data: emailExistente } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', form.email)
        .maybeSingle();

      if (emailExistente) {
        showToast('Este e-mail ja esta cadastrado.', 'erro');
        setSalvando(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.senha,
        options: { data: { nome: form.nome, matricula: form.matricula, curso_id: form.curso_id, periodo_id: form.periodo_id, turno_id: form.turno_id } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Falha ao criar conta de autenticacao.');

      const { data: usuarioData, error: insertError } = await supabase
        .from('usuarios')
        .insert({
          auth_user_id: data.user.id,
          nome: form.nome,
          email: form.email,
          matricula: form.matricula,
          senha_hash: 'managed_by_auth',
          perfil: 'aluno',
          status: 'ativo',
          primeiro_acesso: 1,
          curso_id: Number(form.curso_id),
        } as never)
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao criar perfil:', insertError);
        showToast('Conta criada, mas houve um erro ao salvar seus dados. Faca login para completar seu cadastro.', 'erro');
        onVoltar();
        return;
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
          usuario_id: usuarioData.id,
          curso_id: Number(form.curso_id),
          periodo_id: Number(form.periodo_id),
          turno_id: Number(form.turno_id),
          carga_horaria_semanal_max: cargaPadrao,
          situacao: 'ativo',
        } as never);

      if (alunoError) {
        console.error('Erro ao criar registro de aluno:', alunoError);
      }

      showToast('Cadastro realizado! Voce ja pode fazer login.', 'sucesso');
      onVoltar();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar.';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        showToast('Este e-mail ja possui uma conta no sistema.', 'erro');
      } else if (msg.toLowerCase().includes('password')) {
        showToast('A senha nao atende aos requisitos minimos (6 caracteres).', 'erro');
      } else {
        showToast(msg, 'erro');
      }
    } finally {
      setSalvando(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    borderRadius: 8,
    border: '1.5px solid var(--border-color)',
    fontSize: '0.95rem',
    color: 'var(--text-dark)',
    background: '#FFF',
    outline: 'none',
    boxSizing: 'border-box',
  } as CSSProperties;

  const labelStyle = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-dark)',
    marginBottom: 6,
    display: 'block',
  } as CSSProperties;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Carregando opcoes...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 520, background: '#FFF', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '2.5rem 2rem' }}>
        <button onClick={onVoltar} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600, padding: 0, marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Voltar ao login
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <UserPlus size={28} color="#FFF" />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>Cadastro de Aluno</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>Crie sua conta para registrar sua presenca na Clinica-Escola</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={labelStyle}>Nome Completo *</label>
            <input type="text" required placeholder="Seu nome completo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>E-mail *</label>
            <input type="email" required placeholder="seu@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Matricula *</label>
            <input type="text" required placeholder="Sua matricula" value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Curso *</label>
            <select required value={form.curso_id} onChange={e => setForm({ ...form, curso_id: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
              <option value="">Selecione seu curso...</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Periodo *</label>
              <select required value={form.periodo_id} onChange={e => setForm({ ...form, periodo_id: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
                <option value="">Selecione...</option>
                {periodos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Turno *</label>
              <select required value={form.turno_id} onChange={e => setForm({ ...form, turno_id: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
                <option value="">Selecione...</option>
                {turnos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Senha *</label>
            <input type="password" required placeholder="Minimo 6 caracteres" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Confirmar Senha *</label>
            <input type="password" required placeholder="Repita a senha" value={form.confirmaSenha} onChange={e => setForm({ ...form, confirmaSenha: e.target.value })} style={inputStyle} />
          </div>
          <button type="submit" disabled={salvando} className="btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem' }}>
            {salvando ? 'Cadastrando...' : 'Criar Minha Conta'}
          </button>
        </form>
      </div>
    </div>
  );
};
