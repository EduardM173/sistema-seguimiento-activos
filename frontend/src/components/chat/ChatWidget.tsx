/**
 * ChatWidget
 * ----------
 * Best Buy-style floating chat. A round button at the bottom-left toggles
 * a panel where the user converses with the agent service.
 *
 * Behaviour:
 *  - First open lazily creates a chat session via `agentChatService.createSession`.
 *  - User messages are appended optimistically; the assistant reply (and any
 *    deeplinks) are rendered through `<DeeplinkText>`, replacing
 *    `[[link:<slug>]]` tokens with inline clickable pills that use
 *    react-router's `<Link>` for SPA navigation.
 *  - The widget closes on link click so the user lands on the destination
 *    page without the chat panel covering it.
 *
 * Auth context (when present) is sent as `body.context` so the agent can
 * filter the navigation map by the user's permissions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { DeeplinkText } from '../../deeplink';
import type { DeeplinkRef } from '../../deeplink';
import {
  agentChatService,
  type DeeplinkRefWire,
  type SendMessageResponse,
} from '../../services/agent-chat.service';
import '../../styles/chat-widget.css';

interface ChatMessageVM {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  deeplinks?: Record<string, DeeplinkRefWire>;
}

const WELCOME_TEXT =
  'Hola 👋 Soy tu asistente. Preguntame por activos, inventario, transferencias o usuarios y, si corresponde, te llevo directo a la pantalla.';

export default function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessageVM[]>([]);
  const [unread, setUnread] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const creatingSessionRef = useRef<Promise<string> | null>(null);

  const isAuthenticated = Boolean(user);

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, sending]);

  // Reset unread counter when opened.
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Focus input when opening.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    if (creatingSessionRef.current) return creatingSessionRef.current;
    const p = (async () => {
      const resp = await agentChatService.createSession({
        title: user?.nombres ? `Chat de ${user.nombres}` : undefined,
        user_id: user?.id ? String(user.id) : undefined,
      });
      setSessionId(resp.session_id);
      return resp.session_id;
    })();
    creatingSessionRef.current = p;
    try {
      return await p;
    } finally {
      creatingSessionRef.current = null;
    }
  }, [sessionId, user]);

  const permissions = useMemo(
    () => user?.permisos?.map((p) => p.codigo) ?? [],
    [user],
  );

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const userMsg: ChatMessageVM = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setSending(true);

    try {
      const sid = await ensureSession();
      const reply: SendMessageResponse = await agentChatService.sendMessage(sid, {
        content: text,
        allow_conjectures: true,
        context: permissions.length > 0 ? { permissions } : undefined,
      });
      const assistantMsg: ChatMessageVM = {
        id: reply.message_id,
        role: 'assistant',
        content: reply.content,
        deeplinks: reply.deeplinks,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (!open) setUnread((n) => n + 1);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No pude contactar al asistente. Intenta de nuevo.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'error',
          content: msg,
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [draft, sending, ensureSession, permissions, open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  // When the user clicks a deeplink pill, close the widget and let
  // react-router handle the navigation.
  const onDeeplinkClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const a = target.closest('a.chat-widget__deeplink') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href) return;
      // react-router's <Link> already handles plain left-clicks; we just
      // close the panel for a clean hand-off.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      setOpen(false);
      // <Link> takes care of navigation; explicit navigate() call is a
      // belt-and-suspenders guarantee.
      e.preventDefault();
      navigate(href);
    },
    [navigate],
  );

  if (!isAuthenticated) return null;

  const renderableMessages: ChatMessageVM[] =
    messages.length === 0
      ? [{ id: 'welcome', role: 'assistant', content: WELCOME_TEXT }]
      : messages;

  return (
    <>
      <button
        type="button"
        className={`chat-widget__fab ${open ? 'chat-widget__fab--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <span className="chat-widget__badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <section className="chat-widget__panel" role="dialog" aria-label="Asistente">
          <header className="chat-widget__header">
            <div>
              <h3>Asistente</h3>
              <p className="chat-widget__header-sub">Te guío por la app</p>
            </div>
            <button
              type="button"
              className="chat-widget__close"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>

          <div
            className="chat-widget__messages"
            ref={scrollRef}
            onClick={onDeeplinkClick}
          >
            {renderableMessages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}
            {sending && (
              <div className="chat-widget__typing" aria-label="Asistente escribiendo">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <form
            className="chat-widget__form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <textarea
              ref={inputRef}
              className="chat-widget__input"
              placeholder="Escribe tu mensaje…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              disabled={sending}
            />
            <button
              type="submit"
              className="chat-widget__send"
              disabled={sending || draft.trim().length === 0}
            >
              Enviar
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function MessageBubble({ msg }: { msg: ChatMessageVM }) {
  const cls =
    msg.role === 'user'
      ? 'chat-widget__msg chat-widget__msg--user'
      : msg.role === 'error'
        ? 'chat-widget__msg chat-widget__msg--error'
        : 'chat-widget__msg chat-widget__msg--assistant';

  if (msg.role === 'user' || msg.role === 'error') {
    return <div className={cls}>{msg.content}</div>;
  }
  // Assistant: render with deeplink interpolation.
  return (
    <div className={cls}>
      <DeeplinkText
        text={msg.content}
        deeplinks={msg.deeplinks as Record<string, DeeplinkRef> | undefined}
        linkClassName="chat-widget__deeplink"
      />
    </div>
  );
}
