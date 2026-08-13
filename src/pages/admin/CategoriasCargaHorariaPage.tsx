import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Plus, Trash2, Edit2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { CategoriaCargaHoraria } from '../../types';

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  borderRadius: 8,
  border: '1.5px solid var(--border-color)',
  fontSize: '0.9rem',
  color: 'var(--text-dark)',
  background: '#FFF',
  outline: 'none',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-dark)',
  marginBottom: 4,
  display: 'block',
};

export const CategoriasCargaHorariaPage = () => {
  const { showToast } = useAuth();
  const [categorias, setCategorias] = useState<CategoriaCargaHoraria[]>([]);
  const [cargaPadrao, setCargaPadrao] = useState<number>(4);
  const [salvandoPadrao, setSalvandoPadrao] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);
  const [modalInativarOpen, setModalInativarOpen] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<CategoriaCargaHoraria | null>(null);
  const [form, setForm] = useState({ nome: '', horas_semanais: '', descricao: '' });
  const [salvando, setSalvando] = useState(false);

  const carregarCategorias = useCallback(async () => {
    setLoading(true);
    try {
      const [data, padrao] = await Promise.all([
        adminService.getCategoriasCargaHoraria(),
        adminService.getCargaHorariaPadrao(),
      ]);
      setCategorias(data);
      setCargaPadrao(padrao || 4);
    } catch (err) {
      showToast('Erro ao carregar categorias: ' + (err instanceof Error ? err.message : ''), 'erro');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleSalvarPadrao = async () => {
    if (!cargaPadrao || cargaPadrao <= 0 || !Number.isInteger(cargaPadrao)) {
      showToast('A carga horária padrão deve ser um número inteiro positivo (ex: 4, 5, 6).', 'erro');
      return;
    }
    setSalvandoPadrao(true);
    try {
      await adminService.salvarCargaHorariaPadrao(cargaPadrao);
      showToast(`Carga horária padrão atualizada para ${cargaPadrao}h semanais! Novos alunos receberão esta carga automaticamente.`, 'sucesso');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar carga padrão.', 'erro');
    } finally {
      setSalvandoPadrao(false);
    }
  };

  useEffect(() => { carregarCategorias(); }, [carregarCategorias]);

  const abrirCriar = () => {
    setForm({ nome: '', horas_semanais: '', descricao: '' });
    setCategoriaSelecionada(null);
    setModalEditarOpen(true);
  };

  const abrirEditar = (cat: CategoriaCargaHoraria) => {
    setForm({ nome: cat.nome, horas_semanais: String(cat.horas_semanais), descricao: cat.descricao || '' });
    setCategoriaSelecionada(cat);
    setModalEditarOpen(true);
  };

  const handleSalvar = async () => {
    if (!form.nome.trim() || !form.horas_semanais) {
      showToast('Preencha nome e horas semanais.', 'erro');
      return;
    }
    const horas = Number(form.horas_semanais);
    if (horas <= 0 || !Number.isInteger(horas)) {
      showToast('As horas semanais devem ser um número inteiro positivo.', 'erro');
      return;
    }

    setSalvando(true);
    try {
      if (categoriaSelecionada) {
        await adminService.atualizarCategoriaCargaHoraria(categoriaSelecionada.id, {
          nome: form.nome.trim(),
          horas_semanais: horas,
          descricao: form.descricao.trim() || undefined,
        });
        showToast('Categoria atualizada com sucesso!', 'sucesso');
      } else {
        await adminService.criarCategoriaCargaHoraria({
          nome: form.nome.trim(),
          horas_semanais: horas,
          descricao: form.descricao.trim() || undefined,
        });
        showToast('Categoria criada com sucesso!', 'sucesso');
      }
      setModalEditarOpen(false);
      await carregarCategorias();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar categoria.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const handleInativar = async () => {
    if (!categoriaSelecionada) return;
    setSalvando(true);
    try {
      await adminService.inativarCategoriaCargaHoraria(categoriaSelecionada.id, !categoriaSelecionada.ativo);
      showToast(`Categoria ${categoriaSelecionada.ativo ? 'inativada' : 'reativada'} com sucesso!`, 'sucesso');
      setModalInativarOpen(false);
      await carregarCategorias();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar status.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!categoriaSelecionada) return;
    setSalvando(true);
    try {
      await adminService.excluirCategoriaCargaHoraria(categoriaSelecionada.id);
      showToast('Categoria excluída com sucesso!', 'sucesso');
      setModalExcluirOpen(false);
      await carregarCategorias();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir categoria.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Configuração de Carga Horária Semanal</h1>
        <p className="page-subtitle">Defina o padrão do sistema (4h) e gerencie as cargas semanais dos alunos.</p>
      </div>

      {/* Card da Carga Horária Semanal Padrão */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <h3 style={{ color: 'var(--primary)', margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700 }}>
          Carga Horária Semanal Padrão do Sistema
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          Todo novo aluno cadastrado receberá automaticamente esta carga semanal, sem necessidade de selecionar opções no cadastro público.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: 4 }}>
              Horas Padrão (Semanais)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                min="1"
                max="60"
                step="1"
                value={cargaPadrao}
                onChange={e => setCargaPadrao(Number(e.target.value))}
                style={{ ...INPUT_STYLE, width: 100, textAlign: 'center', fontWeight: 700, fontSize: '1.05rem' }}
              />
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>horas / semana</span>
            </div>
          </div>

          <button
            onClick={handleSalvarPadrao}
            disabled={salvandoPadrao}
            className="btn-primary"
            style={{ marginTop: 20, padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
          >
            {salvandoPadrao ? 'Salvando...' : 'Salvar Carga Padrão'}
          </button>
        </div>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={abrirCriar} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Nova Categoria
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Carregando categorias...</p>
      ) : categorias.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Nenhuma categoria cadastrada. Crie a primeira categoria de carga horaria.
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Nome</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700, textAlign: 'center' }}>Horas/Semana</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Descricao</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '0.65rem 1rem', fontWeight: 700, textAlign: 'center' }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map(cat => (
                <tr key={cat.id} style={{ borderTop: '1px solid var(--border-color)', opacity: cat.ativo ? 1 : 0.6 }}>
                  <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{cat.nome}</td>
                  <td style={{ padding: '0.65rem 1rem', textAlign: 'center', fontWeight: 700, fontSize: '1rem' }}>{cat.horas_semanais}h</td>
                  <td style={{ padding: '0.65rem 1rem', color: 'var(--text-muted)' }}>{cat.descricao || '-'}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                      background: cat.ativo ? '#D1FAE5' : '#FEE2E2',
                      color: cat.ativo ? '#065F46' : '#991B1B',
                    }}>
                      {cat.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => abrirEditar(cat)} title="Editar" style={{ background: '#FEF3C7', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#D97706' }}>
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => { setCategoriaSelecionada(cat); setModalInativarOpen(true); }}
                        title={cat.ativo ? 'Inativar' : 'Reativar'}
                        style={{ background: cat.ativo ? '#FEE2E2' : '#D1FAE5', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: cat.ativo ? '#DC2626' : '#059669' }}
                      >
                        {cat.ativo ? <XCircle size={15} /> : <CheckCircle size={15} />}
                      </button>
                      <button
                        onClick={() => { setCategoriaSelecionada(cat); setModalExcluirOpen(true); }}
                        title="Excluir"
                        style={{ background: '#FEE2E2', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#DC2626' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Criar/Editar */}
      {modalEditarOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} /> {categoriaSelecionada ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button onClick={() => setModalEditarOpen(false)} className="btn-close">&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={LABEL_STYLE}>Nome *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: 6 horas semanais"
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Horas Semanais *</label>
                <input
                  type="number"
                  min="1"
                  value={form.horas_semanais}
                  onChange={e => setForm({ ...form, horas_semanais: e.target.value })}
                  placeholder="Ex: 6"
                  style={{ ...INPUT_STYLE, width: 120 }}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Descricao (opcional)</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Descricao da categoria"
                  style={INPUT_STYLE}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setModalEditarOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando} className="btn-primary">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Inativar/Reativar */}
      {modalInativarOpen && categoriaSelecionada && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} /> {categoriaSelecionada.ativo ? 'Inativar' : 'Reativar'} Categoria
              </h3>
              <button onClick={() => setModalInativarOpen(false)} className="btn-close">&times;</button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)', margin: '0.5rem 0 1rem' }}>
              {categoriaSelecionada.ativo
                ? `Deseja inativar a categoria "${categoriaSelecionada.nome}"? Alunos existentes com esta categoria manterao seus dados. Novos alunos nao poderao selecionar esta categoria.`
                : `Deseja reativar a categoria "${categoriaSelecionada.nome}"?`
              }
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalInativarOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleInativar} disabled={salvando} className="btn-primary">
                {salvando ? 'Processando...' : categoriaSelecionada.ativo ? 'Inativar' : 'Reativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {modalExcluirOpen && categoriaSelecionada && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ color: '#DC2626', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={18} /> Excluir Categoria
              </h3>
              <button onClick={() => setModalExcluirOpen(false)} className="btn-close">&times;</button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-dark)', margin: '0.5rem 0 1rem' }}>
              Tem certeza que deseja excluir a categoria <strong>{categoriaSelecionada.nome}</strong>?
              Esta acao so e possivel se nenhum aluno estiver vinculado a esta categoria.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalExcluirOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleExcluir} disabled={salvando} style={{ padding: '0.55rem 1.25rem', borderRadius: 8, border: 'none', background: '#DC2626', color: '#FFF', fontWeight: 700, fontSize: '0.88rem', cursor: salvando ? 'wait' : 'pointer' }}>
                {salvando ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
