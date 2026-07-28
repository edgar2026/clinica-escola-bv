const express = require('express');
const router = express.Router();
const { getAsync, allAsync, runAsync } = require('../database');
const { autenticarToken, autorizarPerfis } = require('../middleware/auth');

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

// GET /api/alunos/dashboard - Painel principal do Aluno
router.get('/dashboard', autenticarToken, autorizarPerfis('aluno'), async (req, res) => {
  try {
    const aluno = await getAsync(`
      SELECT a.*, u.nome, u.email, u.matricula, c.nome as curso_nome, p.codigo as periodo_codigo, t.codigo as turno_codigo, s.nome as setor_nome
      FROM alunos a
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN cursos c ON a.curso_id = c.id
      LEFT JOIN periodos p ON a.periodo_id = p.id
      LEFT JOIN turnos t ON a.turno_id = t.id
      JOIN setores_clinica s ON a.setor_id = s.id
      WHERE a.usuario_id = ?
    `, [req.usuario.id]);

    if (!aluno) {
      return res.json({
        aluno: null,
        metricas: {
          horasCadastradasSemana: 0,
          cargaHorariaMaxSemana: 0,
          horasCumpridasTotal: 0,
          atrasos: 0,
          faltas: 0,
          foraHorario: 0
        },
        proximoAgendamento: null,
        notificacoes: [],
        mensagem: 'Cadastro de aluno nao encontrado. Solicite ao administrador o vínculo com um curso, período, turno e setor.'
      });
    }

    const hoje = new Date().toISOString().split('T')[0];
    const { inicioSemana, fimSemana } = getSemanaRange(hoje);

    // 1. Horas Cadastradas na Semana Vigente
    const somaCadastradas = await getAsync(`
      SELECT SUM(horas_computadas) as total 
      FROM agendamentos 
      WHERE aluno_id = ? AND data BETWEEN ? AND ? AND status = 'confirmado'
    `, [aluno.id, inicioSemana, fimSemana]);
    const horasCadastradasSemana = somaCadastradas && somaCadastradas.total ? somaCadastradas.total : 0;

    // 2. Horas Cumpridas no Semestre
    const somaCumpridas = await getAsync(`
      SELECT SUM(tempo_total_minutos) as total_minutos 
      FROM pontos 
      WHERE aluno_id = ? AND status_frequencia IN ('presenca_no_horario', 'entrada_antecipada', 'atraso', 'hora_extra')
    `, [aluno.id]);
    const horasCumpridasTotal = Math.round(((somaCumpridas && somaCumpridas.total_minutos) || 0) / 60);

    // 3. Contagem de Faltas e Atrasos
    const contagemFrequencia = await getAsync(`
      SELECT 
        SUM(CASE WHEN status_frequencia = 'atraso' THEN 1 ELSE 0 END) as atrasos,
        SUM(CASE WHEN status_frequencia = 'ausencia' THEN 1 ELSE 0 END) as faltas,
        SUM(CASE WHEN status_frequencia = 'presenca_fora_horario' THEN 1 ELSE 0 END) as fora_horario
      FROM pontos WHERE aluno_id = ?
    `, [aluno.id]);

    // 4. Próximo Horário Agendado
    const proximoAgendamento = await getAsync(`
      SELECT ag.*, s.nome as setor_nome
      FROM agendamentos ag
      JOIN vagas_horarios v ON ag.vaga_horario_id = v.id
      JOIN setores_clinica s ON v.setor_id = s.id
      WHERE ag.aluno_id = ? AND ag.data >= ? AND ag.status = 'confirmado'
      ORDER BY ag.data ASC, ag.hora_inicio ASC LIMIT 1
    `, [aluno.id, hoje]);

    // 5. Notificações não lidas
    const notificacoes = await allAsync('SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT 5', [req.usuario.id]);

    return res.json({
      aluno,
      metricas: {
        horasCadastradasSemana,
        cargaHorariaMaxSemana: aluno.carga_horaria_semanal_max,
        horasCumpridasTotal,
        atrasos: (contagemFrequencia && contagemFrequencia.atrasos) || 0,
        faltas: (contagemFrequencia && contagemFrequencia.faltas) || 0,
        foraHorario: (contagemFrequencia && contagemFrequencia.fora_horario) || 0
      },
      proximoAgendamento,
      notificacoes
    });
  } catch (err) {
    console.error('Erro no dashboard do aluno:', err);
    return res.status(500).json({ erro: 'Erro ao carregar dados do aluno.' });
  }
});

