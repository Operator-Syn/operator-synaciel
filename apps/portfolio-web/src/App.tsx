import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import FloatingControlsDock from "./components/floatingControls/FloatingControlsDock";
import { FloatingControlsProvider } from "./components/floatingControls/FloatingControlsProvider";
import HomeSettings from "./components/homePage/HomeSettings";
import { LoadingBlock, LoadingRegion } from "./components/loadingState/LoadingState";
import NavBar from "./components/navBar/NavBar";
import PageTransition from "./components/pageTransition/PageTransition";
import PortfolioAssistantFab from "./components/portfolioAssistant/PortfolioAssistantEntry";
import QuickNavigation from "./components/quickNavigation/QuickNavigation";
import { brandName, navLinks as NavLinks, routes } from "./data/NavLinks.types";

const NotFound = lazy(() => import("./components/pages/notFoundPage/NotFound"));
const SnippetDocument = lazy(() => import("./components/pages/snippetsPage/SnippetDocument"));

function RouteLoadingFallback() {
  return (
    <LoadingRegion className="app-route-loading" label="Loading page">
      <LoadingBlock className="app-route-loading-block" />
    </LoadingRegion>
  );
}

export default function App() {
  return (
    <FloatingControlsProvider>
      <PageTransition>
        <NavBar brandName={brandName} links={NavLinks} />

        <main className="app-shell">
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/snippets/document/:id/:slug" element={<SnippetDocument />} />
              {routes.map((link) => {
                const Component = link.component;
                return (
                  <Route
                    key={link.path}
                    path={link.path === "/snippets" ? `${link.path}/*` : link.path}
                    element={Component ? <Component /> : null}
                  />
                );
              })}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>

        <FloatingControlsDock>
          <PortfolioAssistantFab />
          <HomeSettings />
          <QuickNavigation />
        </FloatingControlsDock>
      </PageTransition>
    </FloatingControlsProvider>
  );
}
