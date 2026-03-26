import React from 'react';
import { Button } from './Button';
import '../../styles/components.css';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  cancelText?: string;
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  loading?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  children,
  onClose,
  onConfirm,
  confirmText = 'Confirmar',
  confirmVariant = 'primary',
  cancelText = 'Cancelar',
  size = 'md',
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className={`modal modal-${size}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <Button
            label={cancelText}
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          />
          {onConfirm && (
            <Button
              label={confirmText}
              variant={confirmVariant}
              onClick={onConfirm}
              isLoading={loading}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default Modal;