// GET /api/alunos/meu-horario-firmado - Painel Oficial da Grade Semanal
router.get('/meu-horario-firmado', autenticarToken, autorizarPerfis('aluno'), async (req, res) => {
  try {
    const { data_referencia } = req.query;
    const refData = data_referencia || new Date().toISOString().split('T')[0];
    const { inicioSemana, fimSemana } = getSemanaRange(refData);

    const aluno = await getAsync(`
      SELECT a.*, u.nome, u.email, u.matricula, c.nome as curso_nome, p.codigo as periodo_codigo, t.codigo as turno_codigo, s.nome as setor_nome
      FROM alunos a
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN cursos c ON a.curso_id = c.id
      LEFT JOIN periodos p ON a.periodo_id = p.id
      LEFT JOIN turnos t ON a.turno_id = t.id
      JOIN setores_clinica s ON a.setor_id = s.id
      WHERE a.usuario_id = ?
    `, [req.usuario.id]);

    if (!aluno) {
      return res.json({
        comprovanteInfo: { titulo: 'Horario Firmado Oficial - Clinica-Escola UNINASSAU', codigoAutenticacao: '', dataEmissao: new Date().toISOString() },
        aluno: null,
        semanaReferencia: { inicioSemana: '', fimSemana: '' },
        totalHorasSemana: 0,
        cargaHorariaMax: 0,
        horariosFirmados: []
      });
    }

    const agendamentosSemana = await allAsync(`
      SELECT 
        ag.id as agendamento_id,
        ag.data,
        ag.dia_semana,
        ag.hora_inicio,
        ag.hora_fim,
        ag.horas_computadas,
        ag.status,
        ag.criado_em,
        s.nome as setor_nome
      FROM agendamentos ag
      JOIN vagas_horarios v ON ag.vaga_horario_id = v.id
      JOIN setores_clinica s ON v.setor_id = s.id
      WHERE ag.aluno_id = ? AND ag.data BETWEEN ? AND ? AND ag.status = 'confirmado'
      ORDER BY ag.data ASC, ag.hora_inicio ASC
    `, [aluno.id, inicioSemana, fimSemana]);

    const totalHorasSemana = agendamentosSemana.reduce((sum, item) => sum + item.horas_computadas, 0);

    return res.json({
      comprovanteInfo: {
        titulo: 'Horário Firmado Oficial - Clínica-Escola UNINASSAU',
        codigoAutenticacao: `UNINASSAU-${aluno.matricula}-${refData.replace(/-/g, '')}`,
        dataEmissao: new Date().toISOString()
      },
      aluno,
      semanaReferencia: { inicioSemana, fimSemana },
      totalHorasSemana,
      cargaHorariaMax: aluno.carga_horaria_semanal_max,
      horariosFirmados: agendamentosSemana
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao carregar o Horário Firmado.' });
  }
});

// GET /api/alunos/historico-frequencia - Histórico de Ponto do Aluno
router.get('/historico-frequencia', autenticarToken, autorizarPerfis('aluno'), async (req, res) => {
  try {
    const aluno = await getAsync('SELECT id FROM alunos WHERE usuario_id = ?', [req.usuario.id]);

    if (!aluno) {
      return res.json({ historico: [] });
    }

    const historico = await allAsync(`
      SELECT p.*, j.status as status_justificativa, j.motivo as motivo_justificativa
      FROM pontos p
      LEFT JOIN justificativas j ON p.id = j.ponto_id
      WHERE p.aluno_id = ?
      ORDER BY p.data DESC, p.hora_entrada DESC
    `, [aluno.id]);

    return res.json({ historico });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao carregar histórico de frequência.' });
  }
});

module.exports = router;
