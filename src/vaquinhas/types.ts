export type PersonStatus = "paid" | "pending";

export type VaquinhaPerson = {
  id: string;
  name: string;
  status: PersonStatus;
};

export type PeriodKind = "range" | "monthly" | "yearly";

export type VaquinhaPeriod =
  | { kind: "range"; startDateIso: string; endDateIso: string }
  | { kind: "monthly" }
  | { kind: "yearly" };

export type Vaquinha = {
  id: string;
  name: string;
  totalCents: number;
  perPersonCents: number;
  period: VaquinhaPeriod;
  people: VaquinhaPerson[];
  createdAtIso: string;
};

export type VaquinhaInput = {
  name: string;
  totalCents: number;
  perPersonCents: number;
  period: VaquinhaPeriod;
};

export type VaquinhasPersisted = {
  version: 4;
  items: Vaquinha[];
};