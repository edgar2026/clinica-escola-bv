import { useEffect, useRef, useCallback, useState } from 'react';
import { pontoService } from '../../services/pontoService';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft } from 'lucide-react';
import { formatarDataCurta } from '../../utils/datas';
import type { Ponto } from '../../types';

export const RegistroPontoPage = () => {
  const { showToast } = useAuth();

  const agoraRef = useRef(new Date());
  const [_relogioTick, setRelogioTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      agoraRef.current = new Date();
      setRelogioTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [statusHoje, setStatusHoje] = useState<{ podeRegistrar: boolean; pontoAberto: boolean; mensagem: string; entradaAberta?: Ponto } | null>(null);
  const [batidasDia, setBatidasDia] = useState<Ponto[]>([]);
  const [loadingAcao, setLoadingAcao] = useState(false);

  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const lastClickTime = useRef(0);

  const fetchDadosPonto = useCallback(async () => {
    try {
      const res = await pontoService.getStatusHoje();
      setStatusHoje(res);
    } catch {
      setStatusHoje({
        podeRegistrar: true,
        pontoAberto: false,
        mensagem: 'Horário agendado confirmado para hoje.'
      });
    }

    try {
      const resHist = await pontoService.getHistoricoAluno();
      const hojeStr = new Date().toISOString().split('T')[0];
      const batidasHoje = (resHist.historico || []).filter(h => h.data === hojeStr);
      setBatidasDia(batidasHoje);
    } catch {
      setBatidasDia([]);
    }
  }, []);

  useEffect(() => {
    fetchDadosPonto();
  }, [fetchDadosPonto]);

  const executarBatidaPonto = async () => {
    if (loadingAcao) return;
    setLoadingAcao(true);

    try {
      await pontoService.fecharPontosAbertos().catch(() => {});

      const res = await pontoService.registrarPonto();

      if (res.acao === 'bloqueado') {
        showToast(res.mensagem, 'alerta');
      } else {
        showToast(res.mensagem, 'sucesso');
        await fetchDadosPonto();
      }
    } catch (err) {
      showToast('Erro ao registrar presença: ' + (err instanceof Error ? err.message : 'Verifique sua conexão e tente novamente.'), 'erro');
      await fetchDadosPonto();
    } finally {
      setLoadingAcao(false);
    }
  };

  const handleDoubleClick = () => {
    executarBatidaPonto();
  };

  const handleSingleClick = () => {
    const now = Date.now();
    if (now - lastClickTime.current < 350) {
      executarBatidaPonto();
      lastClickTime.current = 0;
    } else {
      lastClickTime.current = now;
      showToast('💡 Clique novamente rapidamente para confirmar.', 'info');
    }
  };

  const handleDragStart = (clientX: number) => {
    isDragging.current = true;
    startX.current = clientX;
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging.current) return;
    const diff = clientX - startX.current;
    if (diff > 0 && diff < 120) {
      setDragOffset(diff);
    }
    if (diff >= 90) {
      isDragging.current = false;
      setDragOffset(0);
      executarBatidaPonto();
    }
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    setDragOffset(0);
  };

  const agora = agoraRef.current;
  const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataFormatadaExtenso = agora.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const pontoAberto = statusHoje?.pontoAberto;

  let botaoLabel = 'Registrar Entrada';
  let botaoSubtext = 'Clique duas vezes ou arraste';
  if (loadingAcao) {
    botaoLabel = 'Registrando...';
    botaoSubtext = 'Aguarde';
  } else if (pontoAberto) {
    botaoLabel = 'Registrar Saída';
    botaoSubtext = 'Clique duas vezes ou arraste';
  }

  let statusLabel = '';
  if (pontoAberto && statusHoje?.entradaAberta) {
    statusLabel = `Entrada: ${statusHoje.entradaAberta.hora_entrada || '--:--'}`;
  }

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.82rem', color: '#005691', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Início</span> <span style={{ color: '#CBD5E1' }}>&gt;</span>
          <span style={{ color: 'var(--text-muted)' }}>Registrar presença</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <ChevronLeft size={28} style={{ cursor: 'pointer' }} onClick={() => window.history.back()} /> Registrar presença
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1, letterSpacing: '-1px' }}>
              {horaFormatada}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
              {dataFormatadaExtenso}
            </div>

            <div
              onDoubleClick={handleDoubleClick}
              onClick={handleSingleClick}
              onMouseDown={(e) => handleDragStart(e.clientX)}
              onMouseMove={(e) => handleDragMove(e.clientX)}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
              onTouchEnd={handleDragEnd}
              style={{
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: pontoAberto ? '#FEE2E2' : '#D5EDF6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loadingAcao ? 'wait' : 'pointer',
                userSelect: 'none',
                transition: 'transform 0.15s ease, background 0.3s',
                boxShadow: pontoAberto ? '0 0 30px rgba(239,68,68,0.25)' : '0 0 30px rgba(0,86,145,0.2)',
                position: 'relative',
                touchAction: 'none'
              }}
              title="Clique 2 vezes ou arraste para registrar presença"
            >
              <div style={{
                width: 170,
                height: 170,
                borderRadius: '50%',
                background: pontoAberto ? '#EF4444' : '#004B76',
                color: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                transform: `translateX(${dragOffset}px)`,
                transition: dragOffset === 0 ? 'transform 0.2s ease, background 0.3s' : 'none',
              }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.2 }}>
                  {botaoLabel}
                </span>
                <span style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 6, fontWeight: 500, maxWidth: 130 }}>
                  {botaoSubtext}
                </span>
              </div>
            </div>

            {statusLabel && (
              <div style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                borderRadius: 8,
                background: '#FEF3C7',
                color: '#92400E',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}>
                ⏱ {statusLabel}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', padding: '1rem 1.25rem', background: '#F8FAFC' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-dark)' }}>REGISTRO SUJEITO À AUDITORIA:</strong> Ao registrar entrada ou saída, seu horário será registrado. Inconsistências ou manipulações poderão ser identificadas e encaminhadas à equipe administrativa.
            </div>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          padding: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '1.5rem' }}>
            Registros do dia
          </h3>

          <div style={{ width: '100%' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #E2E8F0',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#005691'
            }}>
              <div>Data</div>
              <div>Entrada</div>
              <div>Saída</div>
            </div>

            {batidasDia.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Nenhum registro realizado hoje.
              </div>
            ) : (
              batidasDia.map((b, idx) => (
                <div
                  key={b.id || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    padding: '1rem 0',
                    borderBottom: '1px solid #F1F5F9',
                    fontSize: '0.9rem',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                    {formatarDataCurta(b.data || '') || `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}`}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                    {b.hora_entrada || '-'}
                  </div>
                  <div style={{ color: !b.hora_saida || b.hora_saida === '00:00' ? '#F59E0B' : 'var(--text-dark)', fontWeight: 700 }}>
                    {(!b.hora_saida || b.hora_saida === '00:00')
                      ? (b.data !== new Date().toISOString().split('T')[0] ? 'Saída não registrada' : 'Em andamento')
                      : b.hora_saida}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </section>
  );
};
