import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { KeyRound, CheckCircle2, X } from 'lucide-react';

export const LoginPage = ({ onCadastro }) => {
  const { login, showToast } = useAuth();
  const [loginInput, setLoginInput] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [loading, setLoading] = useState(false);

  // Modal de Redefinição de Senha (Esqueceu a Senha)
  const [modalResetOpen, setModalResetOpen] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [novaSenhaReset, setNovaSenhaReset] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginInput, senha, lembrar);
    } catch (err) {
      showToast(err.message, 'erro');
    } finally {
      setLoading(false);
    }
  };

  const handleRedefinirSenhaSubmit = async (e) => {
    e.preventDefault();
    if (!resetInput || !novaSenhaReset || novaSenhaReset.trim().length < 4) {
      showToast('Preencha o e-mail/matrícula e a nova senha (mínimo 4 caracteres).', 'erro');
      return;
    }

    setResetting(true);
    try {
      const res = await authService.redefinirSenhaDireta(resetInput, novaSenhaReset);
      showToast(res.mensagem || 'Senha redefinida com sucesso!', 'sucesso');
      
      // Preencher o formulário principal com as novas credenciais
      setLoginInput(resetInput);
      setSenha(novaSenhaReset);
      setModalResetOpen(false);
      setResetInput('');
      setNovaSenhaReset('');
    } catch (err) {
      showToast(err.message || 'Erro ao redefinir senha. Verifique o e-mail/matrícula.', 'erro');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1.5rem' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '2.5rem', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img 
            src="/logo.png" 
            alt="UNINASSAU Logo" 
            style={{ height: '90px', width: 'auto', objectFit: 'contain', marginBottom: '1rem' }} 
          />
          <h2 style={{ color: 'var(--primary)', marginTop: '0.25rem', fontSize: '1.35rem', fontWeight: 800 }}>
            Sistema de Controle de Ponto
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
            Clínica-Escola UNINASSAU
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
              Matrícula ou E-mail Institucional
            </label>
            <input 
              type="text" 
              required 
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="Digite seu e-mail ou matrícula" 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
              Senha de Acesso
            </label>
            <input 
              type="password" 
              required 
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••" 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} /> Lembrar acesso
            </label>
            <button
              type="button"
              onClick={() => { setModalResetOpen(true); setResetInput(loginInput); setNovaSenhaReset(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
            >
              Esqueceu a senha?
            </button>
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}>
            {loading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>

        {onCadastro && (
          <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Ainda não tem conta?{' '}
            <button type="button" onClick={onCadastro} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, padding: 0, fontSize: '0.88rem' }}>
              Criar minha conta
            </button>
          </div>
        )}
      </div>

      {/* ─── MODAL ESQUECEU A SENHA (REDEFINIÇÃO AUTO-SERVIÇO) ─── */}
      {modalResetOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={20} color="var(--primary)" /> Redefinir Senha de Acesso
              </h3>
              <button onClick={() => setModalResetOpen(false)} className="btn-close">&times;</button>
            </div>

            <form onSubmit={handleRedefinirSenhaSubmit}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Informe seu e-mail ou matrícula e digite a nova senha desejada para atualizar o seu acesso imediatamente.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                  Matrícula ou E-mail Cadastrado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Digite sua matricula ou e-mail"
                  value={resetInput}
                  onChange={e => setResetInput(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: 6, border: '1px solid var(--border-color)' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                  Nova Senha de Acesso *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={novaSenhaReset}
                  onChange={e => setNovaSenhaReset(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: 6, border: '1px solid var(--border-color)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalResetOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={resetting} className="btn-primary">
                  {resetting ? 'Atualizando...' : 'Redefinir Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
