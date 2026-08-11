import { useAuth } from '../../context/AuthContext';
import { LogOut, Menu, X } from 'lucide-react';
import type { NavbarProps } from '../../types';

export const Navbar = ({ sidebarOpen, setSidebarOpen }: NavbarProps) => {
  const { usuario, logout } = useAuth();

  if (!usuario) return null;

  return (
    <header className="top-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="mobile-menu-btn"
          aria-label="Abrir Menu"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className="brand-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src="/logo.png"
            alt="UNINASSAU Logo"
            style={{ height: '38px', width: 'auto', objectFit: 'contain', background: '#FFF', padding: '2px 4px', borderRadius: '6px' }}
          />
          <div className="brand-title">
            <span className="brand-main-text">Clínica-Escola UNINASSAU</span>
            <span className="brand-subtitle">Sistema de Controle de Presença</span>
          </div>
        </div>
      </div>

      <div className="user-nav-info">
        <div className="user-badge">
          <div className="avatar">
            {usuario.nome ? usuario.nome.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-name-container">
            <strong style={{ display: 'block', fontSize: '0.88rem' }}>{usuario.nome}</strong>
            <span style={{ color: 'var(--secondary)', fontSize: '0.72rem' }}>
              [{usuario.perfil?.toUpperCase()}]
            </span>
          </div>
        </div>

        <button onClick={logout} className="btn-logout" title="Encerrar Sessão">
          <LogOut size={15} style={{ verticalAlign: 'middle' }} />
          <span className="btn-logout-text">Sair</span>
        </button>
      </div>
    </header>
  );
};