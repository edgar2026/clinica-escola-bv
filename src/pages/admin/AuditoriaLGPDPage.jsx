import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { formatarDataHora } from '../../utils/datas';
import { adminService } from '../../services/adminService';

const ACAO_COR = {
  LOGIN_SUCESSO: 'verde', LOGIN_FALHA: 'vermelho', REGISTRAR_ENTRADA_PONTO: 'verde',
  REGISTRAR_SAIDA_PONTO: 'amarelo', CRIAR_AGENDAMENTO: 'verde', CANCELAR_AGENDAMENTO: 'amarelo',
  VALIDAR_PRESENCA_FORA_HORARIO: 'amarelo', ALTERACAO_STATUS_USUARIO: 'vermelho',
  SUBMETER_JUSTIFICATIVA: 'amarelo', SISTEMA_INICIALIZADO: 'verde',
  CADASTRAR_ALUNO_MANUAL: 'verde', IMPORTAR_ALUNOS_EM_MASSA: 'verde'
};

export const AuditoriaLGPDPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');

  const carregarLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getAuditoriaLogs();
      if (res && res.logs) setLogs(res.logs);
    } catch (err) {
      console.error('Erro ao carregar logs de auditoria:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarLogs();
  }, [carregarLogs]);

  const filtrados = logs.filter(l =>
    (l.acao && l.acao.includes(filtro.toUpperCase())) ||
    (l.usuario_nome && l.usuario_nome.toLowerCase().includes(filtro.toLowerCase())) ||
    (l.entidade && l.entidade.toLowerCase().includes(filtro.toLowerCase()))
  );

  return (
    <section>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Logs de Auditoria & Conformidade LGPD</h1>
          <p className="page-subtitle">Registro imutável de todas as ações administrativas, cadastros e acessos ao sistema.</p>
        </div>
        <button onClick={carregarLogs} className="btn-secondary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar Logs
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Filtrar por ação, usuário ou entidade..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
        />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          <ShieldCheck size={16} style={{ display: 'inline', marginRight: 4, color: 'var(--status-green)' }} />
          {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Data e Hora</th>
              <th>Usuário Responsável</th>
              <th>Ação Executada</th>
              <th>Entidade Afetada</th>
              <th>Justificativa / Observação</th>
              <th>IP Origem</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Nenhum log de auditoria encontrado.</td></tr>
            ) : filtrados.map(l => (
              <tr key={l.id}>
                <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {formatarDataHora(l.criado_em)}
                </td>
                <td>
                  <strong>{l.usuario_nome || 'Sistema'}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.matricula || '-'}</div>
                </td>
                <td>
                  <span className={`badge-vaga ${ACAO_COR[l.acao] || 'amarelo'}`} style={{ fontSize: '0.68rem' }}>
                    {l.acao?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{l.entidade} #{l.entidade_id || '-'}</td>
                <td style={{ fontSize: '0.83rem', maxWidth: 260 }}>{l.justificativa || '-'}</td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{l.ip || '127.0.0.1'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
