import React from 'react';

export const MetricCard = ({ label, value, accent = '', children }) => {
  return (
    <div className={`metric-card ${accent}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {children}
    </div>
  );
};

export const Toast = () => {
  const { toastMessage } = useAuthToast();
  if (!toastMessage) return null;

  const bgColors = {
    sucesso: '#10B981',
    erro: '#EF4444',
    alerta: '#F59E0B',
    info: '#002B49'
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      backgroundColor: bgColors[toastMessage.tipo] || '#002B49',
      color: '#FFFFFF',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontSize: '0.9rem',
      fontWeight: '600'
    }}>
      {toastMessage.mensagem}
    </div>
  );
};

import { useAuth } from '../../context/AuthContext';
const useAuthToast = () => useAuth();
