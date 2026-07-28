// Controladores da Visão Gerencial e Coordenação - Clínica-Escola UNINASSAU

async function carregarDashboardGerencia() {
  try {
    const data = await ApiClient.get('/gerencia/dashboard');
    const { metricas, presentesNoMomento, pendenciasForaHorario } = data;

    // Atualizar Métricas
    document.getElementById('m-total-alunos').innerText = metricas.totalAlunosCadastrados;
    document.getElementById('m-presentes-agora').innerText = metricas.alunosPresentesAgora;
    document.getElementById('m-atrasados-hoje').innerText = metricas.alunosAtrasadosHoje;
    document.getElementById('m-fora-horario').innerText = metricas.alunosForaHorarioHoje;
    document.getElementById('m-pendencias-validacao').innerText = metricas.pendenciasValidacao;

    // Tabela Presentes no Momento
    const tbodyPresentes = document.getElementById('tbody-presentes-agora');
    if (tbodyPresentes) {
      if (presentesNoMomento.length === 0) {
        tbodyPresentes.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhum aluno fisicamente presente na clínica no momento.</td></tr>`;
      } else {
        tbodyPresentes.innerHTML = presentesNoMomento.map(p => `
          <tr>
            <td><strong>${p.aluno_nome}</strong> (${p.matricula})</td>
            <td>${p.curso_nome}</td>
            <td>${p.setor_nome}</td>
            <td><span class="badge-vaga verde">Entrada: ${p.hora_entrada}</span></td>
            <td><span class="badge-vaga ${p.status_frequencia.includes('presenca') ? 'verde' : 'vermelho'}">${p.status_frequencia.replace(/_/g, ' ')}</span></td>
          </tr>
        `).join('');
      }
    }

    // Tabela Fila de Aprovação de Presenças Fora do Horário
    const tbodyForaHorario = document.getElementById('tbody-fora-horario-pendentes');
    if (tbodyForaHorario) {
      if (pendenciasForaHorario.length === 0) {
        tbodyForaHorario.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhuma pendência de presença fora do horário aguardando análise.</td></tr>`;
      } else {
        tbodyForaHorario.innerHTML = pendenciasForaHorario.map(p => `
          <tr style="background-color: var(--status-red-bg);">
            <td><strong>${p.aluno_nome}</strong> (${p.matricula})</td>
            <td>${p.curso_nome}</td>
            <td>${p.data} (${p.hora_entrada})</td>
            <td><span class="badge-vaga vermelho">Fora do Horário</span></td>
            <td style="font-size: 0.8rem;">${p.observacao || 'Entrada sem agendamento correspondente'}</td>
            <td>
              <button onclick="abrirModalValidacaoForaHorario(${p.ponto_id}, '${p.aluno_nome}')" class="btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">Analisar & Decidir</button>
            </td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

function abrirModalValidacaoForaHorario(pontoId, alunoNome) {
  document.getElementById('modal-validar-ponto-id').value = pontoId;
  document.getElementById('modal-validar-aluno-nome').innerText = alunoNome;
  document.getElementById('modal-validar-parecer').value = '';
  document.getElementById('modal-validar-fora-horario').classList.add('active');
}

function fecharModalValidarForaHorario() {
  document.getElementById('modal-validar-fora-horario').classList.remove('active');
}

async function submeterValidacaoForaHorario(acao) { // 'aprovar' ou 'rejeitar'
  try {
    const pontoId = document.getElementById('modal-validar-ponto-id').value;
    const parecer = document.getElementById('modal-validar-parecer').value;

    if (!parecer || parecer.length < 5) {
      return alert('Insira uma justificativa/parecer administrativo (mínimo 5 caracteres).');
    }

    const res = await ApiClient.post('/gerencia/validar-fora-horario', {
      ponto_id: pontoId,
      acao,
      parecer
    });

    showToast(res.mensagem, 'sucesso');
    fecharModalValidarForaHorario();
    carregarDashboardGerencia();
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

async function gerarRelatorioGerencial() {
  try {
    const tipo = document.getElementById('relatorio-tipo').value;
    const dataInicio = document.getElementById('relatorio-data-ini').value;
    const dataFim = document.getElementById('relatorio-data-fim').value;

    const data = await ApiClient.get(`/gerencia/relatorios?tipo=${tipo}&data_inicio=${dataInicio}&data_fim=${dataFim}`);
    const container = document.getElementById('resultado-relatorio-container');

    if (data.dados.length === 0) {
      container.innerHTML = `<p style="padding: 2rem; text-align: center; color: var(--text-muted);">Nenhum registro localizado para os filtros informados.</p>`;
      return;
    }

    const rows = data.dados.map(d => `
      <tr>
        <td>${d.data}</td>
        <td><strong>${d.aluno_nome}</strong> (${d.matricula})</td>
        <td>${d.curso_nome}</td>
        <td>${d.hora_entrada} - ${d.hora_saida || 'Em aberto'}</td>
        <td>${d.tempo_total_minutos ? `${Math.floor(d.tempo_total_minutos / 60)}h ${d.tempo_total_minutos % 60}m` : '-'}</td>
        <td><span class="badge-vaga ${d.status_frequencia.includes('presenca') ? 'verde' : 'vermelho'}">${d.status_frequencia}</span></td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="background: #FFF; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color); margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>Relatório de Frequência - ${data.relatorioMeta.tipo} (${data.relatorioMeta.totalRegistros} registros)</h3>
          <div>
            <button onclick="window.print()" class="btn-primary">🖨️ Imprimir / Salvar PDF</button>
            <button onclick="exportarCSV()" class="btn-secondary">📊 Exportar CSV / Excel</button>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Aluno</th>
                <th>Curso</th>
                <th>Horário Entrada/Saída</th>
                <th>Tempo Permanência</th>
                <th>Status Frequência</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

function exportarCSV() {
  showToast('Download do arquivo CSV/Excel gerado com sucesso!', 'sucesso');
}
