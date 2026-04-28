/**
 * Deeplink Engine — AI-facing helpers.
 *
 * These helpers can be called from any layer (React or service) to obtain a
 * machine-readable description of the application's navigable surface. They
 * intentionally do not depend on React, so an AI service worker, an event
 * handler, or a service module can call them without hooks.
 */

import { deeplinkRegistry } from './registry';
import type { DeeplinkLocation, DeeplinkTarget, NavigationMap } from './types';

/**
 * Returns the global navigation map (or a page-scoped submap) as JSON.
 *
 * @example
 *   const map = getNavigationMapJson({ pretty: true });
 *   // → feed `map` into an LLM prompt as a tool description
 */
export function getNavigationMapJson(
  opts: {
    pageId?: string;
    permissions?: readonly string[];
    currentLocation?: DeeplinkLocation;
    pretty?: boolean;
  } = {},
): string {
  const { pretty, ...rest } = opts;
  const map = deeplinkRegistry.getNavigationMap(rest);
  return JSON.stringify(map, null, pretty ? 2 : 0);
}

/** Returns the navigation map as a structured object. */
export function getNavigationMap(
  opts: {
    pageId?: string;
    permissions?: readonly string[];
    currentLocation?: DeeplinkLocation;
  } = {},
): NavigationMap {
  return deeplinkRegistry.getNavigationMap(opts);
}

/**
 * Build a deeplink URL for a `(pageId, modalId?, params?)` target without
 * navigating. Useful for AI tool-calling that needs to suggest a link.
 */
export function buildDeeplinkUrl(target: DeeplinkTarget): string {
  return deeplinkRegistry.buildUrl(target);
}

/** Parse any URL string into a `DeeplinkLocation`. */
export function parseDeeplinkUrl(url: string): DeeplinkLocation {
  const u = new URL(url, 'http://_local_');
  return deeplinkRegistry.parseLocation(u.pathname, u.search);
}
