/**
 * Deeplink Engine — Registry.
 *
 * Stateless catalog of pages/modals/actions. Knows how to:
 *   - register definitions
 *   - look them up by id or by URL
 *   - build canonical URLs from a `DeeplinkTarget`
 *   - parse a `(pathname, search)` pair into a `DeeplinkLocation`
 *   - export a JSON `NavigationMap` for AI consumption
 *
 * The registry is a plain class with no React dependency; the React layer
 * (DeeplinkProvider) wraps an instance and binds it to react-router.
 */

import type {
  DeeplinkLocation,
  DeeplinkModalDefinition,
  DeeplinkPageDefinition,
  DeeplinkTarget,
  NavigationMap,
  NavigationMapModal,
  NavigationMapPage,
} from './types';

const VERSION = '1.0.0';

/** Convert a path pattern like `/activos/:id` into a RegExp that captures :params. */
function compilePathPattern(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const regexSource = pattern
    .replace(/\/$/, '')
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, (m) => {
      keys.push(m.slice(1));
      return '([^/]+)';
    });
  return { regex: new RegExp(`^${regexSource}/?$`), keys };
}

/** Replace `:name` segments in the pattern with values from `params`. */
function fillPathPattern(pattern: string, params: Record<string, unknown>): string {
  return pattern.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, key: string) => {
    const v = params[key];
    if (v === undefined || v === null || v === '') return `:${key}`; // leave placeholder
    return encodeURIComponent(String(v));
  });
}

export class DeeplinkRegistry {
  private readonly pagesById = new Map<string, DeeplinkPageDefinition>();
  private readonly compiledPaths = new Map<string, { regex: RegExp; keys: string[] }>();

  /** Register a page definition. Throws on duplicate id. */
  registerPage(def: DeeplinkPageDefinition): void {
    if (this.pagesById.has(def.id)) {
      throw new Error(`[deeplink] duplicate page id: ${def.id}`);
    }
    this.pagesById.set(def.id, def);
    this.compiledPaths.set(def.id, compilePathPattern(def.path));
  }

  /** Register many at once. */
  registerPages(defs: readonly DeeplinkPageDefinition[]): void {
    for (const d of defs) this.registerPage(d);
  }

  /** Add a modal definition to an already-registered page. */
  registerModal(pageId: string, modal: DeeplinkModalDefinition): void {
    const page = this.pagesById.get(pageId);
    if (!page) throw new Error(`[deeplink] unknown page: ${pageId}`);
    const modals = page.modals ? [...page.modals] : [];
    if (modals.some((m) => m.id === modal.id)) {
      throw new Error(`[deeplink] duplicate modal "${modal.id}" on page "${pageId}"`);
    }
    modals.push(modal);
    this.pagesById.set(pageId, { ...page, modals });
  }

  getPage(id: string): DeeplinkPageDefinition | undefined {
    return this.pagesById.get(id);
  }

  getModal(pageId: string, modalId: string): DeeplinkModalDefinition | undefined {
    return this.pagesById.get(pageId)?.modals?.find((m) => m.id === modalId);
  }

  listPages(): readonly DeeplinkPageDefinition[] {
    return Array.from(this.pagesById.values());
  }

  /** Find which page's path matches `pathname`, returning extracted path params. */
  matchPath(pathname: string): { page: DeeplinkPageDefinition; pathParams: Record<string, string> } | null {
    for (const page of this.pagesById.values()) {
      const compiled = this.compiledPaths.get(page.id);
      if (!compiled) continue;
      const m = compiled.regex.exec(pathname);
      if (m) {
        const pathParams: Record<string, string> = {};
        compiled.keys.forEach((k, i) => {
          pathParams[k] = decodeURIComponent(m[i + 1] ?? '');
        });
        return { page, pathParams };
      }
    }
    return null;
  }

  /** Parse a `(pathname, search)` pair into a structured location. */
  parseLocation(pathname: string, search: string): DeeplinkLocation {
    const matched = this.matchPath(pathname);
    const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const params: Record<string, string> = {};
    sp.forEach((v, k) => {
      params[k] = v;
    });
    if (matched) Object.assign(params, matched.pathParams);
    const modalId = sp.get('modal');
    return {
      pageId: matched?.page.id ?? null,
      modalId: modalId && matched && this.getModal(matched.page.id, modalId) ? modalId : null,
      params,
      pathname,
      search,
    };
  }

  /** Build a canonical URL for a target. */
  buildUrl(target: DeeplinkTarget): string {
    const page = this.pagesById.get(target.pageId);
    if (!page) throw new Error(`[deeplink] unknown page: ${target.pageId}`);

    const allParams = { ...(target.params ?? {}) };
    const pathname = fillPathPattern(page.path, allParams);

    // Subtract path params from the leftover query bag.
    const compiled = this.compiledPaths.get(page.id);
    const pathKeys = new Set(compiled?.keys ?? []);

    const query = new URLSearchParams();
    if (target.modalId) {
      const modal = this.getModal(target.pageId, target.modalId);
      if (!modal) throw new Error(`[deeplink] unknown modal "${target.modalId}" on page "${target.pageId}"`);
      query.set('modal', target.modalId);
    }
    for (const [k, v] of Object.entries(allParams)) {
      if (pathKeys.has(k)) continue;
      if (v === undefined || v === null || v === '') continue;
      if (k === 'modal') continue;
      query.set(k, String(v));
    }
    const qs = query.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  /**
   * Generate a JSON navigation map. Designed to be passed to an AI so it
   * understands every navigable surface in the app and how to deeplink there.
   *
   * Options:
   *   - `pageId`: scope the map to a single page (returns its submap).
   *   - `permissions`: list of permission codes the current user holds; the
   *     resulting map flags each item with `accessible: true|false`.
   *   - `currentLocation`: optional, embedded in the map for AI grounding.
   */
  getNavigationMap(opts: {
    pageId?: string;
    permissions?: readonly string[];
    currentLocation?: DeeplinkLocation;
  } = {}): NavigationMap {
    const permSet = opts.permissions ? new Set(opts.permissions) : null;
    const can = (req?: string): boolean => (req ? (permSet ? permSet.has(req) : true) : true);

    const pages = opts.pageId
      ? [this.pagesById.get(opts.pageId)].filter(Boolean) as DeeplinkPageDefinition[]
      : Array.from(this.pagesById.values());

    const mapped: NavigationMapPage[] = pages.map((page) => {
      const modals: NavigationMapModal[] = (page.modals ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        requiredPermission: m.requiredPermission,
        deeplink: this.buildUrl({ pageId: page.id, modalId: m.id }),
        params: m.params,
        actions: m.actions,
        reachableModals: m.reachableModals,
        accessible: can(page.requiredPermission) && can(m.requiredPermission),
      }));
      return {
        id: page.id,
        path: page.path,
        title: page.title,
        description: page.description,
        tags: page.tags,
        requiredPermission: page.requiredPermission,
        deeplink: this.buildUrl({ pageId: page.id }),
        params: page.params,
        actions: page.actions,
        modals,
        relatedPages: page.relatedPages,
        accessible: can(page.requiredPermission),
      };
    });

    return {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      scope: opts.pageId ? 'page' : 'global',
      currentLocation: opts.currentLocation,
      pages: mapped,
    };
  }
}

/** Process-wide singleton. */
export const deeplinkRegistry = new DeeplinkRegistry();
