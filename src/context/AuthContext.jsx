import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (mensagem, tipo = 'info') => {
    setToastMessage({ mensagem, tipo });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const checarSessao = async () => {
    try {
      const data = await authService.getMe();
      setUsuario(data.usuario);
    } catch (err) {
      setUsuario(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checarSessao();
    const handleAutoLogout = () => {
      setUsuario(null);
      showToast('Sessão expirada. Faça login novamente.', 'erro');
    };
    window.addEventListener('auth:logout', handleAutoLogout);
    return () => window.removeEventListener('auth:logout', handleAutoLogout);
  }, []);

  const login = async (loginInput, senha, lembrar) => {
    const res = await authService.login(loginInput, senha, lembrar);
    setUsuario(res.usuario);
    showToast(res.mensagem, 'sucesso');
    return res;
  };

  const logout = () => {
    authService.logout();
    setUsuario(null);
    showToast('Sessão encerrada.', 'info');
  };

  return (
    <AuthContext.Provider value={{ usuario, setUsuario, loading, login, logout, showToast, toastMessage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
