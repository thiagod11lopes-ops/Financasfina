import type { AppState } from "../types";

/** Janela em que entidades criadas localmente ainda não confirmadas no servidor são preservadas ao fundir com o snapshot. */
export const LOCAL_ENTITY_BIRTH_WINDOW_MS = 15 * 60 * 1000;

function isRecentBirth(id: string, birth: Map<string, number>, now: number): boolean {
  const t = birth.get(id);
  if (t == null) return false;
  return now - t < LOCAL_ENTITY_BIRTH_WINDOW_MS;
}

/** Remove marcas de “criado localmente” quando o servidor já devolve esse id no payload. */
export function pruneBirthRefForIdsAckedInRemote(birth: Map<string, number>, remote: AppState): void {
  const seen = new Set<string>();
  for (const m of remote.movements) seen.add(m.id);
  for (const e of remote.futureIncomes) seen.add(e.id);
  for (const a of remote.fixedAccounts) seen.add(a.id);
  for (const a of remote.variableAccounts) {
    seen.add(a.id);
    for (const s of a.spends ?? []) seen.add(s.id);
  }
  for (const e of remote.supermarket) seen.add(e.id);
  for (const e of remote.fuel) seen.add(e.id);
  for (const id of [...birth.keys()]) {
    if (seen.has(id)) birth.delete(id);
  }
}

function collectAllIds(s: AppState): Set<string> {
  const out = new Set<string>();
  for (const m of s.movements) out.add(m.id);
  for (const e of s.futureIncomes) out.add(e.id);
  for (const a of s.fixedAccounts) out.add(a.id);
  for (const a of s.variableAccounts) {
    out.add(a.id);
    for (const sp of a.spends ?? []) out.add(sp.id);
  }
  for (const e of s.supermarket) out.add(e.id);
  for (const e of s.fuel) out.add(e.id);
  return out;
}

/** Remove entradas do mapa de nascimento que já não existem no estado local (ex.: apagadas). */
export function pruneOrphanBirthIds(birth: Map<string, number>, local: AppState): void {
  const ids = collectAllIds(local);
  for (const k of [...birth.keys()]) {
    if (!ids.has(k)) birth.delete(k);
  }
}

/**
 * Funde o estado remoto (revived) com alterações locais muito recentes ainda não vistas no servidor,
 * evita perder contas / entradas futuras / etc. quando outro dispositivo escreve primeiro no Firestore.
 */
export function mergeRemotePreservingPendingUploads(
  local: AppState,
  remote: AppState,
  birth: Map<string, number>,
  now: number,
): AppState {
  const rid = new Set(remote.movements.map((m) => m.id));
  const extraMov = local.movements.filter(
    (m) => !rid.has(m.id) && isRecentBirth(m.id, birth, now),
  );
  const movements = [...remote.movements, ...extraMov];

  const rfi = new Set(remote.futureIncomes.map((e) => e.id));
  const extraFi = local.futureIncomes.filter(
    (e) => !rfi.has(e.id) && isRecentBirth(e.id, birth, now),
  );
  const futureIncomes = [...remote.futureIncomes, ...extraFi];

  const rfx = new Set(remote.fixedAccounts.map((a) => a.id));
  const extraFx = local.fixedAccounts.filter(
    (a) => !rfx.has(a.id) && isRecentBirth(a.id, birth, now),
  );
  const fixedAccounts = [...remote.fixedAccounts, ...extraFx];

  const rva = new Set(remote.variableAccounts.map((a) => a.id));
  const extraAcc = local.variableAccounts.filter(
    (a) => !rva.has(a.id) && isRecentBirth(a.id, birth, now),
  );
  const mergedAccounts = remote.variableAccounts.map((r) => {
    const l = local.variableAccounts.find((x) => x.id === r.id);
    if (!l) return r;
    const rs = new Set((r.spends ?? []).map((s) => s.id));
    const extraSp = (l.spends ?? []).filter(
      (s) => !rs.has(s.id) && isRecentBirth(s.id, birth, now),
    );
    return { ...r, spends: [...(r.spends ?? []), ...extraSp] };
  });
  const variableAccounts = [...mergedAccounts, ...extraAcc];

  const rs = new Set(remote.supermarket.map((e) => e.id));
  const extraS = local.supermarket.filter(
    (e) => !rs.has(e.id) && isRecentBirth(e.id, birth, now),
  );
  const supermarket = [...remote.supermarket, ...extraS];

  const rf = new Set(remote.fuel.map((e) => e.id));
  const extraF = local.fuel.filter((e) => !rf.has(e.id) && isRecentBirth(e.id, birth, now));
  const fuel = [...remote.fuel, ...extraF];

  return {
    movements,
    fixedAccounts,
    variableAccounts,
    supermarket,
    fuel,
    futureIncomes,
  };
}
