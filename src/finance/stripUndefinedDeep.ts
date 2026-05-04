/** O Firestore rejeita `undefined` em qualquer nível do documento. */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    const v = src[key];
    if (v === undefined) continue;
    out[key] = stripUndefinedDeep(v);
  }
  return out as T;
}
