import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { VaquinhasProvider } from "./VaquinhasContext";
import { Dashboard } from "./pages/Dashboard";
import "./vaquinhas.css";

function routerBasename(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base.slice(0, -1) || "/" : base;
}

export function VaquinhasApp() {
  return (
    <VaquinhasProvider>
      <BrowserRouter basename={routerBasename()}>
        <div className="vaq-shell">
          <div className="vaq-shell__glow" aria-hidden />
          <Routes>
            <Route path="/vaquinhas" element={<Dashboard />} />
            <Route path="/vaquinhas/" element={<Dashboard />} />
            <Route path="/vaquinhas/*" element={<Navigate to="/vaquinhas" replace />} />
            <Route path="*" element={<Navigate to="/vaquinhas" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </VaquinhasProvider>
  );
}