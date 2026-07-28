const { runAsync } = require('../database');

async function registrarAuditoria(req, acao, entidade, entidadeId = null, dadosAnteriores = null, dadosNovos = null, justificativa = null) {
  try {
    const usuarioId = req && req.usuario ? req.usuario.id : null;
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const dispositivo = req ? (req.headers['user-agent'] || 'Desconhecido') : 'Sistema';

    const strAntigos = dadosAnteriores ? JSON.stringify(dadosAnteriores) : null;
    const strNovos = dadosNovos ? JSON.stringify(dadosNovos) : null;

    await runAsync(`
      INSERT INTO logs_auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, justificativa, ip, dispositivo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [usuarioId, acao, entidade, entidadeId, strAntigos, strNovos, justificativa, ip, dispositivo]);
  } catch (err) {
    console.error('Erro ao gravar log de auditoria:', err);
  }
}

module.exports = {
  registrarAuditoria
};
