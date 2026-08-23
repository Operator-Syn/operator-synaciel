import { Fragment } from "react";
import { Route, Routes } from "react-router-dom";
import NavBar from "./components/navBar/NavBar";
import QuickNavigation from "./components/quickNavigation/QuickNavigation";
import { brandName, navLinks as NavLinks, routes } from "./data/NavLinks.types";

export default function App() {
  return (
    <Fragment>
      <NavBar brandName={brandName} links={NavLinks} />

      <div className="app-shell">
        <Routes>
          {routes.map((link) => (
            <Route
              key={link.path}
              path={link.path === "/snippets" ? `${link.path}/*` : link.path}
              element={link.component ? <link.component /> : null}
            />
          ))}
        </Routes>
      </div>

      <QuickNavigation />
    </Fragment>
  );
}
