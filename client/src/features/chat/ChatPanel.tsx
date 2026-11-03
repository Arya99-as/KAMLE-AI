import {
  AlertTriangle,
  ArrowUp,
  Loader2,
  MessageSquare,
  PanelLeft,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  createChatConversation,
  deleteChatConversation,
  getChatConversation,
  listChatConversations,
  sendChatMessage,
} from "../../services/api";
import { ApiError } from "../../lib/api";
import type {
  ChatConversationSummary,
  ChatMessageRecord,
  ChatResponse,
  PublicWorker,
} from "../../types";
import { useChat } from "./ChatContext";
import { useAuth } from "../../context/AuthContext";
import { Badge, Button } from "../../components/ui/primitives";
import { formatPrice } from "../../lib/utils";
import { LogoMark } from "../../components/brand/Logo";

interface Bubble {
  role: "user" | "assistant";
  content: string;
  degraded?: boolean;
  workers?: PublicWorker[];
  total?: number;
}

const WELCOME =
  "Hi! I'm KAMLE AI. Tell me what you need help with and I'll help you find a suitable local worker.";
const SUGGESTIONS = [
  "My refrigerator is not cooling",
  "I need an electrician to repair a fan",
  "My bathroom tap is leaking in Kolhapur",
  "I want my house painted",
];
const PENDING_QUERY_KEY = "kamle_ai_pending_query";
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function toBubbles(messages: ChatMessageRecord[]): Bubble[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
}

