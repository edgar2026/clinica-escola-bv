const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getAsync, allAsync, runAsync } = require('../database');
const { autenticarToken, autorizarPerfis } = require('../middleware/auth');
const { registrarAuditoria } = require('../utils/audit');

// Middleware exclusivo para Administradores
router.use(autenticarToken);
router.use(autorizarPerfis('admin'));

// GET /api/admin/usuarios - Listar todos os usuários
router.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await allAsync(`
      SELECT u.id, u.nome, u.email, u.matricula, u.cpf, u.perfil, u.status, u.primeiro_acesso, u.tentativas_login, u.bloqueado_ate, u.criado_em
      FROM usuarios u
      ORDER BY u.id DESC
    `);
    return res.json({ usuarios });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
});

// POST /api/admin/usuarios/bloquear-desbloquear - Bloquear ou Desbloquear conta de usuário
router.post('/usuarios/bloquear-desbloquear', async (req, res) => {
  try {
    const { usuario_id, status, justificativa } = req.body; // status: 'ativo', 'bloqueado', 'suspenso'

    if (!usuario_id || !status || !justificativa) {
      return res.status(400).json({ erro: 'Informe o usuário, o novo status e a justificativa para auditoria.' });
    }

    const usuarioAntigo = await getAsync('SELECT * FROM usuarios WHERE id = ?', [usuario_id]);
    if (!usuarioAntigo) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    await runAsync('UPDATE usuarios SET status = ?, bloqueado_ate = NULL, tentativas_login = 0 WHERE id = ?', [status, usuario_id]);

    await registrarAuditoria(req, 'ALTERAR_STATUS_USUARIO', 'usuarios', usuario_id, { status: usuarioAntigo.status }, { status }, justificativa);

    return res.json({ mensagem: `Status do usuário alterado para '${status}' com sucesso!` });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao alterar status do usuário.' });
  }
});

// GET /api/admin/auditoria - Consultar Logs de Auditoria (LGPD)
router.get('/auditoria', async (req, res) => {
  try {
    const logs = await allAsync(`
      SELECT l.*, u.nome as usuario_nome, u.matricula, u.perfil
      FROM logs_auditoria l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      ORDER BY l.criado_em DESC LIMIT 100
    `);
    return res.json({ logs });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao carregar logs de auditoria.' });
  }
});

// GET /api/admin/configuracoes - Listar e atualizar configurações do sistema
router.get('/configuracoes', async (req, res) => {
  try {
    const configuracoes = await allAsync('SELECT * FROM configuracoes');
    return res.json({ configuracoes });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao carregar configurações.' });
  }
});

// POST /api/admin/configuracoes - Salvar parâmetros globais
router.post('/configuracoes', async (req, res) => {
  try {
    const { chave, valor, justificativa } = req.body;
    if (!chave || valor === undefined || !justificativa) {
      return res.status(400).json({ erro: 'Informe a chave, o novo valor e a justificativa.' });
    }

    const antiga = await getAsync('SELECT * FROM configuracoes WHERE chave = ?', [chave]);
    await runAsync('UPDATE configuracoes SET valor = ?, atualizado_em = CURRENT_TIMESTAMP WHERE chave = ?', [valor, chave]);

    await registrarAuditoria(req, 'ALTERAR_CONFIGURACAO_SISTEMA', 'configuracoes', null, antiga, { chave, valor }, justificativa);

    return res.json({ mensagem: `Configuração '${chave}' atualizada para '${valor}'.` });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao salvar configuração.' });
  }
});

module.exports = router;
