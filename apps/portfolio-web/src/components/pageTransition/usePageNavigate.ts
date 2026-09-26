import { useCallback, useContext } from "react";
import { type NavigateOptions, type To, useLocation, useNavigate } from "react-router-dom";
import { PageTransitionNavigationContext } from "./pageTransitionNavigation";

export default function usePageNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const transitionCoordinator = useContext(PageTransitionNavigationContext);

  return useCallback(
    (to: To, options?: NavigateOptions) => {
      if (transitionCoordinator) {
        return transitionCoordinator(navigate, location.pathname, to, options);
      }

      return navigate(to, options);
    },
    [location.pathname, navigate, transitionCoordinator],
  );
}
