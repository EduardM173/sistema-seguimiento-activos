/**
 * Deeplink Engine — React provider, context and hooks.
 *
 * Bridges the framework-agnostic `DeeplinkRegistry` to react-router DOM. Every
 * page in the app sits below `<DeeplinkProvider>` and can consume the engine
 * via the hooks exported here.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { deeplinkRegistry, DeeplinkRegistry } from './registry';
import type {
  DeeplinkLocation,
  DeeplinkTarget,
  NavigationMap,
} from './types';

/* ------------------------------------------------------------------ context */

interface DeeplinkContextValue {
  registry: DeeplinkRegistry;
  /** Parsed view of the current URL. */
  location: DeeplinkLocation;
  /** Navigate to a target page (optionally opening a modal). */
  navigateTo: (target: DeeplinkTarget, opts?: { replace?: boolean }) => void;
  /** Open a modal on the *current* page (URL-encoded). */
  openModal: (modalId: string, params?: Record<string, unknown>) => void;
  /** Close any open modal on the current page. */
  closeModal: () => void;
  /** Build a URL string for a target without navigating. */
  buildUrl: (target: DeeplinkTarget) => string;
  /** Get the JSON navigation map (filtered by current user permissions). */
  getNavigationMap: (opts?: { pageId?: string; scoped?: boolean }) => NavigationMap;
}

const DeeplinkContext = createContext<DeeplinkContextValue | null>(null);

/* ----------------------------------------------------------------- provider */

interface DeeplinkProviderProps {
  children: ReactNode;
  /** Override the default singleton registry (tests). */
  registry?: DeeplinkRegistry;
  /**
   * Callback returning the current user's permission codes. Used to flag
   * `accessible` in the navigation map. Optional — when omitted, every entry
   * is reported as accessible.
   */
  getPermissions?: () => readonly string[] | undefined;
  /**
   * When true, exposes the engine on `window.__deeplinkEngine` so external
   * tooling (e.g. an in-page AI agent or browser extension) can introspect.
   * Defaults to true.
   */
  exposeOnWindow?: boolean;
}

export function DeeplinkProvider({
  children,
  registry = deeplinkRegistry,
  getPermissions,
  exposeOnWindow = true,
}: DeeplinkProviderProps) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const parsedLocation = useMemo<DeeplinkLocation>(
    () => registry.parseLocation(location.pathname, location.search),
    [registry, location.pathname, location.search],
  );

  const buildUrl = useCallback(
    (target: DeeplinkTarget) => registry.buildUrl(target),
    [registry],
  );

  const navigateTo = useCallback(
    (target: DeeplinkTarget, opts?: { replace?: boolean }) => {
      navigate(registry.buildUrl(target), { replace: opts?.replace });
    },
    [navigate, registry],
  );

  const openModal = useCallback(
    (modalId: string, params?: Record<string, unknown>) => {
      const next = new URLSearchParams(searchParams);
      next.set('modal', modalId);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v === undefined || v === null || v === '') next.delete(k);
          else next.set(k, String(v));
        }
      }
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const closeModal = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    if (!next.has('modal')) return;
    next.delete('modal');
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  const getNavigationMap = useCallback(
    (opts?: { pageId?: string; scoped?: boolean }) => {
      const permissions = getPermissions?.();
      return registry.getNavigationMap({
        pageId: opts?.scoped ? parsedLocation.pageId ?? undefined : opts?.pageId,
        permissions,
        currentLocation: parsedLocation,
      });
    },
    [registry, getPermissions, parsedLocation],
  );

  const value = useMemo<DeeplinkContextValue>(
    () => ({
      registry,
      location: parsedLocation,
      navigateTo,
      openModal,
      closeModal,
      buildUrl,
      getNavigationMap,
    }),
    [registry, parsedLocation, navigateTo, openModal, closeModal, buildUrl, getNavigationMap],
  );

  // Optional: expose to window for AI / dev tooling.
  useEffect(() => {
    if (!exposeOnWindow) return;
    const w = window as unknown as { __deeplinkEngine?: unknown };
    w.__deeplinkEngine = {
      getNavigationMap: (opts?: { pageId?: string; scoped?: boolean }) =>
        getNavigationMap(opts),
      buildUrl,
      getCurrentLocation: () => parsedLocation,
      listPages: () => registry.listPages(),
    };
    return () => {
      if (w.__deeplinkEngine) delete w.__deeplinkEngine;
    };
  }, [exposeOnWindow, getNavigationMap, buildUrl, parsedLocation, registry]);

  return <DeeplinkContext.Provider value={value}>{children}</DeeplinkContext.Provider>;
}

/* -------------------------------------------------------------------- hooks */

/** Main consumer hook. Throws if used outside the provider. */
export function useDeeplink(): DeeplinkContextValue {
  const ctx = useContext(DeeplinkContext);
  if (!ctx) throw new Error('useDeeplink must be used within <DeeplinkProvider>');
  return ctx;
}

/** Returns the current parsed deeplink location. */
export function useDeeplinkLocation(): DeeplinkLocation {
  return useDeeplink().location;
}

/**
 * Convenience hook for any page that owns a modal: returns whether the modal
 * is currently active per the URL, plus open/close helpers and the URL params
 * snapshot.
 */
export function useModalDeeplink(modalId: string): {
  isOpen: boolean;
  params: Record<string, string>;
  open: (params?: Record<string, unknown>) => void;
  close: () => void;
} {
  const { location, openModal, closeModal } = useDeeplink();
  const isOpen = location.modalId === modalId;
  return {
    isOpen,
    params: location.params,
    open: (params) => openModal(modalId, params),
    close: closeModal,
  };
}

/**
 * Bridge a legacy `useState` modal flag to the URL. Mounting this hook keeps
 * `<state>` and `?modal=<modalId>` in sync in both directions, which lets us
 * adopt the deeplink engine on existing pages with minimal refactoring.
 */
export function useModalUrlSync(
  modalId: string,
  isOpen: boolean,
  setOpen: (open: boolean) => void,
): void {
  const { location, openModal, closeModal } = useDeeplink();
  const urlOpen = location.modalId === modalId;

  // URL → state
  useEffect(() => {
    if (urlOpen !== isOpen) setOpen(urlOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlOpen]);

  // state → URL
  useEffect(() => {
    if (isOpen && !urlOpen) openModal(modalId);
    else if (!isOpen && urlOpen) closeModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}

/** Returns the navigation map JSON. Use `scoped` to get only the current page. */
export function useNavigationMap(opts?: { pageId?: string; scoped?: boolean }): NavigationMap {
  return useDeeplink().getNavigationMap(opts);
}
