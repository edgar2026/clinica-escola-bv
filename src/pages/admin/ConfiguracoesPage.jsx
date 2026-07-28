import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { formatarData } from '../../utils/datas';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { GestaoUsuariosPage } from './GestaoUsuariosPage';
import {
  Plus, Trash2, Edit2, ChevronRight, BookOpen, Calendar,
  Clock, MapPin, Shield, Users, GraduationCap, AlertTriangle, Settings,
  CheckCircle, Save, X, Lock, Unlock
} from 'lucide-react';

const DIAS_SEMANA = [
  { id: 1, nome: 'Segunda-feira' },
  { id: 2, nome: 'Terca-feira' },
  { id: 3, nome: 'Quarta-feira' },
  { id: 4, nome: 'Quinta-feira' },
  { id: 5, nome: 'Sexta-feira' },
  { id: 6, nome: 'Sabado' },
];

const SITUACOES = ['ativa', 'concluida', 'trancada', 'desistente', 'formado'];

const CATEGORIES = [
  {
    label: 'Gestao de Acesso',
    icon: Shield,
    items: [
      { id: 'usuarios', label: 'Usuarios do Sistema' },
    ],
  },
  {
    label: 'Dados Basicos',
    icon: BookOpen,
    items: [
      { id: 'cursos', label: 'Cursos' },
      { id: 'periodos', label: 'Periodos' },
      { id: 'turnos', label: 'Turnos' },
    ],
  },
  {
    label: 'Corpo Docente',
    icon: Users,
    items: [
      { id: 'supervisores', label: 'Supervisores' },
    ],
  },
  {
    label: 'Horarios de Funcionamento',
    icon: Clock,
    items: [
      { id: 'horarios', label: 'Dias e Horarios' },
      { id: 'duracao_atendimento', label: 'Duracao dos Atendimentos' },
      { id: 'vagas_horarios', label: 'Vagas por Horario' },
    ],
  },
  {
    label: 'Regras de Negocio',
    icon: Shield,
    items: [
      { id: 'limite_semanal', label: 'Limite Semanal' },
      { id: 'datas_vigencia', label: 'Datas de Vigencia' },
      { id: 'tolerancia_atraso', label: 'Tolerancia de Atraso' },
      { id: 'regras_agendamento', label: 'Regras de Presença' },
    ],
  },
  {
    label: 'Calendario',
    icon: Calendar,
    items: [
      { id: 'feriados', label: 'Feriados' },
      { id: 'recessos', label: 'Recessos' },
      { id: 'bloqueios', label: 'Datas Bloqueadas' },
    ],
  },
  {
    label: 'Geolocalizacao',
    icon: MapPin,
    items: [
      { id: 'localizacao', label: 'Localizacao' },
      { id: 'raio_ponto', label: 'Raio para Ponto' },
    ],
  },
];

const SIDEBAR_STYLE = {
  width: 220,
  flexShrink: 0,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 12,
  overflow: 'hidden',
  alignSelf: 'flex-start',
  position: 'sticky',
  top: 0,
};

const INPUT_STYLE = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  borderRadius: 8,
  border: '1.5px solid var(--border-color)',
  fontSize: '0.9rem',
  color: 'var(--text-dark)',
  background: '#FFF',
  outline: 'none',
};

const LABEL_STYLE = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-dark)',
  marginBottom: 4,
  display: 'block',
};

const SECTION_HEADER_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const CARD_STYLE = {
  background: 'var(--bg-card)',
  borderRadius: 12,
  border: '1px solid var(--border-color)',
  padding: '1.25rem',
  marginBottom: '1rem',
};

const TH_STYLE = {
  padding: '0.6rem 0.75rem',
  textAlign: 'left',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  borderBottom: '2px solid var(--border-color)',
};

const TD_STYLE = {
  padding: '0.6rem 0.75rem',
  fontSize: '0.85rem',
  color: 'var(--text-dark)',
  verticalAlign: 'middle',
};

const InlineRegraField = ({ label, descricao, chave, valor, onSalvar }) => {
  const [localValor, setLocalValor] = useState(valor || '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setLocalValor(valor || '');
  }, [valor]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await onSalvar(chave, localValor);
    } catch {} finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ ...CARD_STYLE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{label}</div>
        {descricao && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{descricao}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="number"
          value={localValor}
          onChange={e => setLocalValor(e.target.value)}
          style={{ ...INPUT_STYLE, width: 120, textAlign: 'center', fontWeight: 700 }}
        />
        <button
          onClick={handleSalvar}
          disabled={salvando || localValor === valor}
          className="btn-primary"
          style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, opacity: salvando || localValor === valor ? 0.5 : 1 }}
        >
          <Save size={14} /> {salvando ? '...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
};

const InlineRegraTextoField = ({ label, descricao, chave, valor, onSalvar }) => {
  const [localValor, setLocalValor] = useState(valor || '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setLocalValor(valor || '');
  }, [valor]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await onSalvar(chave, localValor);
    } catch {} finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ ...CARD_STYLE, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{label}</div>
        {descricao && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{descricao}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, maxWidth: 400 }}>
        <input
          type="text"
          value={localValor}
          onChange={e => setLocalValor(e.target.value)}
          style={{ ...INPUT_STYLE, flex: 1 }}
        />
        <button
          onClick={handleSalvar}
          disabled={salvando || localValor === valor}
          className="btn-primary"
          style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, opacity: salvando || localValor === valor ? 0.5 : 1, whiteSpace: 'nowrap' }}
        >
          <Save size={14} /> {salvando ? '...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
};

