import { create } from "zustand";
import { loginSchema, type LoginView } from "../api/types";
function readTablet() {
  try {
    return localStorage.getItem("plateon.tablet");
  } catch {
    return null;
  }
}
function readStaff() {
  try {
    const raw = sessionStorage.getItem("plateon.equipe");
    if (!raw) return null;
    const value = loginSchema
      .extend({ username: loginSchema.shape.token })
      .parse(JSON.parse(raw));
    return Date.parse(value.expiraEm) > Date.now() ? value : null;
  } catch {
    return null;
  }
}
export interface Sessao extends LoginView {
  username: string;
}
interface State {
  tablet: string | null;
  staff: Sessao | null;
  setTablet: (token: string | null) => void;
  setStaff: (session: Sessao | null) => void;
}
export const useSession = create<State>((set) => ({
  tablet: readTablet(),
  staff: readStaff(),
  setTablet: (token) => {
    try {
      if (token) localStorage.setItem("plateon.tablet", token);
      else localStorage.removeItem("plateon.tablet");
    } catch {
      /* A sessão ainda funciona em memória. */
    }
    set({ tablet: token });
  },
  setStaff: (staff) => {
    try {
      if (staff)
        sessionStorage.setItem("plateon.equipe", JSON.stringify(staff));
      else sessionStorage.removeItem("plateon.equipe");
    } catch {
      /* A sessão ainda funciona em memória. */
    }
    set({ staff });
  },
}));
export interface Notice {
  id: number;
  text: string;
  kind: "ok" | "error" | "info";
}
export const useNotices = create<{
  notices: Notice[];
  add: (text: string, kind?: Notice["kind"]) => void;
  remove: (id: number) => void;
}>((set) => ({
  notices: [],
  add: (text, kind = "ok") =>
    set((s) => ({
      notices: [
        ...s.notices.slice(-2),
        { id: Date.now() + Math.random(), text, kind },
      ],
    })),
  remove: (id) =>
    set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));
