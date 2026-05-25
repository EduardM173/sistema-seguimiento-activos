/**
 * DeeplinkText
 * ------------
 * Renders a piece of text returned by the chat agent, replacing
 * `[[link:<slug>]]` tokens with clickable `<Link>` elements.
 *
 * The companion `deeplinks` map is the one returned by the agent service
 * `POST /sessions/{id}/messages` endpoint:
 *
 *   {
 *     "<slug>": {
 *       url: string,        // already built, react-router compatible
 *       label: string,      // user-facing text for the link
 *       page_id?: string,
 *       modal_id?: string | null,
 *       params?: Record<string, unknown>
 *     }
 *   }
 */
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface DeeplinkRef {
  url: string;
  label: string;
  page_id?: string;
  modal_id?: string | null;
  params?: Record<string, unknown>;
}

export interface DeeplinkTextProps {
  /** The assistant text, possibly containing `[[link:<slug>]]` tokens. */
  text: string;
  /** Map slug → deeplink reference returned by the chat endpoint. */
  deeplinks?: Record<string, DeeplinkRef> | null;
  /**
   * Optional className applied to every rendered `<Link>`. Useful for
   * styling links in chat bubbles consistently.
   */
  linkClassName?: string;
  /**
   * If true, links are rendered as plain `<a>` (full reload) instead of
   * react-router `<Link>` (client-side nav). Defaults to `false`.
   */
  asAnchor?: boolean;
}

const TOKEN_RE = /\[\[link:([a-zA-Z0-9_-]+)\]\]/g;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((app:\/\/[^\)]+|\/[^\)]*|https?:\/\/[^\)]+)\)/g;

/** Render a text segment that may contain markdown `[label](url)` links. */
function renderTextSegment(
  segment: string,
  keyStart: number,
  linkClassName?: string,
  asAnchor?: boolean,
): { nodes: ReactNode[]; nextKey: number } {
  const nodes: ReactNode[] = [];
  let key = keyStart;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MARKDOWN_LINK_RE.lastIndex = 0;
  while ((match = MARKDOWN_LINK_RE.exec(segment)) !== null) {
    const [full, label, url] = match;
    const start = match.index;
    if (start > lastIndex) {
      nodes.push(<Fragment key={key++}>{segment.slice(lastIndex, start)}</Fragment>);
    }
    const isAppLink = url.startsWith('app://');
    const isExternal = url.startsWith('http://') || url.startsWith('https://');
    const to = isAppLink ? '/' + url.slice('app://'.length) : url;
    if (isExternal) {
      nodes.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          {label}
        </a>,
      );
    } else if (asAnchor) {
      nodes.push(
        <a key={key++} href={to} className={linkClassName}>{label}</a>,
      );
    } else {
      nodes.push(
        <Link key={key++} to={to} className={linkClassName}>{label}</Link>,
      );
    }
    lastIndex = start + full.length;
  }
  if (lastIndex < segment.length) {
    nodes.push(<Fragment key={key++}>{segment.slice(lastIndex)}</Fragment>);
  }
  return { nodes, nextKey: key };
}

export function DeeplinkText({
  text,
  deeplinks,
  linkClassName,
  asAnchor = false,
}: DeeplinkTextProps): ReactNode {
  if (!text) return null;
  if (!deeplinks || Object.keys(deeplinks).length === 0) {
    // No deeplink tokens — still render markdown links in the raw text.
    const stripped = text.replace(TOKEN_RE, '');
    const { nodes } = renderTextSegment(stripped, 0, linkClassName, asAnchor);
    return <>{nodes}</>;
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // Reset state for global regex.
  TOKEN_RE.lastIndex = 0;
  let key = 0;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    const [token, slug] = match;
    const start = match.index;
    if (start > lastIndex) {
      const segment = text.slice(lastIndex, start);
      const { nodes: segNodes, nextKey } = renderTextSegment(segment, key, linkClassName, asAnchor);
      nodes.push(...segNodes);
      key = nextKey;
    }

    const ref = deeplinks[slug];
    if (ref && ref.url) {
      if (asAnchor) {
        nodes.push(
          <a key={key++} href={ref.url} className={linkClassName}>
            {ref.label || ref.url}
          </a>,
        );
      } else {
        nodes.push(
          <Link key={key++} to={ref.url} className={linkClassName}>
            {ref.label || ref.url}
          </Link>,
        );
      }
    } else {
      // Unknown slug: drop the token silently rather than show raw markup.
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    const segment = text.slice(lastIndex);
    const { nodes: segNodes } = renderTextSegment(segment, key, linkClassName, asAnchor);
    nodes.push(...segNodes);
  }

  return <>{nodes}</>;
}

/**
 * Lightweight non-React helper for environments that need plain HTML
 * (e.g. server-rendered emails or notifications).
 */
export function renderDeeplinkTextToHtml(
  text: string,
  deeplinks?: Record<string, DeeplinkRef> | null,
): string {
  if (!text) return '';
  if (!deeplinks) return escapeHtml(text.replace(TOKEN_RE, ''));
  return text.replace(TOKEN_RE, (token, slug: string) => {
    const ref = deeplinks[slug];
    if (!ref?.url) return '';
    return `<a href="${escapeAttr(ref.url)}">${escapeHtml(ref.label || ref.url)}</a>`;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
