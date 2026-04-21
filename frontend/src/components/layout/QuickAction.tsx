import React from 'react';
import { Card } from '../common';
import '../../styles/dashboard.css';

interface QuickActionProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  label,
  icon,
  onClick,
}) => {
  return (
    <Card
      className="quick-action"
      onClick={onClick}
      hoverable
      padding="md"
    >
      <div style={{ textAlign: 'center' }}>
        <div className="quick-action-icon">
          {icon}
        </div>
        <p className="quick-action-label">{label}</p>
      </div>
    </Card>
  );
};

export default QuickAction;
