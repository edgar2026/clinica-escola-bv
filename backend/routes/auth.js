const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getAsync, allAsync, runAsync, criarUsuarioSupabaseAuth, supaSelect, supaInsert, supaUpdate } = require('../database');
const { JWT_SECRET, autenticarToken, invalidateUserCache } = require('../middleware/auth');
const { registrarAuditoria } = require('../utils/audit');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, senha, lembrar } = req.body;

    if (!login || !senha) {
      return res.status(400).json({ erro: 'Informe a matrícula ou e-mail institucional e a senha.' });
    }

    const loginClean = login.trim().toLowerCase();

    // Buscar por e-mail ou matrícula (case-insensitive)
    const usuario = await getAsync(
      'SELECT * FROM usuarios WHERE LOWER(email) = ? OR LOWER(matricula) = ?',
      [loginClean, loginClean]
    );

    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário não encontrado. Verifique o e-mail ou a matrícula informada.' });
    }

    // Validar Senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha incorreta. Verifique os dados digitados ou utilize "Esqueceu a senha?".' });
    }

    // Sucesso no Login -> Garantir conta ativa e zerar qualquer bloqueio anterior
    await runAsync('UPDATE usuarios SET status = \'ativo\', tentativas_login = 0, bloqueado_ate = NULL WHERE id = ?', [usuario.id]);

    const duracaoToken = lembrar ? '7d' : '12h';
    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil, matricula: usuario.matricula, nome: usuario.nome },
      JWT_SECRET,
      { expiresIn: duracaoToken }
    );

    // Se for aluno, buscar dados específicos
    let dadosAluno = null;
    if (usuario.perfil === 'aluno') {
      dadosAluno = await getAsync(`
        SELECT a.*, c.nome as curso_nome, p.codigo as periodo_codigo, t.codigo as turno_codigo, s.nome as setor_nome
        FROM alunos a
        LEFT JOIN cursos c ON a.curso_id = c.id
        LEFT JOIN periodos p ON a.periodo_id = p.id
        LEFT JOIN turnos t ON a.turno_id = t.id
        LEFT JOIN setores_clinica s ON a.setor_id = s.id
        WHERE a.usuario_id = ?
      `, [usuario.id]);
    }

    await registrarAuditoria(req, 'LOGIN_SUCESSO', 'usuarios', usuario.id);

    return res.json({
      mensagem: 'Login realizado com sucesso.',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        matricula: usuario.matricula,
        perfil: usuario.perfil,
        primeiroAcesso: usuario.primeiro_acesso === 1,
        aluno: dadosAluno
      }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ erro: 'Erro interno no servidor de autenticação.' });
  }
});

// GET /api/auth/cursos - Listar cursos disponíveis (público, para cadastro)
router.get('/cursos', async (req, res) => {
  try {
    const cursos = await supaSelect('cursos', { colunas: 'id, nome', ordenar: { coluna: 'nome' } });
    return res.json({ cursos });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar cursos.' });
  }
});

// GET /api/auth/periodos - Listar períodos disponíveis (público)
router.get('/periodos', async (req, res) => {
  try {
    const periodos = await supaSelect('periodos', { colunas: 'id, nome', ordenar: { coluna: 'nome' } });
    return res.json({ periodos });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar períodos.' });
  }
});

// GET /api/auth/turnos - Listar turnos disponíveis (público)
router.get('/turnos', async (req, res) => {
  try {
    const turnos = await supaSelect('turnos', { colunas: 'id, nome', ordenar: { coluna: 'nome' } });
    return res.json({ turnos });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar turnos.' });
  }
});

