import { Routes, Route } from "react-router-dom";
import { Fragment } from "react";
import NavBar from "./components/navBar/NavBar";
import QuickNavigation from "./components/quickNavigation/QuickNavigation";
import { routes, navLinks as NavLinks, brandName } from "./data/NavLinks.types";

export default function App() {
  return (
    <Fragment>
      <NavBar brandName={brandName} links={NavLinks} />
      
      <Routes>
        {routes.map((link) => (
          <Route
            key={link.path}
            path={link.path === "/snippets" ? `${link.path}/*` : link.path}
            element={link.component ? <link.component /> : null}
          />
        ))}
      </Routes>

      <QuickNavigation />

    </Fragment>
  );
}