const CrudSection = ({ titulo, itens, colunas, camposForm, onNovo, onEditar, onExcluir, nomeItem, showToast }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const abrirNovo = () => {
    setEditando(null);
    const inicial = {};
    camposForm.forEach(c => { inicial[c.chave] = c.valorInicial || ''; });
    setForm(inicial);
    setModalOpen(true);
  };

  const abrirEditar = (item) => {
    setEditando(item);
    const inicial = {};
    camposForm.forEach(c => { inicial[c.chave] = item[c.chave] ?? ''; });
    setForm(inicial);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (editando) {
        await onEditar(editando.id, form);
      } else {
        await onNovo(form);
      }
      setModalOpen(false);
    } catch (err) {
      if (showToast) showToast('Erro ao salvar: ' + (err.message || 'Tente novamente.'), 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!confirmDelete) return;
    try {
      await onExcluir(confirmDelete.id);
    } catch (err) {
      if (showToast) showToast('Erro ao excluir: ' + (err.message || 'Tente novamente.'), 'erro');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{titulo}</h3>
        <button onClick={abrirNovo} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.5rem 1rem', fontSize: '0.82rem' }}>
          <Plus size={14} /> Novo {nomeItem}
        </button>
      </div>

      {itens.length === 0 ? (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <AlertTriangle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>
            Nenhum {nomeItem.toLowerCase()} cadastrado. Clique em 'Novo {nomeItem}' para comecar a configuracao do sistema.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {colunas.map(col => (
                  <th key={col.chave}>{col.label}</th>
                ))}
                <th style={{ width: 140 }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {itens.map(item => (
                <tr key={item.id}>
                  {colunas.map(col => (
                    <td key={col.chave}>
                      {col.render ? col.render(item[col.chave], item) : (item[col.chave] ?? '-')}
                    </td>
                  ))}
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => abrirEditar(item)} style={{ background: '#E0F2FE', border: 'none', color: '#0284C7', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }} title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setConfirmDelete(item)} style={{ background: '#FEE2E2', border: 'none', color: '#DC2626', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }} title="Excluir">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {editando ? <Edit2 size={18} /> : <Plus size={18} />}
                {editando ? `Editar ${nomeItem}` : `Novo ${nomeItem}`}
              </h3>
              <button onClick={() => setModalOpen(false)} className="btn-close">&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: camposForm.length > 2 ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                {camposForm.map(campo => (
                  <div key={campo.chave} style={campo.fullWidth ? { gridColumn: '1 / -1' } : {}}>
                    <label style={LABEL_STYLE}>{campo.label} {campo.obrigatorio && '*'}</label>
                    {campo.tipo === 'select' ? (
                      <select required={campo.obrigatorio} value={form[campo.chave] || ''} onChange={e => setForm({ ...form, [campo.chave]: e.target.value })} style={{ ...INPUT_STYLE, background: '#FFF' }}>
                        <option value="">Selecione...</option>
                        {(campo.opcoes || []).map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    ) : campo.tipo === 'textarea' ? (
                      <textarea required={campo.obrigatorio} rows={3} value={form[campo.chave] || ''} onChange={e => setForm({ ...form, [campo.chave]: e.target.value })} style={{ ...INPUT_STYLE, resize: 'vertical' }} placeholder={campo.placeholder || ''} />
                    ) : (
                      <input type={campo.tipo || 'text'} required={campo.obrigatorio} value={form[campo.chave] || ''} onChange={e => setForm({ ...form, [campo.chave]: e.target.value })} style={INPUT_STYLE} placeholder={campo.placeholder || ''} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Cancelar</button>
                <button type="submit" disabled={salvando} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen={true}
          title={`Excluir ${nomeItem}`}
          message={`Deseja realmente excluir este ${nomeItem.toLowerCase()}? Esta acao nao pode ser desfeita.`}
          confirmText="Excluir"
          cancelText="Cancelar"
          confirmVariant="danger"
          onConfirm={handleExcluir}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

const PERFIL_LABELS = { admin: 'ADMIN', aluno: 'ALUNO', gerencia: 'GERENCIA' };

const PanelUsuarios = ({ showToast }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [perfilFiltro, setPerfilFiltro] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', matricula: '', cpf: '', senha: '', perfil: 'aluno' });
  const [salvando, setSalvando] = useState(false);
  const [targetUsuario, setTargetUsuario] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const res = await adminService.getUsuarios();
      if (res && res.usuarios) setUsuarios(res.usuarios);
    } catch {}
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (e) => {
    e.preventDefault();
    if (!form.nome || !form.email || !form.matricula || !form.senha) {
      showToast('Preencha todos os campos obrigatorios.', 'erro');
      return;
    }
    setSalvando(true);
    try {
      const res = await adminService.criarUsuario(form);
      showToast(res.mensagem || 'Usuario criado com sucesso!', 'sucesso');
      setModalOpen(false);
      setForm({ nome: '', email: '', matricula: '', cpf: '', senha: '', perfil: 'aluno' });
      await carregar();
    } catch (err) {
      showToast(err.message || 'Erro ao criar usuario.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleStatus = async (justificativa) => {
    if (!justificativa || justificativa.trim().length < 4) {
      showToast('Informe a justificativa (minimo 4 caracteres).', 'erro');
      return;
    }
    const novoStatus = targetUsuario.status === 'ativo' ? 'bloqueado' : 'ativo';
    try {
      await adminService.alterarStatusUsuario(targetUsuario.id, novoStatus, justificativa);
      showToast(`Conta ${novoStatus === 'ativo' ? 'desbloqueada' : 'bloqueada'} com sucesso!`, 'sucesso');
      await carregar();
    } catch (err) {
      showToast('Erro ao alterar status: ' + (err.message || 'Tente novamente.'), 'erro');
    } finally {
      setTargetUsuario(null);
    }
  };

  const filtrados = usuarios.filter(u => {
    const bateBusca = (u.nome || '').toLowerCase().includes(filtro.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(filtro.toLowerCase()) ||
      (u.matricula || '').toLowerCase().includes(filtro.toLowerCase());
    const batePerfil = perfilFiltro === 'todos' || u.perfil === perfilFiltro;
    return bateBusca && batePerfil;
  });

  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Usuarios do Sistema</h3>
        <button onClick={() => { setForm({ nome: '', email: '', matricula: '', cpf: '', senha: '', perfil: 'aluno' }); setModalOpen(true); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.5rem 1rem', fontSize: '0.82rem' }}>
          <Plus size={14} /> Novo Usuario
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nome, e-mail ou matricula..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{ ...INPUT_STYLE, flex: 1, minWidth: 200 }}
        />
        <select value={perfilFiltro} onChange={e => setPerfilFiltro(e.target.value)} style={{ ...INPUT_STYLE, width: 180 }}>
          <option value="todos">Todos os Perfis</option>
          <option value="aluno">Alunos</option>
          <option value="gerencia">Gerencia</option>
          <option value="admin">Administradores</option>
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <AlertTriangle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>Nenhum usuario encontrado.</p>
        </div>
      ) : (
        <div style={CARD_STYLE}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={TH_STYLE}>Nome</th>
                <th style={TH_STYLE}>E-mail</th>
                <th style={TH_STYLE}>Matricula</th>
                <th style={TH_STYLE}>Perfil</th>
                <th style={TH_STYLE}>Status</th>
                <th style={TH_STYLE}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={TD_STYLE}><strong>{u.nome}</strong></td>
                  <td style={TD_STYLE}>{u.email}</td>
                  <td style={TD_STYLE}><code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{u.matricula}</code></td>
                  <td style={TD_STYLE}>
                    <span className={`badge-vaga ${u.perfil === 'admin' ? 'amarelo' : u.perfil === 'gerencia' ? 'amarelo' : 'verde'}`}>
                      {PERFIL_LABELS[u.perfil] || u.perfil?.toUpperCase()}
                    </span>
                  </td>
                  <td style={TD_STYLE}>
                    <span className={`badge-vaga ${u.status === 'ativo' ? 'verde' : 'vermelho'}`}>
                      {u.status?.toUpperCase()}
                    </span>
                  </td>
                  <td style={TD_STYLE}>
                    {u.perfil !== 'admin' && (
                      <button
                        onClick={() => {
                          const justificativa = prompt(`Justificativa para ${u.status === 'ativo' ? 'bloquear' : 'desbloquear'} ${u.nome}:`);
                          if (justificativa && justificativa.trim().length >= 4) {
                            setTargetUsuario(u);
                            handleToggleStatus(justificativa);
                          } else if (justificativa !== null) {
                            showToast('Justificativa deve ter minimo 4 caracteres.', 'erro');
                          }
                        }}
                        style={{ padding: '4px 10px', fontSize: '0.78rem', border: 'none', borderRadius: 6, cursor: 'pointer', background: u.status === 'ativo' ? '#FEE2E2' : '#DCFCE7', color: u.status === 'ativo' ? '#DC2626' : '#16A34A', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        {u.status === 'ativo' ? <Lock size={12} /> : <Unlock size={12} />}
                        {u.status === 'ativo' ? 'Bloquear' : 'Desbloquear'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0 }}>Novo Usuario</h3>
              <button onClick={() => setModalOpen(false)} className="btn-close">&times;</button>
            </div>
            <form onSubmit={handleNovo}>
              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={LABEL_STYLE}>Nome Completo *</label>
                  <input type="text" required placeholder="Nome do usuario" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={INPUT_STYLE} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={LABEL_STYLE}>E-mail *</label>
                    <input type="email" required placeholder="email@uninassau.edu.br" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={INPUT_STYLE} />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Matricula *</label>
                    <input type="text" required placeholder="00000000" value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} style={INPUT_STYLE} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={LABEL_STYLE}>CPF</label>
                    <input type="text" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} style={INPUT_STYLE} />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Senha *</label>
                    <input type="password" required placeholder="Minimo 4 caracteres" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} style={INPUT_STYLE} />
                  </div>
                </div>
                <div>
                  <label style={LABEL_STYLE}>Perfil *</label>
                  <select value={form.perfil} onChange={e => setForm({ ...form, perfil: e.target.value })} style={INPUT_STYLE}>
                    <option value="aluno">Aluno</option>
                    <option value="gerencia">Gerencia</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Criar Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const PanelCursos = ({ showToast }) => {
  const [cursos, setCursos] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getCursos();
      setCursos(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Erro ao carregar cursos: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarCurso(form);
    showToast(res.mensagem || 'Curso cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    showToast('Funcionalidade de edicao em desenvolvimento.', 'info');
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirCurso(id);
    showToast(res.mensagem || 'Curso excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Cursos"
      itens={cursos}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'codigo', label: 'Codigo', render: (v) => <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{v}</code> },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome do Curso', obrigatorio: true, placeholder: 'Ex: Enfermagem' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Curso"
      showToast={showToast}
    />
  );
};

const PanelPeriodos = ({ showToast }) => {
  const [periodos, setPeriodos] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getPeriodos();
      setPeriodos(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Erro ao carregar periodos: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarPeriodo(form);
    showToast(res.mensagem || 'Periodo cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    showToast('Funcionalidade de edicao em desenvolvimento.', 'info');
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirPeriodo(id);
    showToast(res.mensagem || 'Periodo excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Periodos"
      itens={periodos}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'codigo', label: 'Codigo', render: (v) => <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{v}</code> },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome do Periodo', obrigatorio: true, placeholder: 'Ex: 1o Semestre 2026' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Periodo"
      showToast={showToast}
    />
  );
};

const PanelTurnos = ({ showToast }) => {
  const [turnos, setTurnos] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getTurnos();
      setTurnos(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Erro ao carregar turnos: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarTurno(form);
    showToast(res.mensagem || 'Turno cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    showToast('Funcionalidade de edicao em desenvolvimento.', 'info');
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirTurno(id);
    showToast(res.mensagem || 'Turno excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Turnos"
      itens={turnos}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'codigo', label: 'Codigo', render: (v) => <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{v}</code> },
        { chave: 'hora_inicio', label: 'Inicio' },
        { chave: 'hora_fim', label: 'Fim' },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome do Turno', obrigatorio: true, placeholder: 'Ex: Manha, Tarde ou Noite' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Turno"
      showToast={showToast}
    />
  );
};

const PanelClinicas = ({ showToast }) => {
  const [clinicas, setClinicas] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getClinicas();
      setClinicas(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Erro ao carregar clinicas: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarClinica(form);
    showToast(res.mensagem || 'Clinica cadastrada com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    const res = await adminService.atualizarClinica(id, form);
    showToast(res.mensagem || 'Clinica atualizada!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirClinica(id);
    showToast(res.mensagem || 'Clinica excluida com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Clinicas"
      itens={clinicas}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'cidade', label: 'Cidade' },
        { chave: 'telefone', label: 'Telefone' },
        { chave: 'email', label: 'Email' },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome da Clinica', obrigatorio: true, placeholder: 'Ex: Clinica Escola' },
        { chave: 'endereco', label: 'Endereco', fullWidth: true },
        { chave: 'cidade', label: 'Cidade', obrigatorio: true },
        { chave: 'telefone', label: 'Telefone' },
        { chave: 'email', label: 'Email', tipo: 'email' },
        { chave: 'latitude', label: 'Latitude', tipo: 'number' },
        { chave: 'longitude', label: 'Longitude', tipo: 'number' },
        { chave: 'raio_geofence_metros', label: 'Raio Geofence (m)', tipo: 'number' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Clinica"
      showToast={showToast}
    />
  );
};

const PanelSetores = ({ showToast }) => {
  const [setores, setSetores] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([adminService.getSetores(), adminService.getUnidades()]);
      setSetores(Array.isArray(s) ? s : []);
      setUnidades(Array.isArray(u) ? u : []);
    } catch (err) {
      showToast('Erro ao carregar setores: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarSetor(form);
    showToast(res.mensagem || 'Setor cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    const res = await adminService.atualizarSetor(id, form);
    showToast(res.mensagem || 'Setor atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirSetor(id);
    showToast(res.mensagem || 'Setor excluido com sucesso!', 'sucesso');
    await carregar();
  };

  const opcoesUnidades = unidades.map(u => ({ value: u.id, label: u.nome }));

  return (
    <CrudSection
      titulo="Setores"
      itens={setores}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'unidade_nome', label: 'Unidade' },
        { chave: 'capacidade_padrao', label: 'Capacidade' },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome do Setor', obrigatorio: true },
        { chave: 'unidade_id', label: 'Unidade', tipo: 'select', opcoes: opcoesUnidades },
        { chave: 'capacidade_padrao', label: 'Capacidade Padrao', tipo: 'number' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Setor"
      showToast={showToast}
    />
  );
};

const PanelEspecialidades = ({ showToast }) => {
  const [especialidades, setEspecialidades] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getEspecialidades();
      setEspecialidades(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Erro ao carregar especialidades: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarEspecialidade(form);
    showToast(res.mensagem || 'Especialidade cadastrada com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    const res = await adminService.atualizarEspecialidade(id, form);
    showToast(res.mensagem || 'Especialidade atualizada!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirEspecialidade(id);
    showToast(res.mensagem || 'Especialidade excluida com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Especialidades"
      itens={especialidades}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'codigo', label: 'Codigo', render: (v) => <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{v}</code> },
        { chave: 'descricao', label: 'Descricao' },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome da Especialidade', obrigatorio: true },
        { chave: 'descricao', label: 'Descricao', tipo: 'textarea', fullWidth: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Especialidade"
      showToast={showToast}
    />
  );
};

const PanelSupervisores = ({ showToast }) => {
  const [supervisores, setSupervisores] = useState([]);
  const [cursos, setCursos] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([adminService.getSupervisores(), adminService.getCursos()]);
      setSupervisores(Array.isArray(s) ? s : []);
      setCursos(Array.isArray(c) ? c : []);
    } catch (err) {
      showToast('Erro ao carregar supervisores: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarSupervisor(form);
    showToast(res.mensagem || 'Supervisor cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    const res = await adminService.atualizarSupervisor(id, form);
    showToast(res.mensagem || 'Supervisor atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirSupervisor(id);
    showToast(res.mensagem || 'Supervisor excluido com sucesso!', 'sucesso');
    await carregar();
  };

  const opcoesCursos = cursos.map(c => ({ value: c.id, label: c.nome }));

  return (
    <CrudSection
      titulo="Supervisores"
      itens={supervisores}
      colunas={[
        { chave: 'nome', label: 'Nome' },
        { chave: 'curso_nome', label: 'Curso' },
      ]}
      camposForm={[
        { chave: 'nome', label: 'Nome Completo', obrigatorio: true, placeholder: 'Nome do supervisor' },
        { chave: 'curso_id', label: 'Curso', tipo: 'select', opcoes: opcoesCursos, obrigatorio: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Supervisor"
      showToast={showToast}
    />
  );
};

const PanelVinculos = ({ showToast }) => {
  const [vinculos, setVinculos] = useState([]);
  const [opcoes, setOpcoes] = useState({ cursos: [], periodos: [], turnos: [], setores: [] });
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [v, o] = await Promise.all([adminService.getVinculos(), adminService.getOpcoesCadastro()]);
      setVinculos(Array.isArray(v) ? v : []);
      setOpcoes(o || {});
    } catch (err) {
      showToast('Erro ao carregar vinculos: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirEditar = (v) => {
    setEditando(v);
    setForm({
      curso_id: v.curso_id || '',
      periodo_id: v.periodo_id || '',
      turno_id: v.turno_id || '',
      setor_id: v.setor_id || '',
      carga_horaria_semanal_max: v.carga_horaria_semanal_max || '',
      situacao: v.situacao || 'ativa',
    });
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const res = await adminService.atualizarVinculo(editando.id, form);
      showToast(res.mensagem || 'Vinculo atualizado com sucesso!', 'sucesso');
      setEditando(null);
      await carregar();
    } catch (err) {
      showToast('Erro ao salvar: ' + err.message, 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const situacaoBadge = (s) => {
    const map = { ativa: 'verde', concluida: 'verde', trancada: 'amarelo', desistente: 'vermelho', formado: 'verde' };
    return map[s] || 'amarelo';
  };

  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Alunos Vinculados</h3>
      </div>

      {vinculos.length === 0 ? (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <AlertTriangle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>
            Nenhum aluno vinculado encontrado. Os vinculos sao criados quando alunos sao cadastrados no sistema.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Curso</th>
                <th>Periodo</th>
                <th>Turno</th>
                <th>Setor</th>
                <th>Carga Horaria</th>
                <th>Situacao</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {vinculos.map(v => (
                <tr key={v.id}>
                  <td><strong>{v.aluno_nome}</strong></td>
                  <td>{v.curso_nome || '-'}</td>
                  <td>{v.periodo_nome || '-'}</td>
                  <td>{v.turno_nome || '-'}</td>
                  <td>{v.setor_nome || '-'}</td>
                  <td>{v.carga_horaria_semanal_max ? `${v.carga_horaria_semanal_max}h` : '-'}</td>
                  <td>
                    <span className={`badge-vaga ${situacaoBadge(v.situacao)}`}>
                      {v.situacao?.toUpperCase() || '-'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => abrirEditar(v)} style={{ background: '#E0F2FE', border: 'none', color: '#0284C7', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Edit2 size={13} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={18} /> Editar Vinculo - {editando.aluno_nome}
              </h3>
              <button onClick={() => setEditando(null)} className="btn-close">&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={LABEL_STYLE}>Curso</label>
                <select value={form.curso_id} onChange={e => setForm({ ...form, curso_id: e.target.value })} style={{ ...INPUT_STYLE, background: '#FFF' }}>
                  <option value="">Selecione...</option>
                  {(opcoes.cursos || []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Periodo</label>
                <select value={form.periodo_id} onChange={e => setForm({ ...form, periodo_id: e.target.value })} style={{ ...INPUT_STYLE, background: '#FFF' }}>
                  <option value="">Selecione...</option>
                  {(opcoes.periodos || []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Turno</label>
                <select value={form.turno_id} onChange={e => setForm({ ...form, turno_id: e.target.value })} style={{ ...INPUT_STYLE, background: '#FFF' }}>
                  <option value="">Selecione...</option>
                  {(opcoes.turnos || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Setor</label>
                <select value={form.setor_id} onChange={e => setForm({ ...form, setor_id: e.target.value })} style={{ ...INPUT_STYLE, background: '#FFF' }}>
                  <option value="">Selecione...</option>
                  {(opcoes.setores || []).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Carga Horaria Semanal Max (h)</label>
                <input type="number" value={form.carga_horaria_semanal_max} onChange={e => setForm({ ...form, carga_horaria_semanal_max: e.target.value })} style={INPUT_STYLE} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Situacao</label>
                <select value={form.situacao} onChange={e => setForm({ ...form, situacao: e.target.value })} style={{ ...INPUT_STYLE, background: '#FFF' }}>
                  {SITUACOES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setEditando(null)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PanelHorarios = ({ showToast }) => {
  const [horarios, setHorarios] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getHorariosFuncionamento();
      setHorarios(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Erro ao carregar horarios: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarHorarioFuncionamento(form);
    showToast(res.mensagem || 'Horario cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    const res = await adminService.atualizarHorarioFuncionamento(id, form);
    showToast(res.mensagem || 'Horario atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirHorarioFuncionamento(id);
    showToast(res.mensagem || 'Horario excluido com sucesso!', 'sucesso');
    await carregar();
  };

  const opcoesDias = DIAS_SEMANA.map(d => ({ value: d.id, label: d.nome }));

  return (
    <CrudSection
      titulo="Dias e Horarios de Funcionamento"
      itens={horarios}
      colunas={[
        { chave: 'dia_semana', label: 'Dia', render: (v) => DIAS_SEMANA.find(d => d.id === v)?.nome || v },
        { chave: 'hora_inicio', label: 'Inicio' },
        { chave: 'hora_fim', label: 'Fim' },
        { chave: 'duracao_intervalo_min', label: 'Intervalo (min)' },
      ]}
      camposForm={[
        { chave: 'dia_semana', label: 'Dia da Semana', tipo: 'select', opcoes: opcoesDias, obrigatorio: true },
        { chave: 'hora_inicio', label: 'Horario Inicio', tipo: 'time', obrigatorio: true },
        { chave: 'hora_fim', label: 'Horario Fim', tipo: 'time', obrigatorio: true },
        { chave: 'duracao_intervalo_min', label: 'Duracao do Intervalo (min)', tipo: 'number' },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Horario"
      showToast={showToast}
    />
  );
};

const PanelDuracaoAtendimento = ({ showToast, regras, onSalvar }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Duracao dos Atendimentos</h3>
      <InlineRegraField
        label="Duracao padrao do atendimento"
        descricao="Tempo em minutos de cada sessao de atendimento."
        chave="duracao_atendimento_minutos"
        valor={regras.duracao_atendimento_minutos}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelVagasHorarios = ({ showToast }) => {
  const [vagas, setVagas] = useState([]);
  const [setores, setSetores] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [cursos, setCursos] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const [v, s, sup, c] = await Promise.all([
        adminService.getVagasHorarios(),
        adminService.getSetores(),
        adminService.getSupervisores(),
        adminService.getCursos(),
      ]);
      setVagas(Array.isArray(v) ? v : []);
      setSetores(Array.isArray(s) ? s : []);
      setSupervisores(Array.isArray(sup) ? sup : []);
      setCursos(Array.isArray(c) ? c : []);
    } catch (err) {
      showToast('Erro ao carregar vagas por horario: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarVagaHorario(form);
    showToast(res.mensagem || 'Vaga por horario cadastrada com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    const res = await adminService.atualizarVagaHorario(id, form);
    showToast(res.mensagem || 'Vaga por horario atualizada!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirVagaHorario(id);
    showToast(res.mensagem || 'Vaga por horario excluida com sucesso!', 'sucesso');
    await carregar();
  };

  const opcoesSetores = setores.map(s => ({ value: s.id, label: s.nome }));
  const opcoesSupervisores = supervisores.map(s => ({ value: s.id, label: s.usuario_nome || s.nome }));
  const opcoesCursos = cursos.map(c => ({ value: c.id, label: c.nome }));
  const opcoesDias = DIAS_SEMANA.map(d => ({ value: d.id, label: d.nome }));

  return (
    <CrudSection
      titulo="Vagas por Horario"
      itens={vagas}
      colunas={[
        { chave: 'setor_nome', label: 'Setor' },
        { chave: 'supervisor_nome', label: 'Supervisor' },
        { chave: 'curso_nome', label: 'Curso' },
        { chave: 'dia_semana', label: 'Dia', render: (v) => DIAS_SEMANA.find(d => d.id === v)?.nome || v },
        { chave: 'hora_inicio', label: 'Inicio' },
        { chave: 'hora_fim', label: 'Fim' },
        { chave: 'capacidade_max', label: 'Capacidade' },
      ]}
      camposForm={[
        { chave: 'setor_id', label: 'Setor', tipo: 'select', opcoes: opcoesSetores, obrigatorio: true },
        { chave: 'supervisor_id', label: 'Supervisor', tipo: 'select', opcoes: opcoesSupervisores, obrigatorio: true },
        { chave: 'curso_id', label: 'Curso', tipo: 'select', opcoes: opcoesCursos, obrigatorio: true },
        { chave: 'dia_semana', label: 'Dia da Semana', tipo: 'select', opcoes: opcoesDias, obrigatorio: true },
        { chave: 'hora_inicio', label: 'Horario Inicio', tipo: 'time', obrigatorio: true },
        { chave: 'hora_fim', label: 'Horario Fim', tipo: 'time', obrigatorio: true },
        { chave: 'capacidade_max', label: 'Capacidade Maxima', tipo: 'number', obrigatorio: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Vaga"
      showToast={showToast}
    />
  );
};

const PanelFeriados = ({ showToast }) => {
  const [feriados, setFeriados] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getFeriados();
      setFeriados((Array.isArray(data) ? data : []).filter(f => f.tipo === 'feriado'));
    } catch (err) {
      showToast('Erro ao carregar feriados: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarFeriado({ ...form, tipo: 'feriado' });
    showToast(res.mensagem || 'Feriado cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    const res = await adminService.atualizarFeriado(id, form);
    showToast(res.mensagem || 'Feriado atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirFeriado(id);
    showToast(res.mensagem || 'Feriado excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Feriados"
      itens={feriados}
      colunas={[
        { chave: 'data', label: 'Data', render: (v) => formatarData(v) },
        { chave: 'descricao', label: 'Descricao' },
      ]}
      camposForm={[
        { chave: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
        { chave: 'descricao', label: 'Descricao', fullWidth: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Feriado"
      showToast={showToast}
    />
  );
};

const PanelRecessos = ({ showToast }) => {
  const [recessos, setRecessos] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getFeriados();
      setRecessos((Array.isArray(data) ? data : []).filter(f => f.tipo === 'recesso'));
    } catch (err) {
      showToast('Erro ao carregar recessos: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarFeriado({ ...form, tipo: 'recesso' });
    showToast(res.mensagem || 'Recesso cadastrado com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    const res = await adminService.atualizarFeriado(id, form);
    showToast(res.mensagem || 'Recesso atualizado!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirFeriado(id);
    showToast(res.mensagem || 'Recesso excluido com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Recessos"
      itens={recessos}
      colunas={[
        { chave: 'data', label: 'Data', render: (v) => formatarData(v) },
        { chave: 'descricao', label: 'Descricao' },
      ]}
      camposForm={[
        { chave: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
        { chave: 'descricao', label: 'Descricao', fullWidth: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Recesso"
      showToast={showToast}
    />
  );
};

const PanelBloqueios = ({ showToast }) => {
  const [bloqueios, setBloqueios] = useState([]);
  const carregar = useCallback(async () => {
    try {
      const data = await adminService.getFeriados();
      setBloqueios((Array.isArray(data) ? data : []).filter(f => f.tipo === 'manutencao'));
    } catch (err) {
      showToast('Erro ao carregar datas bloqueadas: ' + err.message, 'erro');
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleNovo = async (form) => {
    const res = await adminService.cadastrarFeriado({ ...form, tipo: 'manutencao' });
    showToast(res.mensagem || 'Data bloqueada cadastrada com sucesso!', 'sucesso');
    await carregar();
  };

  const handleEditar = async (id, form) => {
    const res = await adminService.atualizarFeriado(id, form);
    showToast(res.mensagem || 'Data bloqueada atualizada!', 'sucesso');
    await carregar();
  };

  const handleExcluir = async (id) => {
    const res = await adminService.excluirFeriado(id);
    showToast(res.mensagem || 'Data bloqueada excluida com sucesso!', 'sucesso');
    await carregar();
  };

  return (
    <CrudSection
      titulo="Datas Bloqueadas"
      itens={bloqueios}
      colunas={[
        { chave: 'data', label: 'Data', render: (v) => formatarData(v) },
        { chave: 'descricao', label: 'Descricao' },
      ]}
      camposForm={[
        { chave: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
        { chave: 'descricao', label: 'Descricao', fullWidth: true },
      ]}
      onNovo={handleNovo}
      onEditar={handleEditar}
      onExcluir={handleExcluir}
      nomeItem="Data Bloqueada"
      showToast={showToast}
    />
  );
};

const PanelLocalizacao = ({ showToast, regras, onSalvar }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Localizacao da Clinica</h3>
      <InlineRegraTextoField
        label="Latitude da clinica"
        descricao="Latitude do endereco da clinica escola."
        chave="latitude_clinica"
        valor={regras.latitude_clinica}
        onSalvar={onSalvar}
      />
      <InlineRegraTextoField
        label="Longitude da clinica"
        descricao="Longitude do endereco da clinica escola."
        chave="longitude_clinica"
        valor={regras.longitude_clinica}
        onSalvar={onSalvar}
      />
      <InlineRegraTextoField
        label="Endereco da clinica"
        descricao="Endereco completo da clinica escola."
        chave="endereco_clinica"
        valor={regras.endereco_clinica}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelRaioPonto = ({ showToast, regras, onSalvar }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Raio para Registro de Ponto</h3>
      <InlineRegraField
        label="Raio maximo para registro de ponto"
        descricao="Distancia maxima em metros que o aluno pode estar da clinica para registrar presenca."
        chave="raio_ponto_metros"
        valor={regras.raio_ponto_metros}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelLimiteSemanal = ({ showToast, regras, onSalvar }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Limite Semanal de Horas</h3>
      <InlineRegraField
        label="Limite padrao de horas semanais"
        descricao="Número máximo de horas que um aluno pode registrar por semana."
        chave="limite_horas_semanais_padrao"
        valor={regras.limite_horas_semanais_padrao}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelDatasVigencia = ({ showToast, regras, onSalvar }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Datas de Vigencia</h3>
      <InlineRegraField
        label="Antecedência para registro (dias)"
        descricao="Número mínimo de dias de antecedência para criar um registro."
        chave="antecedencia_agendamento_dias"
        valor={regras.antecedencia_agendamento_dias}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelToleranciaAtraso = ({ showToast, regras, onSalvar }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Tolerancia de Atraso</h3>
      <InlineRegraField
        label="Tolerancia de atraso (minutos)"
        descricao="Tempo em minutos apos o inicio do atendimento em que o aluno ainda pode registrar presenca."
        chave="tolerancia_atraso_minutos"
        valor={regras.tolerancia_atraso_minutos}
        onSalvar={onSalvar}
      />
    </div>
  );
};

const PanelRegrasAgendamento = ({ showToast, regras, onSalvar }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Regras de Presença</h3>
      <InlineRegraField
        label="Antecedencia para cancelamento (horas)"
        descricao="Horas mínimas de antecedência para cancelar um registro sem penalidade."
        chave="antecedencia_cancelamento_horas"
        valor={regras.antecedencia_cancelamento_horas}
        onSalvar={onSalvar}
      />
      <InlineRegraField
        label="Maximo de cancelamentos por aluno no mes"
        descricao="Numero maximo de cancelamentos que um aluno pode realizar por mes."
        chave="max_cancelamentos_aluno_mes"
        valor={regras.max_cancelamentos_aluno_mes}
        onSalvar={onSalvar}
      />
    </div>
  );
};

export const ConfiguracoesPage = () => {
  const { showToast } = useAuth();
  const [activeItem, setActiveItem] = useState('cursos');
  const [regras, setRegras] = useState({});
  const [loadingRegras, setLoadingRegras] = useState(true);

  const carregarRegras = useCallback(async () => {
    setLoadingRegras(true);
    try {
      const data = await adminService.getRegras();
      const map = {};
      if (Array.isArray(data)) {
        data.forEach(r => { map[r.chave] = r.valor; });
      }
      setRegras(map);
    } catch (err) {
      showToast('Erro ao carregar regras: ' + err.message, 'erro');
    } finally {
      setLoadingRegras(false);
    }
  }, [showToast]);

  useEffect(() => { carregarRegras(); }, [carregarRegras]);

  const handleSalvarRegra = async (chave, valor) => {
    try {
      await adminService.atualizarRegra(chave, valor);
      setRegras(prev => ({ ...prev, [chave]: valor }));
      showToast('Regra salva com sucesso!', 'sucesso');
    } catch (err) {
      showToast('Erro ao salvar regra: ' + err.message, 'erro');
    }
  };

  const renderPanel = () => {
    if (loadingRegras && ['duracao_atendimento', 'limite_semanal', 'datas_vigencia', 'tolerancia_atraso', 'regras_agendamento', 'localizacao', 'raio_ponto'].includes(activeItem)) {
      return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando configuracoes...</div>;
    }

    switch (activeItem) {
      case 'usuarios': return <GestaoUsuariosPage />;
      case 'cursos': return <PanelCursos showToast={showToast} />;
      case 'periodos': return <PanelPeriodos showToast={showToast} />;
      case 'turnos': return <PanelTurnos showToast={showToast} />;
      case 'supervisores': return <PanelSupervisores showToast={showToast} />;
      case 'horarios': return <PanelHorarios showToast={showToast} />;
      case 'duracao_atendimento': return <PanelDuracaoAtendimento showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'vagas_horarios': return <PanelVagasHorarios showToast={showToast} />;
      case 'limite_semanal': return <PanelLimiteSemanal showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'datas_vigencia': return <PanelDatasVigencia showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'tolerancia_atraso': return <PanelToleranciaAtraso showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'regras_agendamento': return <PanelRegrasAgendamento showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'feriados': return <PanelFeriados showToast={showToast} />;
      case 'recessos': return <PanelRecessos showToast={showToast} />;
      case 'bloqueios': return <PanelBloqueios showToast={showToast} />;
      case 'localizacao': return <PanelLocalizacao showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      case 'raio_ponto': return <PanelRaioPonto showToast={showToast} regras={regras} onSalvar={handleSalvarRegra} />;
      default: return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Selecione um item no menu ao lado.</div>;
    }
  };

  const activeLabel = CATEGORIES.flatMap(c => c.items).find(i => i.id === activeItem)?.label || '';

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Configuracoes do Sistema</h1>
        <p className="page-subtitle">Gerencie todas as configuracoes administrativas do sistema clinica-escola.</p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div style={SIDEBAR_STYLE}>
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={16} color="#FFF" />
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#FFF' }}>Configuracoes</span>
          </div>
          <nav style={{ padding: '0.5rem 0' }}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.label}>
                  <div style={{ padding: '0.65rem 1rem 0.35rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                    {cat.label}
                  </div>
                  {cat.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveItem(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        background: activeItem === item.id ? 'rgba(0,43,73,0.08)' : 'transparent',
                        color: activeItem === item.id ? 'var(--primary)' : 'var(--text-muted)',
                        fontSize: '0.82rem',
                        fontWeight: activeItem === item.id ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderLeft: activeItem === item.id ? '3px solid var(--secondary)' : '3px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ChevronRight size={12} style={{ opacity: activeItem === item.id ? 1 : 0.4 }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <Settings size={14} />
            <span>Configuracoes</span>
            <ChevronRight size={14} />
            <strong style={{ color: 'var(--primary)' }}>{activeLabel}</strong>
          </div>
          {renderPanel()}
        </div>
      </div>
    </section>
  );
};
