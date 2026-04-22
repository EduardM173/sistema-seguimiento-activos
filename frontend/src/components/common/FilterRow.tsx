import { useState, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Select } from './Select';
import type { SelectOption } from './Select';
import '../../styles/FilterRow.css';

// ─── Public types ─────────────────────────────────────────────────────────────

/** The flat query object produced by FilterRow and consumed by callers. */
export type FilterQuery = Record<string, string>;

/** A full-text search input with a leading magnifier icon. */
export interface SearchBoxDef {
  type: 'search';
  key: string;
  label: string;
  placeholder?: string;
  /** flex grow (default: 2) */
  flex?: number;
}

/** A plain text input without the search icon (e.g. "Edificio"). */
export interface TextBoxDef {
  type: 'text';
  key: string;
  label: string;
  placeholder?: string;
  flex?: number;
}

/** A custom dark-themed dropdown backed by Select. */
export interface SelectBoxDef {
  type: 'select';
  key: string;
  label: string;
  options: SelectOption[];
  /** Text shown when nothing is selected (becomes the "all" / empty option). */
  placeholder?: string;
  flex?: number;
}

export type FilterElementDef = SearchBoxDef | TextBoxDef | SelectBoxDef;

export interface FilterRowProps {
  elements: FilterElementDef[];
  /**
   * Called with the full query object whenever any element changes.
   * Search boxes are debounced; selects fire immediately.
   */
  onChange: (query: FilterQuery) => void;
  /** Debounce delay for text inputs in ms (default: 350). */
  debounce?: number;
  /** Pre-populate filters (uncontrolled — only read on mount). */
  initialQuery?: FilterQuery;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmpty(elements: FilterElementDef[], seed?: FilterQuery): FilterQuery {
  const q: FilterQuery = {};
  for (const el of elements) q[el.key] = seed?.[el.key] ?? '';
  return q;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterRow({
  elements,
  onChange,
  debounce: delay = 350,
  initialQuery,
}: FilterRowProps) {
  const [values, setValues] = useState<FilterQuery>(() =>
    buildEmpty(elements, initialQuery),
  );

  /**
   * `committed` holds the last query passed to `onChange`.
   * We keep it in a ref so debounce closures always see the latest version
   * without triggering re-renders.
   */
  const committed = useRef<FilterQuery>(buildEmpty(elements, initialQuery));
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fire = useCallback(
    (next: FilterQuery) => {
      committed.current = next;
      onChange({ ...next });
    },
    [onChange],
  );

  function handleText(key: string, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      fire({ ...committed.current, [key]: raw });
    }, delay);
  }

  function handleSelect(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
    fire({ ...committed.current, [key]: val });
  }

  function clear() {
    const empty = buildEmpty(elements);
    setValues(empty);
    for (const t of Object.values(timers.current)) clearTimeout(t);
    fire(empty);
  }

  const isActive = Object.values(values).some((v) => v !== '');

  return (
    <div className="filterRow">
      {elements.map((el) => (
        <div
          key={el.key}
          className="filterRow__group"
          style={el.flex !== undefined ? { flex: el.flex } : undefined}
        >
          <label className="filterRow__label">{el.label}</label>

          {el.type === 'search' && (
            <div className="filterRow__inputWrap">
              <span className="filterRow__searchIcon" aria-hidden>
                <Search size={14} />
              </span>
              <input
                type="text"
                className="filterRow__input filterRow__input--search"
                placeholder={el.placeholder}
                value={values[el.key] ?? ''}
                onChange={(e) => handleText(el.key, e.target.value)}
              />
            </div>
          )}

          {el.type === 'text' && (
            <input
              type="text"
              className="filterRow__input"
              placeholder={el.placeholder}
              value={values[el.key] ?? ''}
              onChange={(e) => handleText(el.key, e.target.value)}
            />
          )}

          {el.type === 'select' && (
            <Select
              value={values[el.key] ?? ''}
              onChange={(val) => handleSelect(el.key, val)}
              options={el.options}
              placeholder={el.placeholder}
            />
          )}
        </div>
      ))}

      <button
        type="button"
        className={`filterRow__clearBtn ${isActive ? 'filterRow__clearBtn--active' : ''}`}
        onClick={clear}
        disabled={!isActive}
        title="Limpiar filtros"
      >
        <X size={13} aria-hidden />
        Limpiar
      </button>
    </div>
  );
}
