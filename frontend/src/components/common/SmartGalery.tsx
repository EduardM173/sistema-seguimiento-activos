import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import type { ColumnDef, ActionDef, SmartTableProps } from './SmartTable';
import '../../styles/SmartTable.css'; // st__dropdown* classes
import '../../styles/SmartGalery.css';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Same props as SmartTable — drop-in replacement that renders as a card grid. */
export type SmartGaleryProps<T extends object> = SmartTableProps<T>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCellValue<T extends object>(row: T, col: ColumnDef<T>): unknown {
  if (typeof col.accessor === 'function') return col.accessor(row);
  return (row as Record<string, unknown>)[col.accessor as string];
}

/**
 * Deterministic gradient derived from the row key.
 * Produces a deep, moody two-stop gradient spanning the HSL wheel.
 */
function buildGradient(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  const hue1 = Math.abs(h) % 360;
  const hue2 = (hue1 + 48) % 360;
  return `linear-gradient(145deg, hsl(${hue1},56%,26%) 0%, hsl(${hue2},68%,13%) 100%)`;
}

const SKELETON_COUNT = 10;

// ─── Component ────────────────────────────────────────────────────────────────

export function SmartGalery<T extends object>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  keyExtractor,
  onRowClick,
  actions,
}: SmartGaleryProps<T>) {
  // ── Dropdown state ────────────────────────────────────────────────────────
  const [dropdownRowKey, setDropdownRowKey] = useState<string | number | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Column layout ─────────────────────────────────────────────────────────
  // Primary column → card title
  const primaryCol = columns.find((c) => c.primary) ?? columns[0];
  // Non-primary columns for subtitle and meta
  const rest = columns.filter((c) => c !== primaryCol);
  const subtitleCol = rest[0] ?? null;
  const metaCols = rest.slice(1, 3); // up to 2 extra columns shown as meta chips

  const hasActions = Boolean(actions && actions.length > 0);

  const activeDropdownRow =
    dropdownRowKey !== null
      ? data.find((r) => keyExtractor(r) === dropdownRowKey) ?? null
      : null;

  // ── Dropdown helpers ──────────────────────────────────────────────────────
  function openDropdown(row: T, btn: HTMLButtonElement) {
    const key = keyExtractor(row);
    if (dropdownRowKey === key) {
      setDropdownRowKey(null);
      return;
    }
    const rect = btn.getBoundingClientRect();
    const DROPDOWN_WIDTH = 180;
    const left =
      rect.left + DROPDOWN_WIDTH > window.innerWidth
        ? rect.right - DROPDOWN_WIDTH
        : rect.left;
    setDropdownPos({ top: rect.bottom + 4, left });
    setDropdownRowKey(key);
  }

  function closeDropdown() {
    setDropdownRowKey(null);
  }

  useEffect(() => {
    if (dropdownRowKey === null) return;
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDropdown();
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dropdownRowKey]);

  // ── Loading — shimmer skeleton ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="sg__skeletonGrid" aria-busy="true" aria-label="Cargando…">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="sg__skeletonCard">
            <div className="sg__skeletonArt" />
            <div className="sg__skeletonLine" />
            <div className="sg__skeletonLine sg__skeletonLine--short" />
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="sg__state">
        <p className="sg__stateText">{emptyMessage}</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="sg__grid">
        {data.map((row) => {
          const rowKey = keyExtractor(row);
          const gradient = buildGradient(rowKey);

          const primaryRaw = primaryCol ? getCellValue(row, primaryCol) : null;
          const firstLetter = String(primaryRaw ?? '?').charAt(0).toUpperCase();

          const primaryNode = primaryCol
            ? primaryCol.render
              ? primaryCol.render(primaryRaw, row)
              : String(primaryRaw ?? '—')
            : '—';

          return (
            <div key={rowKey} className="sg__card">
              {/* ── Art area ── */}
              <div
                className={`sg__art${onRowClick ? ' sg__art--clickable' : ''}`}
                style={{ background: gradient }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') onRowClick(row);
                      }
                    : undefined
                }
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? String(primaryRaw ?? '') : undefined}
              >
                <span className="sg__artLetter">{firstLetter}</span>

                {hasActions && (
                  <button
                    type="button"
                    className="sg__moreBtn"
                    aria-label="Abrir acciones"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDropdown(row, e.currentTarget);
                    }}
                  >
                    ⋯
                  </button>
                )}
              </div>

              {/* ── Card body ── */}
              <div className="sg__body">
                {/* Title */}
                {onRowClick ? (
                  <button
                    type="button"
                    className="sg__titleBtn"
                    onClick={() => onRowClick(row)}
                    title={String(primaryRaw ?? '')}
                  >
                    {primaryNode}
                  </button>
                ) : (
                  <div className="sg__title" title={String(primaryRaw ?? '')}>
                    {primaryNode}
                  </div>
                )}

                {/* Subtitle */}
                {subtitleCol && (
                  <div className="sg__subtitle">
                    {(() => {
                      const v = getCellValue(row, subtitleCol);
                      return subtitleCol.render
                        ? subtitleCol.render(v, row)
                        : String(v ?? '—');
                    })()}
                  </div>
                )}

                {/* Meta */}
                {metaCols.length > 0 && (
                  <div className="sg__meta">
                    {metaCols.map((col) => {
                      const v = getCellValue(row, col);
                      return (
                        <span key={col.id}>
                          {col.render ? col.render(v, row) : String(v ?? '—')}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions dropdown — portal to avoid overflow clipping */}
      {dropdownRowKey !== null &&
        activeDropdownRow !== null &&
        hasActions &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            className="st__dropdown"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            role="menu"
          >
            {actions!.map((action, i) => {
              const isDisabled = action.disabled?.(activeDropdownRow) ?? false;
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  className={[
                    'st__dropdownItem',
                    action.variant === 'danger' ? 'st__dropdownItem--danger' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      action.onClick(activeDropdownRow);
                      closeDropdown();
                    }
                  }}
                >
                  {action.icon !== undefined && (
                    <span className="st__dropdownIcon" aria-hidden>
                      {action.icon}
                    </span>
                  )}
                  {action.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

export default SmartGalery;
