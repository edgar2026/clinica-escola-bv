// Gerenciador Principal da SPA e Roteamento - Clínica-Escola UNINASSAU

let usuarioAtual = null;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Aplicação Clínica-Escola UNINASSAU Inicializada.');

  // Verificar se há token de autenticação ativo
  const token = ApiClient.getToken();
  if (token) {
    try {
      const data = await ApiClient.get('/auth/me');
      usuarioAtual = data.usuario;
      inicializarSessao(usuarioAtual);
    } catch (err) {
      console.warn('Sessão expirada ou inválida.');
      exibirTelaLogin();
    }
  } else {
    exibirTelaLogin();
  }
});

function inicializarSessao(usuario) {
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('app-main-layout').style.display = 'flex';
  document.getElementById('top-navbar').style.display = 'flex';

  // Atualizar dados no cabeçalho
  document.getElementById('nav-user-name').innerText = usuario.nome;
  document.getElementById('nav-user-profile').innerText = `[${usuario.perfil.toUpperCase()}]`;

  // Se for o primeiro acesso, forçar o modal de troca de senha
  if (usuario.primeiroAcesso) {
    document.getElementById('modal-primeiro-acesso').classList.add('active');
  }

  // Ajustar itens do menu lateral de acordo com o perfil
  configurarMenuSidebar(usuario.perfil);

  // Roteamento padrão inicial
  if (usuario.perfil === 'aluno') {
    navegarPara('dashboard-aluno');
  } else if (usuario.perfil === 'gerencia') {
    navegarPara('dashboard-gerencia');
  } else {
    navegarPara('gestao-usuarios-admin');
  }
}

function configurarMenuSidebar(perfil) {
  const navAluno = document.querySelectorAll('.nav-perfil-aluno');
  const navGerencia = document.querySelectorAll('.nav-perfil-gerencia');
  const navAdmin = document.querySelectorAll('.nav-perfil-admin');

  navAluno.forEach(el => el.style.display = perfil === 'aluno' ? 'flex' : 'none');
  navGerencia.forEach(el => el.style.display = (perfil === 'gerencia' || perfil === 'admin') ? 'flex' : 'none');
  navAdmin.forEach(el => el.style.display = perfil === 'admin' ? 'flex' : 'none');
}

function navegarPara(viewId) {
  // Esconder todas as telas
  const visoes = document.querySelectorAll('.view-section');
  visoes.forEach(v => v.style.display = 'none');

  // Atualizar botões da sidebar
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));

  const activeNav = document.getElementById(`nav-link-${viewId}`);
  if (activeNav) activeNav.classList.add('active');

  // Mostrar a visão selecionada
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) {
    targetView.style.display = 'block';
  }

  // Carregar dados dinâmicos da visão
  switch (viewId) {
    case 'dashboard-aluno':
      carregarDashboardAluno();
      break;
    case 'calendario-vagas':
      carregarGradeVagasCalendario();
      break;
    case 'meu-horario-firmado':
      carregarMeuHorarioFirmado();
      break;
    case 'registro-ponto':
      carregarHistoricoPontoAluno();
      break;
    case 'dashboard-gerencia':
      carregarDashboardGerencia();
      break;
    case 'relatorios-gerenciais':
      // Pronto para ação do usuário
      break;
    case 'gestao-usuarios-admin':
      carregarGestaoUsuariosAdmin();
      break;
    case 'auditoria-lgpd-admin':
      carregarLogsAuditoriaAdmin();
      break;
  }
}



