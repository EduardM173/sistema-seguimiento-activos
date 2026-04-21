import React from 'react';
import { Card, Badge } from '../common';
import { IconTrendingUp, IconTrendingDown } from '../common/Icon';
import '../../styles/dashboard.css';

interface StatWidgetProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info';
  onClick?: () => void;
  trend?: number;
}

export const StatWidget: React.FC<StatWidgetProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary',
  onClick,
  trend,
}) => {
  return (
    <Card className={`stat-widget stat-${variant}`} onClick={onClick} hoverable>
      <div className="stat-header">
        {icon && <div className="stat-icon">{icon}</div>}
        <h3 className="stat-title">{title}</h3>
      </div>
      <div className="stat-value">{value}</div>
      {subtitle && <p className="stat-subtitle">{subtitle}</p>}
      {trend !== undefined && (
        <div className={`stat-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
          {trend >= 0
            ? <IconTrendingUp size={13} />
            : <IconTrendingDown size={13} />}
          {Math.abs(trend)}%
        </div>
      )}
    </Card>
  );
};

export default StatWidget;
