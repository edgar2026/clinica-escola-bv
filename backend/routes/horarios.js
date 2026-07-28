const express = require('express');
const router = express.Router();
const { allAsync, getAsync, supaSelect, supaCount } = require('../database');
const { autenticarToken } = require('../middleware/auth');

// GET /api/horarios/disponibilidade - Buscar vagas e disponibilidade por setor e dia da semana
router.get('/disponibilidade', autenticarToken, async (req, res) => {
  try {
    const { setor_id, dia_semana, data } = req.query;

    let whereClause = "WHERE v.status = 'ativo'";
    const params = [];

    if (req.usuario.perfil === 'aluno') {
      const aluno = await getAsync('SELECT curso_id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);
      if (aluno && aluno.curso_id) {
        whereClause += ' AND (v.curso_id = ? OR v.curso_id IS NULL)';
        params.push(aluno.curso_id);
      }
    }

    if (setor_id) {
      whereClause += ' AND v.setor_id = ?';
      params.push(setor_id);
    }

    if (dia_semana) {
      whereClause += ' AND v.dia_semana = ?';
      params.push(dia_semana);
    }

    // Buscar slots cadastrados com informações do setor
    const slots = await allAsync(`
      SELECT 
        v.id as vaga_id,
        v.setor_id,
        s.nome as setor_nome,
        v.dia_semana,
        v.hora_inicio,
        v.hora_fim,
        v.capacidade_max
      FROM vagas_horarios v
      JOIN setores_clinica s ON v.setor_id = s.id
      ${whereClause}
      ORDER BY v.dia_semana, v.hora_inicio
    `, params);

    const dataAlvo = data || new Date().toISOString().split('T')[0];

    // Para cada slot, calcular ocupação atual e status visual (Verde, Amarelo, Vermelho)
    const slotsComOcupacao = await Promise.all(slots.map(async (slot) => {
      const contagem = await getAsync(`
        SELECT COUNT(*) as ocupados 
        FROM agendamentos 
        WHERE vaga_horario_id = ? AND data = ? AND status = 'confirmado'
      `, [slot.vaga_id, dataAlvo]);

      const ocupados = contagem ? contagem.ocupados : 0;
      const disponiveis = Math.max(0, slot.capacidade_max - ocupados);

      let statusCor = 'verde'; // > 2 vagas
      if (disponiveis === 0) {
        statusCor = 'vermelho'; // Lotado 8/8
      } else if (disponiveis <= 2) {
        statusCor = 'amarelo'; // 1-2 vagas restantes
      }

      // Buscar nomes dos alunos agendados (para visão gerencial)
      const alunosInscritos = await allAsync(`
        SELECT a.id as aluno_id, u.nome, u.matricula, c.nome as curso
        FROM agendamentos ag
        JOIN alunos a ON ag.aluno_id = a.id
        JOIN usuarios u ON a.usuario_id = u.id
        JOIN cursos c ON a.curso_id = c.id
        WHERE ag.vaga_horario_id = ? AND ag.data = ? AND ag.status = 'confirmado'
      `, [slot.vaga_id, dataAlvo]);

      return {
        ...slot,
        data: dataAlvo,
        vagasOcupadas: ocupados,
        vagasDisponiveis: disponiveis,
        indicadorVisual: statusCor,
        mensagemStatus: disponiveis === 0 ? 'Horário Lotado (8 de 8 vagas ocupadas)' : `${ocupados} de ${slot.capacidade_max} vagas ocupadas`,
        alunosInscritos: req.usuario.perfil !== 'aluno' ? alunosInscritos : []
      };
    }));

    return res.json({ slots: slotsComOcupacao });
  } catch (err) {
    console.error('Erro ao buscar disponibilidade de horários:', err);
    return res.status(500).json({ erro: 'Erro ao consultar grade de horários.' });
  }
});

// GET /api/horarios/setores - Listar setores da clínica
router.get('/setores', autenticarToken, async (req, res) => {
  try {
    const setores = await supaSelect('setores_clinica', { colunas: 'id, nome, capacidade_padrao', filtros: { status: 'ativo' } });
    return res.json({ setores });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar setores.' });
  }
});

// GET /api/horarios/calendario-mes - Retorna ocupação dia a dia para o mês/ano
// ?mes=7&ano=2026  (ou mês/ano atual se não informado)
router.get('/calendario-mes', autenticarToken, async (req, res) => {
  try {
    let { mes, ano } = req.query;
    const hoje = new Date();
    mes = parseInt(mes) || (hoje.getMonth() + 1); // 1-12
    ano = parseInt(ano) || hoje.getFullYear();

    // Gerar todos os dias do mês
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const dias = [];

    // Buscar todas as vagas ativas com seus dias_semana e capacidade
    let vagasWhere = "WHERE status = 'ativo'";
    const vagasParams = [];

    if (req.usuario.perfil === 'aluno') {
      const aluno = await getAsync('SELECT curso_id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);
      if (aluno && aluno.curso_id) {
        vagasWhere += ' AND (curso_id = ? OR curso_id IS NULL)';
        vagasParams.push(aluno.curso_id);
      }
    }

    const vagas = await allAsync(`
      SELECT id, dia_semana, capacidade_max, hora_inicio, hora_fim,
             setor_id
      FROM vagas_horarios ${vagasWhere}
    `, vagasParams);

    for (let d = 1; d <= diasNoMes; d++) {
      const dataObj = new Date(ano, mes - 1, d);
      const diaSemana = dataObj.getDay(); // 0=Dom, 1=Seg ... 6=Sab
      const dataStr = dataObj.toISOString().split('T')[0];

      // Domingo não tem vagas
      if (diaSemana === 0) {
        dias.push({ data: dataStr, diaSemana, temVagas: false, totalSlots: 0, totalOcupadas: 0, totalDisponiveis: 0, indicador: 'vazio' });
        continue;
      }

      // Filtrar vagas que se encaixam neste dia da semana (SQLite usa 1=Seg … 6=Sab, JS usa 1=Seg)
      const vagasDia = vagas.filter(v => v.dia_semana === diaSemana);

      if (vagasDia.length === 0) {
        dias.push({ data: dataStr, diaSemana, temVagas: false, totalSlots: 0, totalOcupadas: 0, totalDisponiveis: 0, indicador: 'vazio' });
        continue;
      }

      // Somar ocupação do dia
      let totalOcupadas = 0;
      let totalCapacidade = 0;

      for (const v of vagasDia) {
        const contagem = await getAsync(`
          SELECT COUNT(*) as ocupados FROM agendamentos
          WHERE vaga_horario_id = ? AND data = ? AND status = 'confirmado'
        `, [v.id, dataStr]);
        totalOcupadas += contagem ? contagem.ocupados : 0;
        totalCapacidade += v.capacidade_max;
      }

      const totalDisponiveis = Math.max(0, totalCapacidade - totalOcupadas);
      const proporcaoLivre = totalCapacidade > 0 ? totalDisponiveis / totalCapacidade : 0;

      let indicador;
      if (totalDisponiveis === 0) {
        indicador = 'lotado';
      } else if (proporcaoLivre <= 0.25) {
        indicador = 'quase_lotado';
      } else {
        indicador = 'disponivel';
      }

      dias.push({
        data: dataStr,
        diaSemana,
        temVagas: true,
        totalSlots: vagasDia.length,
        totalCapacidade,
        totalOcupadas,
        totalDisponiveis,
        indicador
      });
    }

    return res.json({ mes, ano, dias, totalVagasAtivas: vagas.length });
  } catch (err) {
    console.error('Erro ao gerar calendário:', err);
    return res.status(500).json({ erro: 'Erro ao gerar calendário de disponibilidade.' });
  }
});

module.exports = router;

