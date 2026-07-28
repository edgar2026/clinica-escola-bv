// Controladores de Visão do Aluno - Clínica-Escola UNINASSAU

async function carregarDashboardAluno() {
  try {
    const data = await ApiClient.get('/alunos/dashboard');
    const { aluno, metricas, proximoAgendamento } = data;

    // Atualizar Métricas
    document.getElementById('stat-horas-cadastradas').innerText = `${metricas.horasCadastradasSemana} de ${metricas.cargaHorariaMaxSemana}h`;
    document.getElementById('stat-horas-cumpridas').innerText = `${metricas.horasCumpridasTotal}h`;
    document.getElementById('stat-atrasos').innerText = metricas.atrasos;
    document.getElementById('stat-faltas').innerText = metricas.faltas;

    // Atualizar Barra de Progresso
    const perc = Math.min(100, (metricas.horasCadastradasSemana / metricas.cargaHorariaMaxSemana) * 100);
    const progressBar = document.getElementById('progress-carga-horaria');
    if (progressBar) progressBar.style.width = `${perc}%`;

    // Atualizar Próximo Horário
    const elProximo = document.getElementById('proximo-horario-info');
    if (elProximo) {
      if (proximoAgendamento) {
        elProximo.innerHTML = `
          <div style="background-color: var(--status-green-bg); border-left: 4px solid var(--status-green); padding: 1rem; border-radius: 6px;">
            <strong style="color: var(--primary); font-size: 1.1rem;">${proximoAgendamento.data} (${proximoAgendamento.hora_inicio} às ${proximoAgendamento.hora_fim})</strong>
            <p style="margin-top: 0.25rem; font-size: 0.9rem;">Setor: ${proximoAgendamento.setor_nome} | Supervisor: ${proximoAgendamento.supervisor_nome}</p>
          </div>
        `;
      } else {
        elProximo.innerHTML = `<p style="color: var(--text-muted);">Nenhum agendamento futuro localizado.</p>`;
      }
    }
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

async function carregarMeuHorarioFirmado() {
  try {
    const data = await ApiClient.get('/alunos/meu-horario-firmado');
    const container = document.getElementById('grade-horario-firmado');
    if (!container) return;

    if (!data.horariosFirmados || data.horariosFirmados.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: #FFF; border-radius: 12px;">
          <h3 style="color: var(--primary);">Nenhum Horário Cadastrado para esta Semana</h3>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">Acesse o Calendário de Horários e selecione suas vagas (máximo 6h semanais).</p>
          <button onclick="navegarPara('calendario')" class="btn-primary" style="margin-top: 1rem;">Ir para Calendário de Vagas</button>
        </div>
      `;
      return;
    }

    let rowsHtml = data.horariosFirmados.map(h => `
      <tr>
        <td><strong>${h.data}</strong></td>
        <td>${h.hora_inicio} - ${h.hora_fim}</td>
        <td>${h.setor_nome}</td>
        <td>${h.supervisor_nome}</td>
        <td><span class="badge-vaga verde">Confirmado (${h.horas_computadas}h)</span></td>
        <td>
          <button onclick="cancelarAgendamentoAluno(${h.agendamento_id})" class="btn-logout" style="padding: 0.3rem 0.6rem;">Cancelar</button>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="printable-voucher" style="background: #FFF; padding: 2rem; border-radius: 12px; border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--primary); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <div>
            <span class="logo-badge">UNINASSAU</span>
            <h2 style="color: var(--primary); margin-top: 0.5rem;">Comprovante Oficial de Horário Firmado</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Código de Autenticidade: ${data.comprovanteInfo.codigoAutenticacao}</p>
          </div>
          <div style="text-align: right;">
            <button onclick="window.print()" class="btn-primary">🖨️ Imprimir Horário</button>
            <button onclick="showToast('Funcionalidade de envio por e-mail nao implementada.', 'info')" class="btn-secondary">✉️ Enviar por E-mail</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: var(--bg-main); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
          <div><strong>Aluno:</strong> ${data.aluno.nome}</div>
          <div><strong>Matrícula:</strong> ${data.aluno.matricula}</div>
          <div><strong>Curso:</strong> ${data.aluno.curso_nome}</div>
          <div><strong>Total Horas Firmadas:</strong> ${data.totalHorasSemana} / ${data.cargaHorariaMax}h</div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Clínica / Setor</th>
                <th>Professor Responsável</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

async function cancelarAgendamentoAluno(id) {
  if (!confirm('Deseja realmente cancelar este agendamento? A vaga será liberada para outros alunos.')) return;
  try {
    const res = await ApiClient.delete(`/agendamentos/${id}`);
    showToast(res.mensagem, 'sucesso');
    carregarMeuHorarioFirmado();
  } catch (err) {
    showToast(err.message, 'erro');
  }
}



async function baterPontoAluno(tipo, acao = 'entrada') {
  try {
    const body = {
      tipo_registro: tipo, // 'botao', 'qrcode', 'pin'
      acao
    };

    if (tipo === 'qrcode') {
      body.qr_code_validacao = 'UNINASSAU-CLINICA-VALIDO-2026';
    } else if (tipo === 'pin') {
      const pin = prompt('Digite o código PIN exibido no totem da Clínica-Escola (Padrão: 1234):');
      if (!pin) return;
      body.pin_validacao = pin;
    }

    const res = await ApiClient.post('/pontos/registrar', body);
    showToast(res.mensagem, 'sucesso');

    // Recarregar histórico
    carregarHistoricoPontoAluno();
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

async function carregarHistoricoPontoAluno() {
  try {
    const data = await ApiClient.get('/alunos/historico-frequencia');
    const tbody = document.getElementById('tbody-historico-ponto');
    if (!tbody) return;

    if (data.historico.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum registro de ponto encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.historico.map(p => `
      <tr>
        <td>${p.data}</td>
        <td><strong>${p.hora_entrada}</strong></td>
        <td>${p.hora_saida || '<span style="color: var(--status-yellow);">Em andamento</span>'}</td>
        <td>${p.tempo_total_minutos ? `${Math.floor(p.tempo_total_minutos / 60)}h ${p.tempo_total_minutos % 60}m` : '-'}</td>
        <td><span class="badge-vaga ${p.status_frequencia.includes('presenca') ? 'verde' : p.status_frequencia === 'atraso' ? 'amarelo' : 'vermelho'}">${p.status_frequencia.replace(/_/g, ' ')}</span></td>
        <td>${p.observacao || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'erro');
  }
}
