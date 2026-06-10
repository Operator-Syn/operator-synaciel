import { Routes, Route } from "react-router-dom";
import { Fragment } from "react";
import NavBar from "./components/navBar/NavBar";
import { navLinks as NavLinks, brandName } from "./data/NavLinks.types";

export default function App() {
  return (
    <Fragment>
      <NavBar brandName={brandName} links={NavLinks} />
      
      <Routes>
        {NavLinks.map((link) => (
          <Route
            key={link.path}
            path={link.path === "/snippets" ? `${link.path}/*` : link.path}
            element={link.component ? <link.component /> : null}
          />
        ))}
      </Routes>

    </Fragment>
  );
}
