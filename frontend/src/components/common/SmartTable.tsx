import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../../styles/SmartTable.css';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ColumnDef<T extends object> {
  /** Unique identifier used for sort state, resize map, and React keys */
  id: string;
  /** Text shown in the column header */
  header: string;
  /** Key on T or a function that derives the cell value from the row */
  accessor: keyof T | ((row: T) => unknown);
  /** Allow this column to be sorted. Defaults to `true` when the global
   *  `sortable` prop is also `true`. Set to `false` to disable per-column. */
  sortable?: boolean;
  /** Initial column width in pixels (used by the resize handle). */
  width?: number;
  /** Minimum column width in pixels enforced while resizing (default: 60). */
  minWidth?: number;
  /** Custom cell renderer. Receives the raw cell value and the full row. */
  render?: (value: unknown, row: T) => React.ReactNode;
  /**
   * Optional custom ReactNode rendered inside the `<th>` instead of the
   * default text + sort icon. Useful for server-side sort buttons.
   * When set, `sortable` is ignored for this column.
   */
  headerContent?: React.ReactNode;
  /**
   * Marks this column as the primary column.
   * – Clicking the cell text fires `onRowClick`.
   * – A dropdown-trigger arrow appears next to the text on row hover.
   */
  primary?: boolean;
}

export interface ActionDef<T extends object> {
  label: string;
  /** Any ReactNode used as an icon (emoji, SVG, etc.) */
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  /** 'danger' colours the item red. Default: 'default'. */
  variant?: 'default' | 'danger';
  /** Return `true` to render the item as disabled. */
  disabled?: (row: T) => boolean;
}

