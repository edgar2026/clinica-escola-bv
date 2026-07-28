// Client REST API Wrapper para a Clínica-Escola UNINASSAU

const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

class ApiClient {
  static getToken() {
    return localStorage.getItem('uninassau_jwt_token');
  }

  static setToken(token) {
    localStorage.setItem('uninassau_jwt_token', token);
  }

  static removeToken() {
    localStorage.removeItem('uninassau_jwt_token');
    localStorage.removeItem('uninassau_user_data');
  }

  static async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          this.removeToken();
          window.location.reload();
        }
        throw new Error(data.erro || 'Erro ao comunicar com o servidor.');
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  static get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  static post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  static delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

function showToast(mensagem, tipo = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const cores = {
    sucesso: '#10B981',
    erro: '#EF4444',
    alerta: '#F59E0B',
    info: '#002B49'
  };

  toast.style.cssText = `
    background-color: ${cores[tipo] || '#002B49'};
    color: #FFFFFF;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 0.9rem;
    font-weight: 600;
    max-width: 350px;
    animation: fadeIn 0.3s ease;
  `;
  toast.innerText = mensagem;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}
