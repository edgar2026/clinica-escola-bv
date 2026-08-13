import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { GraduationCap, ChevronRight, Clock } from 'lucide-react';
import type { Periodo, Turno } from '../../types';

type CampoFaltante = 'periodo' | 'turno';

export const CompletarCadastroAlunoPage = () => {
  const { usuario, setUsuario, showToast } = useAuth();
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [faltantes, setFaltantes] = useState<CampoFaltante[]>(['periodo', 'turno']);
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

      const vinculo = (usuario as unknown as Record<string, unknown>).aluno as Record<string, unknown> | null | undefined;
      const periodoSalvo = vinculo && vinculo.periodo_id ? Number(vinculo.periodo_id) : null;
      const turnoSalvo = vinculo && vinculo.turno_id ? Number(vinculo.turno_id) : null;

      const faltando: CampoFaltante[] = [];
      if (!periodoSalvo) faltando.push('periodo');
      if (!turnoSalvo) faltando.push('turno');

      setForm({
        periodo_id: periodoSalvo ? String(periodoSalvo) : '',
        turno_id: turnoSalvo ? String(turnoSalvo) : '',
      });
      setFaltantes(faltando);
    } catch {
      // Silencioso
    }
    setLoading(false);
  }, [usuario]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleSalvar = async () => {
    const update: Record<string, unknown> = {};
    if (faltantes.includes('periodo')) {
      if (!form.periodo_id) {
        showToast('Selecione o periodo.', 'erro');
        return;
      }
      update.periodo_id = Number(form.periodo_id);
    }
    if (faltantes.includes('turno')) {
      if (!form.turno_id) {
        showToast('Selecione o turno.', 'erro');
        return;
      }
      update.turno_id = Number(form.turno_id);
    }

    if (Object.keys(update).length === 0) {
      showToast('Nenhum dado pendente.', 'info');
      return;
    }

    setSalvando(true);
    try {
      if (!usuario?.id) throw new Error('Usuário não encontrado');

      const result = await (supabase
        .from('alunos') as any)
        .update(update)
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
      const alunoAtualizado = result.data as Record<string, unknown>;
      setUsuario({
        ...usuario,
        aluno: alunoAtualizado as never,
        primeiroAcesso: false,
        periodo_id: alunoAtualizado.periodo_id ? String(alunoAtualizado.periodo_id) : usuario.periodo_id,
        turno_id: alunoAtualizado.turno_id ? String(alunoAtualizado.turno_id) : usuario.turno_id,
      });
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

  if (faltantes.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#FFF', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '2.5rem 2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 0.75rem' }}>Cadastro completo</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Seus dados academicos ja estao salvos. Bem-vindo(a) ao sistema!</p>
        </div>
      </div>
    );
  }

  const faltanteLabel = faltantes.length === 1
    ? (faltantes[0] === 'periodo' ? 'período' : 'turno')
    : 'período e turno';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 520, background: '#FFF', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <GraduationCap size={28} color="#FFF" />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>Complete seu cadastro</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
            Está faltando apenas: <strong>{faltanteLabel}</strong>. Os demais dados já estão salvos.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {faltantes.includes('periodo') && (
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
          )}

          {faltantes.includes('turno') && (
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
          )}

          <button onClick={handleSalvar} disabled={salvando} className="btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {salvando ? 'Salvando...' : 'Concluir'} {!salvando && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
