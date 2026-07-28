const express = require('express');
const router = express.Router();
const { getAsync, allAsync, runAsync } = require('../database');
const { autenticarToken } = require('../middleware/auth');
const { registrarAuditoria } = require('../utils/audit');

// Tolerância em minutos antes/depois do horário de início do slot
const TOLERANCIA_MINUTOS = 30;

// Helper: converte string HH:MM em minutos desde meia-noite
function horaParaMinutos(horaStr) {
  const [h, m] = horaStr.split(':').map(Number);
  return h * 60 + m;
}

// GET /api/pontos/status-hoje - Retorna o status do aluno para bater ponto hoje
router.get('/status-hoje', autenticarToken, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'aluno') {
      return res.json({ podeRegistrar: true, motivo: 'admin' });
    }

    const aluno = await getAsync('SELECT id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);
    if (!aluno) return res.status(403).json({ erro: 'Aluno não cadastrado.' });

    const hojeStr = new Date().toISOString().split('T')[0];
    const agora = new Date();
    const horaAtualStr = agora.toTimeString().split(' ')[0].substring(0, 5);
    const minAtual = horaParaMinutos(horaAtualStr);

    // Buscar agendamentos confirmados para hoje
    const agendamentosHoje = await allAsync(`
      SELECT * FROM agendamentos
      WHERE aluno_id = ? AND data = ? AND status = 'confirmado'
      ORDER BY hora_inicio ASC
    `, [aluno.id, hojeStr]);

    // Verificar se já tem ponto aberto hoje
    const pontoAberto = await getAsync(`
      SELECT * FROM pontos
      WHERE aluno_id = ? AND data = ? AND hora_saida IS NULL
      ORDER BY id DESC LIMIT 1
    `, [aluno.id, hojeStr]);

    if (pontoAberto) {
      return res.json({
        podeRegistrar: true,
        pontoAberto: true,
        pontoId: pontoAberto.id,
        horaEntrada: pontoAberto.hora_entrada,
        motivo: 'ponto_em_aberto',
        mensagem: `Entrada registrada às ${pontoAberto.hora_entrada}. Registre a saída quando sair.`
      });
    }

    if (agendamentosHoje.length === 0) {
      return res.json({
        podeRegistrar: false,
        pontoAberto: false,
        motivo: 'sem_agendamento',
        mensagem: '🔒 Acesso bloqueado! Você não possui agendamento confirmado para hoje. Procure a coordenação para agendar seu horário.'
      });
    }

    // Verificar se algum slot está dentro da janela de tolerância agora
    let slotPermitido = null;
    for (const ag of agendamentosHoje) {
      const minInicio = horaParaMinutos(ag.hora_inicio);
      const minFim = horaParaMinutos(ag.hora_fim);
      const inicio_janela = minInicio - TOLERANCIA_MINUTOS;
      const fim_janela = minFim;

      if (minAtual >= inicio_janela && minAtual <= fim_janela) {
        slotPermitido = ag;
        break;
      }
    }

    if (!slotPermitido) {
      const horariosPermitidos = agendamentosHoje.map(ag => {
        const minInicio = horaParaMinutos(ag.hora_inicio);
        const janela = minInicio - TOLERANCIA_MINUTOS;
        const hJanela = String(Math.floor(janela / 60)).padStart(2, '0');
        const mJanela = String(janela % 60).padStart(2, '0');
        return `${hJanela}:${mJanela} – ${ag.hora_fim}`;
      }).join(', ');

      return res.json({
        podeRegistrar: false,
        pontoAberto: false,
        agendamentosHoje,
        motivo: 'fora_janela_horario',
        mensagem: `🔒 Acesso bloqueado! Seu registro só é permitido nos horários: ${horariosPermitidos}. Horário atual: ${horaAtualStr}.`
      });
    }

    return res.json({
      podeRegistrar: true,
      pontoAberto: false,
      agendamentoAtivo: slotPermitido,
      motivo: 'dentro_do_horario',
      mensagem: `✅ Agendamento confirmado para hoje: ${slotPermitido.hora_inicio} – ${slotPermitido.hora_fim}. Pode registrar o ponto!`
    });

  } catch (err) {
    console.error('Erro ao verificar status de ponto:', err);
    return res.status(500).json({ erro: 'Erro ao verificar status do ponto.' });
  }
});

