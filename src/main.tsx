import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/app.css";
import App from "./App.tsx";
import GlobalHeadManager from "./components/globalHeadManager/GlobalHeadManager.tsx";
import SitePreferencesProvider from "./components/sitePreferences/SitePreferencesProvider";
import { initializeSitePreferences } from "./preferences/sitePreferences";

initializeSitePreferences();

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <SitePreferencesProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter useTransitions={false}>
          <GlobalHeadManager />
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </SitePreferencesProvider>
  </StrictMode>,
);
