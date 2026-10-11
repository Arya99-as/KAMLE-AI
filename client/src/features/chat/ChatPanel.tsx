import { AlertTriangle, ArrowUp, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { sendChatMessage } from "../../services/api";
import { ApiError } from "../../lib/api";
import type { ChatResponse, PublicWorker } from "../../types";
import { useChat } from "./ChatContext";
import { useAuth } from "../../context/AuthContext";
import { Badge, Button } from "../../components/ui/primitives";
import { formatPrice } from "../../lib/utils";
import { LogoMark } from "../../components/brand/Logo";

interface Bubble {
  role: "user" | "assistant";
  content: string;
  degraded?: boolean;
}

interface ResultBubble extends Bubble {
  workers: PublicWorker[];
  total: number;
}

const GREETING = "Hi! I'm KAMLE AI. Tell me what you need help with, and I'll help you find a suitable local worker.";

const SUGGESTIONS = ["My refrigerator is not cooling", "I need an electrician to repair a fan", "My bathroom tap is leaking in Kolhapur", "I want my house painted"];

export function ChatPanel() {
  const { open, closeChat } = useChat();
  const { isAuthenticated } = useAuth();
  const [bubbles, setBubbles] = useState<(Bubble | ResultBubble)[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [sessionKey, setSessionKey] = useState<string | undefined>();
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, thinking, open]);

  useEffect(() => {
    if (!open) return;
    setBubbles([{ role: "assistant", content: GREETING }]);
    setSessionKey(undefined);
    setError(null);
    const pending = sessionStorage.getItem("kamle_ai_pending_query");
    if (pending) {
      sessionStorage.removeItem("kamle_ai_pending_query");
      setInput(pending);
    }
  }, [open]);

  async function handleSend(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || thinking) return;
    setInput("");
    setError(null);
    setBubbles((prev) => [...prev, { role: "user", content: text }]);
    setThinking(true);

    try {
      const res: ChatResponse = await sendChatMessage(sessionKey, text);
      setSessionKey(res.sessionKey);

      setBubbles((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, degraded: res.degraded },
        ...(res.workers.length > 0 ? [{ role: "assistant" as const, content: `Here are ${res.matchSummary?.total ?? res.workers.length} approved worker${(res.matchSummary?.total ?? 0) > 1 ? "s" : ""} we found for you.`, workers: res.workers, total: res.matchSummary?.total ?? res.workers.length }] : []),
      ]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
      setError(msg);
      setBubbles((prev) => [...prev, { role: "assistant", content: "I couldn't check the worker list just now. You can still browse approved workers on the Discover page or try again." }]);
    } finally {
      setThinking(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void handleSend();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white md:inset-auto md:bottom-24 md:right-6 md:h-[620px] md:max-h-[82vh] md:w-[400px] md:rounded-2xl md:border md:border-line md:shadow-lift">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 text-white">
        <LogoMark size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold">
            KAMLE AI <Sparkles size={14} className="text-amber-300" />
          </div>
          <div className="truncate text-xs text-white/80">Describe your problem · discover the right worker</div>
        </div>
        <button onClick={closeChat} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10" aria-label="Close chat">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-canvas px-4 py-4">
        {bubbles.map((b, i) =>
          b.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2.5 text-sm text-white shadow-sm">{b.content}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ai-light text-ai">
                <Sparkles size={15} />
              </span>
              <div className="max-w-[85%] space-y-2">
                <div className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm">
                  {b.content}
                  {b.degraded && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning">
                      <AlertTriangle size={11} /> AI provider unavailable — using built-in understanding.
                    </p>
                  )}
                </div>
                {"workers" in b && b.workers.length > 0 && (
                  <div className="space-y-2">
                    {b.workers.map((w) => (
                      <div key={w.workerId} className="rounded-xl border border-line bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <Link to={`/workers/${w.workerId}`} className="text-sm font-bold hover:text-brand-700">
                            {w.name}
                          </Link>
                          <Badge tone="brand">{formatPrice(w.pricing)}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{w.professionalDescription}</p>
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
                      {b.total > b.workers.length ? `${b.total} matching workers — refine your search to narrow down.` : "These are matched using actual profile data."}
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

      {/* Suggestions + input */}
      <div className="border-t border-line bg-white px-4 pb-4 pt-3">
        {bubbles.length <= 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => void handleSend(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted hover:border-brand-300 hover:text-brand-700">
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mb-2 text-xs text-danger">{error}</p>}
        {isAuthenticated && (
          <p className="mb-2 flex items-center gap-1 text-[11px] text-muted">
            <UserRound size={11} /> You're signed in. I only show approved workers from KAMLE AI — I never make up profiles, prices or reviews.
          </p>
        )}
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your problem..."
            className="input flex-1"
            aria-label="Describe your problem"
            disabled={thinking}
          />
          <Button type="submit" disabled={thinking || !input.trim()} className="px-3.5" aria-label="Send message">
            <ArrowUp size={18} />
          </Button>
        </form>
      </div>
    </div>
  );
}