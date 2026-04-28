/**
 * Public entry point for the deeplink engine.
 *
 * Usage:
 *   import {
 *     DeeplinkProvider,
 *     useDeeplink,
 *     useModalDeeplink,
 *     useModalUrlSync,
 *     useNavigationMap,
 *   } from '@/deeplink';
 *
 * Importing this module also registers every app deeplink definition.
 */

export * from './types';
export { DeeplinkRegistry, deeplinkRegistry } from './registry';
export {
  DeeplinkProvider,
  useDeeplink,
  useDeeplinkLocation,
  useModalDeeplink,
  useModalUrlSync,
  useNavigationMap,
} from './DeeplinkProvider';
export { registerAppDeeplinks } from './definitions';
export {
  buildDeeplinkUrl,
  getNavigationMap,
  getNavigationMapJson,
  parseDeeplinkUrl,
} from './ai';
