import { Outlet } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { BottomNav } from "../components/layout/BottomNav";
import { FloatingChatButton } from "../features/chat/FloatingChatButton";
import { ChatPanel } from "../features/chat/ChatPanel";
import { useAuth } from "../context/AuthContext";

export function MainLayout() {
  const { user } = useAuth();
  const showKamleAi = Boolean(user);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
      {showKamleAi && <FloatingChatButton />}
      {showKamleAi && <ChatPanel />}
    </div>
  );
}