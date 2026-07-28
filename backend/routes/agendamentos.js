const express = require('express');
const router = express.Router();
const { getAsync, allAsync, runAsync } = require('../database');
const { autenticarToken } = require('../middleware/auth');
const { registrarAuditoria } = require('../utils/audit');

// Helper para obter início e fim da semana (Segunda a Domingo)
function getSemanaRange(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  const day = d.getDay();
  const diffSegunda = d.getDate() - day + (day === 0 ? -6 : 1);
  const segunda = new Date(d.setDate(diffSegunda));
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  return {
    inicioSemana: segunda.toISOString().split('T')[0],
    fimSemana: domingo.toISOString().split('T')[0]
  };
}

// POST /api/agendamentos - Criar agendamento (Aluno)
router.post('/', autenticarToken, async (req, res) => {
  try {
    const { vaga_horario_id, data } = req.body;

    if (!vaga_horario_id || !data) {
      return res.status(400).json({ erro: 'Informe o ID da vaga e a data desejada.' });
    }

    // Verificar se o usuário é um aluno ativo
    const aluno = await getAsync(`SELECT * FROM alunos WHERE usuario_id = ? AND situacao = 'ativo'`, [req.usuario.id]);
    if (!aluno) {
      return res.status(403).json({ erro: 'Apenas alunos ativos podem realizar agendamentos.' });
    }

    // Validar se o dia da semana não é Domingo (0)
    const dataObj = new Date(data + 'T12:00:00');
    if (dataObj.getDay() === 0) {
      return res.status(400).json({ erro: 'A Clínica-Escola não possui funcionamento aos domingos.' });
    }

    // Buscar a vaga solicitada
    const vaga = await getAsync(`
      SELECT v.*, s.nome as setor_nome
      FROM vagas_horarios v
      JOIN setores_clinica s ON v.setor_id = s.id
      WHERE v.id = ? AND v.status = 'ativo'
    `, [vaga_horario_id]);

    if (!vaga) {
      return res.status(404).json({ erro: 'Horário/vaga não encontrado ou inativo.' });
    }

    // REGRA 1: Trava de Capacidade de Vagas
    const contagemVagas = await getAsync(`
      SELECT COUNT(*) as ocupadas 
      FROM agendamentos 
      WHERE vaga_horario_id = ? AND data = ? AND status = 'confirmado'
    `, [vaga_horario_id, data]);

    const vagasOcupadas = contagemVagas ? contagemVagas.ocupadas : 0;
    if (vagasOcupadas >= vaga.capacidade_max) {
      return res.status(400).json({ 
        erro: `Horário lotado! Limite máximo de ${vaga.capacidade_max} vagas já foi atingido para este horário.`,
        sugestaoListaEspera: true
      });
    }

    // REGRA 2: Trava de Carga Horária Semanal
    const { inicioSemana, fimSemana } = getSemanaRange(data);

    const somaHorasSemana = await getAsync(`
      SELECT SUM(horas_computadas) as total 
      FROM agendamentos 
      WHERE aluno_id = ? AND data BETWEEN ? AND ? AND status = 'confirmado'
    `, [aluno.id, inicioSemana, fimSemana]);

    const horasAtuais = somaHorasSemana && somaHorasSemana.total ? somaHorasSemana.total : 0;
    const duracaoNovoSlot = 1;

    if (horasAtuais + duracaoNovoSlot > aluno.carga_horaria_semanal_max) {
      return res.status(400).json({ 
        erro: `Limite de carga horária semanal excedido! Você já possui ${horasAtuais}h de ${aluno.carga_horaria_semanal_max}h permitidas cadastradas para esta semana.` 
      });
    }

    // REGRA 3: Impedir agendamentos duplicados
    const conflitoExistente = await getAsync(`
      SELECT id FROM agendamentos 
      WHERE aluno_id = ? AND data = ? AND hora_inicio = ? AND status = 'confirmado'
    `, [aluno.id, data, vaga.hora_inicio]);

    if (conflitoExistente) {
      return res.status(400).json({ erro: 'Você já possui um agendamento confirmado neste mesmo dia e horário.' });
    }

    // Registrar o agendamento
    const diaSemana = dataObj.getDay() === 0 ? 7 : dataObj.getDay();
    const resAgendamento = await runAsync(`
      INSERT INTO agendamentos (aluno_id, vaga_horario_id, data, dia_semana, hora_inicio, hora_fim, horas_computadas, status, criado_por)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'confirmado', ?)
      RETURNING id
    `, [aluno.id, vaga_horario_id, data, diaSemana, vaga.hora_inicio, vaga.hora_fim, req.usuario.id]);

    // Notificação ao aluno
    await runAsync(`
      INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo)
      VALUES (?, 'Agendamento Realizado', ?, 'sucesso')
      RETURNING id
    `, [req.usuario.id, `Seu agendamento para ${data} às ${vaga.hora_inicio} foi confirmado com sucesso.`]);

    await registrarAuditoria(req, 'CRIAR_AGENDAMENTO', 'agendamentos', resAgendamento.lastID, null, {
      aluno_id: aluno.id,
      data,
      hora: vaga.hora_inicio
    });

    return res.status(201).json({
      mensagem: 'Agendamento confirmado com sucesso!',
      agendamento: {
        id: resAgendamento.lastID,
        data,
        diaSemana,
        horaInicio: vaga.hora_inicio,
        horaFim: vaga.hora_fim,
        setorNome: vaga.setor_nome,
        horasCadastradasSemana: horasAtuais + duracaoNovoSlot,
        cargaHorariaMax: aluno.carga_horaria_semanal_max
      }
    });
  } catch (err) {
    console.error('Erro ao realizar agendamento:', err);
    return res.status(500).json({ erro: 'Erro interno ao processar a reserva de horário.' });
  }
});

