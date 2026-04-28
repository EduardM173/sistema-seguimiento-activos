/**
 * Deeplink Engine — Type definitions.
 *
 * The deeplink engine is the single source of truth describing every navigable
 * surface of the application: pages, modals/overlays, and side-effect actions.
 *
 * URL convention:
 *   - Pages use React Router paths (e.g. `/activos`, `/activos/:id`).
 *   - Modals and ephemeral page-states are encoded as query params:
 *       /activos?modal=create-asset
 *       /activos?modal=edit-asset&assetId=42
 *     This keeps deeplinks shareable, bookmarkable and back-button friendly.
 */

/** Type of value carried by a deeplink parameter. */
export type DeeplinkParamType = 'string' | 'number' | 'boolean' | 'enum';

/** Single parameter that can be encoded in the URL (path or query). */
export interface DeeplinkParam {
  /** Param key as it appears in URL/path. */
  name: string;
  /** Value type used for parsing/serialisation. */
  type: DeeplinkParamType;
  /** Where this param lives in the URL. */
  in: 'path' | 'query';
  /** True if missing means "deeplink invalid". */
  required?: boolean;
  /** Allowed values when `type === 'enum'`. */
  enumValues?: readonly string[];
  /** Human-readable description, surfaced to the AI. */
  description?: string;
  /** Default value if none provided. */
  defaultValue?: string | number | boolean;
}

/**
 * An "action" is any user-triggerable operation on a page that does NOT open
 * a modal — submit, delete, refresh, switch tab, etc. Useful for the AI map
 * but not directly addressable via URL.
 */
export interface DeeplinkAction {
  id: string;
  title: string;
  description?: string;
  requiredPermission?: string;
  params?: DeeplinkParam[];
}

/** Definition of a modal (or any URL-addressable ephemeral state) on a page. */
export interface DeeplinkModalDefinition {
  /** Unique modal id within its parent page (matches `?modal=<id>`). */
  id: string;
  title: string;
  description?: string;
  /** RBAC permission required to open this modal, if any. */
  requiredPermission?: string;
  /** Extra query/path params that the modal consumes. */
  params?: DeeplinkParam[];
  /** Other modal ids reachable from this one (for the AI navigation graph). */
  reachableModals?: string[];
  /** Free-form actions this modal exposes (submit, cancel, etc.). */
  actions?: DeeplinkAction[];
}

/** Definition of a page. */
export interface DeeplinkPageDefinition {
  /** Unique stable id (used as the deeplink target id). */
  id: string;
  /** React-Router path pattern, e.g. `/activos/:id`. */
  path: string;
  title: string;
  description?: string;
  /** RBAC permission required to enter the page. */
  requiredPermission?: string;
  /** Path/query params declared by the page itself. */
  params?: DeeplinkParam[];
  /** Modals/ephemeral states reachable from this page. */
  modals?: DeeplinkModalDefinition[];
  /** Page-level actions (non-modal). */
  actions?: DeeplinkAction[];
  /** Other page ids commonly reached from here (for AI graph). */
  relatedPages?: string[];
  /** Tags help the AI categorise pages (e.g. ["inventory", "stock"]). */
  tags?: string[];
}

/** Target for navigation/URL building. */
export interface DeeplinkTarget {
  pageId: string;
  modalId?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

/** Result of parsing the current URL against the registry. */
export interface DeeplinkLocation {
  pageId: string | null;
  modalId: string | null;
  params: Record<string, string>;
  pathname: string;
  search: string;
}

/** JSON shape returned by `getNavigationMap()` — designed for AI consumption. */
export interface NavigationMapPage {
  id: string;
  path: string;
  title: string;
  description?: string;
  tags?: string[];
  requiredPermission?: string;
  /** Pre-built deeplink URL (with placeholders for missing required params). */
  deeplink: string;
  params?: DeeplinkParam[];
  actions?: DeeplinkAction[];
  modals?: NavigationMapModal[];
  relatedPages?: string[];
  /** True if the current user (per provided permissions) can reach this. */
  accessible?: boolean;
}

export interface NavigationMapModal {
  id: string;
  title: string;
  description?: string;
  requiredPermission?: string;
  /** Pre-built deeplink URL: `/page?modal=<id>&...`. */
  deeplink: string;
  params?: DeeplinkParam[];
  actions?: DeeplinkAction[];
  reachableModals?: string[];
  accessible?: boolean;
}

export interface NavigationMap {
  version: string;
  generatedAt: string;
  currentLocation?: DeeplinkLocation;
  /** When `pageId` filter was used, this is the page-scoped submap. */
  scope?: 'global' | 'page';
  pages: NavigationMapPage[];
}
