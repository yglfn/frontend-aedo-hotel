import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './ShortcutTile.css';

export interface ShortcutTileProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  to: string;
}

export function ShortcutTile({ icon, title, subtitle, to }: ShortcutTileProps) {
  return (
    <Link to={to} className="shortcut-tile">
      <div className="shortcut-icon-wrapper">
        {icon}
      </div>
      <div className="shortcut-content">
        <div className="shortcut-title">{title}</div>
        {subtitle && <div className="shortcut-subtitle">{subtitle}</div>}
      </div>
    </Link>
  );
}
