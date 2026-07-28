import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, FileSpreadsheet, Download, CheckCircle2, Info, Eye, Edit3, Ban, CheckCircle, Search } from 'lucide-react';
import { adminService } from '../../services/adminService';

const PERFIL_LABELS = { admin: 'Administrador', gerencia: 'Gerência', aluno: 'Aluno' };
const STATUS_COLORS = { ativo: '#10B981', inativo: '#6B7280', suspenso: '#F59E0B' };

const DIAS_SEMANA = [
  { id: 1, nome: 'Segunda' }, { id: 2, nome: 'Terça' }, { id: 3, nome: 'Quarta' },
  { id: 4, nome: 'Quinta' }, { id: 5, nome: 'Sexta' }, { id: 6, nome: 'Sábado' },
];

export const GestaoUsuariosPage = () => {
  const { showToast } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [modalPerfilOpen, setModalPerfilOpen] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);

  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [formEditar, setFormEditar] = useState({});
  const [salvando, setSalvando] = useState(false);

  const [opcoes, setOpcoes] = useState({ cursos: [], periodos: [], turnos: [] });

  const [modalMassaOpen, setModalMassaOpen] = useState(false);
  const [csvTexto, setCsvTexto] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [importandoMassa, setImportandoMassa] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);

  const carregarUsuarios = useCallback(async () => {
    try {
      const res = await adminService.getUsuarios(pagina, 20);
      setUsuarios(res?.usuarios || []);
      setTotalPaginas(res?.pagination?.totalPages || 1);
    } catch (err) {
      showToast('Erro ao carregar usuários: ' + err.message, 'erro');
    } finally {
      setLoading(false);
    }
  }, [showToast, pagina]);

  const carregarOpcoes = useCallback(async () => {
    try {
      const res = await adminService.getOpcoesCadastro();
      if (res) setOpcoes({ cursos: res.cursos || [], periodos: res.periodos || [], turnos: res.turnos || [] });
    } catch (err) {
      console.error('Erro ao carregar opções de cadastro:', err);
    }
  }, []);

  useEffect(() => { carregarUsuarios(); carregarOpcoes(); }, [carregarUsuarios, carregarOpcoes, pagina]);

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const buscaMatch = !busca || u.nome?.toLowerCase().includes(busca.toLowerCase()) || u.matricula?.toLowerCase().includes(busca.toLowerCase()) || u.email?.toLowerCase().includes(busca.toLowerCase());
      const perfilMatch = !filtroPerfil || u.perfil === filtroPerfil;
      return buscaMatch && perfilMatch;
    });
  }, [usuarios, busca, filtroPerfil]);

  const abrirPerfil = (u) => { setUsuarioSelecionado(u); setModalPerfilOpen(true); };

  const abrirEditar = (u) => {
    setFormEditar({
      id: u.id, nome: u.nome || '', email: u.email || '', matricula: u.matricula || '', cpf: u.cpf || '',
      perfil: u.perfil || 'aluno', telefone: u.telefone || '', email_pessoal: u.email_pessoal || '',
      endereco: u.endereco || '', data_nascimento: u.data_nascimento ? u.data_nascimento.split('T')[0] : '',
      curso_id: u.curso_id || '', periodo_id: u.periodo_id || '', turno_id: u.turno_id || '',
    });
    setModalEditarOpen(true);
  };

  const handleSalvarEdicao = async () => {
    setSalvando(true);
    try {
      await adminService.editarUsuario(formEditar.id, formEditar);
      showToast('Usuário atualizado com sucesso!', 'sucesso');
      setModalEditarOpen(false);
      await carregarUsuarios();
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const handleBloquearDesbloquear = async (u) => {
    const novoStatus = u.status === 'ativo' ? 'suspenso' : 'ativo';
    try {
      await adminService.alterarStatusUsuario(u.id, novoStatus, `Alterado manualmente pelo admin`);
      showToast(`Usuário ${novoStatus === 'suspenso' ? 'bloqueado' : 'desbloqueado'} com sucesso!`, 'sucesso');
      await carregarUsuarios();
    } catch (err) {
      showToast(err.message || 'Erro ao alterar status.', 'erro');
    }
  };

  const parseCSV = (text) => {
    if (!text || !text.trim()) { setParsedRows([]); return; }
    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) return;
    const firstLine = lines[0].toLowerCase();
    let delimiter = ',';
    if (firstLine.includes(';')) delimiter = ';';
    else if (firstLine.includes('\t')) delimiter = '\t';
    const hasHeader = firstLine.includes('nome') || firstLine.includes('email') || firstLine.includes('matricula');
    const rows = [];
    const startIndex = hasHeader ? 1 : 0;
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length >= 3) {
        rows.push({ nome: cols[0] || '', email: cols[1] || '', matricula: cols[2] || '', cpf: cols[3] || '', senha: cols[4] || '123456', carga_horaria: cols[5] ? parseInt(cols[5]) : 6 });
      }
    }
    setParsedRows(rows);
  };

  const handleArquivoCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { setCsvTexto(event.target.result); parseCSV(event.target.result); };
    reader.readAsText(file, 'UTF-8');
  };

  const handleBaixarModeloCSV = () => {
    const csvContent = 'nome,email,matricula,cpf,senha,carga_horaria\nNome Completo,aluno@email.com,00000000,000.000.000-00,123456,6';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'modelo_importacao_alunos.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Planilha modelo baixada!', 'sucesso');
  };

  const handleImportarMassa = async () => {
    if (parsedRows.length === 0) { showToast('Carregue ou cole dados para importar.', 'erro'); return; }
    setImportandoMassa(true); setResultadoImportacao(null);
    try {
      const res = await adminService.importarAlunosEmMassa(parsedRows);
      setResultadoImportacao(res);
      showToast(res.mensagem || `${res.importadosSucesso} alunos importados!`, 'sucesso');
    } catch (err) {
      showToast(err.message || 'Erro ao importar.', 'erro');
    } finally { setImportandoMassa(false); }
  };

  const inputStyle = { width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.88rem', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, display: 'block' };

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Gestão de Usuários</h1>
        <p className="page-subtitle">Visualize, edite e gerencie os usuários do sistema.</p>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
          <Search size={16} color="var(--text-muted)" />
          <input type="text" placeholder="Buscar por nome, matrícula ou e-mail..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inputStyle, border: 'none', background: 'transparent', fontSize: '0.9rem' }} />
        </div>
        <select value={filtroPerfil} onChange={e => setFiltroPerfil(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.4rem 0.6rem' }}>
          <option value="">Todos os perfis</option>
          <option value="aluno">Alunos</option>
          <option value="gerencia">Gerência</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={() => { setModalMassaOpen(true); setResultadoImportacao(null); setCsvTexto(''); setParsedRows([]); }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#0284C7', color: '#FFF', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
          <FileSpreadsheet size={14} /> Importar CSV
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</p>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Nome</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Matrícula</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Perfil</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Curso</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700, textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum usuário encontrado.</td></tr>
              ) : usuariosFiltrados.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.nome}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.matricula}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>{PERFIL_LABELS[u.perfil] || u.perfil}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.curso_nome || '-'}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: STATUS_COLORS[u.status] + '20', color: STATUS_COLORS[u.status] }}>
                      {u.status === 'ativo' ? 'Ativo' : u.status === 'suspenso' ? 'Bloqueado' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => abrirPerfil(u)} title="Ver perfil" style={{ background: '#EFF6FF', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#2563EB' }}><Eye size={15} /></button>
                      <button onClick={() => abrirEditar(u)} title="Editar" style={{ background: '#FEF3C7', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#D97706' }}><Edit3 size={15} /></button>
                      <button onClick={() => handleBloquearDesbloquear(u)} title={u.status === 'ativo' ? 'Bloquear' : 'Desbloquear'} style={{ background: u.status === 'ativo' ? '#FEE2E2' : '#D1FAE5', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: u.status === 'ativo' ? '#DC2626' : '#059669' }}>
                        {u.status === 'ativo' ? <Ban size={15} /> : <CheckCircle size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="btn-secondary" style={{ padding: '6px 16px' }}>Anterior</button>
          <span>Página {pagina} de {totalPaginas}</span>
          <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="btn-secondary" style={{ padding: '6px 16px' }}>Próxima</button>
        </div>
      )}

      {modalPerfilOpen && usuarioSelecionado && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0 }}>Perfil do Usuário</h3>
              <button onClick={() => setModalPerfilOpen(false)} className="btn-close">&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              {[
                ['Nome', usuarioSelecionado.nome],
                ['Matrícula', usuarioSelecionado.matricula],
                ['E-mail (sistema)', usuarioSelecionado.email],
                ['CPF', usuarioSelecionado.cpf || '-'],
                ['Perfil', PERFIL_LABELS[usuarioSelecionado.perfil]],
                ['Status', usuarioSelecionado.status === 'ativo' ? 'Ativo' : 'Bloqueado'],
                ['Telefone', usuarioSelecionado.telefone || '-'],
                ['E-mail Pessoal', usuarioSelecionado.email_pessoal || '-'],
                ['Endereço', usuarioSelecionado.endereco || '-'],
                ['Data de Nascimento', usuarioSelecionado.data_nascimento ? new Date(usuarioSelecionado.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'],
                ['Curso', usuarioSelecionado.curso_nome || '-'],
                ['Período', usuarioSelecionado.periodo_codigo || '-'],
                ['Turno', usuarioSelecionado.turno_codigo || '-'],
                ['Criado em', usuarioSelecionado.criado_em ? new Date(usuarioSelecionado.criado_em).toLocaleDateString('pt-BR') : '-'],
              ].map(([label, valor]) => (
                <div key={label}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{label}</span>
                  <strong>{valor}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => { setModalPerfilOpen(false); abrirEditar(usuarioSelecionado); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Edit3 size={14} /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEditarOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} /> Editar Usuário
              </h3>
              <button onClick={() => setModalEditarOpen(false)} className="btn-close">&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>Dados Cadastrais</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div><label style={labelStyle}>Nome *</label><input value={formEditar.nome} onChange={e => setFormEditar({ ...formEditar, nome: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Matrícula *</label><input value={formEditar.matricula} onChange={e => setFormEditar({ ...formEditar, matricula: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>E-mail (sistema) *</label><input value={formEditar.email} onChange={e => setFormEditar({ ...formEditar, email: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>CPF</label><input value={formEditar.cpf} onChange={e => setFormEditar({ ...formEditar, cpf: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Perfil</label>
                  <select value={formEditar.perfil} onChange={e => setFormEditar({ ...formEditar, perfil: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
                    <option value="aluno">Aluno</option>
                    <option value="gerencia">Gerência</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <strong style={{ fontSize: '0.82rem', color: 'var(--primary)', marginTop: '0.3rem' }}>Dados Complementares (Opcionais)</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div><label style={labelStyle}>Telefone</label><input value={formEditar.telefone || ''} onChange={e => setFormEditar({ ...formEditar, telefone: e.target.value })} placeholder="(81) 99999-0000" style={inputStyle} /></div>
                <div><label style={labelStyle}>E-mail Pessoal</label><input value={formEditar.email_pessoal || ''} onChange={e => setFormEditar({ ...formEditar, email_pessoal: e.target.value })} placeholder="email@pessoal.com" style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Endereço</label><input value={formEditar.endereco || ''} onChange={e => setFormEditar({ ...formEditar, endereco: e.target.value })} placeholder="Rua, número, bairro" style={inputStyle} /></div>
                <div><label style={labelStyle}>Data de Nascimento</label><input type="date" value={formEditar.data_nascimento || ''} onChange={e => setFormEditar({ ...formEditar, data_nascimento: e.target.value })} style={inputStyle} /></div>
              </div>

              {formEditar.perfil === 'aluno' && (
                <>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--primary)', marginTop: '0.3rem' }}>Dados Acadêmicos</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                    <div><label style={labelStyle}>Curso</label>
                      <select value={formEditar.curso_id || ''} onChange={e => setFormEditar({ ...formEditar, curso_id: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
                        <option value="">Selecione...</option>
                        {(opcoes.cursos || []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div><label style={labelStyle}>Período</label>
                      <select value={formEditar.periodo_id || ''} onChange={e => setFormEditar({ ...formEditar, periodo_id: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
                        <option value="">Selecione...</option>
                        {(opcoes.periodos || []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                    <div><label style={labelStyle}>Turno</label>
                      <select value={formEditar.turno_id || ''} onChange={e => setFormEditar({ ...formEditar, turno_id: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
                        <option value="">Selecione...</option>
                        {(opcoes.turnos || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setModalEditarOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSalvarEdicao} disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Salvar Alterações'}</button>
            </div>
          </div>
        </div>
      )}

      {modalMassaOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={20} color="var(--primary)" /> Importar Alunos em Massa (.CSV)
              </h3>
              <button onClick={() => setModalMassaOpen(false)} className="btn-close">&times;</button>
            </div>
            <div style={{ marginBottom: '1rem', background: '#F8FAFC', padding: '0.85rem', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>Instruções:</strong>
                <button onClick={handleBaixarModeloCSV} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Download size={12} /> Modelo CSV
                </button>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0' }}>
                Colunas: <code>nome, email, matricula, cpf, senha</code>.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Arquivo CSV:</label>
                <input type="file" accept=".csv,text/csv" onChange={handleArquivoCSV} style={{ fontSize: '0.82rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Ou cole aqui:</label>
                <textarea rows="3" placeholder="nome,email,matricula" value={csvTexto} onChange={e => { setCsvTexto(e.target.value); parseCSV(e.target.value); }} style={{ width: '100%', fontSize: '0.78rem', padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border-color)' }} />
              </div>
            </div>
            {parsedRows.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>{parsedRows.length} aluno(s) reconhecidos:</strong>
                <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6, marginTop: 4, fontSize: '0.78rem' }}>
                  <table style={{ width: '100%' }}>
                    <thead><tr><th style={{ padding: '4px 8px', textAlign: 'left' }}>Nome</th><th style={{ padding: '4px 8px' }}>E-mail</th><th style={{ padding: '4px 8px' }}>Matrícula</th></tr></thead>
                    <tbody>{parsedRows.map((r, i) => <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}><td style={{ padding: '4px 8px' }}>{r.nome}</td><td style={{ padding: '4px 8px' }}>{r.email}</td><td style={{ padding: '4px 8px' }}>{r.matricula}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
            {resultadoImportacao && (
              <div style={{ marginBottom: '1rem', background: '#F0FDF4', padding: '0.75rem', borderRadius: 6, border: '1px solid #BBF7D0', fontSize: '0.82rem' }}>
                <strong style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={16} /> Importação Concluída!</strong>
                <p style={{ margin: '4px 0 0 0', color: '#15803D' }}>Sucesso: {resultadoImportacao.importadosSucesso} aluno(s).</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalMassaOpen(false)} className="btn-secondary">Fechar</button>
              <button onClick={handleImportarMassa} disabled={importandoMassa || parsedRows.length === 0} className="btn-primary">
                {importandoMassa ? 'Importando...' : `Importar ${parsedRows.length} Aluno(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
