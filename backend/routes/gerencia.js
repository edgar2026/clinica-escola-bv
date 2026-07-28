const express = require('express');
const router = express.Router();
const { getAsync, allAsync, runAsync } = require('../database');
const { autenticarToken, autorizarPerfis } = require('../middleware/auth');
const { registrarAuditoria } = require('../utils/audit');

// Middleware para autorizar Admin e Gerencia
router.use(autenticarToken);
router.use(autorizarPerfis('admin', 'gerencia'));

// GET /api/gerencia/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const hojeStr = new Date().toISOString().split('T')[0];

    // 1. Total de alunos ativos
    const totalAlunos = await getAsync(`SELECT COUNT(*) as qtd FROM alunos WHERE situacao = 'ativo'`);

    // 2. Alunos presentes no momento
    const presentesNoMomento = await allAsync(`
      SELECT 
        p.id as ponto_id,
        p.hora_entrada,
        p.tipo_registro,
        p.status_frequencia,
        u.nome as aluno_nome,
        u.matricula,
        c.nome as curso_nome,
        s.nome as setor_nome
      FROM pontos p
      JOIN alunos a ON p.aluno_id = a.id
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN cursos c ON a.curso_id = c.id
      JOIN setores_clinica s ON a.setor_id = s.id
      WHERE p.data = ? AND p.hora_saida IS NULL
      ORDER BY p.hora_entrada DESC
    `, [hojeStr]);

    // 3. Contadores de Atrasados e Fora do Horário hoje
    const contadoresHoje = await getAsync(`
      SELECT 
        SUM(CASE WHEN status_frequencia = 'atraso' THEN 1 ELSE 0 END) as atrasados,
        SUM(CASE WHEN status_frequencia = 'presenca_fora_horario' THEN 1 ELSE 0 END) as fora_horario,
        SUM(CASE WHEN status_frequencia = 'presenca_no_horario' THEN 1 ELSE 0 END) as no_horario
      FROM pontos WHERE data = ?
    `, [hojeStr]);

    // 4. Ocupação dos Horários Hoje
    const slotsHoje = await allAsync(`
      SELECT v.id, s.nome as setor_nome, v.hora_inicio, v.hora_fim, v.capacidade_max
      FROM vagas_horarios v
      JOIN setores_clinica s ON v.setor_id = s.id
      WHERE v.status = 'ativo'
    `);

    let slotsLotados = 0;
    let slotsComVagas = 0;

    for (const slot of slotsHoje) {
      const occ = await getAsync(`SELECT COUNT(*) as qtd FROM agendamentos WHERE vaga_horario_id = ? AND data = ? AND status = 'confirmado'`, [slot.id, hojeStr]);
      if ((occ ? parseInt(occ.qtd, 10) : 0) >= slot.capacidade_max) {
        slotsLotados++;
      } else {
        slotsComVagas++;
      }
    }

    // 5. Pendências de Validação de Presença Fora do Horário
    const pendenciasForaHorario = await allAsync(`
      SELECT 
        p.id as ponto_id,
        p.data,
        p.hora_entrada,
        p.hora_saida,
        p.observacao,
        u.nome as aluno_nome,
        u.matricula,
        c.nome as curso_nome
      FROM pontos p
      JOIN alunos a ON p.aluno_id = a.id
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN cursos c ON a.curso_id = c.id
      WHERE p.status_frequencia = 'presenca_fora_horario' AND p.validado_por IS NULL
      ORDER BY p.data DESC
    `);

    // 6. Justificativas pendentes
    const justificativasPendentes = await allAsync(`
      SELECT j.*, u.nome as aluno_nome, u.matricula
      FROM justificativas j
      JOIN alunos a ON j.aluno_id = a.id
      JOIN usuarios u ON a.usuario_id = u.id
      WHERE j.status = 'pendente'
      ORDER BY j.criado_em DESC
    `);

    return res.json({
      metricas: {
        totalAlunosCadastrados: (totalAlunos ? parseInt(totalAlunos.qtd, 10) : 0),
        alunosPresentesAgora: presentesNoMomento.length,
        alunosAtrasadosHoje: (contadoresHoje && contadoresHoje.atrasados) || 0,
        alunosForaHorarioHoje: (contadoresHoje && contadoresHoje.fora_horario) || 0,
        slotsLotados,
        slotsComVagas,
        pendenciasValidacao: pendenciasForaHorario.length,
        justificativasPendentes: justificativasPendentes.length
      },
      presentesNoMomento,
      pendenciasForaHorario,
      justificativasPendentes
    });
  } catch (err) {
    console.error('Erro no dashboard da gerência:', err);
    return res.status(500).json({ erro: 'Erro ao carregar dados gerenciais.' });
  }
});

