import React, { useEffect, useRef, useCallback, useState } from 'react';
import { pontoService } from '../../services/pontoService';
import { useAuth } from '../../context/AuthContext';
import { RotateCw, MapPin, ChevronLeft } from 'lucide-react';
import { formatarDataCurta } from '../../utils/datas';

export const RegistroPontoPage = () => {
  const { showToast } = useAuth();

  // Relógio ao vivo — usa ref para evitar re-render a cada segundo
  const agoraRef = useRef(new Date());
  const [relogioTick, setRelogioTick] = useState(0);

  // Atualiza o tick do relógio apenas a cada 10 segundos (economiza re-renders)
  useEffect(() => {
    const timer = setInterval(() => {
      agoraRef.current = new Date();
      setRelogioTick(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Estado de localização GPS
  const [localizacao, setLocalizacao] = useState({
    carregando: false,
    disponivel: false,
    endereco: 'Localização não disponível',
    lat: null,
    lng: null,
    erro: null
  });

  // Estado de ponto e batidas
  const [statusHoje, setStatusHoje] = useState(null);
  const [batidasDia, setBatidasDia] = useState([]);
  const [loadingAcao, setLoadingAcao] = useState(false);

  // Controle do Gesto de Arraste (Drag / Swipe)
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const clickTimer = useRef(null);

  // ─── 1. Atualizar relógio em tempo real ─────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── 2. Buscar Localização GPS ──────────────────────────────────────────────
  const obterLocalizacao = useCallback(() => {
    setLocalizacao(prev => ({ ...prev, carregando: true, erro: null }));

    if (!navigator.geolocation) {
      setLocalizacao({
        carregando: false,
        disponivel: false,
        endereco: 'Geolocalização não suportada neste navegador',
        lat: null, lng: null,
        erro: 'não suportado'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Endereço aproximado da clínica-escola UNINASSAU
        const endAprox = `Av. Eng. Abdias de Carvalho, 1678 - Madalena, Recife - PE (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        setLocalizacao({
          carregando: false,
          disponivel: true,
          endereco: endAprox,
          lat: latitude,
          lng: longitude,
          erro: null
        });
      },
      (err) => {
        setLocalizacao({
          carregando: false,
          disponivel: false,
          endereco: 'Localização não disponível — permissão negada',
          lat: null, lng: null,
          erro: err.message
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    obterLocalizacao();
  }, [obterLocalizacao]);

  // ─── 3. Carregar Status e Batidas do Dia ──────────────────────────────────
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

  // ─── 4. Executar o Registro de Ponto ────────────────────────────────────────
  const executarBatidaPonto = async () => {
    // Validação de Geolocalização Obrigatória se estiver no Mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    
    if (isMobile && !localizacao.disponivel) {
      showToast('Por favor, habilite a permissão de localização do dispositivo para registrar o ponto.', 'erro');
      obterLocalizacao();
      return;
    }

    if (loadingAcao) return;
    setLoadingAcao(true);

    const acao = statusHoje?.pontoAberto ? 'saida' : 'entrada';

    try {
      const res = await pontoService.registrarPonto('botao', acao);
      showToast(res.mensagem || `Ponto de ${acao.toUpperCase()} registrado com sucesso!`, 'sucesso');
      await fetchDadosPonto();
    } catch (err) {
      showToast('Erro ao registrar ponto: ' + (err.message || 'Verifique sua conexão e tente novamente.'), 'erro');
      await fetchDadosPonto();
    } finally {
      setLoadingAcao(false);
    }
  };

  // ─── 5. Eventos de Clique Duplo e Arraste (Drag / Touch Swipe) ──────────────
  const handleSingleOrDoubleClick = () => {
    if (clickTimer.current) {
      // Clique Duplo Detectado!
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      executarBatidaPonto();
    } else {
      // Primeiro Clique -> aguarda 300ms para ver se é duplo
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        showToast('💡 Clique duas vezes seguidas ou arraste para o lado para bater o ponto.', 'info');
      }, 300);
    }
  };

  // Touch / Drag Handlers
  const handleDragStart = (clientX) => {
    isDragging.current = true;
    startX.current = clientX;
  };

  const handleDragMove = (clientX) => {
    if (!isDragging.current) return;
    const diff = clientX - startX.current;
    if (diff > 0 && diff < 120) {
      setDragOffset(diff);
    }
    if (diff >= 90) {
      // Arrastou o suficiente -> Dispara o Ponto!
      isDragging.current = false;
      setDragOffset(0);
      executarBatidaPonto();
    }
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    setDragOffset(0);
  };

  // Formatação de data/hora
  const agora = agoraRef.current;
  const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataFormatadaExtenso = agora.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const pontoAberto = statusHoje?.pontoAberto;

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Breadcrumb e Título */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.82rem', color: '#005691', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Início</span> <span style={{ color: '#CBD5E1' }}>&gt;</span> <span style={{ color: 'var(--text-muted)' }}>Bater ponto</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <ChevronLeft size={28} style={{ cursor: 'pointer' }} onClick={() => window.history.back()} /> Bater ponto
        </h1>
      </div>

      {/* Grid Principal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

        {/* ─── CARD ESQUERDO: RELÓGIO & BOTÃO PRINCIPAL ─── */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Corpo do card */}
          <div style={{ padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            
            {/* Relógio digital */}
            <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1, letterSpacing: '-1px' }}>
              {horaFormatada}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: '2rem' }}>
              {dataFormatadaExtenso}
            </div>

            {/* BOTÃO CIRCULAR GRANDE (Bater ponto / Arrasta ou Duplo Clique) */}
            <div
              onClick={handleSingleOrDoubleClick}
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
              title="Clique 2 vezes ou arraste para a direita para bater ponto"
            >
              {/* Círculo interno interativo */}
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
                  {loadingAcao ? 'Registrando...' : pontoAberto ? 'Registrar Saída' : 'Bater ponto'}
                </span>
                <span style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: 6, fontWeight: 500, maxWidth: 130 }}>
                  Clique duas vezes ou arraste
                </span>
              </div>
            </div>

          </div>

          {/* Rodapé com Geolocalização */}
          <div style={{ borderTop: '1px solid #E2E8F0', padding: '1rem 1.25rem', background: '#F8FAFC' }}>
            <button
              onClick={obterLocalizacao}
              disabled={localizacao.carregando}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#005691',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginBottom: '0.5rem',
                padding: 0
              }}
            >
              <RotateCw size={16} className={localizacao.carregando ? 'spin' : ''} />
              {localizacao.carregando ? 'Obtendo localização...' : 'Recarregar localização'}
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-dark)' }}>
              <MapPin size={16} color={localizacao.disponivel ? '#10B981' : '#EF4444'} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', color: 'var(--primary)' }}>Endereço aproximado</strong>
                <span style={{ color: localizacao.disponivel ? 'var(--text-muted)' : '#EF4444' }}>
                  {localizacao.endereco}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── CARD DIREITO: BATIDAS DO DIA ─── */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          padding: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '1.5rem' }}>
            Batidas do dia
          </h3>

          <div style={{ width: '100%' }}>
            {/* Cabeçalho da tabela de batidas */}
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
              <div>📍 Entrada</div>
              <div>📍 Saída</div>
            </div>

            {/* Linhas de batida */}
            {batidasDia.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Nenhuma batida registrada hoje.
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
                    {b.dataFormatada || formatarDataCurta(b.data) || `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}`}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                    {b.entrada || b.hora_entrada || '-'}
                  </div>
                  <div style={{ color: b.saida === 'Em andamento' ? '#F59E0B' : 'var(--text-dark)', fontWeight: 700 }}>
                    {b.saida || b.hora_saida || '-'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </section>
  );
};
