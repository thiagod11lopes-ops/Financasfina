import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useUserDocCloud } from "../firebase/userDocCloud";
import type {
  PersonStatus,
  Vaquinha,
  VaquinhaInput,
  VaquinhaPerson,
  VaquinhasPersisted,
} from "./types";
import { uid } from "./utils";
import { loadVaquinhas, saveVaquinhas, VAQUINHAS_SYNC_EVENT } from "./storage";

type VaquinhasCtx = {
  items: Vaquinha[];
  createVaquinha: (input: VaquinhaInput) => string | null;
  updateVaquinha: (id: string, patch: Partial<VaquinhaInput>) => void;
  deleteVaquinha: (id: string) => void;
  addPerson: (vaquinhaId: string, name: string) => void;
  updatePerson: (
    vaquinhaId: string,
    personId: string,
    patch: Partial<Pick<VaquinhaPerson, "name" | "status">>,
  ) => void;
  setPersonStatus: (vaquinhaId: string, personId: string, status: PersonStatus) => void;
  removePerson: (vaquinhaId: string, personId: string) => void;
  getVaquinhaById: (id: string) => Vaquinha | undefined;
};

const VaquinhasContext = createContext<VaquinhasCtx | null>(null);

export function useVaquinhas() {
  const v = useContext(VaquinhasContext);
  if (!v) throw new Error("useVaquinhas must be used inside VaquinhasProvider");
  return v;
}

export function VaquinhasProvider({ children }: { children: React.ReactNode }) {
  const cloud = useUserDocCloud();
  const [items, setItems] = useState<Vaquinha[]>(() => loadVaquinhas().items);
  const hydratedRef = useRef(false);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      applyingRemoteRef.current = true;
      setItems(loadVaquinhas().items);
    };
    window.addEventListener(VAQUINHAS_SYNC_EVENT, sync);
    return () => window.removeEventListener(VAQUINHAS_SYNC_EVENT, sync);
  }, []);

  useEffect(() => {
    const p: VaquinhasPersisted = { version: 4, items };
    saveVaquinhas(p, { silent: true });
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    cloud.scheduleVaquinhasPush(p);
  }, [items, cloud]);

  const createVaquinha = useCallback((input: VaquinhaInput) => {
    const name = input.name.trim();
    if (!name || input.totalCents <= 0 || input.perPersonCents <= 0) return null;
    if (input.period.kind === "range") {
      if (!input.period.startDateIso || !input.period.endDateIso) return null;
      if (input.period.endDateIso < input.period.startDateIso) return null;
    }
    if (input.period.kind === "monthly") {
      if (!input.period.year || input.period.month < 1 || input.period.month > 12) return null;
    }
    if (input.period.kind === "yearly") {
      if (!input.period.year) return null;
    }
    const id = uid("vaq");
    setItems((prev) => [
      {
        id,
        name,
        totalCents: input.totalCents,
        perPersonCents: input.perPersonCents,
        period: input.period,
        people: [],
        createdAtIso: new Date().toISOString(),
      },
      ...prev,
    ]);
    return id;
  }, []);

  const updateVaquinha = useCallback((id: string, patch: Partial<VaquinhaInput>) => {
    setItems((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const next: Vaquinha = {
          ...v,
          ...(patch.name != null ? { name: patch.name.trim() || v.name } : {}),
          ...(patch.totalCents != null ? { totalCents: Math.max(0, patch.totalCents) } : {}),
          ...(patch.perPersonCents != null
            ? { perPersonCents: Math.max(0, patch.perPersonCents) }
            : {}),
          ...(patch.period != null ? { period: patch.period } : {}),
        };
        return next;
      }),
    );
  }, []);

  const deleteVaquinha = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addPerson = useCallback((vaquinhaId: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    setItems((prev) =>
      prev.map((v) => {
        if (v.id !== vaquinhaId) return v;
        return {
          ...v,
          people: [...v.people, { id: uid("p"), name: n, status: "pending" }],
        };
      }),
    );
  }, []);

  const updatePerson = useCallback(
    (vaquinhaId: string, personId: string, patch: Partial<Pick<VaquinhaPerson, "name" | "status">>) => {
      setItems((prev) =>
        prev.map((v) => {
          if (v.id !== vaquinhaId) return v;
          return {
            ...v,
            people: v.people.map((p) => {
              if (p.id !== personId) return p;
              const next = { ...p, ...patch };
              if (typeof next.name === "string") next.name = next.name.trim() || p.name;
              return next;
            }),
          };
        }),
      );
    },
    [],
  );

  const setPersonStatus = useCallback((vaquinhaId: string, personId: string, status: PersonStatus) => {
    setItems((prev) =>
      prev.map((v) => {
        if (v.id !== vaquinhaId) return v;
        return {
          ...v,
          people: v.people.map((p) => (p.id === personId ? { ...p, status } : p)),
        };
      }),
    );
  }, []);

  const removePerson = useCallback((vaquinhaId: string, personId: string) => {
    setItems((prev) =>
      prev.map((v) => {
        if (v.id !== vaquinhaId) return v;
        return { ...v, people: v.people.filter((p) => p.id !== personId) };
      }),
    );
  }, []);

  const getVaquinhaById = useCallback((id: string) => items.find((x) => x.id === id), [items]);

  const value = useMemo(
    () => ({
      items,
      createVaquinha,
      updateVaquinha,
      deleteVaquinha,
      addPerson,
      updatePerson,
      setPersonStatus,
      removePerson,
      getVaquinhaById,
    }),
    [
      items,
      createVaquinha,
      updateVaquinha,
      deleteVaquinha,
      addPerson,
      updatePerson,
      setPersonStatus,
      removePerson,
      getVaquinhaById,
    ],
  );

  return <VaquinhasContext.Provider value={value}>{children}</VaquinhasContext.Provider>;
}