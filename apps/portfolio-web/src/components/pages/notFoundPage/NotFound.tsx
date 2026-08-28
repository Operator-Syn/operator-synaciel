import { ArrowLeft, Compass, Home as HomeIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import CookingArea from "../../cookingArea/CookingArea";
import GlobalHeadManager from "../../globalHeadManager/GlobalHeadManager";
import TransitionNavLink from "../../pageTransition/TransitionNavLink";
import PointerCoordinates from "../../pointerCoordinates/PointerCoordinates";
import "./NotFound.css";

const NOT_FOUND_DESCRIPTION =
  "The requested Syn-Forge page could not be found. Return to the portfolio home or open the public AI guide.";

export default function NotFound() {
  const { pathname } = useLocation();
  const requestedPath = pathname || "/";

  return (
    <>
      <GlobalHeadManager
        description={NOT_FOUND_DESCRIPTION}
        robots="noindex, nofollow"
        title="Page not found"
      />

      <CookingArea>
        <main aria-labelledby="not-found-title" className="not-found-page">
          <PointerCoordinates className="not-found-coordinates" markerCount={0} />

          <section className="not-found-panel">
            <div className="not-found-copy">
              <p className="not-found-kicker">404 / Route not found</p>
              <h1 id="not-found-title">Nothing at this address.</h1>
              <p className="not-found-lede">
                This route is not part of the public portfolio. Try a known page or read the AI
                guide for the public MCP.
              </p>
              <code className="not-found-path">{requestedPath}</code>
              <div className="not-found-actions">
                <TransitionNavLink className="not-found-link" to="/">
                  <HomeIcon aria-hidden="true" size={16} />
                  Back home
                </TransitionNavLink>
                <TransitionNavLink className="not-found-link secondary" to="/ai">
                  <Compass aria-hidden="true" size={16} />
                  Open AI guide
                </TransitionNavLink>
              </div>
            </div>

            <div aria-hidden="true" className="not-found-mark">
              <span>404</span>
              <small>NO ROUTE / FOUND</small>
              <ArrowLeft size={42} strokeWidth={1} />
            </div>
          </section>
        </main>
      </CookingArea>
    </>
  );
}
