export type PersonStatus = "paid" | "pending";

export type VaquinhaPerson = {
  id: string;
  name: string;
  status: PersonStatus;
};

export type Vaquinha = {
  id: string;
  name: string;
  totalCents: number;
  perPersonCents: number;
  people: VaquinhaPerson[];
  createdAtIso: string;
};

export type VaquinhasPersisted = {
  version: 3;
  items: Vaquinha[];
};