import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Printer, Download, Search } from 'lucide-react';
import { formatarData } from '../../utils/datas';
import { gerenciaService } from '../../services/gerenciaService';

const STATUS_LABEL = {
  presenca_no_horario:  { label: 'No Horário',       cls: 'verde'   },
  atraso:               { label: 'Atraso',            cls: 'amarelo' },
  presenca_fora_horario:{ label: 'Fora do Horário',   cls: 'vermelho'},
  ausencia:             { label: 'Ausência',           cls: 'vermelho'},
  hora_extra:           { label: 'Hora Extra / Aprovado', cls: 'verde' }
};

export const RelatoriosPage = () => {
  const { showToast } = useAuth();
  const [tipo, setTipo]     = useState('Frequência Geral');
  const [dataIni, setDataIni] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGerar = async () => {
    setLoading(true);
    try {
      const res = await gerenciaService.getRelatorio(tipo, dataIni, dataFim);
      if (res) {
        let dados = res.dados || [];
        if (tipo === 'Atrasos e Faltas') {
          dados = dados.filter(d => d.status_frequencia === 'atraso' || d.status_frequencia === 'ausencia');
        } else if (tipo === 'Presenças Fora do Horário') {
          dados = dados.filter(d => d.status_frequencia === 'presenca_fora_horario');
        }
        setResultados({ tipo, total: dados.length, dados });
      }
    } catch {
      setResultados({ tipo, total: 0, dados: [] });
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    if (!resultados) return;
    const header = 'Data,Aluno,Matrícula,Curso,Entrada,Saída,Tempo(min),Status\n';
    const rows = resultados.dados.map(d =>
      `${formatarData(d.data)},"${d.aluno_nome}",${d.matricula},"${d.curso_nome}",${d.hora_entrada},${d.hora_saida || ''},${d.tempo_total_minutos || 0},${d.status_frequencia}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `relatorio-${tipo.toLowerCase().replace(/ /g, '-')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Arquivo CSV baixado com sucesso!', 'sucesso');
  };

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Relatórios Gerenciais</h1>
        <p className="page-subtitle">Filtre frequências, atrasos e presenças em tempo real com exportação em PDF e CSV.</p>
      </div>

      {/* Filtros */}
      <div style={{ background: '#FFF', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Tipo de Relatório</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <option>Frequência Geral</option>
            <option>Atrasos e Faltas</option>
            <option>Presenças Fora do Horário</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Data Inicial</label>
          <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Data Final</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
        </div>
        <button onClick={handleGerar} disabled={loading} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Search size={16} /> {loading ? 'Buscando...' : 'Gerar Relatório'}
        </button>
      </div>

      {/* Resultado */}
      {resultados && (
        <div style={{ background: '#FFF', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>
              {resultados.tipo} — <span style={{ color: 'var(--primary)' }}>{resultados.total} registro{resultados.total !== 1 ? 's' : ''}</span>
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => window.print()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Printer size={16} /> Imprimir / PDF
              </button>
              <button onClick={exportarCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Download size={16} /> Exportar CSV
              </button>
            </div>
          </div>

          {resultados.dados.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Nenhum registro encontrado no banco de dados para os filtros selecionados.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Data</th><th>Aluno</th><th>Curso</th><th>Entrada / Saída</th><th>Permanência</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.dados.map(d => {
                    const cfg = STATUS_LABEL[d.status_frequencia] || { label: d.status_frequencia, cls: 'amarelo' };
                    return (
                      <tr key={d.id}>
                        <td>{formatarData(d.data)}</td>
                        <td><strong>{d.aluno_nome}</strong> ({d.matricula})</td>
                        <td>{d.curso_nome}</td>
                        <td>{d.hora_entrada} — {d.hora_saida || 'Em aberto'}</td>
                        <td>{d.tempo_total_minutos ? `${Math.floor(d.tempo_total_minutos / 60)}h ${d.tempo_total_minutos % 60}m` : '-'}</td>
                        <td><span className={`badge-vaga ${cfg.cls}`}>{cfg.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
