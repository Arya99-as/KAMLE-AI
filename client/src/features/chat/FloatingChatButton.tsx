import { Sparkles, X } from "lucide-react";
import { useChat } from "./ChatContext";
import { useAuth } from "../../context/AuthContext";

export function FloatingChatButton() {
  const { open, openChat, closeChat } = useChat();
  const { isAuthenticated } = useAuth();
  const label = isAuthenticated ? undefined : "Login to chat";

  return (
    <>
      {!open && !isAuthenticated && (
        <a
          href="/login"
          className="btn-ai fixed bottom-20 right-4 z-40 rounded-full px-4 py-3 shadow-lift md:bottom-6 md:right-6"
          aria-label={label}
        >
          <Sparkles size={18} /> Ask KAMLE AI
        </a>
      )}
      {!open && isAuthenticated && (
        <button
          onClick={openChat}
          className="btn-ai fixed bottom-20 right-4 z-40 rounded-full px-4 py-3 shadow-lift md:bottom-6 md:right-6"
          aria-label="Open KAMLE AI chat"
        >
          <Sparkles size={18} /> Ask KAMLE AI
        </button>
      )}
      {open && (
        <button
          onClick={closeChat}
          className="fixed bottom-20 right-4 z-[60] hidden rounded-full bg-white p-3 text-muted shadow-lift ring-1 ring-line md:bottom-6 md:right-6 md:inline-flex"
          aria-label="Close KAMLE AI chat"
        >
          <X size={18} />
        </button>
      )}
    </>
  );
}