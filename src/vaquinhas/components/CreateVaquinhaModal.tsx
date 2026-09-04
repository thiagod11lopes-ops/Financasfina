import type { VaquinhaInput } from "../types";
import { VaquinhaFormModal } from "./VaquinhaFormModal";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: VaquinhaInput) => void;
};

export function CreateVaquinhaModal({ open, onClose, onCreate }: Props) {
  return (
    <VaquinhaFormModal
      open={open}
      mode="create"
      onClose={onClose}
      onSubmit={onCreate}
    />
  );
}