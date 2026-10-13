import type { ReactNode } from 'react';
import './HighlightCard.css';

export interface HighlightCardProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function HighlightCard({ title, description, action }: HighlightCardProps) {
  return (
    <div className="highlight-card">
      <div className="highlight-content">
        <h3 className="highlight-title">{title}</h3>
        <p className="highlight-description">{description}</p>
      </div>
      {action && (
        <div className="highlight-action">
          {action}
        </div>
      )}
    </div>
  );
}
