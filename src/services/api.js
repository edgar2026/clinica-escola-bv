// API REST Service Client for React

const API_BASE_URL = '/api';

export const getToken = () => localStorage.getItem('uninassau_jwt_token');
export const setToken = (token) => localStorage.setItem('uninassau_jwt_token', token);
export const removeToken = () => {
  localStorage.removeItem('uninassau_jwt_token');
  localStorage.removeItem('uninassau_user_data');
};

const requestCache = new Map();
const CACHE_TTL = 60000;

function getCacheKey(endpoint, options) {
  return `${options?.method || 'GET'}:${endpoint}`;
}

function getCached(key) {
  const entry = requestCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    requestCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  requestCache.set(key, { data, ts: Date.now() });
  if (requestCache.size > 100) {
    const oldest = requestCache.keys().next().value;
    requestCache.delete(oldest);
  }
}

const CACHEABLE_ENDPOINTS = [
  '/admin/opcoes-cadastro',
  '/admin/cursos',
  '/admin/periodos',
  '/admin/turnos',
  '/admin/setores',
  '/admin/clinicas',
  '/admin/especialidades',
];

export const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const isGet = !options.method || options.method === 'GET';
  const cacheKey = getCacheKey(endpoint, options);

  if (isGet && CACHEABLE_ENDPOINTS.some(e => endpoint.includes(e))) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Erro do servidor (${response.status}): Verifique se o backend está ativo.`);
      }
      data = { mensagem: text };
    }

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        removeToken();
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
      throw new Error(data.erro || data.message || 'Erro ao comunicar com o servidor.');
    }

    if (isGet && CACHEABLE_ENDPOINTS.some(e => endpoint.includes(e))) {
      setCache(cacheKey, data);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Requisição expirou. Verifique sua conexão.');
    }
    throw err;
  }
};

export const invalidateCache = (endpointPattern) => {
  for (const key of requestCache.keys()) {
    if (key.includes(endpointPattern)) {
      requestCache.delete(key);
    }
  }
};
