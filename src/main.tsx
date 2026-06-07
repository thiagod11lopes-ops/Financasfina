import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FinanceProvider } from "./context/FinanceContext";
import { AuthProvider } from "./firebase/AuthProvider";
import { getFirebaseAuth, resolveGoogleRedirectOnce } from "./firebase/auth";
import { isFirebaseConfigured } from "./firebase/config";
import { UserDocCloudProvider } from "./firebase/userDocCloud";
import App from "./App";
import "./index.css";

if (isFirebaseConfigured()) {
  const auth = getFirebaseAuth();
  if (auth) void resolveGoogleRedirectOnce(auth);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <FinanceProvider>
        <UserDocCloudProvider>
          <App />
        </UserDocCloudProvider>
      </FinanceProvider>
    </AuthProvider>
  </StrictMode>,
);
