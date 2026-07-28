// Controladores da Visão de Administração do Sistema - Clínica-Escola UNINASSAU

async function carregarGestaoUsuariosAdmin() {
  try {
    const data = await ApiClient.get('/admin/usuarios');
    const tbody = document.getElementById('tbody-usuarios-admin');
    if (!tbody) return;

    tbody.innerHTML = data.usuarios.map(u => `
      <tr>
        <td><strong>${u.nome}</strong></td>
        <td>${u.email}</td>
        <td>${u.matricula}</td>
        <td><span class="badge-vaga verde">${u.perfil.toUpperCase()}</span></td>
        <td><span class="badge-vaga ${u.status === 'ativo' ? 'verde' : 'vermelho'}">${u.status.toUpperCase()}</span></td>
        <td>
          <button onclick="alterarStatusUsuario(${u.id}, '${u.status === 'ativo' ? 'bloqueado' : 'ativo'}')" class="${u.status === 'ativo' ? 'btn-logout' : 'btn-primary'}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
            ${u.status === 'ativo' ? 'Bloquear Conta' : 'Desbloquear Conta'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

async function alterarStatusUsuario(usuarioId, novoStatus) {
  const justificativa = prompt(`Informe a justificativa para alterar o status da conta para '${novoStatus.toUpperCase()}' (Obrigatório para Auditoria LGPD):`);
  if (!justificativa || justificativa.length < 5) {
    return alert('É obrigatório informar uma justificativa detalhada para cumprir os requisitos de auditoria LGPD.');
  }

  try {
    const res = await ApiClient.post('/admin/usuarios/bloquear-desbloquear', {
      usuario_id: usuarioId,
      status: novoStatus,
      justificativa
    });
    showToast(res.mensagem, 'sucesso');
    carregarGestaoUsuariosAdmin();
  } catch (err) {
    showToast(err.message, 'erro');
  }
}

async function carregarLogsAuditoriaAdmin() {
  try {
    const data = await ApiClient.get('/admin/auditoria');
    const tbody = document.getElementById('tbody-auditoria-admin');
    if (!tbody) return;

    if (data.logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum log de auditoria registrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.logs.map(l => `
      <tr>
        <td style="font-size: 0.8rem;">${new Date(l.criado_em).toLocaleString()}</td>
        <td><strong>${l.usuario_nome || 'Sistema / Convidado'}</strong> (${l.matricula || 'N/A'})</td>
        <td><span class="badge-vaga verde" style="font-size: 0.7rem;">${l.acao}</span></td>
        <td>${l.entidade} #${l.entidade_id || '-'}</td>
        <td style="font-size: 0.8rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${l.justificativa || 'Sem justificativa'}">${l.justificativa || '-'}</td>
        <td style="font-size: 0.75rem; color: var(--text-muted);">${l.ip} | ${l.dispositivo.substring(0, 30)}...</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'erro');
  }
}
