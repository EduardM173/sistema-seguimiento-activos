import React from 'react';
import '../../styles/components.css';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, message, icon, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {icon && <div className="empty-state__icon">{icon}</div>}
      <div>
        <p className="empty-state__title">{title}</p>
        {message && <p className="empty-state__message">{message}</p>}
      </div>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export default EmptyState;
