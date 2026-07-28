const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getAsync, allAsync, runAsync, criarUsuarioSupabaseAuth, supaSelect, supaCount, supaInsert, supaUpdate, supaDelete } = require('../database');
const { autenticarToken, autorizarPerfis, invalidateUserCache } = require('../middleware/auth');
const { registrarAuditoria } = require('../utils/audit');

// Middleware exclusivo para Administradores
router.use(autenticarToken);
router.use(autorizarPerfis('admin'));

// Helper: auto-gerar código único (ex: CUR-001, PER-001, TUR-001, ESP-001)
async function gerarCodigoUnico(tabela, prefixo) {
  const padding = (n) => String(n).padStart(3, '0');
  for (let i = 1; i <= 9999; i++) {
    const candidato = `${prefixo}-${padding(i)}`;
    const existe = await getAsync(`SELECT id FROM ${tabela} WHERE LOWER(codigo) = LOWER(?)`, [candidato]);
    if (!existe) return candidato;
  }
  return `${prefixo}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

// GET /api/admin/usuarios - Listar todos os usuários com dados completos de aluno se houver
router.get('/usuarios', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const usuariosRaw = await supaSelect('usuarios', {
      colunas: 'id, nome, email, matricula, cpf, perfil, status, primeiro_acesso, tentativas_login, bloqueado_ate, criado_em, telefone, email_pessoal, endereco, data_nascimento',
      ordenar: { coluna: 'id', asc: false },
      limite,
      offset
    });

    const totalPromise = supaCount('usuarios', {});

    const ids = usuariosRaw.map(u => u.id);
    let alunosMap = {};
    if (ids.length > 0) {
      const alunosRaw = await supaSelect('alunos', { colunas: 'usuario_id, curso_id, periodo_id, turno_id, setor_id', filtros: { usuario_id: ids } });
      for (const a of alunosRaw) {
        alunosMap[a.usuario_id] = a;
      }
    }

    const [cursos, periodos, turnos, setores, total] = await Promise.all([
      ids.length > 0 ? supaSelect('cursos', { colunas: 'id, nome' }) : [],
      ids.length > 0 ? supaSelect('periodos', { colunas: 'id, codigo' }) : [],
      ids.length > 0 ? supaSelect('turnos', { colunas: 'id, codigo' }) : [],
      ids.length > 0 ? supaSelect('setores_clinica', { colunas: 'id, nome' }) : [],
      totalPromise
    ]);

    const cursosMap = Object.fromEntries(cursos.map(c => [c.id, c]));
    const periodosMap = Object.fromEntries(periodos.map(p => [p.id, p]));
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const setoresMap = Object.fromEntries(setores.map(s => [s.id, s]));

    const usuarios = usuariosRaw.map(u => {
      const a = alunosMap[u.id] || {};
      return {
        ...u,
        curso_id: a.curso_id || null,
        curso_nome: a.curso_id ? (cursosMap[a.curso_id]?.nome || null) : null,
        periodo_id: a.periodo_id || null,
        periodo_codigo: a.periodo_id ? (periodosMap[a.periodo_id]?.codigo || null) : null,
        turno_id: a.turno_id || null,
        turno_codigo: a.turno_id ? (turnosMap[a.turno_id]?.codigo || null) : null,
        setor_id: a.setor_id || null,
        setor_nome: a.setor_id ? (setoresMap[a.setor_id]?.nome || null) : null,
      };
    });

    return res.json({
      usuarios,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    return res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
});

// GET /api/admin/usuarios/:id - Perfil completo de um usuário
router.get('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioRows = await supaSelect('usuarios', { colunas: '*', filtros: { id: Number(id) } });
    const usuario = usuarioRows && usuarioRows.length > 0 ? usuarioRows[0] : null;
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    delete usuario.senha_hash;

    const alunoRows = await supaSelect('alunos', { colunas: 'curso_id, periodo_id, turno_id, setor_id', filtros: { usuario_id: Number(id) } });
    const aluno = alunoRows && alunoRows.length > 0 ? alunoRows[0] : null;

    if (aluno) {
      const [curso, periodo, turno, setor] = await Promise.all([
        aluno.curso_id ? supaSelect('cursos', { colunas: 'id, nome', filtros: { id: aluno.curso_id } }) : [],
        aluno.periodo_id ? supaSelect('periodos', { colunas: 'id, codigo', filtros: { id: aluno.periodo_id } }) : [],
        aluno.turno_id ? supaSelect('turnos', { colunas: 'id, codigo', filtros: { id: aluno.turno_id } }) : [],
        aluno.setor_id ? supaSelect('setores_clinica', { colunas: 'id, nome', filtros: { id: aluno.setor_id } }) : [],
      ]);
      usuario.curso_id = aluno.curso_id;
      usuario.curso_nome = curso.length > 0 ? curso[0].nome : null;
      usuario.periodo_id = aluno.periodo_id;
      usuario.periodo_codigo = periodo.length > 0 ? periodo[0].codigo : null;
      usuario.turno_id = aluno.turno_id;
      usuario.turno_codigo = turno.length > 0 ? turno[0].codigo : null;
      usuario.setor_id = aluno.setor_id;
      usuario.setor_nome = setor.length > 0 ? setor[0].nome : null;
    }

    return res.json({ usuario });
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    return res.status(500).json({ erro: 'Erro ao buscar usuário.' });
  }
});

// PUT /api/admin/usuarios/:id - Editar perfil completo de um usuário
router.put('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, matricula, cpf, perfil, telefone, email_pessoal, endereco, data_nascimento, curso_id, periodo_id, turno_id } = req.body;
    const antigaRows = await supaSelect('usuarios', { colunas: '*', filtros: { id: Number(id) } });
    const antiga = antigaRows && antigaRows.length > 0 ? antigaRows[0] : null;
    if (!antiga) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const usuarioId = Number(id);

    const dadosUsuarios = {};
    if (nome !== undefined) dadosUsuarios.nome = nome;
    if (email !== undefined) dadosUsuarios.email = email;
    if (matricula !== undefined) dadosUsuarios.matricula = matricula;
    if (cpf !== undefined) dadosUsuarios.cpf = cpf || null;
    if (perfil !== undefined) dadosUsuarios.perfil = perfil;
    if (telefone !== undefined) dadosUsuarios.telefone = telefone || null;
    if (email_pessoal !== undefined) dadosUsuarios.email_pessoal = email_pessoal || null;
    if (endereco !== undefined) dadosUsuarios.endereco = endereco || null;
    if (data_nascimento !== undefined) dadosUsuarios.data_nascimento = data_nascimento || null;

    await supaUpdate('usuarios', dadosUsuarios, { id: usuarioId });
    invalidateUserCache(usuarioId);

    const perfilAtual = perfil ?? antiga.perfil;
    if (perfilAtual === 'aluno') {
      const alunoRows = await supaSelect('alunos', { colunas: 'id', filtros: { usuario_id: usuarioId } });
      const aluno = alunoRows && alunoRows.length > 0 ? alunoRows[0] : null;

      const dadosAluno = {
        curso_id: curso_id ? Number(curso_id) : null,
        periodo_id: periodo_id ? Number(periodo_id) : null,
        turno_id: turno_id ? Number(turno_id) : null,
      };

      if (aluno) {
        await supaUpdate('alunos', dadosAluno, { usuario_id: usuarioId });
      } else if (curso_id) {
        await supaInsert('alunos', {
          usuario_id: usuarioId,
          curso_id: Number(curso_id),
          periodo_id: periodo_id ? Number(periodo_id) : null,
          turno_id: turno_id ? Number(turno_id) : null,
          situacao: 'ativo'
        });
      }
    }

    await registrarAuditoria(req, 'EDITAR_USUARIO_ADMIN', 'usuarios', id, antiga, req.body);
    return res.json({ mensagem: 'Usuário atualizado com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar usuário: ' + (err.message || err.msg || 'desconhecido') });
  }
});

// GET /api/admin/opcoes-cadastro - Listar opções de Cursos, Períodos, Turnos e Setores
router.get('/opcoes-cadastro', async (req, res) => {
  try {
    const [cursos, periodos, turnos, setores] = await Promise.all([
      supaSelect('cursos', { colunas: 'id, nome, codigo', ordenar: { coluna: 'nome' } }),
      supaSelect('periodos', { colunas: 'id, nome, codigo', filtros: { status: 'ativo' }, ordenar: { coluna: 'nome' } }),
      supaSelect('turnos', { colunas: 'id, nome, codigo', filtros: { status: 'ativo' }, ordenar: { coluna: 'nome' } }),
      supaSelect('setores_clinica', { colunas: 'id, nome', ordenar: { coluna: 'nome' } }),
    ]);

    return res.json({ cursos, periodos, turnos, setores, supervisores: [] });
  } catch (err) {
    console.error('Erro ao carregar opções de cadastro:', err);
    return res.status(500).json({ erro: 'Erro ao carregar opções de cadastro.' });
  }
});

// POST /api/admin/usuarios/bloquear-desbloquear
router.post('/usuarios/bloquear-desbloquear', async (req, res) => {
  try {
    const { usuario_id, status, justificativa } = req.body;

    if (!usuario_id || !status || !justificativa) {
      return res.status(400).json({ erro: 'Informe o usuário, o novo status e a justificativa para auditoria.' });
    }

    const usuarioAntigo = await getAsync('SELECT * FROM usuarios WHERE id = ?', [usuario_id]);
    if (!usuarioAntigo) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    await runAsync(`UPDATE usuarios SET status = ?, bloqueado_ate = NULL, tentativas_login = 0 WHERE id = ?`, [status, usuario_id]);
    invalidateUserCache(Number(usuario_id));

    await registrarAuditoria(req, 'ALTERAR_STATUS_USUARIO', 'usuarios', usuario_id, { status: usuarioAntigo.status }, { status }, justificativa);

    return res.json({ mensagem: `Status do usuário alterado para '${status}' com sucesso!` });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao alterar status do usuário.' });
  }
});

// POST /api/admin/alunos/cadastrar-manual - Cadastrar 1 aluno individualmente
router.post('/alunos/cadastrar-manual', async (req, res) => {
  try {
    const {
      nome, email, matricula, cpf, senha,
      curso_id, periodo_id, turno_id, setor_id,
      carga_horaria_semanal_max
    } = req.body;

    if (!nome || !email || !matricula) {
      return res.status(400).json({ erro: 'Os campos Nome, E-mail e Matrícula são obrigatórios.' });
    }

    const emailClean = email.toLowerCase().trim();
    const matriculaClean = matricula.trim();

    // Verificar duplicidade
    const existente = await getAsync(
      'SELECT id, email, matricula FROM usuarios WHERE LOWER(email) = ? OR LOWER(matricula) = ?',
      [emailClean, matriculaClean]
    );

    if (existente) {
      const campo = existente.email.toLowerCase() === emailClean ? 'E-mail' : 'Matrícula';
      return res.status(400).json({ erro: `Já existe um usuário cadastrado com este ${campo} (${existente.email.toLowerCase() === emailClean ? emailClean : matriculaClean}).` });
    }

    // Obter IDs padrão caso omitidos ou zerados
    const cursoDefault = (curso_id && Number(curso_id) > 0) ? Number(curso_id) : ((await getAsync('SELECT id FROM cursos ORDER BY id LIMIT 1'))?.id);
    const periodoDefault = (periodo_id && Number(periodo_id) > 0) ? Number(periodo_id) : ((await getAsync('SELECT id FROM periodos LIMIT 1'))?.id || null);
    const turnoDefault = (turno_id && Number(turno_id) > 0) ? Number(turno_id) : ((await getAsync('SELECT id FROM turnos LIMIT 1'))?.id || null);
    const setorDefault = (setor_id && Number(setor_id) > 0) ? Number(setor_id) : ((await getAsync('SELECT id FROM setores_clinica LIMIT 1'))?.id);
    if (!cursoDefault) {
      return res.status(400).json({ erro: 'Cadastre ao menos um Curso antes de criar alunos.' });
    }
    if (!setorDefault) {
      return res.status(400).json({ erro: 'Cadastre ao menos um Setor antes de criar alunos.' });
    }
    const unidadeDefault = (await getAsync('SELECT id FROM unidades LIMIT 1'))?.id;
    if (!unidadeDefault) {
      return res.status(400).json({ erro: 'Cadastre ao menos uma Unidade antes de criar alunos.' });
    }

    const senhaFinal = senha && senha.trim().length >= 4 ? senha.trim() : '123456';
    const senhaHash = bcrypt.hashSync(senhaFinal, 10);

    // Inserir Usuário
    const resUser = await runAsync(`
      INSERT INTO usuarios (nome, email, matricula, cpf, senha_hash, perfil, status, primeiro_acesso)
      VALUES (?, ?, ?, ?, ?, 'aluno', 'ativo', 1)
      RETURNING id
    `, [nome.trim(), emailClean, matriculaClean, cpf ? cpf.trim() : null, senhaHash]);

    const usuarioId = resUser.lastID;

    // Inserir Aluno
    let resAluno;
    try {
      resAluno = await runAsync(`
        INSERT INTO alunos (usuario_id, curso_id, periodo_id, turno_id, unidade_id, setor_id, carga_horaria_semanal_max, situacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo')
        RETURNING id
      `, [usuarioId, cursoDefault, periodoDefault, turnoDefault, unidadeDefault, setorDefault, carga_horaria_semanal_max || 6]);
    } catch (alunoErr) {
      await runAsync('DELETE FROM usuarios WHERE id = ?', [usuarioId]);
      throw alunoErr;
    }

    // Sincronizar com Supabase Auth (auth.users)
    try {
      await criarUsuarioSupabaseAuth(emailClean, senhaFinal, nome.trim(), 'aluno', matriculaClean);
    } catch (authErr) {
      console.warn('Aviso: Sincronização Supabase Auth:', authErr.message);
    }

    await registrarAuditoria(req, 'CADASTRAR_ALUNO_MANUAL', 'alunos', resAluno.lastID, null, { nome, email: emailClean, matricula: matriculaClean });

    return res.status(201).json({
      mensagem: `Aluno ${nome.trim()} cadastrado com sucesso!`,
      usuario: { id: usuarioId, nome: nome.trim(), email: emailClean, matricula: matriculaClean, perfil: 'aluno', senhaInicial: senhaFinal }
    });

  } catch (err) {
    console.error('Erro ao cadastrar aluno manual:', err);
    return res.status(400).json({ erro: err.message || 'Erro ao cadastrar aluno.' });
  }
});

// POST /api/admin/alunos/importar-massa - Cadastrar lote de alunos em massa
router.post('/alunos/importar-massa', async (req, res) => {
  try {
    const { listaAlunos } = req.body;

    if (!Array.isArray(listaAlunos) || listaAlunos.length === 0) {
      return res.status(400).json({ erro: 'Envie uma lista de alunos com ao menos 1 registro.' });
    }

    const cursoDefault = (await getAsync('SELECT id FROM cursos ORDER BY id LIMIT 1'))?.id;
    const periodoDefault = (await getAsync('SELECT id FROM periodos LIMIT 1'))?.id || null;
    const turnoDefault = (await getAsync('SELECT id FROM turnos LIMIT 1'))?.id || null;
    const setorDefault = (await getAsync('SELECT id FROM setores_clinica LIMIT 1'))?.id;
    if (!cursoDefault) {
      return res.status(400).json({ erro: 'Cadastre ao menos um Curso antes de importar alunos.' });
    }
    if (!setorDefault) {
      return res.status(400).json({ erro: 'Cadastre ao menos um Setor antes de importar alunos.' });
    }
    const unidadeDefault = (await getAsync('SELECT id FROM unidades LIMIT 1'))?.id;
    if (!unidadeDefault) {
      return res.status(400).json({ erro: 'Cadastre ao menos uma Unidade antes de importar alunos.' });
    }
    const senhaHashPadrao = bcrypt.hashSync('123456', 10);

    let importadosSucesso = 0;
    const erros = [];
    const cadastrados = [];

    for (let i = 0; i < listaAlunos.length; i++) {
      const item = listaAlunos[i];
      const numLinha = i + 1;

      const nome = item.nome || item.Nome || item['Nome Completo'];
      const email = item.email || item.Email || item['E-mail'];
      const matricula = item.matricula || item.Matricula || item['Matrícula'];
      const cpf = item.cpf || item.CPF;
      const senha = item.senha || item.Senha;

      if (!nome || !email || !matricula) {
        erros.push(`Linha ${numLinha}: Campos Nome, E-mail ou Matrícula ausentes.`);
        continue;
      }

      const emailClean = String(email).toLowerCase().trim();
      const matClean = String(matricula).trim();

      // Verificar duplicidade
      const existente = await getAsync('SELECT id FROM usuarios WHERE email = ? OR matricula = ?', [emailClean, matClean]);
      if (existente) {
        erros.push(`Linha ${numLinha} (${nome}): E-mail ou Matrícula (${matClean}) já cadastrados.`);
        continue;
      }

      let senhaHashFinal = senhaHashPadrao;
      if (senha && String(senha).trim().length >= 4) {
        senhaHashFinal = bcrypt.hashSync(String(senha).trim(), 10);
      }

      const cursoId = item.curso_id || cursoDefault;
      const periodoId = item.periodo_id || periodoDefault;
      const turnoId = item.turno_id || turnoDefault;
      const setorId = item.setor_id || setorDefault;
      const cargaHoraria = item.carga_horaria || item.carga_horaria_semanal_max || 6;

      try {
        const resUser = await runAsync(`
          INSERT INTO usuarios (nome, email, matricula, cpf, senha_hash, perfil, status, primeiro_acesso)
          VALUES (?, ?, ?, ?, ?, 'aluno', 'ativo', 1)
          RETURNING id
        `, [String(nome).trim(), emailClean, matClean, cpf ? String(cpf).trim() : null, senhaHashFinal]);

        const usuarioId = resUser.lastID;

        await runAsync(`
          INSERT INTO alunos (usuario_id, curso_id, periodo_id, turno_id, unidade_id, setor_id, carga_horaria_semanal_max, situacao)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo')
          RETURNING id
        `, [usuarioId, cursoId, periodoId, turnoId, unidadeDefault, setorId, cargaHoraria]);

        // Sincronizar no Supabase Auth
        await criarUsuarioSupabaseAuth(emailClean, senha ? String(senha).trim() : '123456', String(nome).trim(), 'aluno', matClean);

        importadosSucesso++;
        cadastrados.push({ id: usuarioId, nome, email: emailClean, matricula: matClean });
      } catch (e) {
        erros.push(`Linha ${numLinha} (${nome}): ${e.message}`);
      }
    }

    await registrarAuditoria(req, 'IMPORTAR_ALUNOS_EM_MASSA', 'alunos', null, null, { importadosSucesso, errosCount: erros.length });

    return res.json({
      mensagem: `${importadosSucesso} aluno(s) importados com sucesso! ${erros.length > 0 ? `${erros.length} aviso(s)/erro(s).` : ''}`,
      importadosSucesso,
      cadastrados,
      erros
    });

  } catch (err) {
    console.error('Erro na importação em massa de alunos:', err);
    return res.status(500).json({ erro: 'Erro interno ao processar importação em massa.' });
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

// GET /api/admin/configuracoes - Listar configurações do sistema
router.get('/configuracoes', async (req, res) => {
  try {
    const configuracoes = await supaSelect('configuracoes');
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
    await runAsync(`UPDATE configuracoes SET valor = ?, atualizado_em = NOW() WHERE chave = ?`, [valor, chave]);

    await registrarAuditoria(req, 'ALTERAR_CONFIGURACAO_SISTEMA', 'configuracoes', null, antiga, { chave, valor }, justificativa);

    return res.json({ mensagem: `Configuração '${chave}' atualizada para '${valor}'.` });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao salvar configuração.' });
  }
});

// POST /api/admin/usuarios/criar - Criar novo usuário genérico
router.post('/usuarios/criar', async (req, res) => {
  try {
    const { nome, email, matricula, cpf, senha, perfil } = req.body;
    if (!nome || !email || !matricula || !senha || !perfil) {
      return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }

    const existente = await getAsync('SELECT id FROM usuarios WHERE email = ? OR matricula = ?', [email, matricula]);
    if (existente) {
      return res.status(400).json({ erro: 'Já existe um usuário com este e-mail ou matrícula.' });
    }

    const senhaHash = bcrypt.hashSync(senha, 10);
    const res2 = await runAsync(`
      INSERT INTO usuarios (nome, email, matricula, cpf, senha_hash, perfil, primeiro_acesso, status)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'ativo')
      RETURNING id
    `, [nome, email, matricula, cpf || null, senhaHash, perfil]);

    await registrarAuditoria(req, 'CRIAR_USUARIO', 'usuarios', res2.lastID, null, { nome, email, perfil }, 'Cadastro administrativo');

    return res.status(201).json({ mensagem: 'Usuário criado com sucesso!', id: res2.lastID });
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    return res.status(500).json({ erro: 'Erro ao criar usuário.' });
  }
});

// POST /api/admin/cursos - Cadastrar novo curso
router.post('/cursos', async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'Informe o Nome do curso.' });
    }

    const nomeClean = nome.trim();

    const existente = await getAsync('SELECT id, nome FROM cursos WHERE LOWER(nome) = ?', [nomeClean.toLowerCase()]);
    if (existente) {
      return res.status(400).json({ erro: `Já existe um curso cadastrado como '${existente.nome}'.` });
    }

    const codClean = await gerarCodigoUnico('cursos', 'CUR');

    const resCurso = await runAsync(`
      INSERT INTO cursos (nome, codigo, descricao, status)
      VALUES (?, ?, ?, 'ativo')
      RETURNING id
    `, [nomeClean, codClean, descricao ? descricao.trim() : `Curso de ${nomeClean}`]);

    const cursoId = resCurso.lastID;

    try {
      const unidadeRow = await getAsync('SELECT id FROM unidades LIMIT 1');
      const unidadeId = unidadeRow?.id;
      if (unidadeId) {
        await runAsync(`
          INSERT INTO setores_clinica (unidade_id, nome, capacidade_padrao, status)
          VALUES (?, ?, 10, 'ativo')
          RETURNING id
        `, [unidadeId, `Clínica de ${nomeClean}`]);
      }
    } catch (innerErr) {
      console.warn('Aviso: não foi possível criar setor clínica automático:', innerErr.message);
    }

    await registrarAuditoria(req, 'CRIAR_CURSO', 'cursos', cursoId, null, { nome: nomeClean, codigo: codClean });

    return res.status(201).json({ mensagem: `Curso '${nomeClean}' (Código: ${codClean}) cadastrado com sucesso!`, id: cursoId, codigo: codClean });
  } catch (err) {
    console.error('Erro ao cadastrar curso:', err);
    return res.status(500).json({ erro: 'Erro ao cadastrar curso.' });
  }
});

// DELETE /api/admin/cursos/:id - Excluir curso
router.delete('/cursos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const curso = await getAsync('SELECT * FROM cursos WHERE id = ?', [id]);
    if (!curso) {
      return res.status(404).json({ erro: 'Curso não encontrado.' });
    }

    await runAsync('DELETE FROM cursos WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_CURSO', 'cursos', id, curso, null, 'Exclusão de curso pelo admin');

    return res.json({ mensagem: `Curso '${curso.nome}' removido com sucesso.` });
  } catch (err) {
    console.error('Erro ao excluir curso:', err);
    return res.status(500).json({ erro: 'Erro ao excluir curso.' });
  }
});

// GET /api/admin/periodos - Listar períodos
router.get('/periodos', async (req, res) => {
  try {
    const periodos = await supaSelect('periodos', { ordenar: { coluna: 'nome' } });
    return res.json({ periodos });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar períodos.' });
  }
});

// POST /api/admin/periodos - Criar período
router.post('/periodos', async (req, res) => {
  try {
    const { nome, data_inicio, data_fim } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'Informe o nome do período.' });
    }
    const existente = await getAsync('SELECT id FROM periodos WHERE LOWER(nome) = ?', [nome.trim().toLowerCase()]);
    if (existente) {
      return res.status(400).json({ erro: 'Já existe um período com este nome.' });
    }
    const codClean = await gerarCodigoUnico('periodos', 'PER');
    const resultado = await runAsync(
      'INSERT INTO periodos (nome, codigo, data_inicio, data_fim) VALUES (?, ?, ?, ?) RETURNING id',
      [nome.trim(), codClean, data_inicio || null, data_fim || null]
    );
    await registrarAuditoria(req, 'CRIAR_PERIODO', 'periodos', resultado.lastID, null, { nome, codigo: codClean });
    return res.status(201).json({ mensagem: 'Período criado com sucesso!', id: resultado.lastID, codigo: codClean });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao criar período.' });
  }
});

// DELETE /api/admin/periodos/:id
router.delete('/periodos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const periodo = await getAsync('SELECT * FROM periodos WHERE id = ?', [id]);
    if (!periodo) return res.status(404).json({ erro: 'Período não encontrado.' });
    const vinculados = await getAsync('SELECT COUNT(*) as qtd FROM alunos WHERE periodo_id = ?', [id]);
    if (vinculados && parseInt(vinculados.qtd, 10) > 0) {
      return res.status(400).json({ erro: 'Não é possível excluir: há alunos vinculados a este período.' });
    }
    await runAsync('DELETE FROM periodos WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_PERIODO', 'periodos', id, periodo, null);
    return res.json({ mensagem: 'Período excluído com sucesso.' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao excluir período.' });
  }
});

// GET /api/admin/turnos - Listar turnos
router.get('/turnos', async (req, res) => {
  try {
    const turnos = await supaSelect('turnos', { ordenar: { coluna: 'nome' } });
    return res.json({ turnos });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar turnos.' });
  }
});

// POST /api/admin/turnos - Criar turno
router.post('/turnos', async (req, res) => {
  try {
    const { nome, hora_inicio, hora_fim } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'Informe o nome do turno.' });
    }
    const existente = await getAsync('SELECT id FROM turnos WHERE LOWER(nome) = ?', [nome.trim().toLowerCase()]);
    if (existente) {
      return res.status(400).json({ erro: 'Já existe um turno com este nome.' });
    }
    const nomeLower = nome.trim().toLowerCase();
    const horariosPadrao = {
      'manha': { inicio: '06:00', fim: '12:00' },
      'manhã': { inicio: '06:00', fim: '12:00' },
      'tarde': { inicio: '12:00', fim: '18:00' },
      'noite': { inicio: '18:00', fim: '23:00' },
    };
    const padrao = horariosPadrao[nomeLower];
    const hi = hora_inicio || padrao?.inicio || null;
    const hf = hora_fim || padrao?.fim || null;
    const codClean = await gerarCodigoUnico('turnos', 'TUR');
    const resultado = await runAsync(
      'INSERT INTO turnos (nome, codigo, hora_inicio, hora_fim) VALUES (?, ?, ?, ?) RETURNING id',
      [nome.trim(), codClean, hi, hf]
    );
    await registrarAuditoria(req, 'CRIAR_TURNO', 'turnos', resultado.lastID, null, { nome, codigo: codClean });
    return res.status(201).json({ mensagem: 'Turno criado com sucesso!', id: resultado.lastID, codigo: codClean });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao criar turno.' });
  }
});

// DELETE /api/admin/turnos/:id
router.delete('/turnos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const turno = await getAsync('SELECT * FROM turnos WHERE id = ?', [id]);
    if (!turno) return res.status(404).json({ erro: 'Turno não encontrado.' });
    const vinculados = await getAsync('SELECT COUNT(*) as qtd FROM alunos WHERE turno_id = ?', [id]);
    if (vinculados && parseInt(vinculados.qtd, 10) > 0) {
      return res.status(400).json({ erro: 'Não é possível excluir: há alunos vinculados a este turno.' });
    }
    await runAsync('DELETE FROM turnos WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_TURNO', 'turnos', id, turno, null);
    return res.json({ mensagem: 'Turno excluído com sucesso.' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao excluir turno.' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 4. CLÍNICAS
// ════════════════════════════════════════════════════════════════════════════
router.get('/clinicas', async (req, res) => {
  try {
    const clinicas = await supaSelect('clinicas', { ordenar: { coluna: 'nome' } });
    return res.json({ clinicas });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar clínicas.' }); }
});

router.post('/clinicas', async (req, res) => {
  try {
    const { nome, unidade_id, endereco, cidade, estado, cep, telefone, email, latitude, longitude, raio_geofence_metros, horario_funcionamento } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome da clínica.' });
    const resultado = await runAsync(
      `INSERT INTO clinicas (nome, unidade_id, endereco, cidade, estado, cep, telefone, email, latitude, longitude, raio_geofence_metros, horario_funcionamento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [nome.trim(), unidade_id || null, endereco || null, cidade || 'Recife', estado || 'PE', cep || null, telefone || null, email || null, latitude || null, longitude || null, raio_geofence_metros || 200, horario_funcionamento || null]
    );
    await registrarAuditoria(req, 'CRIAR_CLINICA', 'clinicas', resultado.lastID, null, { nome });
    return res.status(201).json({ mensagem: 'Clínica criada com sucesso!', id: resultado.lastID });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao criar clínica.' }); }
});

