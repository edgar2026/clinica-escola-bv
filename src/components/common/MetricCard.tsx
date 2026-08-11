import type { MetricCardProps } from '../../types';

export const MetricCard = ({ label, value, accent = '', children }: MetricCardProps) => {
  return (
    <div className={`metric-card ${accent}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {children}
    </div>
  );
};

