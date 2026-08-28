import { Route, Routes } from "react-router-dom";
import NavBar from "./components/navBar/NavBar";
import NotFound from "./components/pages/notFoundPage/NotFound";
import SnippetDocument from "./components/pages/snippetsPage/SnippetDocument";
import PageTransition from "./components/pageTransition/PageTransition";
import QuickNavigation from "./components/quickNavigation/QuickNavigation";
import { brandName, navLinks as NavLinks, routes } from "./data/NavLinks.types";

export default function App() {
  return (
    <PageTransition>
      <NavBar brandName={brandName} links={NavLinks} />

      <div className="app-shell">
        <Routes>
          <Route path="/snippets/document/:id/:slug" element={<SnippetDocument />} />
          {routes.map((link) => (
            <Route
              key={link.path}
              path={link.path === "/snippets" ? `${link.path}/*` : link.path}
              element={link.component ? <link.component /> : null}
            />
          ))}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>

      <QuickNavigation />
    </PageTransition>
  );
}
