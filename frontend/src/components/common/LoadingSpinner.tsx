import React from 'react';
import '../../styles/components.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullscreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message = 'Cargando...',
  fullscreen = false,
}) => {
  return (
    <div className={`loading-container ${fullscreen ? 'loading-fullscreen' : ''}`}>
      <div className={`spinner spinner-${size}`}>
        <div className="spinner-border"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
