import type { ReactNode } from 'react';
import type { StatusColor } from '../../lib/status';
import './KpiCard.css';

export interface KpiCardProps {
  label: string;
  value: string | number;
  compareText?: string;
  color?: StatusColor;
  icon?: ReactNode;
  onClick?: () => void;
}

export function KpiCard({ label, value, compareText, color = 'neutral', icon, onClick }: KpiCardProps) {
  const isClickable = !!onClick;
  
  return (
    <div 
      className={`kpi-card kpi-bg-${color} ${isClickable ? 'is-clickable' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        {icon && (
          <div className={`kpi-icon-wrapper kpi-fg-${color}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      {compareText && <div className="kpi-compare">{compareText}</div>}
    </div>
  );
}
