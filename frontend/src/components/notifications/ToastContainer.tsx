import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import { IconCheck, IconX, IconAlertTriangle, IconInfo } from '../common/Icon';
import '../../styles/toast.css';

const ICONS: Record<string, React.ReactNode> = {
  success: <IconCheck size={15} />,
  error: <IconX size={15} />,
  warning: <IconAlertTriangle size={15} />,
  info: <IconInfo size={15} />,
};

export default function ToastContainer() {
  const { toasts, removeToast } = useNotification();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <span className="toast__icon">{ICONS[toast.type]}</span>
          <div className="toast__body">
            <span className="toast__title">{toast.title}</span>
            {toast.message && <span className="toast__message">{toast.message}</span>}
          </div>
          <button className="toast__close" onClick={() => removeToast(toast.id)}>
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
