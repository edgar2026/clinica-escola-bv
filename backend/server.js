require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');
const { cacheMiddleware, cacheInvalidationMiddleware, invalidateAll } = require('./middleware/cache');

const authRoutes = require('./routes/auth');
const alunoRoutes = require('./routes/alunos');
const horariosRoutes = require('./routes/horarios');
const agendamentoRoutes = require('./routes/agendamentos');
const pontoRoutes = require('./routes/pontos');
const gerenciaRoutes = require('./routes/gerencia');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const distPath = path.join(__dirname, '../dist');
const frontendPath = fs.existsSync(distPath) ? distPath : path.join(__dirname, '..');
app.use(express.static(frontendPath, {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

app.use(cacheMiddleware({ ttl: 60000, static: false }));

app.use(cacheInvalidationMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/alunos', alunoRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/pontos', pontoRoutes);
app.use('/api/gerencia', gerenciaRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/admin/cache-clear', (req, res) => {
  invalidateAll();
  res.json({ mensagem: 'Cache limpo com sucesso.', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
  res.json({
    sistema: 'Sistema de Controle de Ponto e Agendamento da Clínica-Escola UNINASSAU',
    status: 'ONLINE',
    versao: '1.0.0',
    dataHora: new Date().toISOString()
  });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ erro: 'Endpoint da API não encontrado.' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Erro não tratado na aplicação:', err);
  res.status(500).json({ erro: 'Ocorreu um erro interno no servidor.' });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`  SISTEMA DE CONTROLE DE PONTO E AGENDAMENTO - CLINICA-ESCOLA   `);
    console.log(`  UNINASSAU - RECURSOS COMPLETOS E LGPD DEPLOYED                `);
    console.log(`  Servidor executando na porta: ${PORT}                          `);
    console.log(`  Acesse no navegador: http://localhost:${PORT}                  `);
    console.log(`================================================================`);
  });
}).catch(err => {
  console.error('Falha crítica ao inicializar o banco de dados:', err);
});