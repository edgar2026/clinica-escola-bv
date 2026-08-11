import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { KeyRound, AlertCircle } from 'lucide-react';
import type { LoginPageProps } from '../../types';

export const LoginPage = ({ onCadastro }: LoginPageProps) => {
  const { login, showToast } = useAuth();
  const [loginInput, setLoginInput] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const [modalResetOpen, setModalResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMotivo, setResetMotivo] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetSucesso, setResetSucesso] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginInput, senha);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro no login', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const handleEsqueciSenhaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetMotivo || resetMotivo.trim().length < 5) {
      showToast('Preencha o e-mail e o motivo (minimo 5 caracteres).', 'erro');
      return;
    }

    setResetting(true);
    try {
      const { data, error } = await supabase.rpc('criar_solicitacao_reset_senha', {
        p_email: resetEmail,
        p_motivo: resetMotivo,
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'sucesso' in data) {
        if (data.sucesso) {
          setResetSucesso(true);
        } else {
          showToast(data.mensagem || 'Nao foi possível registrar a solicitacao.', 'erro');
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar solicitacao.', 'erro');
    } finally {
      setResetting(false);
    }
  };

  const fecharModalReset = () => {
    setModalResetOpen(false);
    setResetEmail('');
    setResetMotivo('');
    setResetSucesso(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    fontSize: '0.95rem',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-dark)',
    marginBottom: '0.35rem',
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
            Sistema de Controle de Presenca
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
            Clinica-Escola UNINASSAU
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>E-mail Institucional</label>
            <input
              type="email"
              required
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="Digite seu e-mail"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Senha de Acesso</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="........"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <button type="button" onClick={() => setModalResetOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              Esqueceu a senha?
            </button>
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}>
            {loading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>

        {onCadastro && (
          <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Ainda nao tem conta?{' '}
            <button type="button" onClick={onCadastro} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, padding: 0, fontSize: '0.88rem' }}>
              Criar minha conta
            </button>
          </div>
        )}
      </div>

      {modalResetOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={20} color="var(--primary)" /> Esqueci Minha Senha
              </h3>
              <button onClick={fecharModalReset} className="btn-close">&times;</button>
            </div>

            {!resetSucesso ? (
              <form onSubmit={handleEsqueciSenhaSubmit}>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Informe seu e-mail cadastrado e o motivo da solicitacao de redefinicao de senha.
                </p>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    E-mail Cadastrado *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 6, border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Motivo da Solicitacao *
                  </label>
                  <textarea
                    required
                    placeholder="Explique o motivo (minimo 5 caracteres)"
                    value={resetMotivo}
                    onChange={e => setResetMotivo(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 6, border: '1px solid var(--border-color)', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={fecharModalReset} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" disabled={resetting} className="btn-primary">
                    {resetting ? 'Enviando...' : 'Enviar Solicitacao'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem', background: '#EFF6FF', borderRadius: 8, marginBottom: '1.25rem' }}>
                  <AlertCircle size={20} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: '0.9rem', color: '#1E40AF', margin: 0, lineHeight: 1.5 }}>
                    Apos enviar a solicitacao, avise a recepcao da Clinica-Escola que esqueceu sua senha para agilizar o atendimento.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={fecharModalReset} className="btn-primary">
                    Entendido
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
