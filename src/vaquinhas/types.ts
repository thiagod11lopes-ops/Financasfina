export type TitleStatus = "paid" | "pending";

export type VaquinhaTitle = {
  id: string;
  payerName: string;
  amountCents: number;
  dueDateIso: string; // YYYY-MM-DD
  status: TitleStatus;
  paidAtIso?: string; // ISO string
  notes?: string;
};

export type Vaquinha = {
  id: string;
  name: string;
  createdAtIso: string;
  titles: VaquinhaTitle[];
};

export type VaquinhasPersisted = {
  version: 1;
  items: Vaquinha[];
};

