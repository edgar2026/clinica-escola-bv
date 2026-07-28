import { apiRequest, setToken, removeToken } from './api';

export const authService = {
  async login(login, senha, lembrar = true) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, senha, lembrar })
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  async getMe() {
    return await apiRequest('/auth/me');
  },

  async alterarSenhaPrimeiroAcesso(novaSenha, confirmaSenha) {
    return await apiRequest('/auth/primeiro-acesso', {
      method: 'POST',
      body: JSON.stringify({ novaSenha, confirmaSenha })
    });
  },

  async redefinirSenhaDireta(emailMatricula, novaSenha) {
    return await apiRequest('/auth/redefinir-senha-direta', {
      method: 'POST',
      body: JSON.stringify({ emailMatricula, novaSenha })
    });
  },

  logout() {
    removeToken();
  }
};
