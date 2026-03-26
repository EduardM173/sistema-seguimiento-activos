import React from 'react';
import { Card } from '../common';
import '../../styles/dashboard.css';

interface QuickActionProps {
  label: string;
  icon: string;
  onClick: () => void;
  color?: string;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  label,
  icon,
  onClick,
  color = '#0056b3',
}) => {
  return (
    <Card
      className="quick-action"
      onClick={onClick}
      hoverable
      padding="md"
    >
      <div style={{ textAlign: 'center' }}>
        <div className="quick-action-icon" style={{ fontSize: '32px', marginBottom: '12px' }}>
          {icon}
        </div>
        <p className="quick-action-label">{label}</p>
      </div>
    </Card>
  );
};

export default QuickAction;
