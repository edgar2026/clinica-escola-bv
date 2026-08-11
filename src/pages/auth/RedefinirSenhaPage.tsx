import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { KeyRound, LogOut } from 'lucide-react';

export const RedefinirSenhaPage = () => {
  const { showToast, logout, setUsuario, usuario } = useAuth();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const SENHA_TEMPORARIA = 'ser@2026';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!novaSenha || !confirmaSenha) {
      showToast('Preencha todos os campos.', 'erro');
      return;
    }

    if (novaSenha !== confirmaSenha) {
      showToast('As senhas nao conferem.', 'erro');
      return;
    }

    if (novaSenha.length < 6) {
      showToast('A senha deve ter pelo menos 6 caracteres.', 'erro');
      return;
    }

    if (novaSenha === SENHA_TEMPORARIA) {
      showToast('Nao e permitido usar a senha temporaria como nova senha.', 'erro');
      return;
    }

    setLoading(true);
    try {
      await authService.atualizarSenha(novaSenha);
      await authService.confirmarTrocaSenha();

      if (usuario) {
        setUsuario({ ...usuario, troca_senha_obrigatoria: false });
      }

      showToast('Senha alterada com sucesso! Bem-vindo ao sistema.', 'sucesso');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar senha.', 'erro');
    } finally {
      setLoading(false);
    }
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
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <KeyRound size={32} color="#D97706" />
          </div>
          <h2 style={{ color: 'var(--primary)', fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
            Criar Nova Senha
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
            Sua senha foi redefinida por um administrador. Crie uma nova senha para acessar o sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Nova Senha *</label>
            <input
              type="password"
              required
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Minimo 6 caracteres"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Confirmar Nova Senha *</label>
            <input
              type="password"
              required
              value={confirmaSenha}
              onChange={(e) => setConfirmaSenha(e.target.value)}
              placeholder="Repita a nova senha"
              style={inputStyle}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}>
            {loading ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={() => { logout(); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <LogOut size={14} /> Sair do Sistema
          </button>
        </div>
      </div>
    </div>
  );
};