// Formulário de Login Principal
async function submeterLogin(e) {
  e.preventDefault();
  const login = document.getElementById('login-input').value;
  const senha = document.getElementById('senha-input').value;
  const lembrar = document.getElementById('lembrar-check').checked;

  try {
    const res = await ApiClient.post('/auth/login', { login, senha, lembrar });
    ApiClient.setToken(res.token);
    usuarioAtual = res.usuario;
    showToast(res.mensagem, 'sucesso');
    inicializarSessao(usuarioAtual);
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

function encerrarSessao() {
  ApiClient.removeToken();
  showToast('Sessão encerrada com segurança.', 'info');
  exibirTelaLogin();
}

function exibirTelaLogin() {
  document.getElementById('app-main-layout').style.display = 'none';
  document.getElementById('top-navbar').style.display = 'none';
  document.getElementById('view-login').style.display = 'flex';
}

// Função para renderizar o Calendário de Vagas (Com travas visuais de Verde, Amarelo e Vermelho - 8/8 Vagas)
async function carregarGradeVagasCalendario() {
  const container = document.getElementById('container-grid-vagas');
  if (!container) return;

  try {
    const data = await ApiClient.get('/horarios/disponibilidade?dia_semana=1'); // Segunda-feira
    
    if (data.slots.length === 0) {
      container.innerHTML = `<p style="padding: 2rem; color: var(--text-muted);">Nenhum horário cadastrado para este setor.</p>`;
      return;
    }

    container.innerHTML = data.slots.map(s => `
      <div class="slot-card" style="border-left: 5px solid ${s.indicadorVisual === 'verde' ? 'var(--status-green)' : s.indicadorVisual === 'amarelo' ? 'var(--status-yellow)' : 'var(--status-red)'};">
        <div class="slot-header">
          <span class="slot-time">⏰ ${s.hora_inicio} - ${s.hora_fim}</span>
          <span class="badge-vaga ${s.indicadorVisual}">${s.vagasDisponiveis} vagas livres</span>
        </div>
        <div>
          <p style="font-weight: 600; color: var(--primary); font-size: 0.95rem;">${s.setor_nome}</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Prof.: ${s.supervisor_nome} (${s.especialidade})</p>
          <p style="font-size: 0.8rem; margin-top: 0.5rem; font-weight: 600; color: ${s.indicadorVisual === 'vermelho' ? 'var(--status-red)' : 'var(--text-dark)'};">
            ${s.mensagemStatus}
          </p>
        </div>
        <div>
          ${s.vagasDisponiveis > 0 
            ? `<button onclick="confirmarAgendamentoModal(${s.vaga_id}, '${s.hora_inicio}', '${s.setor_nome}', '${s.supervisor_nome}')" class="btn-secondary" style="width: 100%;">Reservar Horário</button>`
            : `<button onclick="entrarListaEspera(${s.vaga_id})" class="btn-logout" style="width: 100%; background-color: var(--status-yellow-bg); color: var(--status-yellow); border-color: var(--status-yellow);">Entrar na Lista de Espera</button>`
          }
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

function confirmarAgendamentoModal(vagaId, horaInicio, setorNome, supervisorNome) {
  document.getElementById('modal-reserva-vaga-id').value = vagaId;
  document.getElementById('modal-reserva-detalhes').innerHTML = `
    <div style="background: var(--bg-main); padding: 1rem; border-radius: 8px; font-size: 0.9rem;">
      <p><strong>Clínica / Setor:</strong> ${setorNome}</p>
      <p><strong>Supervisor Responsável:</strong> ${supervisorNome}</p>
      <p><strong>Horário:</strong> Próxima Segunda-feira às ${horaInicio}</p>
      <p><strong>Carga Horária:</strong> 1 hora computada</p>
    </div>
  `;
  document.getElementById('modal-confirmar-reserva').classList.add('active');
}

function fecharModalReserva() {
  document.getElementById('modal-confirmar-reserva').classList.remove('active');
}

async function executarReservaConfirmada() {
  try {
    const vagaId = document.getElementById('modal-reserva-vaga-id').value;
    // Data da próxima Segunda
    const hoje = new Date();
    const proximaSegunda = new Date();
    proximaSegunda.setDate(hoje.getDate() + ((1 + 7 - hoje.getDay()) % 7 || 7));
    const dataStr = proximaSegunda.toISOString().split('T')[0];

    const res = await ApiClient.post('/agendamentos', {
      vaga_horario_id: vagaId,
      data: dataStr
    });

    showToast(res.mensagem, 'sucesso');
    fecharModalReserva();
    navegarPara('meu-horario-firmado');
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

async function entrarListaEspera(vagaId) {
  const hoje = new Date();
  const proximaSegunda = new Date();
  proximaSegunda.setDate(hoje.getDate() + ((1 + 7 - hoje.getDay()) % 7 || 7));
  const dataStr = proximaSegunda.toISOString().split('T')[0];

  try {
    const res = await ApiClient.post('/agendamentos/lista-espera', { vaga_horario_id: vagaId, data: dataStr });
    showToast(res.mensagem, 'alerta');
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

async function submeterTrocaSenhaPrimeiroAcesso(e) {
  e.preventDefault();
  const novaSenha = document.getElementById('primeiro-senha-nova').value;
  const confirmaSenha = document.getElementById('primeiro-senha-confirma').value;

  try {
    const res = await ApiClient.post('/auth/primeiro-acesso', { novaSenha, confirmaSenha });
    showToast(res.mensagem, 'sucesso');
    document.getElementById('modal-primeiro-acesso').classList.remove('active');
  } catch (err) {
    showToast(err.message, 'erro');
  }
}
