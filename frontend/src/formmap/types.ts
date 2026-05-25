/**
 * FormMap — Type definitions.
 *
 * A FormMap describes the navigable/fillable surface of a single UI form so
 * that an AI assistant can guide a user through completing it conversationally.
 *
 * Two distinct layers:
 *  - `FormMapDefinition` — the static schema registered in code (field types,
 *    labels, static enum options, catalog source hints).
 *  - `ResolvedFormMap` — the schema plus live options for each select field,
 *    resolved by the Vite plugin at request time against the backend or from
 *    the authenticated browser context.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Option
// ─────────────────────────────────────────────────────────────────────────────

export interface FormFieldOption {
  /** The value stored / sent to the backend. */
  value: string;
  /** Human-readable display label shown to the user and the AI. */
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Field definition
// ─────────────────────────────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';

/** Which backend catalog provides the live options for a select field. */
export type CatalogSource = 'categorias' | 'ubicaciones' | 'areas' | 'usuarios';

export interface FormField {
  /** Matches the form state key / backend field name. */
  name: string;
  /** Human-readable label used in chat questions. */
  label: string;
  type: FormFieldType;
  required?: boolean;
  /** Static options — for enums that never change (e.g. estado). */
  options?: FormFieldOption[];
  /**
   * Key in `wizard_catalogs` that provides live options at runtime.
   * Populated by the ChatWidget from backend API calls.
   */
  optionsSource?: CatalogSource;
  /**
   * Query-param name used in the prefill deeplink URL.
   * Defaults to `prefill_<name>` when absent.
   */
  prefillParam?: string;
  /**
   * Whether to skip this field in the AI wizard
   * (e.g. auto-generated code fields).
   */
  skipInWizard?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form definition (registered in code)
// ─────────────────────────────────────────────────────────────────────────────

export interface FormMapDefinition {
  formId: string;
  title: string;
  /** Fields in the order they should be collected by the assistant. */
  fields: FormField[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolved form map (served by the Vite plugin)
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedFormField extends Omit<FormField, 'optionsSource'> {
  /**
   * Populated for select fields — either from static `options` or from the
   * resolved catalog. May be empty when the catalog couldn't be fetched.
   */
  options?: FormFieldOption[];
  /** Indicates the client should hydrate live options from this catalog key. */
  optionsSource?: CatalogSource;
}

export interface ResolvedFormMap {
  formId: string;
  title: string;
  generatedAt: string;
  fields: ResolvedFormField[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard context (sent as part of chat message context)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catalog data fetched by the ChatWidget and sent with every message in a
 * wizard session so the agent knows the valid options for select fields.
 */
export interface WizardCatalogs {
  categorias?: Array<{ id: string; nombre: string }>;
  ubicaciones?: Array<{ id: string; nombre: string }>;
  areas?: Array<{ id: string; nombre: string }>;
  usuarios?: Array<{ id: string; nombre: string }>;
}

/**
 * When the user picks an option from a `suggestions` quick-reply, the
 * ChatWidget stores this and sends it in the next message's context so the
 * agent can record the actual DB id (not just the display label).
 */
export interface WizardSelection {
  /** Form field name, e.g. "categoriaId". */
  field: string;
  /** The actual backend value (DB id or enum value). */
  value: string;
  /** Human-readable label shown in the chat. */
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion (returned by the chat API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A quick-reply option returned by the chat API alongside a message.
 * The frontend renders these as clickable buttons below the assistant bubble.
 */
export interface ChatSuggestion {
  /** Display text shown on the button. */
  text: string;
  /** Actual value to store (DB id or enum). Sent back as `wizard_selection.value`. */
  value: string;
  /** Form field this suggestion answers (e.g. "categoriaId"). */
  field: string;
}
