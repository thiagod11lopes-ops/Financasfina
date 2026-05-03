import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FinanceProvider } from "./context/FinanceContext";
import { AuthProvider } from "./firebase/AuthProvider";
import { UserDocCloudProvider } from "./firebase/userDocCloud";
import App from "./App";
import "./index.css";

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
