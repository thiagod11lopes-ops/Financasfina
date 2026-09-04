export type Vaquinha = {
  id: string;
  name: string;
  expectedCents: number;
  paidCents: number;
  createdAtIso: string;
};

export type VaquinhasPersisted = {
  version: 2;
  items: Vaquinha[];
};