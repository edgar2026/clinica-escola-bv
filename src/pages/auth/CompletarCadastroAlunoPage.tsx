import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { GraduationCap, ChevronRight } from 'lucide-react';
import type { Periodo, Turno } from '../../types';

export const CompletarCadastroAlunoPage = () => {
  const { usuario, setUsuario, showToast } = useAuth();
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [form, setForm] = useState({ periodo_id: '', turno_id: '' });
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);

  const carregarDados = useCallback(async () => {
    try {
      const [periodosRes, turnosRes] = await Promise.all([
        supabase.from('periodos').select('*'),
        supabase.from('turnos').select('*'),
      ]);
      if (!periodosRes.error && periodosRes.data) setPeriodos(periodosRes.data);
      if (!turnosRes.error && turnosRes.data) setTurnos(turnosRes.data);
    } catch {
      // Silencioso
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleSalvar = async () => {
    if (!form.periodo_id || !form.turno_id) {
      showToast('Selecione o periodo e o turno.', 'erro');
      return;
    }
    setSalvando(true);
    try {
      if (!usuario?.id) throw new Error('Usuário não encontrado');

      const result = await (supabase
        .from('alunos') as any)
        .update({ periodo_id: form.periodo_id, turno_id: form.turno_id })
        .eq('usuario_id', usuario.id)
        .select()
        .single();
      if (result.error) throw result.error;

      const { error: updateUsuarioError } = await supabase
        .from('usuarios')
        .update({ primeiro_acesso: 0 } as never)
        .eq('id', usuario.id);

      if (updateUsuarioError) throw updateUsuarioError;

      showToast('Cadastro completado!', 'sucesso');
      setUsuario({ ...usuario, aluno: result.data as any, primeiroAcesso: false } as any);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'erro');
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
  } as CSSProperties;

  const labelStyle = {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-dark)',
    marginBottom: 6,
    display: 'block',
  } as CSSProperties;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Carregando opcoes...</div>
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
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>Selecione seu periodo e turno para comecar</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}>
              <GraduationCap size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Periodo *
            </label>
            <select value={form.periodo_id} onChange={e => setForm({ ...form, periodo_id: e.target.value })} style={inputStyle}>
              <option value="">Selecione o periodo...</option>
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
            {salvando ? 'Salvando...' : 'Comecar'} {!salvando && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
