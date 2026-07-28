import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { GraduationCap, Clock, ChevronRight } from 'lucide-react';

export const CompletarCadastroAlunoPage = () => {
  const { usuario, setUsuario, showToast } = useAuth();
  const [periodos, setPeriodos] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [form, setForm] = useState({ periodo_id: '', turno_id: '' });
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);

  const carregarDados = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([
        apiRequest('/auth/periodos'),
        apiRequest('/auth/turnos'),
      ]);
      setPeriodos(p?.periodos || []);
      setTurnos(t?.turnos || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleSalvar = async () => {
    if (!form.periodo_id || !form.turno_id) {
      showToast('Selecione o período e o turno.', 'erro');
      return;
    }
    setSalvando(true);
    try {
      const data = await apiRequest('/auth/completar-cadastro-aluno', {
        method: 'POST',
        body: JSON.stringify({ periodo_id: form.periodo_id, turno_id: form.turno_id }),
      });
      showToast(data.mensagem || 'Cadastro completado!', 'sucesso');
      setUsuario({ ...usuario, aluno: data.aluno, primeiroAcesso: false });
    } catch (err) {
      showToast(err.message || 'Erro ao salvar.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    borderRadius: 8,
    border: '1.5px solid var(--border-color)',
    fontSize: '0.95rem',
    color: 'var(--text-dark)',
    background: '#FFF',
    outline: 'none',
  };

  const labelStyle = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-dark)',
    marginBottom: 6,
    display: 'block',
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Carregando opções...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 520, background: '#FFF', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <GraduationCap size={28} color="#FFF" />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>Complete seu cadastro</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>Selecione seu período e turno para começar</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}>
              <GraduationCap size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Período *
            </label>
            <select value={form.periodo_id} onChange={e => setForm({ ...form, periodo_id: e.target.value })} style={inputStyle}>
              <option value="">Selecione o período...</option>
              {periodos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              <Clock size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Turno *
            </label>
            <select value={form.turno_id} onChange={e => setForm({ ...form, turno_id: e.target.value })} style={inputStyle}>
              <option value="">Selecione o turno...</option>
              {turnos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <button onClick={handleSalvar} disabled={salvando} className="btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {salvando ? 'Salvando...' : 'Começar'} {!salvando && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
