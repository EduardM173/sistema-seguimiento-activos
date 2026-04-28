import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Text shown when value === '' */
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Custom portal-based select that renders the same dark dropdown
 * as SmartTable's action menu (st__dropdown / st__dropdownItem).
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  className = '',
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const displayLabel = selectedLabel ?? placeholder;

  function openMenu() {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
  }

  function pick(val: string) {
    onChange(val);
    closeMenu();
  }

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`fr__selectTrigger ${open ? 'fr__selectTrigger--open' : ''} ${!value ? 'fr__selectTrigger--empty' : ''} ${className}`}
        onClick={open ? closeMenu : openMenu}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="fr__selectLabel">{displayLabel}</span>
        <ChevronDown
          size={13}
          className={`fr__selectCaret ${open ? 'fr__selectCaret--open' : ''}`}
          aria-hidden
        />
      </button>

      {open &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            className="st__dropdown fr__selectMenu"
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
            role="listbox"
          >
            {/* Empty / "all" option */}
            <button
              type="button"
              className={`st__dropdownItem ${!value ? 'fr__item--selected' : ''}`}
              role="option"
              aria-selected={!value}
              onClick={() => pick('')}
            >
              {placeholder}
            </button>

            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`st__dropdownItem ${value === opt.value ? 'fr__item--selected' : ''}`}
                role="option"
                aria-selected={value === opt.value}
                onClick={() => pick(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
