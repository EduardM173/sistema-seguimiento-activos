import React from 'react';
import { Button } from './Button';
import OverlayModal from './OverlayModal';

const SIZE_WIDTH: Record<string, string> = {
  sm: '420px',
  md: '560px',
  lg: '720px',
  fullscreen: '95vw',
};

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
}) => (
  <OverlayModal
    open={isOpen}
    title={title}
    onClose={onClose}
    width={SIZE_WIDTH[size] ?? '560px'}
    disabled={loading}
  >
    {children}
    {onConfirm && (
      <div className="overlayModal__footer">
        <Button
          label={cancelText}
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        />
        <Button
          label={confirmText}
          variant={confirmVariant}
          onClick={onConfirm}
          isLoading={loading}
        />
      </div>
    )}
  </OverlayModal>
);

export default Modal;
