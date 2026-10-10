import { Navigate } from "react-router-dom";

/**
 * Guard component that redirects when prerequisites are not met.
 * Returns <Navigate> directly — no ref mutation during render.
 *
 * @param {{ isAllowed: boolean, redirectTo: string, children: React.ReactNode }} props
 */
export default function ProtectedRoute({ isAllowed, redirectTo, children }) {
  if (!isAllowed) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}
