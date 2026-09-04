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
        <div className="min-h-screen bg-slate-950 text-slate-100 relative">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.25)_0%,rgba(6,182,212,0.18)_45%,transparent_70%)]" />
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