import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconChevronDown } from "./Icons";
import {
  filterExpenseAccountOptions,
  findExpenseOptionByTarget,
  type ExpenseAccountOption,
  type ExpenseAccountTarget,
} from "./expenseAccountPicker";

type Props = {
  id: string;
  options: ExpenseAccountOption[];
  value: string;
  selectedTarget: ExpenseAccountTarget | null;
  onValueChange: (value: string) => void;
  onSelectOption: (option: ExpenseAccountOption) => void;
  placeholder?: string;
};

export function ExpenseAccountCombobox({
  id,
  options,
  value,
  selectedTarget,
  onValueChange,
  onSelectOption,
  placeholder = "Escolha uma conta ou digite livremente…",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => filterExpenseAccountOptions(options, value), [options, value]);

  const activeOption = useMemo(
    () => findExpenseOptionByTarget(options, selectedTarget),
    [options, selectedTarget],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`expense-combobox${open ? " expense-combobox--open" : ""}`}
    >
      <div className="expense-combobox__control">
        <input
          id={id}
          className="input expense-combobox__input"
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          enterKeyHint="done"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        <button
          type="button"
          className="expense-combobox__toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Fechar lista de contas" : "Abrir lista de contas"}
          tabIndex={-1}
        >
          <IconChevronDown className={open ? "is-open" : undefined} aria-hidden />
        </button>
      </div>

      {activeOption ? (
        <p className="expense-combobox__linked">
          Vinculado a <strong>{activeOption.name}</strong>
          <span className={`expense-combobox__tag expense-combobox__tag--${activeOption.kind}`}>
            {activeOption.kindTag}
          </span>
        </p>
      ) : null}

      {open ? (
        <ul id={listId} className="expense-combobox__list" role="listbox">
          {filtered.length === 0 ? (
            <li className="expense-combobox__empty" role="presentation">
              Nenhuma conta encontrada — continue digitando para usar texto livre.
            </li>
          ) : (
            filtered.map((opt) => (
              <li key={`${opt.target.kind}-${opt.target.accountId}`} role="presentation">
                <button
                  type="button"
                  className={`expense-combobox__option${
                    selectedTarget?.accountId === opt.target.accountId &&
                    selectedTarget?.kind === opt.target.kind
                      ? " is-selected"
                      : ""
                  }`}
                  role="option"
                  aria-selected={
                    selectedTarget?.accountId === opt.target.accountId &&
                    selectedTarget?.kind === opt.target.kind
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelectOption(opt);
                    setOpen(false);
                  }}
                >
                  <span className="expense-combobox__option-name">{opt.name}</span>
                  <span className={`expense-combobox__tag expense-combobox__tag--${opt.kind}`}>
                    {opt.kindTag}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
