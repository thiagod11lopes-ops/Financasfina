import type { VaquinhasPersisted } from "./types";

const KEY = "vaquinhas:v1";

export function loadVaquinhas(): VaquinhasPersisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { version: 1, items: [] };
    const parsed = JSON.parse(raw) as VaquinhasPersisted;
    if (!parsed || parsed.version !== 1) return { version: 1, items: [] };
    return parsed;
  } catch {
    return { version: 1, items: [] };
  }
}

export function saveVaquinhas(p: VaquinhasPersisted) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