// POST /api/gerencia/validar-fora-horario
router.post('/validar-fora-horario', async (req, res) => {
  try {
    const { ponto_id, acao, parecer } = req.body;

    if (!ponto_id || !acao || !parecer) {
      return res.status(400).json({ erro: 'Informe o ID do ponto, a ação (aprovar/rejeitar) e o parecer administrativo com justificativa.' });
    }

    const ponto = await getAsync('SELECT * FROM pontos WHERE id = ?', [ponto_id]);
    if (!ponto) return res.status(404).json({ erro: 'Registro de ponto não encontrado.' });

    const novoStatus = acao === 'aprovar' ? 'hora_extra' : 'ausencia';
    const obsAtualizada = `${ponto.observacao || ''} | Parecer Gerência: ${parecer}`;

    await runAsync(`
      UPDATE pontos 
      SET status_frequencia = ?, validado_por = ?, observacao = ?
      WHERE id = ?
    `, [novoStatus, req.usuario.id, obsAtualizada, ponto_id]);

    // Notificar aluno
    const alunoUser = await getAsync('SELECT u.id FROM alunos a JOIN usuarios u ON a.usuario_id = u.id WHERE a.id = ?', [ponto.aluno_id]);
    if (alunoUser) {
      const tipoNotif = acao === 'aprovar' ? 'sucesso' : 'erro';
      const statusTexto = acao === 'aprovar' ? 'APROVADA' : 'REJEITADA';
      await runAsync(`
        INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo)
        VALUES (?, 'Validação de Presença Fora do Horário', ?, ?)
        RETURNING id
      `, [alunoUser.id, `Sua presença no dia ${ponto.data} foi ${statusTexto} pela coordenação. Parecer: ${parecer}`, tipoNotif]);
    }

    await registrarAuditoria(req, 'VALIDAR_PRESENCA_FORA_HORARIO', 'pontos', ponto_id, { status: 'presenca_fora_horario' }, { status: novoStatus }, parecer);

    return res.json({ mensagem: `Presença fora do horário ${acao === 'aprovar' ? 'aprovada' : 'rejeitada'} com sucesso!` });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao validar presença fora do horário.' });
  }
});

// POST /api/gerencia/alterar-horario-aluno
router.post('/alterar-horario-aluno', async (req, res) => {
  try {
    const { agendamento_id, nova_vaga_id, nova_data, justificativa } = req.body;

    if (!agendamento_id || !nova_vaga_id || !nova_data || !justificativa) {
      return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios, incluindo a justificativa administrativa.' });
    }

    const agendamentoAntigo = await getAsync('SELECT * FROM agendamentos WHERE id = ?', [agendamento_id]);
    if (!agendamentoAntigo) return res.status(404).json({ erro: 'Agendamento original não encontrado.' });

    const vaga = await getAsync('SELECT * FROM vagas_horarios WHERE id = ?', [nova_vaga_id]);
    const contagem = await getAsync(`SELECT COUNT(*) as ocupadas FROM agendamentos WHERE vaga_horario_id = ? AND data = ? AND status = 'confirmado'`, [nova_vaga_id, nova_data]);
    
    if ((contagem ? parseInt(contagem.ocupadas, 10) : 0) >= vaga.capacidade_max) {
      return res.status(400).json({ erro: `A nova vaga escolhida está lotada (${vaga.capacidade_max}/${vaga.capacidade_max}).` });
    }

    await runAsync(`
      UPDATE agendamentos 
      SET vaga_horario_id = ?, data = ?, hora_inicio = ?, hora_fim = ?
      WHERE id = ?
    `, [nova_vaga_id, nova_data, vaga.hora_inicio, vaga.hora_fim, agendamento_id]);

    const alunoUser = await getAsync('SELECT u.id FROM alunos a JOIN usuarios u ON a.usuario_id = u.id WHERE a.id = ?', [agendamentoAntigo.aluno_id]);
    if (alunoUser) {
      await runAsync(`
        INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo)
        VALUES (?, 'Horário Alterado pela Coordenação', ?, 'alerta')
        RETURNING id
      `, [alunoUser.id, `Seu horário do dia ${agendamentoAntigo.data} foi alterado para ${nova_data} às ${vaga.hora_inicio}. Motivo: ${justificativa}. Consulte o painel Meu Horário Firmado.`]);
    }

    await registrarAuditoria(req, 'ALTERACAO_ADMINISTRATIVA_AGENDAMENTO', 'agendamentos', agendamento_id, agendamentoAntigo, { nova_vaga_id, nova_data }, justificativa);

    return res.json({ mensagem: 'Horário do aluno alterado com sucesso! O painel "Meu Horário Firmado" do aluno foi atualizado automaticamente.' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao alterar horário do aluno.' });
  }
});

// GET /api/gerencia/relatorios
router.get('/relatorios', async (req, res) => {
  try {
    const { tipo, data_inicio, data_fim, curso_id, periodo_id, turno_id } = req.query;

    let sql = `
      SELECT 
        p.id, p.data, p.hora_entrada, p.hora_saida, p.tempo_total_minutos, p.status_frequencia, p.tipo_registro,
        u.nome as aluno_nome, u.matricula, c.nome as curso_nome, pe.codigo as periodo_codigo, t.codigo as turno_codigo, s.nome as setor_nome
      FROM pontos p
      JOIN alunos a ON p.aluno_id = a.id
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN cursos c ON a.curso_id = c.id
      LEFT JOIN periodos pe ON a.periodo_id = pe.id
      LEFT JOIN turnos t ON a.turno_id = t.id
      JOIN setores_clinica s ON a.setor_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (data_inicio && data_fim) {
      sql += ' AND p.data BETWEEN ? AND ?';
      params.push(data_inicio, data_fim);
    }
    if (curso_id) {
      sql += ' AND a.curso_id = ?';
      params.push(curso_id);
    }
    if (periodo_id) {
      sql += ' AND a.periodo_id = ?';
      params.push(periodo_id);
    }
    if (turno_id) {
      sql += ' AND a.turno_id = ?';
      params.push(turno_id);
    }

    sql += ' ORDER BY p.data DESC, p.hora_entrada DESC';

    const resultados = await allAsync(sql, params);

    return res.json({
      relatorioMeta: {
        tipo: tipo || 'Frequência Geral',
        dataGeracao: new Date().toISOString(),
        geradoPor: req.usuario.nome,
        totalRegistros: resultados.length
      },
      dados: resultados
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao gerar relatório.' });
  }
});

module.exports = router;
