import { useLayoutEffect } from "react";
import { create } from "zustand";
import s from "./theme.module.css";

export type Theme = "light" | "default" | "dark";
const storageKey = "plateon.theme";
const validTheme = (value: string | null): Theme =>
  value === "light" || value === "dark" ? value : "default";

function readTheme(): Theme {
  try {
    return validTheme(localStorage.getItem(storageKey));
  } catch {
    return "default";
  }
}

const useTheme = create<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>((set) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // The selection still works when browser storage is unavailable.
    }
    set({ theme });
  },
}));

export function ThemePreferences() {
  const theme = useTheme((state) => state.theme);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useLayoutEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        useTheme.setState({ theme: readTheme() });
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return null;
}

const options = [
  {
    value: "light",
    label: "Claro",
    path: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
  },
  {
    value: "default",
    label: "Padrão",
    path: "M12 3 3 12l9 9 9-9-9-9ZM12 7v10m-5-5h10",
  },
  {
    value: "dark",
    label: "Escuro",
    path: "M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z",
  },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      className={`${s.toggle} ${compact ? s.compact : ""}`}
      role="group"
      aria-label="Aparência"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-label={`Modo ${option.label.toLowerCase()}`}
          title={`Modo ${option.label.toLowerCase()}`}
          aria-pressed={theme === option.value}
          onClick={() => setTheme(option.value)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const next =
              (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) %
              options.length;
            setTheme(options[next].value);
            (
              event.currentTarget.parentElement?.children[
                next
              ] as HTMLButtonElement
            )?.focus();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={option.path} />
          </svg>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
