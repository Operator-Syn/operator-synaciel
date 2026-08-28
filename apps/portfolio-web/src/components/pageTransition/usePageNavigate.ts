import { useCallback } from "react";
import { type NavigateOptions, type To, useLocation, useNavigate } from "react-router-dom";
import { navigateThroughTransition } from "./pageTransitionNavigation";

export default function usePageNavigate() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (to: To, options?: NavigateOptions) =>
      navigateThroughTransition(navigate, location.pathname, to, options),
    [location.pathname, navigate],
  );
}