router.put('/clinicas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, endereco, cidade, estado, cep, telefone, email, latitude, longitude, raio_geofence_metros, horario_funcionamento, status } = req.body;
    const antiga = await getAsync('SELECT * FROM clinicas WHERE id = ?', [id]);
    if (!antiga) return res.status(404).json({ erro: 'Clínica não encontrada.' });
    await runAsync(
      `UPDATE clinicas SET nome=?, endereco=?, cidade=?, estado=?, cep=?, telefone=?, email=?, latitude=?, longitude=?, raio_geofence_metros=?, horario_funcionamento=?, status=? WHERE id=?`,
      [nome || antiga.nome, endereco ?? antiga.endereco, cidade || antiga.cidade, estado || antiga.estado, cep ?? antiga.cep, telefone ?? antiga.telefone, email ?? antiga.email, latitude ?? antiga.latitude, longitude ?? antiga.longitude, raio_geofence_metros || antiga.raio_geofence_metros, horario_funcionamento ?? antiga.horario_funcionamento, status || antiga.status, id]
    );
    await registrarAuditoria(req, 'ALTERAR_CLINICA', 'clinicas', id, antiga, req.body);
    return res.json({ mensagem: 'Clínica atualizada com sucesso!' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar clínica.' }); }
});

router.delete('/clinicas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const c = await getAsync('SELECT * FROM clinicas WHERE id = ?', [id]);
    if (!c) return res.status(404).json({ erro: 'Clínica não encontrada.' });
    await runAsync('DELETE FROM clinicas WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_CLINICA', 'clinicas', id, c, null);
    return res.json({ mensagem: 'Clínica excluída com sucesso.' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao excluir clínica.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// 5. SETORES
// ════════════════════════════════════════════════════════════════════════════
router.get('/setores', async (req, res) => {
  try {
    const [setoresRaw, unidades] = await Promise.all([
      supaSelect('setores_clinica', { colunas: '*, unidade_id', ordenar: { coluna: 'nome' } }),
      supaSelect('unidades', { colunas: 'id, nome' })
    ]);
    const unidadesMap = Object.fromEntries(unidades.map(u => [u.id, u]));
    const setores = setoresRaw.map(s => ({ ...s, unidade_nome: unidadesMap[s.unidade_id]?.nome || null }));
    return res.json({ setores });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar setores.' }); }
});

router.post('/setores', async (req, res) => {
  try {
    const { nome, unidade_id, capacidade_padrao } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome do setor.' });
    const uid = unidade_id || (await getAsync('SELECT id FROM unidades LIMIT 1'))?.id;
    if (!uid) return res.status(400).json({ erro: 'Cadastre ao menos uma Unidade antes de criar setores.' });
    const resultado = await runAsync(
      'INSERT INTO setores_clinica (unidade_id, nome, capacidade_padrao, status) VALUES (?, ?, ?, ?) RETURNING id',
      [uid, nome.trim(), capacidade_padrao || 8, 'ativo']
    );
    await registrarAuditoria(req, 'CRIAR_SETOR', 'setores_clinica', resultado.lastID, null, { nome });
    return res.status(201).json({ mensagem: 'Setor criado com sucesso!', id: resultado.lastID });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao criar setor.' }); }
});

router.put('/setores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, capacidade_padrao, status } = req.body;
    const antiga = await getAsync('SELECT * FROM setores_clinica WHERE id = ?', [id]);
    if (!antiga) return res.status(404).json({ erro: 'Setor não encontrado.' });
    await runAsync('UPDATE setores_clinica SET nome=?, capacidade_padrao=?, status=? WHERE id=?',
      [nome || antiga.nome, capacidade_padrao || antiga.capacidade_padrao, status || antiga.status, id]);
    await registrarAuditoria(req, 'ALTERAR_SETOR', 'setores_clinica', id, antiga, req.body);
    return res.json({ mensagem: 'Setor atualizado com sucesso!' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar setor.' }); }
});

router.delete('/setores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const s = await getAsync('SELECT * FROM setores_clinica WHERE id = ?', [id]);
    if (!s) return res.status(404).json({ erro: 'Setor não encontrado.' });
    await runAsync('DELETE FROM setores_clinica WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_SETOR', 'setores_clinica', id, s, null);
    return res.json({ mensagem: 'Setor excluído com sucesso.' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao excluir setor.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// 6. ESPECIALIDADES
// ════════════════════════════════════════════════════════════════════════════
router.get('/especialidades', async (req, res) => {
  try {
    const items = await supaSelect('especialidades', { ordenar: { coluna: 'nome' } });
    return res.json({ especialidades: items });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar especialidades.' }); }
});

router.post('/especialidades', async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome da especialidade.' });
    const existente = await getAsync('SELECT id FROM especialidades WHERE LOWER(nome) = ?', [nome.trim().toLowerCase()]);
    if (existente) return res.status(400).json({ erro: 'Já existe especialidade com este nome.' });
    const codClean = await gerarCodigoUnico('especialidades', 'ESP');
    const resultado = await runAsync(
      'INSERT INTO especialidades (nome, codigo, descricao) VALUES (?, ?, ?) RETURNING id',
      [nome.trim(), codClean, descricao || null]
    );
    await registrarAuditoria(req, 'CRIAR_ESPECIALIDADE', 'especialidades', resultado.lastID, null, { nome, codigo: codClean });
    return res.status(201).json({ mensagem: 'Especialidade criada com sucesso!', id: resultado.lastID, codigo: codClean });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao criar especialidade.' }); }
});

router.put('/especialidades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, codigo, descricao, status } = req.body;
    const antiga = await getAsync('SELECT * FROM especialidades WHERE id = ?', [id]);
    if (!antiga) return res.status(404).json({ erro: 'Especialidade não encontrada.' });
    await runAsync('UPDATE especialidades SET nome=?, codigo=?, descricao=?, status=? WHERE id=?',
      [nome || antiga.nome, codigo || antiga.codigo, descricao ?? antiga.descricao, status || antiga.status, id]);
    await registrarAuditoria(req, 'ALTERAR_ESPECIALIDADE', 'especialidades', id, antiga, req.body);
    return res.json({ mensagem: 'Especialidade atualizada com sucesso!' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar especialidade.' }); }
});

router.delete('/especialidades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const e = await getAsync('SELECT * FROM especialidades WHERE id = ?', [id]);
    if (!e) return res.status(404).json({ erro: 'Especialidade não encontrada.' });
    await runAsync('DELETE FROM especialidades WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_ESPECIALIDADE', 'especialidades', id, e, null);
    return res.json({ mensagem: 'Especialidade excluída com sucesso.' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao excluir especialidade.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// 7. PROFESSORES
// ════════════════════════════════════════════════════════════════════════════
router.get('/professores', async (req, res) => {
  try {
    const items = await allAsync(`
      SELECT p.*, c.nome as curso_nome
      FROM professores p
      LEFT JOIN cursos c ON p.curso_id = c.id
      ORDER BY p.nome
    `);
    return res.json({ professores: items });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar professores.' }); }
});

router.post('/professores', async (req, res) => {
  try {
    const { nome, curso_id } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome do professor.' });
    const resultado = await runAsync(
      `INSERT INTO professores (nome, curso_id, status) VALUES (?, ?, 'ativo') RETURNING id`,
      [nome.trim(), curso_id || null]
    );
    await registrarAuditoria(req, 'CRIAR_PROFESSOR', 'professores', resultado.lastID, null, { nome, curso_id });
    return res.status(201).json({ mensagem: 'Professor cadastrado com sucesso!', id: resultado.lastID });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao cadastrar professor.' }); }
});

router.put('/professores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, curso_id, status } = req.body;
    const antiga = await getAsync('SELECT * FROM professores WHERE id = ?', [id]);
    if (!antiga) return res.status(404).json({ erro: 'Professor não encontrado.' });
    await runAsync(
      `UPDATE professores SET nome=?, curso_id=?, status=? WHERE id=?`,
      [nome || antiga.nome, curso_id ?? antiga.curso_id, status || antiga.status, id]
    );
    await registrarAuditoria(req, 'ALTERAR_PROFESSOR', 'professores', id, antiga, req.body);
    return res.json({ mensagem: 'Professor atualizado com sucesso!' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar professor.' }); }
});

router.delete('/professores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await getAsync('SELECT * FROM professores WHERE id = ?', [id]);
    if (!p) return res.status(404).json({ erro: 'Professor não encontrado.' });
    await runAsync('DELETE FROM professores WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_PROFESSOR', 'professores', id, p, null);
    return res.json({ mensagem: 'Professor excluído com sucesso.' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao excluir professor.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// 8. SUPERVISORES
// ════════════════════════════════════════════════════════════════════════════
router.get('/supervisores', async (req, res) => {
  try {
    const items = await allAsync(`
      SELECT sv.*, c.nome as curso_nome
      FROM supervisores sv
      LEFT JOIN cursos c ON sv.curso_id = c.id
      ORDER BY sv.nome
    `);
    return res.json({ supervisores: items });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar supervisores.' }); }
});

router.post('/supervisores', async (req, res) => {
  try {
    const { nome, curso_id } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome do supervisor.' });
    const resultado = await runAsync(
      'INSERT INTO supervisores (nome, curso_id, status) VALUES (?, ?, ?) RETURNING id',
      [nome.trim(), curso_id || null, 'ativo']
    );
    await registrarAuditoria(req, 'CRIAR_SUPERVISOR', 'supervisores', resultado.lastID, null, { nome, curso_id });
    return res.status(201).json({ mensagem: 'Supervisor cadastrado com sucesso!', id: resultado.lastID });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao cadastrar supervisor.' }); }
});

router.put('/supervisores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, curso_id, status } = req.body;
    const antiga = await getAsync('SELECT * FROM supervisores WHERE id = ?', [id]);
    if (!antiga) return res.status(404).json({ erro: 'Supervisor não encontrado.' });
    await runAsync('UPDATE supervisores SET nome=?, curso_id=?, status=? WHERE id=?',
      [nome ?? antiga.nome, curso_id ?? antiga.curso_id, status || antiga.status, id]);
    await registrarAuditoria(req, 'ALTERAR_SUPERVISOR', 'supervisores', id, antiga, req.body);
    return res.json({ mensagem: 'Supervisor atualizado com sucesso!' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar supervisor.' }); }
});

router.delete('/supervisores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const s = await getAsync('SELECT * FROM supervisores WHERE id = ?', [id]);
    if (!s) return res.status(404).json({ erro: 'Supervisor não encontrado.' });
    await runAsync('DELETE FROM supervisores WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_SUPERVISOR', 'supervisores', id, s, null);
    return res.json({ mensagem: 'Supervisor excluído com sucesso.' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao excluir supervisor.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// 9. VÍNCULOS ACADÊMICOS (alunos)
// ════════════════════════════════════════════════════════════════════════════
router.get('/vinculos', async (req, res) => {
  try {
    const items = await allAsync(`
      SELECT a.*, u.nome as aluno_nome, u.email as aluno_email, u.matricula,
        c.nome as curso_nome, p.codigo as periodo_codigo, t.codigo as turno_codigo, s.nome as setor_nome
      FROM alunos a
      JOIN usuarios u ON a.usuario_id = u.id
      LEFT JOIN cursos c ON a.curso_id = c.id
      LEFT JOIN periodos p ON a.periodo_id = p.id
      LEFT JOIN turnos t ON a.turno_id = t.id
      LEFT JOIN setores_clinica s ON a.setor_id = s.id
      ORDER BY u.nome
    `);
    return res.json({ vinculos: items });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar vínculos.' }); }
});

router.put('/vinculos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { curso_id, periodo_id, turno_id, setor_id, carga_horaria_semanal_max, situacao } = req.body;
    const antiga = await getAsync('SELECT * FROM alunos WHERE id = ?', [id]);
    if (!antiga) return res.status(404).json({ erro: 'Vínculo não encontrado.' });
    await runAsync(
      `UPDATE alunos SET curso_id=?, periodo_id=?, turno_id=?, setor_id=?, carga_horaria_semanal_max=?, situacao=? WHERE id=?`,
      [curso_id ?? antiga.curso_id, periodo_id ?? antiga.periodo_id, turno_id ?? antiga.turno_id, setor_id ?? antiga.setor_id, carga_horaria_semanal_max || antiga.carga_horaria_semanal_max, situacao || antiga.situacao, id]
    );
    await registrarAuditoria(req, 'ALTERAR_VINCULO', 'alunos', id, antiga, req.body);
    return res.json({ mensagem: 'Vínculo atualizado com sucesso!' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar vínculo.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// 10. HORÁRIOS DE FUNCIONAMENTO
// ════════════════════════════════════════════════════════════════════════════
router.get('/horarios-funcionamento', async (req, res) => {
  try {
    const items = await allAsync('SELECT * FROM horarios_funcionamento ORDER BY dia_semana, hora_inicio');
    return res.json({ horarios: items });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar horários.' }); }
});

router.post('/horarios-funcionamento', async (req, res) => {
  try {
    const { dia_semana, hora_inicio, hora_fim, duracao_intervalo_min } = req.body;
    if (!dia_semana || !hora_inicio || !hora_fim) return res.status(400).json({ erro: 'Informe dia da semana, horário de início e fim.' });
    const resultado = await runAsync(
      'INSERT INTO horarios_funcionamento (dia_semana, hora_inicio, hora_fim, duracao_intervalo_min) VALUES (?, ?, ?, ?) RETURNING id',
      [dia_semana, hora_inicio, hora_fim, duracao_intervalo_min || 60]
    );
    await registrarAuditoria(req, 'CRIAR_HORARIO_FUNCIONAMENTO', 'horarios_funcionamento', resultado.lastID, null, req.body);
    return res.status(201).json({ mensagem: 'Horário de funcionamento criado!', id: resultado.lastID });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao criar horário.' }); }
});

router.put('/horarios-funcionamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dia_semana, hora_inicio, hora_fim, duracao_intervalo_min, status } = req.body;
    const antiga = await getAsync('SELECT * FROM horarios_funcionamento WHERE id = ?', [id]);
    if (!antiga) return res.status(404).json({ erro: 'Horário não encontrado.' });
    await runAsync('UPDATE horarios_funcionamento SET dia_semana=?, hora_inicio=?, hora_fim=?, duracao_intervalo_min=?, status=? WHERE id=?',
      [dia_semana || antiga.dia_semana, hora_inicio || antiga.hora_inicio, hora_fim || antiga.hora_fim, duracao_intervalo_min ?? antiga.duracao_intervalo_min, status || antiga.status, id]);
    await registrarAuditoria(req, 'ALTERAR_HORARIO_FUNCIONAMENTO', 'horarios_funcionamento', id, antiga, req.body);
    return res.json({ mensagem: 'Horário atualizado com sucesso!' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar horário.' }); }
});

router.delete('/horarios-funcionamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const h = await getAsync('SELECT * FROM horarios_funcionamento WHERE id = ?', [id]);
    if (!h) return res.status(404).json({ erro: 'Horário não encontrado.' });
    await runAsync('DELETE FROM horarios_funcionamento WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_HORARIO_FUNCIONAMENTO', 'horarios_funcionamento', id, h, null);
    return res.json({ mensagem: 'Horário excluído com sucesso.' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao excluir horário.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// 13. VAGAS POR HORÁRIO
// ════════════════════════════════════════════════════════════════════════════
router.get('/vagas-horarios', async (req, res) => {
  try {
    const items = await allAsync(`
      SELECT v.*, s.nome as setor_nome, sv.id as sup_id, u.nome as supervisor_nome, c.nome as curso_nome
      FROM vagas_horarios v
      LEFT JOIN setores_clinica s ON v.setor_id = s.id
      LEFT JOIN supervisores sv ON v.supervisor_id = sv.id
      LEFT JOIN usuarios u ON sv.usuario_id = u.id
      LEFT JOIN cursos c ON v.curso_id = c.id
      ORDER BY v.dia_semana, v.hora_inicio
    `);
    return res.json({ vagas: items });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar vagas.' }); }
});

router.post('/vagas-horarios', async (req, res) => {
  try {
    const { setor_id, supervisor_id, curso_id, dia_semana, hora_inicio, hora_fim, capacidade_max, justificativa_capacidade } = req.body;
    if (!setor_id || !supervisor_id || !curso_id || !dia_semana || !hora_inicio || !hora_fim) {
      return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }
    const resultado = await runAsync(
      `INSERT INTO vagas_horarios (setor_id, supervisor_id, curso_id, dia_semana, hora_inicio, hora_fim, capacidade_max, justificativa_capacidade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [setor_id, supervisor_id, curso_id, dia_semana, hora_inicio, hora_fim, capacidade_max || 8, justificativa_capacidade || null]
    );
    await registrarAuditoria(req, 'CRIAR_VAGA_HORARIO', 'vagas_horarios', resultado.lastID, null, req.body);
    return res.status(201).json({ mensagem: 'Vaga criada com sucesso!', id: resultado.lastID });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao criar vaga.' }); }
});

router.put('/vagas-horarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { capacidade_max, justificativa_capacidade, status } = req.body;
    const antiga = await getAsync('SELECT * FROM vagas_horarios WHERE id = ?', [id]);
    if (!antiga) return res.status(404).json({ erro: 'Vaga não encontrada.' });
    await runAsync('UPDATE vagas_horarios SET capacidade_max=?, justificativa_capacidade=?, status=? WHERE id=?',
      [capacidade_max || antiga.capacidade_max, justificativa_capacidade ?? antiga.justificativa_capacidade, status || antiga.status, id]);
    await registrarAuditoria(req, 'ALTERAR_VAGA_HORARIO', 'vagas_horarios', id, antiga, req.body);
    return res.json({ mensagem: 'Vaga atualizada com sucesso!' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar vaga.' }); }
});

router.delete('/vagas-horarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const v = await getAsync('SELECT * FROM vagas_horarios WHERE id = ?', [id]);
    if (!v) return res.status(404).json({ erro: 'Vaga não encontrada.' });
    await runAsync('DELETE FROM vagas_horarios WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_VAGA_HORARIO', 'vagas_horarios', id, v, null);
    return res.json({ mensagem: 'Vaga excluída com sucesso.' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao excluir vaga.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// 16-18. FERIADOS / RECESSOS / DATAS BLOQUEADAS
// ════════════════════════════════════════════════════════════════════════════
router.get('/feriados', async (req, res) => {
  try {
    const items = await allAsync(`
      SELECT f.*, s.nome as setor_nome
      FROM feriados_bloqueios f
      LEFT JOIN setores_clinica s ON f.setor_id = s.id
      ORDER BY f.data
    `);
    return res.json({ feriados: items });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar feriados/bloqueios.' }); }
});

router.post('/feriados', async (req, res) => {
  try {
    const { data, descricao, tipo, afeta_todos, setor_id } = req.body;
    if (!data || !descricao) return res.status(400).json({ erro: 'Informe a data e a descrição.' });
    const resultado = await runAsync(
      'INSERT INTO feriados_bloqueios (data, descricao, tipo, afeta_todos, setor_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [data, descricao.trim(), tipo || 'feriado', afeta_todos !== undefined ? afeta_todos : 1, setor_id || null]
    );
    await registrarAuditoria(req, 'CRIAR_FERIADO', 'feriados_bloqueios', resultado.lastID, null, req.body);
    return res.status(201).json({ mensagem: 'Registro criado com sucesso!', id: resultado.lastID });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao criar registro.' }); }
});

router.put('/feriados/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, descricao, tipo, afeta_todos, setor_id } = req.body;
    const antiga = await getAsync('SELECT * FROM feriados_bloqueios WHERE id = ?', [id]);
    if (!antiga) return res.status(404).json({ erro: 'Registro não encontrado.' });
    await runAsync('UPDATE feriados_bloqueios SET data=?, descricao=?, tipo=?, afeta_todos=?, setor_id=? WHERE id=?',
      [data || antiga.data, descricao || antiga.descricao, tipo || antiga.tipo, afeta_todos ?? antiga.afeta_todos, setor_id ?? antiga.setor_id, id]);
    await registrarAuditoria(req, 'ALTERAR_FERIADO', 'feriados_bloqueios', id, antiga, req.body);
    return res.json({ mensagem: 'Registro atualizado com sucesso!' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar registro.' }); }
});

router.delete('/feriados/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const f = await getAsync('SELECT * FROM feriados_bloqueios WHERE id = ?', [id]);
    if (!f) return res.status(404).json({ erro: 'Registro não encontrado.' });
    await runAsync('DELETE FROM feriados_bloqueios WHERE id = ?', [id]);
    await registrarAuditoria(req, 'EXCLUIR_FERIADO', 'feriados_bloqueios', id, f, null);
    return res.json({ mensagem: 'Registro excluído com sucesso.' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao excluir registro.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// 19-22. REGRAS DO SISTEMA (regras_sistema)
// ════════════════════════════════════════════════════════════════════════════
router.get('/regras', async (req, res) => {
  try {
    const { categoria } = req.query;
    let sql = 'SELECT * FROM regras_sistema';
    const params = [];
    if (categoria) { sql += ' WHERE categoria = ?'; params.push(categoria); }
    sql += ' ORDER BY categoria, chave';
    const items = await allAsync(sql, params);
    return res.json({ regras: items });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar regras.' }); }
});

router.put('/regras/:chave', async (req, res) => {
  try {
    const { chave } = req.params;
    const { valor } = req.body;
    if (valor === undefined) return res.status(400).json({ erro: 'Informe o novo valor.' });
    const antiga = await getAsync('SELECT * FROM regras_sistema WHERE chave = ?', [chave]);
    if (!antiga) return res.status(404).json({ erro: 'Regra não encontrada.' });
    await runAsync('UPDATE regras_sistema SET valor = ?, atualizado_em = NOW() WHERE chave = ?', [String(valor), chave]);
    await registrarAuditoria(req, 'ALTERAR_REGRA_SISTEMA', 'regras_sistema', antiga.id, { valor: antiga.valor }, { chave, valor });
    return res.json({ mensagem: `Regra '${chave}' atualizada com sucesso!` });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao atualizar regra.' }); }
});

router.post('/regras', async (req, res) => {
  try {
    const { chave, valor, descricao, tipo, categoria } = req.body;
    if (!chave || !valor || !categoria) return res.status(400).json({ erro: 'Informe chave, valor e categoria.' });
    const existente = await getAsync('SELECT id FROM regras_sistema WHERE chave = ?', [chave]);
    if (existente) return res.status(400).json({ erro: 'Já existe uma regra com esta chave.' });
    const resultado = await runAsync(
      'INSERT INTO regras_sistema (chave, valor, descricao, tipo, categoria) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [chave, String(valor), descricao || null, tipo || 'texto', categoria]
    );
    await registrarAuditoria(req, 'CRIAR_REGRA_SISTEMA', 'regras_sistema', resultado.lastID, null, req.body);
    return res.status(201).json({ mensagem: 'Regra criada com sucesso!', id: resultado.lastID });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao criar regra.' }); }
});

router.delete('/regras/:chave', async (req, res) => {
  try {
    const { chave } = req.params;
    const r = await getAsync('SELECT * FROM regras_sistema WHERE chave = ?', [chave]);
    if (!r) return res.status(404).json({ erro: 'Regra não encontrada.' });
    await runAsync('DELETE FROM regras_sistema WHERE chave = ?', [chave]);
    await registrarAuditoria(req, 'EXCLUIR_REGRA_SISTEMA', 'regras_sistema', r.id, r, null);
    return res.json({ mensagem: 'Regra excluída com sucesso.' });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao excluir regra.' }); }
});

// ════════════════════════════════════════════════════════════════════════════
// UNIDADES (auxiliar)
// ════════════════════════════════════════════════════════════════════════════
router.get('/unidades', async (req, res) => {
  try {
    const items = await allAsync('SELECT * FROM unidades ORDER BY nome');
    return res.json({ unidades: items });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao listar unidades.' }); }
});

router.post('/unidades', async (req, res) => {
  try {
    const { nome, endereco, cidade } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome da unidade.' });
    const resultado = await runAsync('INSERT INTO unidades (nome, endereco, cidade) VALUES (?, ?, ?) RETURNING id',
      [nome.trim(), endereco || null, cidade || 'Recife']);
    await registrarAuditoria(req, 'CRIAR_UNIDADE', 'unidades', resultado.lastID, null, { nome });
    return res.status(201).json({ mensagem: 'Unidade criada com sucesso!', id: resultado.lastID });
  } catch (err) { return res.status(500).json({ erro: 'Erro ao criar unidade.' }); }
});

module.exports = router;
