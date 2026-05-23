/**
 * Agent chat service
 * ------------------
 * Thin client over the FastAPI `agent_service` chat endpoints. Talks to
 * `/agent/chat/...` which the Vite dev server proxies to the agent
 * container (configured in `vite.config.ts` via `VITE_AGENT_URL`).
 *
 * The service is intentionally framework-agnostic — the React widget owns
 * state. Errors are normalised to `AgentChatError`.
 */

const AGENT_BASE = (import.meta.env.VITE_AGENT_BASE_PATH as string | undefined) || '/agent';

export class AgentChatError extends Error {
  status: number;
  detail?: unknown;
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'AgentChatError';
    this.status = status;
    this.detail = detail;
  }
}

// ── Wire types (mirror agent_service/src/models/chat.py) ─────────────────

export type MessageRole = 'system' | 'user' | 'assistant';

export interface DeeplinkRefWire {
  slug: string;
  url: string;
  label: string;
  page_id: string;
  modal_id?: string | null;
  params?: Record<string, unknown>;
}

export interface CreateSessionRequest {
  title?: string;
  user_id?: string;
  initial_context?: string;
}

export interface CreateSessionResponse {
  session_id: string;
  status: string;
  created_at: string;
}

export interface SendMessageRequest {
  content: string;
  context?: Record<string, unknown> | null;
  allow_conjectures?: boolean;
}

export interface SendMessageResponse {
  message_id: string;
  role: MessageRole;
  content: string;
  dsl_conclusion?: string;
  proof_trace?: string[];
  facts_used?: string[];
  conjectures_made?: string[];
  z3_validations?: unknown[];
  is_conjecture?: boolean;
  new_facts_count?: number;
  /** Map slug → deeplink ref. Tokens `[[link:<slug>]]` in `content`
   *  reference these entries. Empty when no deeplink applies. */
  deeplinks?: Record<string, DeeplinkRefWire>;
}

export interface HistoryMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at?: string;
  deeplinks?: Record<string, DeeplinkRefWire>;
}

export interface EndSessionRequest {
  success: boolean;
  rating?: number;
  comment?: string;
}

// ── HTTP helper ──────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<T> {
  const { body, headers, ...rest } = init;
  const resp = await fetch(`${AGENT_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string> | undefined),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!resp.ok) {
    let detail: unknown = undefined;
    try {
      detail = await resp.json();
    } catch {
      /* ignore */
    }
    const msg =
      (detail as { detail?: string } | undefined)?.detail ||
      `Agent request failed (${resp.status})`;
    throw new AgentChatError(msg, resp.status, detail);
  }

  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

// ── Public API ───────────────────────────────────────────────────────────

export const agentChatService = {
  createSession(body: CreateSessionRequest = {}): Promise<CreateSessionResponse> {
    return request<CreateSessionResponse>('/chat/sessions', {
      method: 'POST',
      body,
    });
  },

  sendMessage(
    sessionId: string,
    body: SendMessageRequest,
  ): Promise<SendMessageResponse> {
    return request<SendMessageResponse>(
      `/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
      { method: 'POST', body },
    );
  },

  listMessages(
    sessionId: string,
    limit = 100,
    offset = 0,
  ): Promise<{ messages: HistoryMessage[]; total: number }> {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return request<{ messages: HistoryMessage[]; total: number }>(
      `/chat/sessions/${encodeURIComponent(sessionId)}/messages?${qs.toString()}`,
      { method: 'GET' },
    );
  },

  endSession(sessionId: string, body: EndSessionRequest): Promise<unknown> {
    return request<unknown>(
      `/chat/sessions/${encodeURIComponent(sessionId)}/end`,
      { method: 'POST', body },
    );
  },

  health(): Promise<{ status: string }> {
    return request<{ status: string }>('/health', { method: 'GET' });
  },
};