// POST /api/auth/cadastro-aluno - Auto-cadastro do aluno
router.post('/cadastro-aluno', async (req, res) => {
  try {
    const { nome, matricula, curso_id, senha } = req.body;

    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe seu nome completo.' });
    if (!matricula || !matricula.trim()) return res.status(400).json({ erro: 'Informe sua matrícula.' });
    if (!curso_id) return res.status(400).json({ erro: 'Selecione seu curso.' });
    if (!senha || senha.trim().length < 4) return res.status(400).json({ erro: 'Informe uma senha com pelo menos 4 caracteres.' });

    const matriculaClean = matricula.trim().toLowerCase();
    const emailGerado = `${matriculaClean}@uninassau.edu.br`;

    const existente = await getAsync(
      'SELECT id, matricula FROM usuarios WHERE LOWER(matricula) = ?',
      [matriculaClean]
    );
    if (existente) {
      return res.status(400).json({ erro: 'Já existe um usuário com esta matrícula.' });
    }

    const senhaHash = bcrypt.hashSync(senha.trim(), 10);

    const resUser = await runAsync(
      `INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, status, primeiro_acesso)
       VALUES (?, ?, ?, ?, 'aluno', 'ativo', 1) RETURNING id`,
      [nome.trim(), emailGerado, matriculaClean, senhaHash]
    );

    const usuarioId = resUser.lastID;

    const unidadeRow = await getAsync('SELECT id FROM unidades LIMIT 1');
    const unidadeId = unidadeRow?.id;

    await runAsync(
      `INSERT INTO alunos (usuario_id, unidade_id, curso_id, situacao) VALUES (?, ?, ?, 'ativo') RETURNING id`,
      [usuarioId, unidadeId || null, curso_id]
    );

    await criarUsuarioSupabaseAuth(emailGerado, senha.trim(), nome.trim(), 'aluno', matriculaClean);

    await registrarAuditoria(req, 'CADASTRO_ALUNO_AUTO', 'usuarios', usuarioId);

    const token = jwt.sign(
      { id: usuarioId, perfil: 'aluno', matricula: matriculaClean, nome: nome.trim() },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso! Agora selecione seu curso, período e turno.',
      token,
      usuario: {
        id: usuarioId,
        nome: nome.trim(),
        email: emailGerado,
        matricula: matriculaClean,
        perfil: 'aluno',
        primeiroAcesso: true,
        aluno: null
      }
    });
  } catch (err) {
    console.error('Erro no auto-cadastro:', err);
    return res.status(500).json({ erro: 'Erro ao realizar cadastro.' });
  }
});

// POST /api/auth/completar-cadastro-aluno - Aluno seleciona período e turno
router.post('/completar-cadastro-aluno', autenticarToken, async (req, res) => {
  try {
    const { periodo_id, turno_id } = req.body;

    if (!periodo_id || !turno_id) {
      return res.status(400).json({ erro: 'Selecione o período e o turno.' });
    }

    const setorRow = await getAsync('SELECT id FROM setores_clinica LIMIT 1');

    let aluno = await getAsync('SELECT * FROM alunos WHERE usuario_id = ?', [req.usuario.id]);
    if (!aluno) {
      const resultado = await runAsync(
        `INSERT INTO alunos (usuario_id, curso_id, periodo_id, turno_id, setor_id, situacao) VALUES (?, 1, ?, ?, ?, 'ativo') RETURNING id`,
        [req.usuario.id, periodo_id, turno_id, setorRow?.id || null]
      );
      aluno = { id: resultado.lastID };
    } else {
      await runAsync(
        `UPDATE alunos SET periodo_id=?, turno_id=?, setor_id=?, situacao='ativo' WHERE usuario_id=?`,
        [periodo_id, turno_id, setorRow?.id || null, req.usuario.id]
      );
    }

    await runAsync('UPDATE usuarios SET primeiro_acesso = 0 WHERE id = ?', [req.usuario.id]);

    await registrarAuditoria(req, 'COMPLETAR_CADASTRO_ALUNO', 'alunos', aluno.id);

    const dadosAluno = await getAsync(`
      SELECT a.*, c.nome as curso_nome, p.codigo as periodo_codigo, t.codigo as turno_codigo, s.nome as setor_nome
      FROM alunos a
      LEFT JOIN cursos c ON a.curso_id = c.id
      LEFT JOIN periodos p ON a.periodo_id = p.id
      LEFT JOIN turnos t ON a.turno_id = t.id
      LEFT JOIN setores_clinica s ON a.setor_id = s.id
      WHERE a.usuario_id = ?
    `, [req.usuario.id]);

    return res.json({
      mensagem: 'Cadastro completado com sucesso!',
      aluno: dadosAluno
    });
  } catch (err) {
    console.error('Erro ao completar cadastro:', err);
    return res.status(500).json({ erro: 'Erro ao completar cadastro.' });
  }
});
router.post('/redefinir-senha-direta', async (req, res) => {
  try {
    const { emailMatricula, novaSenha } = req.body;

    if (!emailMatricula || !novaSenha || novaSenha.trim().length < 4) {
      return res.status(400).json({ erro: 'Informe o e-mail/matrícula e a nova senha (mínimo 4 caracteres).' });
    }

    const cleanInput = emailMatricula.trim().toLowerCase();
    const usuario = await getAsync(
      'SELECT id, nome, email, matricula, perfil FROM usuarios WHERE LOWER(email) = ? OR LOWER(matricula) = ?',
      [cleanInput, cleanInput]
    );

    if (!usuario) {
      return res.status(404).json({ erro: 'Nenhum usuário encontrado com este e-mail ou matrícula.' });
    }

    const novaHash = bcrypt.hashSync(novaSenha.trim(), 10);
    await runAsync(
      'UPDATE usuarios SET senha_hash = ?, status = \'ativo\', tentativas_login = 0, bloqueado_ate = NULL WHERE id = ?',
      [novaHash, usuario.id]
    );

    // Sincronizar também no Supabase Auth
    await criarUsuarioSupabaseAuth(usuario.email, novaSenha.trim(), usuario.nome, usuario.perfil, usuario.matricula);

    await registrarAuditoria(req, 'REDEFINICAO_SENHA_AUTO_SERVICO', 'usuarios', usuario.id);

    return res.json({
      mensagem: `Senha redefinida com sucesso para ${usuario.nome}! Você já pode fazer login com a nova senha.`
    });

  } catch (err) {
    console.error('Erro ao redefinir senha:', err);
    return res.status(500).json({ erro: 'Erro interno ao redefinir senha.' });
  }
});