// POST /api/pontos/registrar - Registrar Entrada ou Saída
router.post('/registrar', autenticarToken, async (req, res) => {
  try {
    const { tipo_registro, qr_code_validacao, pin_validacao, acao } = req.body;
    const hojeStr = new Date().toISOString().split('T')[0];
    const agora = new Date();
    const horaAtualStr = agora.toTimeString().split(' ')[0].substring(0, 5);
    const minAtual = horaParaMinutos(horaAtualStr);

    // Obter Aluno
    let alunoId = null;
    if (req.usuario.perfil === 'aluno') {
      const aluno = await getAsync('SELECT id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);
      if (!aluno) return res.status(403).json({ erro: 'Aluno não cadastrado.' });
      alunoId = aluno.id;
    } else if (req.body.aluno_id) {
      alunoId = req.body.aluno_id;
    }

    // Validar QR Code ou PIN
    if (tipo_registro === 'qrcode' && qr_code_validacao && qr_code_validacao !== 'UNINASSAU-CLINICA-VALIDO-2026') {
      return res.status(400).json({ erro: 'QR Code de validação da Clínica-Escola é inválido ou expirou.' });
    }
    if (tipo_registro === 'pin' && pin_validacao && pin_validacao !== '1234') {
      return res.status(400).json({ erro: 'Código PIN de validação inválido.' });
    }

    // Verificar ponto aberto hoje
    const pontoAberto = await getAsync(`
      SELECT * FROM pontos 
      WHERE aluno_id = ? AND data = ? AND hora_saida IS NULL
      ORDER BY id DESC LIMIT 1
    `, [alunoId, hojeStr]);

    if (acao === 'saida' || pontoAberto) {
      // REGISTRAR SAÍDA
      if (!pontoAberto) {
        return res.status(400).json({ erro: 'Não foi localizado um registro de Entrada aberto para hoje.' });
      }

      const [hEnt, mEnt] = pontoAberto.hora_entrada.split(':').map(Number);
      const [hSai, mSai] = horaAtualStr.split(':').map(Number);
      const minEntrada = hEnt * 60 + mEnt;
      const minSaida = hSai * 60 + mSai;
      const tempoTotalMin = Math.max(0, minSaida - minEntrada);

      await runAsync(`
        UPDATE pontos 
        SET hora_saida = ?, tempo_total_minutos = ? 
        WHERE id = ?
      `, [horaAtualStr, tempoTotalMin, pontoAberto.id]);

      await registrarAuditoria(req, 'REGISTRAR_SAIDA_PONTO', 'pontos', pontoAberto.id, null, { hora_saida: horaAtualStr, tempoTotalMin });

      return res.json({
        mensagem: 'Saída registrada com sucesso!',
        ponto: {
          id: pontoAberto.id,
          data: pontoAberto.data,
          horaEntrada: pontoAberto.hora_entrada,
          horaSaida: horaAtualStr,
          tempoTotalPermanencia: `${Math.floor(tempoTotalMin / 60)}h ${tempoTotalMin % 60}min`,
          statusFrequencia: pontoAberto.status_frequencia
        }
      });

    } else {
      // REGISTRAR ENTRADA
      if (req.usuario.perfil === 'aluno') {
        const agendamentosHoje = await allAsync(`
          SELECT * FROM agendamentos
          WHERE aluno_id = ? AND data = ? AND status = 'confirmado'
          ORDER BY hora_inicio ASC
        `, [alunoId, hojeStr]);

        if (agendamentosHoje.length === 0) {
          return res.status(403).json({
            erro: '🔒 Registro bloqueado! Você não possui agendamento confirmado para hoje. Procure a coordenação para regularizar seu horário.',
            bloqueado: true,
            motivo: 'sem_agendamento'
          });
        }

        let slotPermitido = null;
        for (const ag of agendamentosHoje) {
          const minInicio = horaParaMinutos(ag.hora_inicio);
          const minFim = horaParaMinutos(ag.hora_fim);
          if (minAtual >= (minInicio - TOLERANCIA_MINUTOS) && minAtual <= minFim) {
            slotPermitido = ag;
            break;
          }
        }

        if (!slotPermitido) {
          const horariosPermitidos = agendamentosHoje.map(ag => {
            const minInicio = horaParaMinutos(ag.hora_inicio);
            const janela = minInicio - TOLERANCIA_MINUTOS;
            const hJanela = String(Math.floor(janela / 60)).padStart(2, '0');
            const mJanela = String(janela % 60).padStart(2, '0');
            return `${hJanela}:${mJanela}–${ag.hora_fim}`;
          }).join(', ');

          return res.status(403).json({
            erro: `🔒 Registro bloqueado! O horário atual (${horaAtualStr}) está fora da sua janela de atendimento. Horários permitidos: ${horariosPermitidos}.`,
            bloqueado: true,
            motivo: 'fora_janela_horario',
            horaAtual: horaAtualStr,
            horariosPermitidos
          });
        }

        const agendamentoHoje = slotPermitido;
        const [hAg, mAg] = agendamentoHoje.hora_inicio.split(':').map(Number);
        const minAgendado = hAg * 60 + mAg;
        const diferenca = minAtual - minAgendado;

        let statusFrequencia = 'presenca_no_horario';
        let observacao = null;

        if (diferenca > 15) {
          statusFrequencia = 'atraso';
          observacao = `Entrada registrada com atraso de ${diferenca} minutos.`;
        } else if (diferenca < -15) {
          statusFrequencia = 'entrada_antecipada';
        }

        const resPonto = await runAsync(`
          INSERT INTO pontos (aluno_id, agendamento_id, data, hora_entrada, tipo_registro, status_frequencia, observacao)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `, [alunoId, agendamentoHoje.id, hojeStr, horaAtualStr, tipo_registro || 'botao', statusFrequencia, observacao]);

        await registrarAuditoria(req, 'REGISTRAR_ENTRADA_PONTO', 'pontos', resPonto.lastID, null, { hora_entrada: horaAtualStr, statusFrequencia });

        return res.status(201).json({
          mensagem: statusFrequencia === 'atraso'
            ? `Entrada registrada com atraso de ${diferenca} minutos.`
            : 'Entrada registrada com sucesso!',
          ponto: {
            id: resPonto.lastID,
            data: hojeStr,
            horaEntrada: horaAtualStr,
            statusFrequencia,
            observacao
          }
        });

      } else {
        // Admin/Gerência inserindo ponto manual
        const resPonto = await runAsync(`
          INSERT INTO pontos (aluno_id, agendamento_id, data, hora_entrada, tipo_registro, status_frequencia, observacao)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `, [alunoId, null, hojeStr, horaAtualStr, 'manual', 'presenca_no_horario', 'Ponto inserido manualmente pelo administrador.']);

        return res.status(201).json({
          mensagem: 'Ponto manual registrado com sucesso!',
          ponto: { id: resPonto.lastID, data: hojeStr, horaEntrada: horaAtualStr }
        });
      }
    }

  } catch (err) {
    console.error('Erro ao registrar ponto:', err);
    return res.status(500).json({ erro: 'Erro interno ao processar registro de ponto.' });
  }
});

// POST /api/pontos/justificativa - Enviar justificativa
router.post('/justificativa', autenticarToken, async (req, res) => {
  try {
    const { ponto_id, motivo, descricao, arquivo_comprovante } = req.body;

    if (!motivo || !descricao) {
      return res.status(400).json({ erro: 'Preencha o motivo e a descrição da justificativa.' });
    }

    const aluno = await getAsync('SELECT id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);
    if (!aluno) return res.status(403).json({ erro: 'Apenas alunos podem submeter justificativas.' });

    const resJust = await runAsync(`
      INSERT INTO justificativas (aluno_id, ponto_id, motivo, descricao, arquivo_comprovante, status)
      VALUES (?, ?, ?, ?, ?, 'pendente')
      RETURNING id
    `, [aluno.id, ponto_id || null, motivo, descricao, arquivo_comprovante || null]);

    await registrarAuditoria(req, 'SUBMETER_JUSTIFICATIVA', 'justificativas', resJust.lastID);

    return res.status(201).json({ mensagem: 'Justificativa enviada para análise da coordenação com sucesso!' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao registrar justificativa.' });
  }
});

// GET /api/pontos/historico-hoje - Pontos do dia do aluno (para tabela "Batidas do dia")
router.get('/historico-hoje', autenticarToken, async (req, res) => {
  try {
    const hojeStr = new Date().toISOString().split('T')[0];
    let alunoId;

    if (req.usuario.perfil === 'aluno') {
      const aluno = await getAsync('SELECT id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);
      if (!aluno) return res.status(403).json({ erro: 'Aluno não cadastrado.' });
      alunoId = aluno.id;
    } else {
      alunoId = req.query.aluno_id;
    }

    const pontosHoje = await allAsync(`
      SELECT id, hora_entrada, hora_saida, tempo_total_minutos, tipo_registro, status_frequencia, observacao
      FROM pontos
      WHERE aluno_id = ? AND data = ?
      ORDER BY hora_entrada ASC
    `, [alunoId, hojeStr]);

    return res.json({ data: hojeStr, pontos: pontosHoje });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar batidas do dia.' });
  }
});

// POST /api/pontos/justificativa-upload - Submeter justificativa com URL de arquivo (Supabase Storage)
router.post('/justificativa-upload', autenticarToken, async (req, res) => {
  try {
    const { ponto_id, motivo, descricao, arquivo_url } = req.body;

    if (!motivo || !descricao) {
      return res.status(400).json({ erro: 'Preencha o motivo e a descrição da justificativa.' });
    }

    const aluno = await getAsync('SELECT id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);
    if (!aluno) return res.status(403).json({ erro: 'Apenas alunos podem submeter justificativas.' });

    const resJust = await runAsync(`
      INSERT INTO justificativas (aluno_id, ponto_id, motivo, descricao, arquivo_comprovante, status)
      VALUES (?, ?, ?, ?, ?, 'pendente')
      RETURNING id
    `, [aluno.id, ponto_id || null, motivo, descricao, arquivo_url || null]);

    await registrarAuditoria(req, 'SUBMETER_JUSTIFICATIVA_COM_ARQUIVO', 'justificativas', resJust.lastID, null, { arquivo_url });

    return res.status(201).json({ 
      mensagem: 'Justificativa com comprovante enviada para análise com sucesso!',
      id: resJust.lastID
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao registrar justificativa com arquivo.' });
  }
});

module.exports = router;
