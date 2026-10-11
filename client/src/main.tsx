import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import { LocationProvider } from "./context/LocationContext";
import { ChatProvider } from "./features/chat/ChatContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);