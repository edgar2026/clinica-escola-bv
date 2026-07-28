const jwt = require('jsonwebtoken');
const { getAsync } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET;

const authCache = new Map();
const CACHE_TTL = 30000;

function getCachedUser(id) {
  const entry = authCache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    authCache.delete(id);
    return null;
  }
  return entry.user;
}

function setCachedUser(id, user) {
  authCache.set(id, { user, ts: Date.now() });
  if (authCache.size > 500) {
    const oldest = authCache.keys().next().value;
    authCache.delete(oldest);
  }
}

function invalidateUserCache(id) {
  authCache.delete(id);
}

async function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Acesso negado. Token de autenticação não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    let usuario = getCachedUser(decoded.id);

    if (!usuario) {
      usuario = await getAsync('SELECT id, nome, email, matricula, perfil, status, primeiro_acesso FROM usuarios WHERE id = ?', [decoded.id]);
      if (usuario) setCachedUser(decoded.id, usuario);
    }

    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário não encontrado.' });
    }

    if (usuario.status !== 'ativo') {
      return res.status(403).json({ erro: `Sua conta está com o status: ${usuario.status}. Entre em contato com a coordenação.` });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(403).json({ erro: 'Token inválido ou expirado. Realize um novo login.' });
  }
}

function autorizarPerfis(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }

    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Acesso negado. Perfil sem permissão para esta funcionalidade.' });
    }

    next();
  };
}

module.exports = {
  autenticarToken,
  autorizarPerfis,
  JWT_SECRET,
  invalidateUserCache
};
