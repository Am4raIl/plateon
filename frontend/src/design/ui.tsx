import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, type LinkProps } from "react-router-dom";
import { friendlyError, imageUrl } from "../api/client";
import { useNotices, type Notice } from "../app/store";
import { labels } from "../lib/format";
import s from "./ui.module.css";
export function Brand() {
  return (
    <span className="brand">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M9 28V4h8.5a8 8 0 0 1 0 16H9"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
        />
        <circle cx="23" cy="26" r="2.4" fill="var(--latao)" />
      </svg>
      Plateon
    </span>
  );
}
export function Button({
  variant = "primary",
  size = "md",
  loading,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dangerPrimary";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={`${s.button} ${s[variant] ?? ""} ${s[size] ?? ""} ${className}`}
    >
      {loading && <span className={s.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.field}>
      <span>{label}</span>
      {children}
      {error && (
        <span className={s.fieldError} role="alert">
          ▲ {error}
        </span>
      )}
    </div>
  );
}
export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: LinkProps & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Link
      {...props}
      className={`${s.button} ${s[variant] ?? ""} ${s[size] ?? ""} ${className}`}
      style={{ textDecoration: "none", ...props.style }}
    />
  );
}
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
>(function Input({ label, error, ...props }, ref) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <label className={s.field} htmlFor={id}>
      {label}
      <input
        {...props}
        ref={ref}
        id={id}
        className={s.control}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span id={`${id}-error`} className={s.fieldError} role="alert">
          ▲ {error}
        </span>
      )}
    </label>
  );
});
export const controlClass = s.control;
export function MoneyInput({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
}) {
  const format = (amount: number) =>
    `R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  const [text, setText] = useState(value ? format(value) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value ? format(value) : "");
  }, [value]);
  return (
    <Input
      label={label}
      inputMode="numeric"
      required={required}
      placeholder="R$ 0,00"
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
        const amount = Number(digits) / 100;
        setText(digits ? format(amount) : "");
        onChange(amount);
      }}
      onBlur={() => {
        focused.current = false;
        setText(value ? format(value) : "");
      }}
    />
  );
}
export function Tag({
  status,
  children,
}: {
  status?: string;
  children?: ReactNode;
}) {
  const symbol =
    status === "ESGOTADO"
      ? "⊘"
      : status === "RASCUNHO"
        ? "✎"
        : status === "CANCELADO" || status === "CANCELADA"
          ? "×"
          : status === "PRONTO" ||
              status === "ENTREGUE" ||
              status === "PAGA" ||
              status === "ATENDIDO"
            ? "✓"
            : status === "EM_PREPARO"
              ? "◐"
              : "●";
  return (
    <span
      className={`${s.tag} ${status === "RASCUNHO" ? s.draft : ""} ${status?.startsWith("CANCEL") ? s.error : ""} ${status === "AGUARDANDO_PAGAMENTO" ? s.warn : ""}`}
    >
      {symbol} {children ?? labels[status ?? ""] ?? status}
    </span>
  );
}
export function Banner({
  kind = "info",
  children,
}: {
  kind?: "info" | "ok" | "warn" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`${s.banner} ${s[kind]}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span aria-hidden="true">
        {kind === "ok" ? "✓" : kind === "error" ? "▲" : "●"}
      </span>
      <div>{children}</div>
    </div>
  );
}
export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={s.seg} role="group" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
              e.preventDefault();
              const next =
                (index + (e.key === "ArrowRight" ? 1 : -1) + options.length) %
                options.length;
              onChange(options[next].value);
              (
                e.currentTarget.parentElement?.children[
                  next
                ] as HTMLButtonElement
              ).focus();
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
export function Stepper({
  value,
  onChange,
  disabled,
  max = 2147483647,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  max?: number;
}) {
  return (
    <div className={s.stepper}>
      <button
        type="button"
        disabled={disabled || value <= 1}
        aria-label="Diminuir quantidade"
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-live="polite" aria-label="Quantidade">
        {value}
      </output>
      <button
        type="button"
        disabled={disabled || value >= max}
        aria-label="Aumentar quantidade"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
export function Switch({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={s.switch}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
      <span id={id}>{label}</span>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const id = useId();
  useEffect(() => {
    const active = document.activeElement as HTMLElement;
    const root = document.getElementById("root");
    root?.setAttribute("inert", "");
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = () =>
      ref.current?.querySelector<HTMLElement>(
        'button,input,select,textarea,[tabindex="0"]',
      );
    first()?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const all = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        );
        if (!all?.length) return;
        const first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      root?.removeAttribute("inert");
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handle);
      active?.focus();
    };
  }, []);
  return createPortal(
    <div
      className={`${s.backdrop} ${drawer ? s.drawerBackdrop : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`${s.modal} ${drawer ? s.drawer : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <header className="spread">
          <h2 id={id}>{title}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Fechar janela"
          >
            ×
          </Button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
function Toast({ notice }: { notice: Notice }) {
  const remove = useNotices((s) => s.remove);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(
      () => remove(notice.id),
      notice.kind === "error" ? 8000 : 5000,
    );
    return () => clearTimeout(timer);
  }, [notice, paused, remove]);
  return (
    <div
      className={`${s.toast} ${notice.kind === "error" ? s.toastError : ""}`}
      role={notice.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span>{notice.kind === "error" ? "▲" : "✓"}</span>
      <span>{notice.text}</span>
      <button aria-label="Fechar mensagem" onClick={() => remove(notice.id)}>
        ×
      </button>
    </div>
  );
}
export function Toasts() {
  const notices = useNotices((s) => s.notices);
  return (
    <div className={s.toasts}>
      {notices.map((n) => (
        <Toast key={n.id} notice={n} />
      ))}
    </div>
  );
}
export function Empty({
  title = "Nada por aqui ainda",
  text = "Os próximos registros aparecerão aqui.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <span className="empty-symbol" aria-hidden="true">
        —
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <Empty
      title={friendlyError(error)}
      text="Confira sua conexão e tente de novo."
      action={
        <Button variant="secondary" onClick={retry}>
          Tentar de novo
        </Button>
      }
    />
  );
}
export function Skeleton() {
  return (
    <div className="stack" role="status" aria-label="Carregando">
      <div className={s.skeleton} />
      <div className={s.skeleton} />
      <div className={s.skeleton} />
    </div>
  );
}
export function Photo({
  url,
  name,
  className = "",
}: {
  url: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div className={`${s.photo} ${className}`}>
      {url && !failed ? (
        <img src={imageUrl(url)} alt={name} onError={() => setFailed(true)} />
      ) : (
        <svg viewBox="0 0 240 160" role="img" aria-label={name}>
          <ellipse cx="120" cy="87" rx="86" ry="53" fill="#ddd6c5" />
          <ellipse
            cx="120"
            cy="86"
            rx="66"
            ry="39"
            fill="none"
            stroke="#aaa38f"
            strokeWidth="2"
          />
          <path
            d="M74 95Q86 51 125 63T167 93Q130 119 74 95"
            fill="var(--comida,#9d7451)"
          />
          <path
            d="M83 88Q119 74 153 86M99 99Q120 65 144 76"
            fill="none"
            stroke="#d9b78a"
            strokeWidth="5"
          />
          <path d="M125 66q2-18 17-10q-2 17-17 10" fill="#3b6049" />
        </svg>
      )}
    </div>
  );
}
export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <div className="section-label">{eyebrow}</div>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}
export function Pagination({
  page,
  total,
  next,
  onChange,
}: {
  page: number;
  total: number;
  next: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Paginação">
      <Button
        variant="secondary"
        size="sm"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </Button>
      <span>
        Página {page + 1} de {Math.max(1, total)}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={!next}
        onClick={() => onChange(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}
