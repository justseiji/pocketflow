import {
  useEffect,
  useId,
  useRef,
  useState,
  cloneElement,
  isValidElement,
  type ReactElement,
  type FormEvent,
  type ReactNode,
} from "react";
import { X, ArrowUpRight, Plus } from "lucide-react";
import { formatMoney, moneyInput } from "../shared/finance";

export function Money({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return <span className={`money ${className}`}>{formatMoney(value)}</span>;
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">
        <Plus size={22} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        <span>{label}</span>
      </label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            id,
            "aria-describedby": hint ? `${id}-hint` : undefined,
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Amount({
  name = "amount",
  value,
  required = true,
  id,
  "aria-describedby": describedBy,
}: {
  name?: string;
  value?: number;
  required?: boolean;
  id?: string;
  "aria-describedby"?: string;
}) {
  return (
    <div className="amount-input">
      <span aria-hidden="true">₱</span>
      <input
        id={id}
        aria-describedby={describedBy}
        name={name}
        inputMode="decimal"
        placeholder="0.00"
        defaultValue={value === undefined ? "" : moneyInput(value)}
        required={required}
        autoComplete="off"
        pattern="[0-9]+(\.[0-9]{1,2})?"
      />
    </div>
  );
}
export function Progress({
  value,
  danger = false,
}: {
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`progress ${danger ? "danger" : ""}`}
      role="progressbar"
      aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Allocation used"
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function FormDialog({
  title,
  description,
  onClose,
  onSave,
  children,
  submit = "Save changes",
  danger = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  children?: ReactNode;
  submit?: string;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(new FormData(event.currentTarget));
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      {description && <p className="dialog-description">{description}</p>}
      <form onSubmit={save}>
        <div className="form-content">{children}</div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className={`button ${danger ? "destructive" : ""}`}
            disabled={busy}
          >
            {busy ? "Saving…" : submit}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
