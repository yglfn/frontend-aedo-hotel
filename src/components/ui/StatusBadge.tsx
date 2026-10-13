import { getStatusDef } from '../../lib/status';
import type { StatusColor } from '../../lib/status';
import './StatusBadge.css';

export interface StatusBadgeProps {
  type: 'booking' | 'room' | 'payment_status' | 'payment_method' | 'payment_type' | 'invoice' | 'housekeeping' | 'maintenance' | 'shift' | 'booking_source';
  value: string;
  className?: string;
}

export function StatusBadge({ type, value, className = '' }: StatusBadgeProps) {
  const def = getStatusDef(type, value);
  if (!def) return null;

  return (
    <div className={`badge badge-${def.color} ${className}`}>
      <span className="badge-dot"></span>
      {def.label}
    </div>
  );
}

export interface ChipProps {
  label: string;
  color?: StatusColor;
  className?: string;
  icon?: React.ReactNode;
}

export function Chip({ label, color = 'neutral', className = '', icon }: ChipProps) {
  return (
    <div className={`badge badge-${color} ${className}`}>
      {icon && <span className="badge-icon">{icon}</span>}
      {label}
    </div>
  );
}