function ConversationGroup({
  label,
  items,
  activeId,
  emptyHint,
  onOpen,
  onDelete,
}: {
  label: string;
  items: ChatConversationSummary[];
  activeId: string | null;
  emptyHint: string;
  onOpen: (id: string) => void;
  onDelete: (conversation: ChatConversationSummary) => void;
}) {
  return (
    <div className="mb-4">
      <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-[11px] text-muted/70">{emptyHint}</p>
      ) : (
        items.map((conversation) => {
          const active = conversation.conversationId === activeId;
          return (
            <div
              key={conversation.conversationId}
              className={`group mb-0.5 flex items-center gap-1 rounded-lg ${
                active ? "bg-brand-50" : "hover:bg-slate-50"
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(conversation.conversationId)}
                className="flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5 text-left"
                aria-current={active ? "true" : undefined}
              >
                <MessageSquare size={13} className="mt-0.5 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span
                    className={`block truncate text-xs ${
                      active ? "font-bold text-brand-800" : "font-medium text-ink"
                    }`}
                  >
                    {conversation.title}
                  </span>
                  <span className="block truncate text-[10px] text-muted">
                    {conversation.lastMessage ?? "No messages yet"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(conversation)}
                aria-label={`Delete ${conversation.title}`}
                title="Delete conversation"
                className="mr-1 shrink-0 rounded p-1 text-muted opacity-0 hover:bg-white hover:text-danger focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export function ChatPanel() {
  const { open, closeChat } = useChat();
  const { user } = useAuth();
  const isCustomer = user?.role === "customer";

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [thinking, setThinking] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, thinking, open]);

  // Account switch safety: never keep another customer's thread in memory.
  useEffect(() => {
    setBubbles([]);
    setConversations([]);
    setActiveId(null);
    activeIdRef.current = null;
    setInput("");
    setError(null);
    setSidebarOpen(false);
  }, [user?.id]);

  const refreshList = useCallback(async () => {
    try {
      const data = await listChatConversations({ limit: 50 });
      setConversations(data.items);
      return data.items;
    } catch {
      return [];
    }
  }, []);

  const openConversation = useCallback(async (id: string) => {
    // Do not switch threads while a reply is in flight, otherwise the reply
    // would be appended to the newly selected conversation.
    if (thinking) return;
    setLoadingThread(true);
    setError(null);
    try {
      const data = await getChatConversation(id);
      setActiveId(data.conversation.conversationId);
      activeIdRef.current = data.conversation.conversationId;
      setBubbles(toBubbles(data.conversation.messages));
      setSidebarOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingThread(false);
    }
  }, [thinking]);

  // When the panel opens, load only this customer's conversations and restore
  // the last selected one (or the most recently updated one).
  useEffect(() => {
    if (!open || !isCustomer) return;
    let cancelled = false;

    (async () => {
      setLoadingList(true);
      setError(null);
      try {
        const data = await listChatConversations({ limit: 50 });
        if (cancelled) return;
        setConversations(data.items);

        const pending = sessionStorage.getItem(PENDING_QUERY_KEY);
        if (pending) {
          sessionStorage.removeItem(PENDING_QUERY_KEY);
          setInput(pending);
        }

        const preferredId =
          activeIdRef.current && data.items.some((c) => c.conversationId === activeIdRef.current)
            ? activeIdRef.current
            : data.items[0]?.conversationId ?? null;

        if (preferredId) {
          const detail = await getChatConversation(preferredId);
          if (cancelled) return;
          setActiveId(detail.conversation.conversationId);
          activeIdRef.current = detail.conversation.conversationId;
          setBubbles(toBubbles(detail.conversation.messages));
        } else {
          setActiveId(null);
          activeIdRef.current = null;
          setBubbles([]);
        }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, isCustomer, user?.id]);

  async function startNewChat() {
    if (thinking) return;
    const current = conversations.find((c) => c.conversationId === activeId);
    if (current && current.messageCount === 0) {
      setBubbles([]);
      setSidebarOpen(false);
      return;
    }

    setError(null);
    try {
      const data = await createChatConversation({});
      setConversations((prev) => [data.conversation, ...prev]);
      setActiveId(data.conversation.conversationId);
      activeIdRef.current = data.conversation.conversationId;
      setBubbles([]);
      setInput("");
      setSidebarOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleSend(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || thinking || loadingThread) return;
    setInput("");
    setError(null);
    setBubbles((prev) => [...prev, { role: "user", content: text }]);
    setThinking(true);

    try {
      const res: ChatResponse = await sendChatMessage({
        conversationId: activeId ?? undefined,
        message: text,
      });
      setActiveId(res.conversationId);
      activeIdRef.current = res.conversationId;
      setBubbles((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, degraded: res.degraded },
        ...(res.workers.length > 0
          ? [
              {
                role: "assistant" as const,
                content: `Here are ${res.matchSummary?.total ?? res.workers.length} approved worker${
                  (res.matchSummary?.total ?? 0) > 1 ? "s" : ""
                } we found for you.`,
                workers: res.workers,
                total: res.matchSummary?.total ?? res.workers.length,
              },
            ]
          : []),
      ]);
      void refreshList();
    } catch (e) {
      setError(errorMessage(e));
      setBubbles((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I couldn't complete that request just now. You can still browse approved workers on the Discover page or try again.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function handleDelete(conversation: ChatConversationSummary) {
    if (thinking) return;
    const confirmed = window.confirm(
      `Delete "${conversation.title}"? This removes the conversation permanently.`,
    );
    if (!confirmed) return;

    try {
      await deleteChatConversation(conversation.conversationId);
      setConversations((prev) =>
        prev.filter((c) => c.conversationId !== conversation.conversationId),
      );
      if (activeIdRef.current === conversation.conversationId) {
        setActiveId(null);
        activeIdRef.current = null;
        setBubbles([]);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void handleSend();
  }

  if (!open || !isCustomer) return null;

  const now = Date.now();
  const recent = conversations.filter(
    (c) => c.status === "ACTIVE" && now - new Date(c.updatedAt).getTime() <= RECENT_WINDOW_MS,
  );
  const previous = conversations.filter((c) => !recent.includes(c));
  const showWelcome = bubbles.length === 0 && !loadingThread;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white md:inset-auto md:bottom-24 md:right-6 md:h-[640px] md:max-h-[86vh] md:w-[700px] md:rounded-2xl md:border md:border-line md:shadow-lift">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 text-white">
        <LogoMark size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold">
            KAMLE AI <Sparkles size={14} className="text-amber-300" />
          </div>
          <div className="truncate text-xs text-white/80">
            Your private conversations · discover the right worker
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 md:hidden"
          aria-label="Toggle conversation list"
        >
          <PanelLeft size={18} />
        </button>
        <button
          onClick={() => void startNewChat()}
          className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
          aria-label="New chat"
          title="New chat"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={closeChat}
          className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
          aria-label="Close chat"
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "absolute inset-0 z-20 flex" : "hidden"
          } w-full flex-col border-r border-line bg-white md:static md:z-auto md:flex md:w-[235px] md:shrink-0`}
        >
          <div className="border-b border-line p-3">
            <button
              type="button"
              onClick={() => void startNewChat()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus size={16} /> New Chat
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {loadingList ? (
              <p className="flex items-center gap-2 px-2 text-xs text-muted">
                <Loader2 size={13} className="animate-spin" /> Loading conversations…
              </p>
            ) : (
              <>
                <ConversationGroup
                  label="Recent Conversations"
                  items={recent}
                  activeId={activeId}
                  emptyHint="Your latest chats will appear here."
                  onOpen={(id) => void openConversation(id)}
                  onDelete={(c) => void handleDelete(c)}
                />
                <ConversationGroup
                  label="Previous Conversations"
                  items={previous}
                  activeId={activeId}
                  emptyHint="Older and archived chats appear here."
                  onOpen={(id) => void openConversation(id)}
                  onDelete={(c) => void handleDelete(c)}
                />
              </>
            )}
          </div>

          <p className="border-t border-line px-3 py-2 text-[10px] leading-relaxed text-muted">
            Only conversations owned by your account are shown.
          </p>
        </aside>

        {/* Thread */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto bg-canvas px-4 py-4">
            {showWelcome && (
              <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-5 text-center shadow-sm">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ai-light text-ai">
                  <Sparkles size={20} />
                </span>
                <h3 className="mt-3 text-base font-bold text-ink">Welcome to KAMLE AI</h3>
                <p className="mt-1 text-sm text-muted">{WELCOME}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void handleSend(s)}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted hover:border-brand-300 hover:text-brand-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingThread && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" /> Loading conversation…
              </div>
            )}

            {bubbles.map((b, i) =>
              b.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
                    {b.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ai-light text-ai">
                    <Sparkles size={15} />
                  </span>
                  <div className="min-w-0 max-w-[85%] space-y-2">
                    <div className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm">
                      {b.content}
                      {b.degraded && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning">
                          <AlertTriangle size={11} /> AI provider unavailable — using built-in
                          understanding.
                        </p>
                      )}
                    </div>
                    {b.workers && b.workers.length > 0 && (
                      <div className="space-y-2">
                        {b.workers.map((w) => (
                          <div
                            key={w.workerId}
                            className="rounded-xl border border-line bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Link
                                to={`/workers/${w.workerId}`}
                                className="text-sm font-bold hover:text-brand-700"
                              >
                                {w.name}
                              </Link>
                              <Badge tone="brand">{formatPrice(w.pricing)}</Badge>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted">
                              {w.professionalDescription}
                            </p>
                            {w.reasons && w.reasons.length > 0 && (
                              <p className="mt-2 rounded-lg bg-ai-light px-2.5 py-1.5 text-xs text-ai">
                                <span className="font-semibold">Why:</span> {w.reasons.join(" · ")}
                              </p>
                            )}
                            <Link
                              to={`/workers/${w.workerId}`}
                              className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:underline"
                              onClick={closeChat}
                            >
                              View profile →
                            </Link>
                          </div>
                        ))}
                        <p className="pt-1 text-center text-xs font-semibold text-muted">
                          {b.total && b.total > b.workers.length
                            ? `${b.total} matching workers — refine your search to narrow down.`
                            : "These are matched using actual profile data."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {thinking && (
              <div className="flex gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ai-light text-ai">
                  <Sparkles size={15} />
                </span>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-sm">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ai" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ai [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ai [animation-delay:240ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-line bg-white px-4 pb-4 pt-3">
            {error && <p className="mb-2 text-xs text-danger">{error}</p>}
            <p className="mb-2 flex items-center gap-1 text-[11px] text-muted">
              <UserRound size={11} /> You're signed in. I only show approved workers from KAMLE AI —
              I never make up profiles, prices or reviews.
            </p>
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your problem..."
                className="input flex-1"
                aria-label="Describe your problem"
                disabled={thinking || loadingThread}
              />
              <Button
                type="submit"
                disabled={thinking || loadingThread || !input.trim()}
                className="px-3.5"
                aria-label="Send message"
              >
                <ArrowUp size={18} />
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
