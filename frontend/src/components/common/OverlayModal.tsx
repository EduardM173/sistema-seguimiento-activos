import { useEffect, useRef, type ReactNode } from 'react';
import { IconX } from './Icon';
import './OverlayModal.css';

type OverlayModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
  disabled?: boolean;
  className?: string;
};

export default function OverlayModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = '560px',
  disabled = false,
  className = '',
}: OverlayModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disabled) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, disabled]);

  // Lock body scroll and reset modal scroll to top on open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // Reset scroll position so the top of the form is always visible
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      // Capture focus on the dialog itself so inputs don't auto-scroll
      if (dialogRef.current) dialogRef.current.focus();
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
        className={`overlayModal__dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-modal-title"
        style={{ maxWidth: width }}
        tabIndex={-1}
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
            <IconX size={16} />
          </button>
        </div>
        <div
          ref={bodyRef}
          className="overlayModal__body"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
