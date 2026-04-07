import { useEffect, useRef, type ReactNode } from 'react';
import './OverlayModal.css';

type OverlayModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
  disabled?: boolean;
};

export default function OverlayModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = '560px',
  disabled = false,
}: OverlayModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disabled) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, disabled]);

  // Trap focus on open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="overlayModal__backdrop"
      role="presentation"
      onClick={() => { if (!disabled) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="overlayModal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-modal-title"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overlayModal__header">
          <div>
            <h2 id="overlay-modal-title" className="overlayModal__title">
              {title}
            </h2>
            {subtitle && (
              <p className="overlayModal__subtitle">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            className="overlayModal__closeBtn"
            onClick={onClose}
            disabled={disabled}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="overlayModal__body">
          {children}
        </div>
      </div>
    </div>
  );
}
