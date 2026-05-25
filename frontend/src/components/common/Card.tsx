import React from 'react';
import '../../styles/components.css';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  /** Visual variant. Default = floating (no box). */
  variant?: 'floating' | 'bordered' | 'surface';
}

export const Card: React.FC<CardProps> = ({
  title,
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'md',
  variant = 'floating',
}) => {
  const variantClass =
    variant === 'bordered' ? 'card--bordered' :
    variant === 'surface' ? 'card--surface' : '';
  return (
    <div
      className={`card card-${padding} ${variantClass} ${hoverable ? 'card-hoverable' : ''} ${className}`.trim()}
      onClick={onClick}
    >
      {title && <div className="card-title">{title}</div>}
      <div className="card-content">{children}</div>
    </div>
  );
};

export default Card;
