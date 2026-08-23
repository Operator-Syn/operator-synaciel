import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/app.css";
import App from "./App.tsx";
import GlobalHeadManager from "./components/globalHeadManager/GlobalHeadManager.tsx";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    {/* 3. Wrap your app with the Provider */}
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GlobalHeadManager />
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