// POST /api/auth/recuperar-senha
router.post('/recuperar-senha', async (req, res) => {
  try {
    const { emailMatricula } = req.body;
    if (!emailMatricula) {
      return res.status(400).json({ erro: 'Informe seu e-mail ou matrícula.' });
    }

    const cleanInput = emailMatricula.trim().toLowerCase();
    const usuario = await getAsync(
      'SELECT id, nome, email FROM usuarios WHERE LOWER(email) = ? OR LOWER(matricula) = ?',
      [cleanInput, cleanInput]
    );

    if (!usuario) {
      return res.status(404).json({ erro: 'Nenhum usuário encontrado com este e-mail ou matrícula.' });
    }

    await registrarAuditoria(req, 'SOLICITACAO_RECUPERACAO_SENHA', 'usuarios', usuario.id);

    return res.json({ 
      mensagem: `Solicitação aprovada para ${usuario.nome}! Utilize a redefinição de senha para cadastrar sua nova senha.` 
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao processar recuperação de senha.' });
  }
});

// GET /api/auth/me - Obter dados do usuário logado
router.get('/me', autenticarToken, async (req, res) => {
  try {
    const usuarioDb = await getAsync('SELECT primeiro_acesso FROM usuarios WHERE id = ?', [req.usuario.id]);

    let dadosAluno = null;
    if (req.usuario.perfil === 'aluno') {
      dadosAluno = await getAsync(`
        SELECT a.*, c.nome as curso_nome, p.codigo as periodo_codigo, t.codigo as turno_codigo, s.nome as setor_nome
        FROM alunos a
        LEFT JOIN cursos c ON a.curso_id = c.id
        LEFT JOIN periodos p ON a.periodo_id = p.id
        LEFT JOIN turnos t ON a.turno_id = t.id
        LEFT JOIN setores_clinica s ON a.setor_id = s.id
        WHERE a.usuario_id = ?
      `, [req.usuario.id]);
    }

    return res.json({
      usuario: {
        id: req.usuario.id,
        nome: req.usuario.nome,
        email: req.usuario.email,
        matricula: req.usuario.matricula,
        perfil: req.usuario.perfil,
        primeiroAcesso: usuarioDb?.primeiro_acesso === 1,
        aluno: dadosAluno
      }
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar dados da sessão.' });
  }
});

module.exports = router;
