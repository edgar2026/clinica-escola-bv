import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { UserPlus, ArrowLeft } from 'lucide-react';

export const CadastroAlunoPage = ({ onVoltar }) => {
  const { showToast } = useAuth();
  const [form, setForm] = useState({ nome: '', matricula: '', curso_id: '', senha: '', confirmaSenha: '' });
  const [salvando, setSalvando] = useState(false);
  const [cursos, setCursos] = useState([]);

  const carregarCursos = useCallback(async () => {
    try {
      const data = await apiRequest('/auth/cursos');
      setCursos(data?.cursos || []);
    } catch {}
  }, []);

  useEffect(() => { carregarCursos(); }, [carregarCursos]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.nome || !form.matricula || !form.curso_id || !form.senha) {
      showToast('Preencha nome, matrícula, curso e senha.', 'erro');
      return;
    }
    if (form.senha !== form.confirmaSenha) {
      showToast('As senhas não conferem.', 'erro');
      return;
    }
    if (form.senha.trim().length < 4) {
      showToast('A senha deve ter pelo menos 4 caracteres.', 'erro');
      return;
    }

    setSalvando(true);
    try {
      const data = await apiRequest('/auth/cadastro-aluno', {
        method: 'POST',
        body: JSON.stringify({
          nome: form.nome,
          matricula: form.matricula,
          curso_id: form.curso_id,
          senha: form.senha,
        }),
      });

      if (data.token) {
        localStorage.setItem('uninassau_jwt_token', data.token);
      }
      showToast(data.mensagem || 'Cadastro realizado!', 'sucesso');
      window.location.reload();
    } catch (err) {
      showToast(err.message || 'Erro ao cadastrar.', 'erro');
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
  };

  const labelStyle = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-dark)',
    marginBottom: 6,
    display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#FFF', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '2.5rem 2rem' }}>
        <button onClick={onVoltar} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600, padding: 0, marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Voltar ao login
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <UserPlus size={28} color="#FFF" />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>Cadastro de Aluno</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>Crie sua conta para registrar sua presença na Clínica-Escola</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={labelStyle}>Nome Completo *</label>
            <input type="text" required placeholder="Seu nome completo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Matrícula *</label>
            <input type="text" required placeholder="Sua matrícula" value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Curso *</label>
            <select required value={form.curso_id} onChange={e => setForm({ ...form, curso_id: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
              <option value="">Selecione seu curso...</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Senha *</label>
            <input type="password" required placeholder="Mínimo 4 caracteres" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} style={inputStyle} />
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
