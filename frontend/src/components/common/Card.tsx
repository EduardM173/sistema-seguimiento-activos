import React from 'react';
import '../../styles/components.css';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  title,
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'md',
}) => {
  return (
    <div
      className={`card card-${padding} ${hoverable ? 'card-hoverable' : ''} ${className}`}
      onClick={onClick}
    >
      {title && <div className="card-title">{title}</div>}
      <div className="card-content">{children}</div>
    </div>
  );
};

export default Card;
