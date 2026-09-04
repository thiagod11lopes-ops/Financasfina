import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Vaquinha, VaquinhasPersisted } from "./types";
import { uid } from "./utils";
import { loadVaquinhas, saveVaquinhas } from "./storage";

type VaquinhasCtx = {
  items: Vaquinha[];
  createVaquinha: (name: string, expectedCents: number) => void;
  updateVaquinha: (id: string, patch: Partial<Pick<Vaquinha, "name" | "expectedCents" | "paidCents">>) => void;
  deleteVaquinha: (id: string) => void;
};

const VaquinhasContext = createContext<VaquinhasCtx | null>(null);

export function useVaquinhas() {
  const v = useContext(VaquinhasContext);
  if (!v) throw new Error("useVaquinhas must be used inside VaquinhasProvider");
  return v;
}

export function VaquinhasProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Vaquinha[]>(() => loadVaquinhas().items);

  useEffect(() => {
    const p: VaquinhasPersisted = { version: 2, items };
    saveVaquinhas(p);
  }, [items]);

  const createVaquinha = useCallback((name: string, expectedCents: number) => {
    const n = name.trim();
    if (!n || expectedCents <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        id: uid("vaq"),
        name: n,
        expectedCents,
        paidCents: 0,
        createdAtIso: new Date().toISOString(),
      },
    ]);
  }, []);

  const updateVaquinha = useCallback(
    (id: string, patch: Partial<Pick<Vaquinha, "name" | "expectedCents" | "paidCents">>) => {
      setItems((prev) =>
        prev.map((v) => {
          if (v.id !== id) return v;
          const next = { ...v, ...patch };
          if (next.expectedCents < 0) next.expectedCents = 0;
          if (next.paidCents < 0) next.paidCents = 0;
          if (next.paidCents > next.expectedCents) next.paidCents = next.expectedCents;
          return next;
        }),
      );
    },
    [],
  );

  const deleteVaquinha = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const value = useMemo(
    () => ({ items, createVaquinha, updateVaquinha, deleteVaquinha }),
    [items, createVaquinha, updateVaquinha, deleteVaquinha],
  );

  return <VaquinhasContext.Provider value={value}>{children}</VaquinhasContext.Provider>;
}