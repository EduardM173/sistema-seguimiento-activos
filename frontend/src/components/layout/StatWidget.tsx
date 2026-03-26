import React from 'react';
import { Card, Badge } from '../common';
import '../../styles/dashboard.css';

interface StatWidgetProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: string;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info';
  onClick?: () => void;
  trend?: number; // porcentaje de cambio
}

export const StatWidget: React.FC<StatWidgetProps> = ({
  title,
  value,
  subtitle,
  icon = '📊',
  variant = 'primary',
  onClick,
  trend,
}) => {
  return (
    <Card className={`stat-widget stat-${variant}`} onClick={onClick} hoverable>
      <div className="stat-header">
        <div className="stat-icon">{icon}</div>
        <h3 className="stat-title">{title}</h3>
      </div>
      <div className="stat-value">{value}</div>
      {subtitle && <p className="stat-subtitle">{subtitle}</p>}
      {trend !== undefined && (
        <div className={`stat-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </Card>
  );
};

export default StatWidget;
