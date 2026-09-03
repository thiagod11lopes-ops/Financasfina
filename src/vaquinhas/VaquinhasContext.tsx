import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Vaquinha, VaquinhaTitle, VaquinhasPersisted } from "./types";
import type { TitleStatus } from "./types";
import { uid } from "./utils";
import { loadVaquinhas, saveVaquinhas } from "./storage";

type VaquinhasCtx = {
  items: Vaquinha[];
  createVaquinha: (name: string) => void;
  deleteVaquinha: (id: string) => void;

  addTitle: (vaquinhaId: string, t: Omit<VaquinhaTitle, "id" | "status" | "paidAtIso">) => void;
  toggleTitleStatus: (vaquinhaId: string, titleId: string) => void;
  removeTitle: (vaquinhaId: string, titleId: string) => void;

  getVaquinhaById: (id: string) => Vaquinha | undefined;
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
    const p: VaquinhasPersisted = { version: 1, items };
    saveVaquinhas(p);
  }, [items]);

  const createVaquinha = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setItems((prev) => [
      ...prev,
      {
        id: uid("vaq"),
        name: n,
        createdAtIso: new Date().toISOString(),
        titles: [],
      },
    ]);
  }, []);

  const deleteVaquinha = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addTitle = useCallback(
    (vaquinhaId: string, t: Omit<VaquinhaTitle, "id" | "status" | "paidAtIso">) => {
      setItems((prev) =>
        prev.map((v) => {
          if (v.id !== vaquinhaId) return v;
          const title: VaquinhaTitle = {
            ...t,
            id: uid("t"),
            status: "pending",
            paidAtIso: undefined,
          };
          return { ...v, titles: [...v.titles, title] };
        }),
      );
    },
    [],
  );

  const toggleTitleStatus = useCallback((vaquinhaId: string, titleId: string) => {
    setItems((prev) =>
      prev.map((v) => {
        if (v.id !== vaquinhaId) return v;
        return {
          ...v,
          titles: v.titles.map((t) => {
            if (t.id !== titleId) return t;
            const next: TitleStatus = t.status === "paid" ? "pending" : "paid";
            return {
              ...t,
              status: next,
              paidAtIso: next === "paid" ? new Date().toISOString() : undefined,
            };
          }),
        };
      }),
    );
  }, []);

  const removeTitle = useCallback((vaquinhaId: string, titleId: string) => {
    setItems((prev) =>
      prev.map((v) => {
        if (v.id !== vaquinhaId) return v;
        return { ...v, titles: v.titles.filter((t) => t.id !== titleId) };
      }),
    );
  }, []);

  const getVaquinhaById = useCallback(
    (id: string) => items.find((x) => x.id === id),
    [items],
  );

  const value = useMemo(
    () => ({ items, createVaquinha, deleteVaquinha, addTitle, toggleTitleStatus, removeTitle, getVaquinhaById }),
    [items, createVaquinha, deleteVaquinha, addTitle, toggleTitleStatus, removeTitle, getVaquinhaById],
  );

  return <VaquinhasContext.Provider value={value}>{children}</VaquinhasContext.Provider>;
}