// DELETE /api/agendamentos/:id - Cancelar Agendamento
router.delete('/:id', autenticarToken, async (req, res) => {
  try {
    const agendamentoId = req.params.id;
    const agendamento = await getAsync('SELECT * FROM agendamentos WHERE id = ?', [agendamentoId]);

    if (!agendamento) {
      return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    }

    if (req.usuario.perfil === 'aluno') {
      const aluno = await getAsync('SELECT id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);
      if (!aluno || agendamento.aluno_id !== aluno.id) {
        return res.status(403).json({ erro: 'Você não tem permissão para cancelar este agendamento.' });
      }
    }

    await runAsync(`UPDATE agendamentos SET status = 'cancelado' WHERE id = ?`, [agendamentoId]);

    // Verificar lista de espera
    const proximoEspera = await getAsync(`
      SELECT l.*, u.id as usuario_id 
      FROM lista_espera l
      JOIN alunos a ON l.aluno_id = a.id
      JOIN usuarios u ON a.usuario_id = u.id
      WHERE l.vaga_horario_id = ? AND l.data = ? AND l.status = 'aguardando'
      ORDER BY l.posicao ASC LIMIT 1
    `, [agendamento.vaga_horario_id, agendamento.data]);

    if (proximoEspera) {
      await runAsync(`UPDATE lista_espera SET status = 'notificado' WHERE id = ?`, [proximoEspera.id]);
      await runAsync(`
        INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo)
        VALUES (?, 'Vaga Liberada na Lista de Espera!', ?, 'alerta')
        RETURNING id
      `, [proximoEspera.usuario_id, `Uma vaga foi liberada para o horário de ${agendamento.data} às ${agendamento.hora_inicio}. Acesse o sistema e confirme seu agendamento.`]);
    }

    await registrarAuditoria(req, 'CANCELAR_AGENDAMENTO', 'agendamentos', agendamentoId, { status: 'confirmado' }, { status: 'cancelado' });

    return res.json({ mensagem: 'Agendamento cancelado com sucesso.' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao cancelar agendamento.' });
  }
});

// POST /api/agendamentos/lista-espera - Entrar na lista de espera
router.post('/lista-espera', autenticarToken, async (req, res) => {
  try {
    const { vaga_horario_id, data } = req.body;
    const aluno = await getAsync('SELECT id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);

    if (!aluno) return res.status(403).json({ erro: 'Apenas alunos podem entrar na lista de espera.' });

    const contagem = await getAsync(`SELECT COUNT(*) as qtd FROM lista_espera WHERE vaga_horario_id = ? AND data = ? AND status = 'aguardando'`, [vaga_horario_id, data]);
    const posicao = (contagem ? parseInt(contagem.qtd, 10) : 0) + 1;

    await runAsync(`
      INSERT INTO lista_espera (vaga_horario_id, aluno_id, data, posicao, status)
      VALUES (?, ?, ?, ?, 'aguardando')
      RETURNING id
    `, [vaga_horario_id, aluno.id, data, posicao]);

    return res.json({ mensagem: `Você foi adicionado à lista de espera na posição #${posicao}.` });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao entrar na lista de espera.' });
  }
});

module.exports = router;
