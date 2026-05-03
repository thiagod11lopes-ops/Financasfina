import type {
  AppState,
  FixedAccount,
  FutureIncomeEntry,
  Movement,
  VariableAccount,
} from "../types";

export const FINANCES_EMPTY_STATE: AppState = {
  movements: [],
  fixedAccounts: [],
  variableAccounts: [],
  supermarket: [],
  fuel: [],
  futureIncomes: [],
};

function newId(): string {
  return crypto.randomUUID();
}

/** Reconstrói `AppState` a partir de JSON (localStorage ou Firestore). */
export function reviveAppStateFromUnknown(parsed: unknown): AppState {
  if (!parsed || typeof parsed !== "object") return { ...FINANCES_EMPTY_STATE };
  try {
    const root = parsed as Partial<AppState> & Record<string, unknown>;
    const movements: Movement[] = Array.isArray(root.movements)
      ? [...root.movements].map((m) => {
          const responsible =
            typeof m.responsible === "string" && m.responsible.trim() ? m.responsible : undefined;
          return responsible ? { ...m, responsible } : { ...m };
        })
      : [];
    const fixedAccounts = (Array.isArray(root.fixedAccounts) ? root.fixedAccounts : []).map(
      (a: FixedAccount) => {
        let linkedMovementId =
          typeof a.linkedMovementId === "string" ? a.linkedMovementId : undefined;
        const linkedExists =
          linkedMovementId != null && movements.some((m) => m.id === linkedMovementId);
        if ((a.inFlow ?? false) && !linkedExists) {
          const existing = movements.find(
            (m) =>
              m.kind === "expense" &&
              m.nature === "fixed" &&
              m.amount === a.monthlyAmount &&
              m.title === a.name,
          );
          if (existing) {
            linkedMovementId = existing.id;
          } else {
            const movement: Movement = {
              id: newId(),
              kind: "expense",
              amount: a.monthlyAmount,
              title: a.name,
              date: new Date().toISOString().slice(0, 10),
              nature: "fixed",
            };
            movements.unshift(movement);
            linkedMovementId = movement.id;
          }
        }
        return {
          ...a,
          linkedMovementId,
        };
      },
    );
    return {
      movements,
      fixedAccounts,
      variableAccounts: (
        Array.isArray(root.variableAccounts) ? root.variableAccounts : []
      ).map((v: VariableAccount) => ({
        ...v,
        spends: (Array.isArray(v.spends) ? v.spends : []).map((sp) => {
          let linkedMovementId =
            typeof sp.linkedMovementId === "string" ? sp.linkedMovementId : undefined;

          const linkedExists =
            linkedMovementId != null && movements.some((m) => m.id === linkedMovementId);

          if (!linkedExists && sp.amount > 0) {
            const existing = movements.find(
              (m) =>
                m.kind === "expense" &&
                m.nature === "variable" &&
                m.amount === sp.amount &&
                m.title === sp.title &&
                m.date === sp.date,
            );
            if (existing) {
              linkedMovementId = existing.id;
            } else {
              const movement: Movement = {
                id: newId(),
                kind: "expense",
                amount: sp.amount,
                title: sp.title,
                date: sp.date,
                nature: "variable",
              };
              movements.unshift(movement);
              linkedMovementId = movement.id;
            }
          }

          return {
            ...sp,
            linkedMovementId,
          };
        }),
      })),
      supermarket: Array.isArray(root.supermarket) ? root.supermarket : [],
      fuel: Array.isArray(root.fuel) ? root.fuel : [],
      futureIncomes: Array.isArray(root.futureIncomes)
        ? (root.futureIncomes as FutureIncomeEntry[]).map((e) => ({
            ...e,
            received: Boolean(e.received),
            linkedMovementId:
              typeof e.linkedMovementId === "string" ? e.linkedMovementId : undefined,
          }))
        : [],
    };
  } catch {
    return { ...FINANCES_EMPTY_STATE };
  }
}
