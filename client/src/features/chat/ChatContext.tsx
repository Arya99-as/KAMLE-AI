import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";

interface ChatContextValue {
  open: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Close the panel whenever the signed-in account changes so a second
  // customer can never see the previous customer's thread on screen.
  useEffect(() => {
    setOpen(false);
  }, [user?.id]);

  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);
  const toggleChat = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(() => ({ open, openChat, closeChat, toggleChat }), [open, openChat, closeChat, toggleChat]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}