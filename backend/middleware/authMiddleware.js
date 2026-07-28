const jwt = require('jsonwebtoken');
const SECRET = 'clinica-uninassau-secret';

function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });
    req.usuario = decoded;
    next();
  });
}

function perfilAutorizado(...perfis) {
  return (req, res, next) => {
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    next();
  };
}

module.exports = { verificarToken, perfilAutorizado, SECRET };