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
 *  - When the agent is guiding a form-filling wizard, it can emit quick-reply
 *    suggestions for select fields. Clicking a suggestion sends the label as a
 *    message and passes the actual DB value in `context.wizard_selection` so
 *    the agent can build an accurate prefill URL.
 *
 * Auth context (when present) is sent as `body.context` so the agent can
 * filter the navigation map by the user's permissions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IconMessageSquare, IconBot, IconSend, IconX } from '../common/Icon';

import { useAuth } from '../../context/AuthContext';
import { DeeplinkText } from '../../deeplink';
import type { DeeplinkRef } from '../../deeplink';
import {
  agentChatService,
  type DeeplinkRefWire,
  type SendMessageResponse,
} from '../../services/agent-chat.service';
import { getCategorias, getUbicaciones } from '../../services/catalogs.service';
import type { WizardCatalogs, WizardSelection, ChatSuggestion } from '../../formmap';
import '../../styles/chat-widget.css';

interface ChatMessageVM {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  deeplinks?: Record<string, DeeplinkRefWire>;
  /** Quick-reply suggestions for form wizard select fields. */
  suggestions?: ChatSuggestion[];
}

const WELCOME_TEXT =
  'Hola! Soy tu asistente. Preguntame por activos, inventario, transferencias o usuarios y, si corresponde, te llevo directo a la pantalla.';

export default function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessageVM[]>([]);
  const [unread, setUnread] = useState(0);

  // Wizard state ──────────────────────────────────────────────────────────────
  /** Catalog data fetched on first open; sent as context.wizard_catalogs. */
  const [wizardCatalogs, setWizardCatalogs] = useState<WizardCatalogs | null>(null);
  /**
   * When the user clicks a suggestion button, store the selection here until
   * the next message is submitted, then include it in context.wizard_selection.
   */
  const [pendingSelection, setPendingSelection] = useState<WizardSelection | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const creatingSessionRef = useRef<Promise<string> | null>(null);

  const isAuthenticated = Boolean(user);

  // Fetch wizard catalogs once when the widget is opened. Best-effort.
  useEffect(() => {
    if (!open || wizardCatalogs !== null) return;
    void Promise.all([getCategorias(), getUbicaciones()])
      .then(([cats, ubis]) => {
        setWizardCatalogs({
          categorias: cats.map((c) => ({ id: c.id, nombre: c.nombre })),
          ubicaciones: ubis.map((u) => ({ id: u.id, nombre: u.nombre })),
        });
      })
      .catch(() => {
        // Non-critical — wizard still works; agent won't have live options
        setWizardCatalogs({});
      });
  }, [open, wizardCatalogs]);

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

  const submit = useCallback(async (overrideDraft?: string, selection?: WizardSelection) => {
    const text = (overrideDraft ?? draft).trim();
    if (!text || sending) return;

    const userMsg: ChatMessageVM = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setSending(true);

    // Capture and clear pending selection before the async call
    const sel = selection ?? pendingSelection;
    setPendingSelection(null);

    try {
      const sid = await ensureSession();
      const reply: SendMessageResponse = await agentChatService.sendMessage(sid, {
        content: text,
        allow_conjectures: true,
        context: {
          permissions: permissions.length > 0 ? permissions : undefined,
          current_route: location.pathname,
          ...(wizardCatalogs ? { wizard_catalogs: wizardCatalogs } : {}),
          ...(sel ? { wizard_selection: sel } : {}),
        },
      });
      const assistantMsg: ChatMessageVM = {
        id: reply.message_id,
        role: 'assistant',
        content: reply.content,
        deeplinks: reply.deeplinks,
        suggestions: reply.suggestions,
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
  }, [draft, sending, ensureSession, permissions, open, wizardCatalogs, pendingSelection]);

  /** Called when user clicks a quick-reply suggestion button. */
  const handleSuggestionClick = useCallback((suggestion: ChatSuggestion) => {
    const sel: WizardSelection = {
      field: suggestion.field,
      value: suggestion.value,
      label: suggestion.text,
    };
    void submit(suggestion.text, sel);
  }, [submit]);

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
        <IconMessageSquare size={22} />
        {!open && unread > 0 && (
          <span className="chat-widget__badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <section className="chat-widget__panel" role="dialog" aria-label="Asistente">
          <header className="chat-widget__header">
            <div className="chat-widget__header-icon" aria-hidden="true"><IconBot size={18} /></div>
            <div className="chat-widget__header-text">
              <h3>Asistente</h3>
              <p className="chat-widget__header-sub">En línea</p>
            </div>
            <div className="chat-widget__status-dot" aria-hidden="true" />
            <button
              type="button"
              className="chat-widget__close"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
            >
              <IconX size={14} />
            </button>
          </header>

          <div
            className="chat-widget__messages"
            ref={scrollRef}
            onClick={onDeeplinkClick}
          >
            {renderableMessages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                onSuggestionClick={handleSuggestionClick}
                suggestionsDisabled={sending}
              />
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
              aria-label="Enviar mensaje"
            >
              <IconSend size={16} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}

interface MessageBubbleProps {
  msg: ChatMessageVM;
  onSuggestionClick: (s: ChatSuggestion) => void;
  suggestionsDisabled: boolean;
}

function MessageBubble({ msg, onSuggestionClick, suggestionsDisabled }: MessageBubbleProps) {
  const cls =
    msg.role === 'user'
      ? 'chat-widget__msg chat-widget__msg--user'
      : msg.role === 'error'
        ? 'chat-widget__msg chat-widget__msg--error'
        : 'chat-widget__msg chat-widget__msg--assistant';

  if (msg.role === 'user' || msg.role === 'error') {
    return <div className={cls}>{msg.content}</div>;
  }

  // Assistant: render with deeplink interpolation and optional suggestions.
  return (
    <div className="chat-widget__msg-group">
      <div className={cls}>
        <DeeplinkText
          text={msg.content}
          deeplinks={msg.deeplinks as Record<string, DeeplinkRef> | undefined}
          linkClassName="chat-widget__deeplink"
        />
      </div>
      {msg.suggestions && msg.suggestions.length > 0 && (
        <div className="chat-widget__suggestions" role="group" aria-label="Opciones de respuesta">
          {msg.suggestions.map((s) => (
            <button
              key={`${s.field}-${s.value}`}
              type="button"
              className="chat-widget__suggestion-btn"
              onClick={() => onSuggestionClick(s)}
              disabled={suggestionsDisabled}
            >
              {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