export interface SmartTableProps<T extends object> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  /** Extract a stable, unique key from each row (required). */
  keyExtractor: (row: T) => string | number;
  /**
   * Enable / disable the column-sorting feature globally.
   * Individual columns can still opt-out via `ColumnDef.sortable = false`.
   * Default: `true`.
   */
  sortable?: boolean;
  /**
   * Fired when the user clicks the **name text** in the primary column.
   * If omitted, the name text becomes non-interactive.
   */
  onRowClick?: (row: T) => void;
  /** Actions shown in the dropdown that opens from the primary column. */
  actions?: ActionDef<T>[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCellValue<T extends object>(row: T, col: ColumnDef<T>): unknown {
  if (typeof col.accessor === 'function') return col.accessor(row);
  return (row as Record<string, unknown>)[col.accessor as string];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SmartTable<T extends object>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  keyExtractor,
  sortable = true,
  onRowClick,
  actions,
}: SmartTableProps<T>) {
  // ── Sort ──────────────────────────────────────────────────────────────────
  const [sortColId, setSortColId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Column widths (resizable) ─────────────────────────────────────────────
  const defaultWidths = useMemo(() => {
    const map: Record<string, number> = {};
    for (const col of columns) map[col.id] = col.width ?? 150;
    return map;
  }, [columns]);
  const [colWidths, setColWidths] = useState<Record<string, number>>(defaultWidths);

  // Reset widths if columns change (e.g. parent re-renders with new column set)
  useEffect(() => {
    setColWidths(defaultWidths);
  }, [defaultWidths]);

  // ── Dropdown ──────────────────────────────────────────────────────────────
  const [dropdownRowKey, setDropdownRowKey] = useState<string | number | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Resize tracking ───────────────────────────────────────────────────────
  const resizeRef = useRef<{
    colId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // ── Sorted data ───────────────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortable || !sortColId) return data;
    const col = columns.find((c) => c.id === sortColId);
    if (!col || col.sortable === false) return data;

    return [...data].sort((a, b) => {
      const av = getCellValue(a, col);
      const bv = getCellValue(b, col);
      if (av === bv) return 0;
      // coerce to comparable type
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortColId, sortDir, columns, sortable]);

  // ── Sort click ────────────────────────────────────────────────────────────
  function handleSortClick(col: ColumnDef<T>) {
    if (!sortable || col.sortable === false) return;
    if (sortColId === col.id) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColId(col.id);
      setSortDir('asc');
    }
  }

  // ── Dropdown open / close ─────────────────────────────────────────────────
  function openDropdown(row: T, btnEl: HTMLButtonElement) {
    const key = keyExtractor(row);
    if (dropdownRowKey === key) {
      setDropdownRowKey(null);
      return;
    }
    const rect = btnEl.getBoundingClientRect();
    // Position: below the trigger button, left-aligned to it
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

  // Close on outside click / Escape
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

  // ── Column resize ─────────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, colId: string) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        colId,
        startX: e.clientX,
        startWidth: colWidths[colId] ?? 150,
      };
    },
    [colWidths],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizeRef.current) return;
      const { colId, startX, startWidth } = resizeRef.current;
      const col = columns.find((c) => c.id === colId);
      const minW = col?.minWidth ?? 60;
      const newWidth = Math.max(minW, startWidth + (e.clientX - startX));
      setColWidths((prev) => ({ ...prev, [colId]: newWidth }));
    }
    function onMouseUp() {
      resizeRef.current = null;
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [columns]);

  // ── State helpers ─────────────────────────────────────────────────────────
  const hasActions = Boolean(actions && actions.length > 0);
  const activeDropdownRow =
    dropdownRowKey !== null
      ? sortedData.find((r) => keyExtractor(r) === dropdownRowKey) ?? null
      : null;

  // ── Loading / empty ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="st__state">
        <p className="st__stateText">Cargando...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="st__state">
        <p className="st__stateText">{emptyMessage}</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="st__wrap">
        <table className="st__table">
          <colgroup>
            {columns.map((col) => (
              <col key={col.id} style={{ width: colWidths[col.id] }} />
            ))}
          </colgroup>

          <thead className="st__thead">
            <tr>
              {columns.map((col) => {
                const isColSortable = sortable && col.sortable !== false;
                const isSorted = sortColId === col.id;

                return (
                  <th
                    key={col.id}
                    className={[
                      'st__th',
                      isColSortable ? 'st__th--sortable' : '',
                      isSorted ? 'st__th--sorted' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => !col.headerContent && handleSortClick(col)}
                    title={isColSortable && !col.headerContent ? `Ordenar por ${col.header}` : undefined}
                  >
                    {col.headerContent ? (
                      col.headerContent
                    ) : (
                    <span className="st__thInner">
                      {col.header}
                      {isColSortable && (
                        <span className="st__sortIcon" aria-hidden>
                          {isSorted ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                        </span>
                      )}
                    </span>
                    )}
                    {/* Resize handle — stops click propagation to avoid triggering sort */}
                    <div
                      className="st__resizeHandle"
                      onMouseDown={(e) => handleResizeMouseDown(e, col.id)}
                      onClick={(e) => e.stopPropagation()}
                      title="Arrastrar para ajustar ancho"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="st__tbody">
            {sortedData.map((row) => {
              const rowKey = keyExtractor(row);
              return (
                <tr key={rowKey} className="st__tr">
                  {columns.map((col) => {
                    const value = getCellValue(row, col);

                    if (col.primary) {
                      return (
                        <td key={col.id} className="st__td st__td--primary">
                          <div className="st__primaryCell">
                            {/* Name text — fires onRowClick */}
                            {onRowClick ? (
                              <button
                                type="button"
                                className="st__primaryName st__primaryName--clickable"
                                onClick={() => onRowClick(row)}
                              >
                                {col.render ? col.render(value, row) : String(value ?? '—')}
                              </button>
                            ) : (
                              <span className="st__primaryName">
                                {col.render ? col.render(value, row) : String(value ?? '—')}
                              </span>
                            )}

                            {/* Dropdown trigger arrow (Jenkins-style) */}
                            {hasActions && (
                              <button
                                type="button"
                                className="st__dropdownTrigger"
                                aria-label="Abrir acciones"
                                title="Acciones"
                                onClick={(e) => openDropdown(row, e.currentTarget)}
                              >
                                ▾
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={col.id} className="st__td">
                        {col.render
                          ? col.render(value, row)
                          : (value as React.ReactNode) ?? '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dropdown — rendered into document.body via portal to avoid overflow clipping */}
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

export default SmartTable;
