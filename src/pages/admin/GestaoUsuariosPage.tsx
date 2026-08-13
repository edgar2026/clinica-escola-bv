import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, Edit3, Ban, CheckCircle, Search, Trash2, KeyRound, AlertCircle, Clock, Calendar } from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { OpcoesCadastro, Perfil, SolicitacaoResetSenha, CategoriaCargaHoraria, UsuarioComAluno } from '../../types';

const PERFIL_LABELS: Record<string, string> = { admin: 'Administrador', gerencia: 'Gerencia', aluno: 'Aluno' };
const STATUS_COLORS: Record<string, string> = { ativo: '#10B981', inativo: '#6B7280', suspenso: '#F59E0B' };
const STATUS_SOLICITACAO_COLORS: Record<string, string> = { pendente: '#F59E0B', atendida: '#10B981', cancelada: '#6B7280' };
const SITUACAO_LABELS: Record<string, string> = { ativo: 'Ativo', inativo: 'Inativo', suspenso: 'Suspenso', formado: 'Formado', desistente: 'Desistente' };
const DIAS_SEMANA: Record<number, string> = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sab' };

export const GestaoUsuariosPage = () => {
  const { showToast, usuario: usuarioLogado } = useAuth();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const [usuarios, setUsuarios] = useState<UsuarioComAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [modalPerfilOpen, setModalPerfilOpen] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UsuarioComAluno | null>(null);

  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [formEditar, setFormEditar] = useState<Partial<UsuarioComAluno>>({});
  const [salvando, setSalvando] = useState(false);

  const [opcoes, setOpcoes] = useState<OpcoesCadastro>({ cursos: [], periodos: [], turnos: [] });
  const [, setCategoriasCarga] = useState<CategoriaCargaHoraria[]>([]);
  const [setoresClinica, setSetoresClinica] = useState<Array<{ id: number; nome: string }>>([]);

  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);
  const [usuarioExcluir, setUsuarioExcluir] = useState<UsuarioComAluno | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState(0);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoResetSenha[]>([]);
  const [modalSolicitacoesOpen, setModalSolicitacoesOpen] = useState(false);
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);

  const [modalResetSenhaOpen, setModalResetSenhaOpen] = useState(false);
  const [usuarioResetSenha, setUsuarioResetSenha] = useState<UsuarioComAluno | null>(null);
  const [resetando, setResetando] = useState(false);

  const [modalGradeOpen, setModalGradeOpen] = useState(false);
  const [gradeAluno, setGradeAluno] = useState<Record<string, unknown> | null>(null);
  const [loadingGrade, setLoadingGrade] = useState(false);

  const carregarUsuarios = useCallback(async () => {
    try {
      const res = await adminService.getUsuarios(pagina, 20);
      setUsuarios((res?.usuarios || []) as UsuarioComAluno[]);
      setTotalPaginas(res?.total ? Math.ceil(res.total / 20) : 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showToastRef.current('Erro ao carregar usuarios: ' + msg, 'erro');
    } finally {
      setLoading(false);
    }
  }, [pagina]);

  const carregarOpcoes = useCallback(async () => {
    try {
      const [cursos, periodos, turnos, cats, setores] = await Promise.all([
        adminService.getCursos(),
        adminService.getPeriodos(),
        adminService.getTurnos(),
        adminService.getCategoriasCargaHoraria(),
        adminService.getSetoresClinica(),
      ]);
      setOpcoes({ cursos, periodos, turnos });
      setCategoriasCarga(cats);
      setSetoresClinica(setores);
    } catch (err) {
      console.error('Erro ao carregar opcoes:', err);
    }
  }, []);

  const carregarContadorSolicitacoes = useCallback(async () => {
    try {
      const count = await adminService.contarSolicitacoesPendentes();
      setSolicitacoesPendentes(count);
    } catch {
      // Silencioso
    }
  }, []);

  useEffect(() => { carregarUsuarios(); carregarOpcoes(); carregarContadorSolicitacoes(); }, [carregarUsuarios, carregarOpcoes, carregarContadorSolicitacoes]);

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const buscaMatch = !busca || u.nome?.toLowerCase().includes(busca.toLowerCase()) || u.matricula?.toLowerCase().includes(busca.toLowerCase()) || u.email?.toLowerCase().includes(busca.toLowerCase());
      const perfilMatch = !filtroPerfil || u.perfil === filtroPerfil;
      return buscaMatch && perfilMatch;
    });
  }, [usuarios, busca, filtroPerfil]);

  const isCurrentUser = (u: UsuarioComAluno) => u.auth_user_id === usuarioLogado?.auth_user_id;

  const abrirPerfil = (u: UsuarioComAluno) => { setUsuarioSelecionado(u); setModalPerfilOpen(true); };

  const [modalLoteOpen, setModalLoteOpen] = useState(false);
  const [previewLote, setPreviewLote] = useState<{ valor_padrao: number; total_afetados: number; apenas_sem_carga: boolean } | null>(null);
  const [apenasSemCarga, setApenasSemCarga] = useState(true);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');
  const [aplicandoLote, setAplicandoLote] = useState(false);

  const abrirEditar = (u: UsuarioComAluno) => {
    setFormEditar({
      id: u.id, nome: u.nome || '', email: u.email || '', matricula: u.matricula || '', cpf: u.cpf || '',
      perfil: u.perfil || 'aluno', telefone: u.telefone || '', email_pessoal: u.email_pessoal || '',
      endereco: u.endereco || '', data_nascimento: u.data_nascimento ? u.data_nascimento.split('T')[0] : '',
      curso_id: u.aluno_curso_id || u.curso_id || '',
      carga_horaria_semanal: u.carga_horaria_semanal || u.categoria_carga_horas || 4,
      categoria_carga_id: u.categoria_carga_id || undefined,
      periodo_id: u.periodo_id || '',
      turno_id: u.turno_id || '',
      setor_id: u.setor_id || undefined,
      situacao_vinculo: u.situacao_vinculo || 'ativo',
      aluno_id: u.aluno_id || undefined,
    });
    setModalEditarOpen(true);
  };

  const handleSalvarEdicao = async () => {
    setSalvando(true);
    try {
      await adminService.editarUsuario(formEditar.id!, formEditar);

      let msg = 'Usuario atualizado com sucesso!';
      if (formEditar.aluno_id && formEditar.perfil === 'aluno') {
        const resAluno = await adminService.atualizarAlunoAdmin(Number(formEditar.aluno_id), {
          carga_horaria_semanal: formEditar.carga_horaria_semanal ? Number(formEditar.carga_horaria_semanal) : 4,
          curso_id: formEditar.aluno_curso_id ? Number(formEditar.aluno_curso_id) : (formEditar.curso_id ? Number(formEditar.curso_id) : null),
          periodo_id: formEditar.periodo_id ? Number(formEditar.periodo_id) : null,
          turno_id: formEditar.turno_id ? Number(formEditar.turno_id) : null,
          setor_id: formEditar.setor_id ? Number(formEditar.setor_id) : null,
          situacao: formEditar.situacao_vinculo || 'ativo',
        });
        if (resAluno && resAluno.grade_reaberta) {
          if (resAluno.tipo_ajuste === 'aumento') {
            msg = `Dados atualizados! Carga aumentada de ${resAluno.carga_anterior}h para ${resAluno.carga_nova}h. O aluno precisa selecionar mais ${resAluno.horas_necessarias}h na grade.`;
          } else if (resAluno.tipo_ajuste === 'reducao') {
            msg = `Dados atualizados! Carga reduzida de ${resAluno.carga_anterior}h para ${resAluno.carga_nova}h. O aluno precisa remover ${resAluno.horas_remover}h na grade.`;
          } else {
            msg = 'Dados atualizados! A carga horária foi alterada e a grade do aluno foi reaberta.';
          }
        }
      }

      showToast(msg, 'sucesso');
      setModalEditarOpen(false);
      await carregarUsuarios();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalLote = async () => {
    setApenasSemCarga(true);
    setConfirmacaoTexto('');
    try {
      const prev = await adminService.getPreviewAplicarCargaPadrao(true);
      setPreviewLote(prev);
      setModalLoteOpen(true);
    } catch (err) {
      showToast('Erro ao carregar prévia do lote: ' + (err instanceof Error ? err.message : ''), 'erro');
    }
  };

  const handleToggleOpcaoSemCarga = async (semCarga: boolean) => {
    setApenasSemCarga(semCarga);
    setConfirmacaoTexto('');
    try {
      const prev = await adminService.getPreviewAplicarCargaPadrao(semCarga);
      setPreviewLote(prev);
    } catch {
      // Silencioso
    }
  };

  const handleAplicarLote = async () => {
    if (!apenasSemCarga && confirmacaoTexto.trim().toUpperCase() !== 'CONFIRMAR') {
      showToast('Digite "CONFIRMAR" para autorizar a aplicação a todos os alunos.', 'erro');
      return;
    }
    setAplicandoLote(true);
    try {
      const res = await adminService.aplicarCargaPadraoEmLote(apenasSemCarga);
      showToast(res.mensagem || 'Carga horária padrão aplicada em lote com sucesso!', 'sucesso');
      setModalLoteOpen(false);
      await carregarUsuarios();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao aplicar lote.', 'erro');
    } finally {
      setAplicandoLote(false);
    }
  };

  const handleBloquearDesbloquear = async (u: UsuarioComAluno) => {
    if (isCurrentUser(u)) {
      showToast('Voce nao pode bloquear sua propria conta.', 'erro');
      return;
    }
    const novoStatus = u.status === 'ativo' ? 'suspenso' : 'ativo';
    setProcessandoId(u.id);
    try {
      await adminService.alterarStatusUsuario(u.id, novoStatus, 'Alterado manualmente pelo admin');
      showToast(`Usuario ${novoStatus === 'suspenso' ? 'bloqueado' : 'desbloqueado'} com sucesso!`, 'sucesso');
      await carregarUsuarios();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar status.', 'erro');
    } finally {
      setProcessandoId(null);
    }
  };

  const confirmarExclusao = (u: UsuarioComAluno) => {
    if (isCurrentUser(u)) {
      showToast('Voce nao pode excluir sua propria conta.', 'erro');
      return;
    }
    setUsuarioExcluir(u);
    setModalExcluirOpen(true);
  };

  const handleExcluir = async () => {
    if (!usuarioExcluir) return;
    setExcluindo(true);
    try {
      await adminService.excluirUsuario(usuarioExcluir.auth_user_id || usuarioExcluir.id);
      showToast('Usuario excluido com sucesso!', 'sucesso');
      setModalExcluirOpen(false);
      setUsuarioExcluir(null);
      await carregarUsuarios();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir.', 'erro');
    } finally {
      setExcluindo(false);
    }
  };

  const abrirSolicitacoes = async () => {
    setLoadingSolicitacoes(true);
    setModalSolicitacoesOpen(true);
    try {
      const data = await adminService.getSolicitacoesResetSenha();
      setSolicitacoes(data as SolicitacaoResetSenha[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar solicitacoes.', 'erro');
    } finally {
      setLoadingSolicitacoes(false);
    }
  };

  const abrirModalResetSenha = (u: UsuarioComAluno) => {
    if (isCurrentUser(u)) {
      showToast('O administrador nao pode redefinir a propria senha por este metodo.', 'erro');
      return;
    }
    setUsuarioResetSenha(u);
    setModalResetSenhaOpen(true);
  };

  const handleRedefinirSenha = async (solicitacaoId?: number) => {
    if (!usuarioResetSenha) return;
    setResetando(true);
    try {
      await adminService.redefinirSenhaAdmin(
        Number(usuarioResetSenha.id),
        usuarioResetSenha.auth_user_id || '',
        solicitacaoId
      );
      showToast(`Senha de ${usuarioResetSenha.nome} redefinida. Senha temporaria: ser@2026`, 'sucesso');
      setModalResetSenhaOpen(false);
      setUsuarioResetSenha(null);
      await carregarContadorSolicitacoes();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao redefinir senha.', 'erro');
    } finally {
      setResetando(false);
    }
  };

  const abrirDetalhesGrade = async (u: UsuarioComAluno) => {
    if (!u.aluno_id) {
      showToast('Este usuario nao possui registro de aluno.', 'erro');
      return;
    }
    setLoadingGrade(true);
    setModalGradeOpen(true);
    try {
      const data = await adminService.getGradeAlunoAdmin(Number(u.aluno_id));
      setGradeAluno(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar grade.', 'erro');
    } finally {
      setLoadingGrade(false);
    }
  };

  const inputStyle = { width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.88rem', boxSizing: 'border-box' as const };
  const labelStyle = { fontSize: '0.78rem', fontWeight: 600, marginBottom: 4, display: 'block' };

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Gestao de Usuarios</h1>
        <p className="page-subtitle">Visualize, edite e gerencie os usuarios do sistema.</p>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
          <Search size={16} color="var(--text-muted)" />
          <input type="text" placeholder="Buscar por nome, matricula ou e-mail..." value={busca} onChange={e => setBusca(e.target.value)} style={{ ...inputStyle, border: 'none', background: 'transparent', fontSize: '0.9rem' }} />
        </div>
        <select value={filtroPerfil} onChange={e => setFiltroPerfil(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.4rem 0.6rem' }}>
          <option value="">Todos os perfis</option>
          <option value="aluno">Alunos</option>
          <option value="admin">Administradores</option>
        </select>
        <button
          onClick={abrirModalLote}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border-color)', background: '#F0F9FF', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)' }}
          title="Aplicar carga horária semanal padrão aos alunos"
        >
          <Clock size={15} />
          Aplicar padrão aos alunos
        </button>
        <button
          onClick={abrirSolicitacoes}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border-color)', background: '#FFF', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-dark)', position: 'relative' }}
        >
          <KeyRound size={15} />
          Solicitacoes
          {solicitacoesPendentes > 0 && (
            <span style={{ position: 'absolute', top: -6, right: -6, background: '#DC2626', color: '#FFF', fontSize: '0.7rem', fontWeight: 700, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {solicitacoesPendentes}
            </span>
          )}
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
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Matricula</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Perfil</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Curso</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Carga</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Situacao</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700, textAlign: 'center' }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum usuario encontrado.</td></tr>
              ) : usuariosFiltrados.map(u => {
                const isSelf = isCurrentUser(u);
                const semPerfil = u.tem_perfil === false;
                const bloqueando = processandoId === u.id;
                const carga = u.carga_horaria_semanal || u.categoria_carga_horas;
                return (
                <tr key={u.id} style={{ borderTop: '1px solid var(--border-color)', opacity: semPerfil ? 0.7 : 1 }}>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    {u.nome}
                    {semPerfil && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>Sem perfil</span>}
                    {isSelf && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#DBEAFE', color: '#1E40AF', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>Voce</span>}
                  </td>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.matricula || '-'}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>{PERFIL_LABELS[u.perfil] || u.perfil}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>{u.aluno_curso_nome || u.curso_nome || '-'}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    {carga ? (
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{carga}h/sem</span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: (STATUS_COLORS[u.status] || '#6B7280') + '20', color: STATUS_COLORS[u.status] || '#6B7280' }}>
                      {SITUACAO_LABELS[u.situacao_vinculo || ''] || (u.status === 'ativo' ? 'Ativo' : u.status === 'suspenso' ? 'Bloqueado' : 'Inativo')}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      {!semPerfil && (
                        <>
                          <button onClick={() => abrirPerfil(u)} title="Ver perfil" style={{ background: '#EFF6FF', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#2563EB' }}><Eye size={15} /></button>
                          <button onClick={() => abrirEditar(u)} title="Editar" style={{ background: '#FEF3C7', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#D97706' }}><Edit3 size={15} /></button>
                          {u.perfil === 'aluno' && u.aluno_id && (
                            <button onClick={() => abrirDetalhesGrade(u)} title="Ver Horario Firmado" style={{ background: '#EDE9FE', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#7C3AED' }}><Calendar size={15} /></button>
                          )}
                          <button
                            onClick={() => abrirModalResetSenha(u)}
                            disabled={isSelf}
                            title={isSelf ? 'Nao pode redefinir a propria senha' : 'Redefinir senha'}
                            style={{ background: isSelf ? '#F3F4F6' : '#EDE9FE', border: 'none', borderRadius: 6, padding: 6, cursor: isSelf ? 'not-allowed' : 'pointer', color: isSelf ? '#9CA3AF' : '#7C3AED', opacity: isSelf ? 0.5 : 1 }}
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            onClick={() => handleBloquearDesbloquear(u)}
                            disabled={isSelf || bloqueando}
                            title={isSelf ? 'Nao pode bloquear a si mesmo' : u.status === 'ativo' ? 'Bloquear' : 'Desbloquear'}
                            style={{ background: isSelf ? '#F3F4F6' : u.status === 'ativo' ? '#FEE2E2' : '#D1FAE5', border: 'none', borderRadius: 6, padding: 6, cursor: isSelf ? 'not-allowed' : 'pointer', color: isSelf ? '#9CA3AF' : u.status === 'ativo' ? '#DC2626' : '#059669', opacity: isSelf ? 0.5 : 1 }}
                          >
                            {u.status === 'ativo' ? <Ban size={15} /> : <CheckCircle size={15} />}
                          </button>
                        </>
                      )}
                      <button onClick={() => confirmarExclusao(u)} title={isSelf ? 'Nao pode excluir a si mesmo' : 'Excluir usuario'} disabled={isSelf} style={{ background: isSelf ? '#F3F4F6' : '#FEE2E2', border: 'none', borderRadius: 6, padding: 6, cursor: isSelf ? 'not-allowed' : 'pointer', color: isSelf ? '#9CA3AF' : '#DC2626', opacity: isSelf ? 0.5 : 1 }}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="btn-secondary" style={{ padding: '6px 16px' }}>Anterior</button>
          <span>Pagina {pagina} de {totalPaginas}</span>
          <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="btn-secondary" style={{ padding: '6px 16px' }}>Proxima</button>
        </div>
      )}

      {/* Modal Perfil */}
      {modalPerfilOpen && usuarioSelecionado && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0 }}>Perfil do Usuario</h3>
              <button onClick={() => setModalPerfilOpen(false)} className="btn-close">&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              {[
                ['Nome', usuarioSelecionado.nome],
                ['Matricula', usuarioSelecionado.matricula],
                ['E-mail (sistema)', usuarioSelecionado.email],
                ['CPF', usuarioSelecionado.cpf || '-'],
                ['Perfil', PERFIL_LABELS[usuarioSelecionado.perfil] || usuarioSelecionado.perfil],
                ['Status', usuarioSelecionado.status === 'ativo' ? 'Ativo' : 'Bloqueado'],
                ['Telefone', usuarioSelecionado.telefone || '-'],
                ['E-mail Pessoal', usuarioSelecionado.email_pessoal || '-'],
                ['Endereco', usuarioSelecionado.endereco || '-'],
                ['Data de Nascimento', usuarioSelecionado.data_nascimento ? new Date(usuarioSelecionado.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'],
                ['Curso', usuarioSelecionado.aluno_curso_nome || usuarioSelecionado.curso_nome || '-'],
                ['Periodo', usuarioSelecionado.periodo_nome || '-'],
                ['Turno', usuarioSelecionado.turno_nome || '-'],
                ['Setor/Clinica', usuarioSelecionado.setor_nome || '-'],
                ['Categoria Carga', usuarioSelecionado.categoria_carga_horas ? `${usuarioSelecionado.categoria_carga_horas}h semanais` : 'Nao definida'],
                ['Situacao Vinculo', SITUACAO_LABELS[usuarioSelecionado.situacao_vinculo || ''] || usuarioSelecionado.situacao_vinculo || '-'],
                ['Criado em', usuarioSelecionado.criado_em ? new Date(usuarioSelecionado.criado_em).toLocaleDateString('pt-BR') : '-'],
              ].map(([label, valor]) => (
                <div key={label}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{label}</span>
                  <strong>{valor}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', gap: '0.75rem' }}>
              {usuarioSelecionado.perfil === 'aluno' && usuarioSelecionado.aluno_id && (
                <button onClick={() => { setModalPerfilOpen(false); abrirDetalhesGrade(usuarioSelecionado); }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} /> Ver Horario Firmado
                </button>
              )}
              <button onClick={() => { setModalPerfilOpen(false); abrirEditar(usuarioSelecionado); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Edit3 size={14} /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {modalEditarOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} /> Editar Usuario
              </h3>
              <button onClick={() => setModalEditarOpen(false)} className="btn-close">&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>Dados Cadastrais</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div><label style={labelStyle}>Nome *</label><input value={formEditar.nome || ''} onChange={e => setFormEditar({ ...formEditar, nome: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Matricula *</label><input value={formEditar.matricula || ''} onChange={e => setFormEditar({ ...formEditar, matricula: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>E-mail (sistema) *</label><input value={formEditar.email || ''} onChange={e => setFormEditar({ ...formEditar, email: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>CPF</label><input value={formEditar.cpf || ''} onChange={e => setFormEditar({ ...formEditar, cpf: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Perfil</label>
                  <select value={formEditar.perfil || 'aluno'} onChange={e => setFormEditar({ ...formEditar, perfil: e.target.value as Perfil })} style={{ ...inputStyle, background: '#FFF' }}>
                    <option value="aluno">Aluno</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <strong style={{ fontSize: '0.82rem', color: 'var(--primary)', marginTop: '0.3rem' }}>Dados Complementares</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div><label style={labelStyle}>Telefone</label><input value={formEditar.telefone || ''} onChange={e => setFormEditar({ ...formEditar, telefone: e.target.value })} placeholder="(81) 99999-0000" style={inputStyle} /></div>
                <div><label style={labelStyle}>E-mail Pessoal</label><input value={formEditar.email_pessoal || ''} onChange={e => setFormEditar({ ...formEditar, email_pessoal: e.target.value })} placeholder="email@pessoal.com" style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Endereco</label><input value={formEditar.endereco || ''} onChange={e => setFormEditar({ ...formEditar, endereco: e.target.value })} placeholder="Rua, numero, bairro" style={inputStyle} /></div>
                <div><label style={labelStyle}>Data de Nascimento</label><input type="date" value={formEditar.data_nascimento || ''} onChange={e => setFormEditar({ ...formEditar, data_nascimento: e.target.value })} style={inputStyle} /></div>
              </div>

              {formEditar.perfil === 'aluno' && (
                <>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--primary)', marginTop: '0.3rem' }}>Dados Academicos</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div>
                      <label style={labelStyle}>Carga Horária Semanal (Horas)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        step="1"
                        placeholder="ex: 4, 7 ou 12"
                        value={formEditar.carga_horaria_semanal ?? ''}
                        onChange={e => setFormEditar({ ...formEditar, carga_horaria_semanal: e.target.value ? Number(e.target.value) : undefined })}
                        style={inputStyle}
                      />
                    </div>
                    <div><label style={labelStyle}>Curso</label>
                      <select value={formEditar.aluno_curso_id || formEditar.curso_id || ''} onChange={e => setFormEditar({ ...formEditar, aluno_curso_id: e.target.value, curso_id: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
                        <option value="">Selecione...</option>
                        {(opcoes.cursos || []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div><label style={labelStyle}>Periodo</label>
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
                    <div><label style={labelStyle}>Clinica / Setor</label>
                      <select value={formEditar.setor_id || ''} onChange={e => setFormEditar({ ...formEditar, setor_id: e.target.value || undefined })} style={{ ...inputStyle, background: '#FFF' }}>
                        <option value="">Selecione...</option>
                        {setoresClinica.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                      </select>
                    </div>
                    <div><label style={labelStyle}>Situacao do Vinculo</label>
                      <select value={formEditar.situacao_vinculo || 'ativo'} onChange={e => setFormEditar({ ...formEditar, situacao_vinculo: e.target.value })} style={{ ...inputStyle, background: '#FFF' }}>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                        <option value="suspenso">Suspenso</option>
                        <option value="formado">Formado</option>
                        <option value="desistente">Desistente</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setModalEditarOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSalvarEdicao} disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Salvar Alteracoes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes Grade */}
      {modalGradeOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 680, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} /> Horario Firmado do Aluno
              </h3>
              <button onClick={() => { setModalGradeOpen(false); setGradeAluno(null); }} className="btn-close">&times;</button>
            </div>
            {loadingGrade ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Carregando...</p>
            ) : !gradeAluno || !gradeAluno.tem_grade ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>Nenhum horario firmado</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Este aluno ainda nao confirmou nenhum horario na grade semanal.</p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: 8, fontSize: '0.85rem' }}>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Status</span><strong style={{ color: gradeAluno.confirmado ? '#10B981' : '#F59E0B' }}>{gradeAluno.confirmado ? 'Confirmado' : 'Pendente'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Carga Semanal</span><strong>{String(gradeAluno.categoria_carga ?? '-')}h</strong></div>
                  {gradeAluno.horas_firmadas_minutos !== undefined && Number(gradeAluno.horas_firmadas_minutos) > 0 && (
                    <div><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Horas Firmadas</span><strong style={{ color: '#065F46' }}>{Math.floor(Number(gradeAluno.horas_firmadas_minutos) / 60)}h</strong></div>
                  )}
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Total Selecionado</span><strong>{Math.floor(Number(gradeAluno.total_horas_selecionadas_minutos ?? 0) / 60)}h</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Vigencia</span><strong>{gradeAluno.vigencia_inicio ? new Date(String(gradeAluno.vigencia_inicio) + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} - {gradeAluno.vigencia_fim ? new Date(String(gradeAluno.vigencia_fim) + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</strong></div>
                </div>
                {!gradeAluno.confirmado && gradeAluno.horas_firmadas_minutos !== undefined && Number(gradeAluno.horas_firmadas_minutos) > 0 && Number(gradeAluno.horas_firmadas_minutos) < Number(gradeAluno.categoria_carga ?? 0) * 60 && (
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#1E40AF' }}>
                    <strong>Ajuste pendente:</strong> {Math.floor(Number(gradeAluno.horas_firmadas_minutos) / 60)}h firmadas de {String(gradeAluno.categoria_carga)}h. O aluno precisa selecionar mais {String(Number(gradeAluno.categoria_carga) - Math.floor(Number(gradeAluno.horas_firmadas_minutos) / 60))}h.
                  </div>
                )}
                {!gradeAluno.confirmado && gradeAluno.horas_rascunho_minutos !== undefined && Number(gradeAluno.horas_rascunho_minutos) > 0 && Number(gradeAluno.horas_rascunho_minutos) !== Number(gradeAluno.categoria_carga ?? 0) * 60 && (gradeAluno.horas_firmadas_minutos === undefined || Number(gradeAluno.horas_firmadas_minutos) === 0) && (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#92400E' }}>
                    <strong>Ajuste pendente:</strong> {Math.floor(Number(gradeAluno.horas_rascunho_minutos) / 60)}h selecionadas de {String(gradeAluno.categoria_carga)}h. O aluno precisa ajustar para {String(gradeAluno.categoria_carga)}h.
                  </div>
                )}

                {Array.isArray(gradeAluno.selecoes) && gradeAluno.selecoes.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                    {(gradeAluno.selecoes as Array<{ dia_semana: number; hora_inicio: string; hora_fim: string; confirmado: boolean }>).map((sel, idx) => (
                      <div key={idx} style={{
                        background: sel.confirmado ? '#F0FDF4' : '#FFF',
                        border: sel.confirmado ? '1px solid #BBF7D0' : '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '0.65rem',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)', marginBottom: 4 }}>{DIAS_SEMANA[sel.dia_semana] || sel.dia_semana}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 600, fontSize: '0.82rem' }}>
                          <Clock size={12} /> {sel.hora_inicio} - {sel.hora_fim}
                        </div>
                        {sel.confirmado && (
                          <div style={{ marginTop: 4 }}><CheckCircle size={12} color="#10B981" /> <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Firmado</span></div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma selecao encontrada.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {modalExcluirOpen && usuarioExcluir && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ color: '#DC2626', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={18} /> Excluir Usuario
              </h3>
              <button onClick={() => { setModalExcluirOpen(false); setUsuarioExcluir(null); }} className="btn-close">&times;</button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)', margin: '0.5rem 0 1rem' }}>
              Tem certeza que deseja excluir <strong>{usuarioExcluir.nome}</strong>?
              Esta acao ira remover permanentemente o acesso ao Supabase Auth e o perfil do banco de dados. Esta acao nao pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setModalExcluirOpen(false); setUsuarioExcluir(null); }} className="btn-secondary">Cancelar</button>
              <button onClick={handleExcluir} disabled={excluindo} style={{ padding: '0.55rem 1.25rem', borderRadius: 8, border: 'none', background: '#DC2626', color: '#FFF', fontWeight: 700, fontSize: '0.88rem', cursor: excluindo ? 'wait' : 'pointer' }}>
                {excluindo ? 'Excluindo...' : 'Excluir Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solicitacoes */}
      {modalSolicitacoesOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} /> Solicitacoes de Redefinicao de Senha
              </h3>
              <button onClick={() => setModalSolicitacoesOpen(false)} className="btn-close">&times;</button>
            </div>
            {loadingSolicitacoes ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Carregando...</p>
            ) : solicitacoes.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Nenhuma solicitacao encontrada.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Usuario</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>E-mail</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Matricula</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Curso</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Motivo</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Data</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Situacao</th>
                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, textAlign: 'center' }}>Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitacoes.map(s => (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.nome_usuario || '-'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.email}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.matricula || '-'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.curso_nome || '-'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.motivo}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.criado_em ? new Date(s.criado_em).toLocaleDateString('pt-BR') : '-'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: (STATUS_SOLICITACAO_COLORS[s.status] || '#6B7280') + '20', color: STATUS_SOLICITACAO_COLORS[s.status] || '#6B7280' }}>
                          {s.status === 'pendente' ? 'Pendente' : s.status === 'atendida' ? 'Atendida' : 'Cancelada'}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                        {s.status === 'pendente' && (
                          <button
                            onClick={() => {
                              setModalSolicitacoesOpen(false);
                              setUsuarioResetSenha({
                                id: String(s.usuario_id),
                                nome: s.nome_usuario,
                                email: s.email,
                                matricula: s.matricula,
                                curso_nome: s.curso_nome,
                                auth_user_id: undefined,
                              } as UsuarioComAluno);
                              setModalResetSenhaOpen(true);
                            }}
                            style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: '#7C3AED', color: '#FFF', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem' }}
                          >
                            Redefinir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal Reset Senha */}
      {modalResetSenhaOpen && usuarioResetSenha && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ color: '#7C3AED', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} /> Redefinir Senha
              </h3>
              <button onClick={() => { setModalResetSenhaOpen(false); setUsuarioResetSenha(null); }} className="btn-close">&times;</button>
            </div>
            <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertCircle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: '0.85rem', color: '#92400E', margin: 0 }}>
                A senha sera redefinida para <strong>ser@2026</strong>. O usuario sera obrigado a criar uma nova senha no proximo login.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nome:</span> <strong>{usuarioResetSenha.nome}</strong></div>
              <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>E-mail:</span> <strong>{usuarioResetSenha.email}</strong></div>
              <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Matricula:</span> <strong>{usuarioResetSenha.matricula || '-'}</strong></div>
              <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Curso:</span> <strong>{usuarioResetSenha.curso_nome || '-'}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setModalResetSenhaOpen(false); setUsuarioResetSenha(null); }} className="btn-secondary">Cancelar</button>
              <button onClick={() => handleRedefinirSenha()} disabled={resetando} style={{ padding: '0.55rem 1.25rem', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#FFF', fontWeight: 700, fontSize: '0.88rem', cursor: resetando ? 'wait' : 'pointer' }}>
                {resetando ? 'Redefinindo...' : 'Confirmar Redefinicao'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aplicar Carga Horária Padrão em Lote */}
      {modalLoteOpen && previewLote && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} /> Aplicar Carga Horária Padrão em Lote
              </h3>
              <button onClick={() => setModalLoteOpen(false)} className="btn-close">&times;</button>
            </div>

            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#0369A1' }}>
                <strong>Resumo da Operação:</strong>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                  <li>Carga Padrão Atual do Sistema: <strong>{previewLote.valor_padrao}h semanais</strong></li>
                  <li>Alunos a serem afetados: <strong>{previewLote.total_afetados} aluno(s)</strong></li>
                </ul>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)', display: 'block', marginBottom: '0.5rem' }}>
                Modo de Aplicação:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', background: apenasSemCarga ? '#EFF6FF' : '#FFF', padding: '0.6rem 0.8rem', borderRadius: 8, border: apenasSemCarga ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}>
                  <input
                    type="radio"
                    name="modo_lote"
                    checked={apenasSemCarga}
                    onChange={() => handleToggleOpcaoSemCarga(true)}
                  />
                  <span><strong>Apenas aos alunos sem carga configurada</strong> (Recomendado — Preserva cargas individuais existentes)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', background: !apenasSemCarga ? '#FEF2F2' : '#FFF', padding: '0.6rem 0.8rem', borderRadius: 8, border: !apenasSemCarga ? '2px solid #EF4444' : '1px solid var(--border-color)' }}>
                  <input
                    type="radio"
                    name="modo_lote"
                    checked={!apenasSemCarga}
                    onChange={() => handleToggleOpcaoSemCarga(false)}
                  />
                  <span style={{ color: !apenasSemCarga ? '#991B1B' : 'inherit' }}>
                    <strong>Aplicar a TODOS os alunos</strong> (Sobrescreve a carga de todos os alunos cadastrados)
                  </span>
                </label>
              </div>
            </div>

            {!apenasSemCarga && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#991B1B', fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>
                  <AlertCircle size={16} color="#DC2626" /> Confirmação Reforçada Exigida
                </div>
                <p style={{ fontSize: '0.8rem', color: '#7F1D1D', margin: '0 0 0.5rem' }}>
                  Esta ação alterará a carga horária de TODOS os alunos para {previewLote.valor_padrao}h semanais. Alunos com horário firmado terão a grade reaberta com a marcação "Grade precisa de ajuste".
                </p>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#991B1B', display: 'block', marginBottom: 4 }}>
                  Digite <strong>CONFIRMAR</strong> abaixo para prosseguir:
                </label>
                <input
                  type="text"
                  placeholder="CONFIRMAR"
                  value={confirmacaoTexto}
                  onChange={e => setConfirmacaoTexto(e.target.value)}
                  style={{ ...inputStyle, background: '#FFF', borderColor: '#FCA5A5', fontWeight: 700 }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalLoteOpen(false)} className="btn-secondary">Cancelar</button>
              <button
                onClick={handleAplicarLote}
                disabled={aplicandoLote || (!apenasSemCarga && confirmacaoTexto.trim().toUpperCase() !== 'CONFIRMAR')}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: 8,
                  border: 'none',
                  background: !apenasSemCarga ? '#DC2626' : 'var(--primary)',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: aplicandoLote ? 'wait' : 'pointer',
                  opacity: (!apenasSemCarga && confirmacaoTexto.trim().toUpperCase() !== 'CONFIRMAR') || aplicandoLote ? 0.5 : 1,
                }}
              >
                {aplicandoLote ? 'Aplicando...' : 'Confirmar e Aplicar em Lote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
