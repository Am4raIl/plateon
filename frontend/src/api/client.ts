import { useSession } from "../app/store";
import {
  comandaSchema,
  fechamentoSchema,
  kanbanSchema,
  pedidoSchema,
} from "./types";
export const API_URL =
  process.env.NODE_ENV === "test" ? "http://localhost:8081/api/v1" : "/api/v1";
export type Scope = "public" | "staff" | "tablet";
export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: Record<string, unknown> = {},
    public retryAfter = 0,
  ) {
    super(errorMessage(status));
  }
}
export function errorMessage(status: number) {
  return (
    (
      {
        400: "Confira os campos e tente de novo.",
        401: "Sua sessão expirou. Entre novamente.",
        403: "Acesso negado. Peça ajuda ao gerente.",
        404: "Este item não está mais disponível. Atualize a tela.",
        409: "Este registro foi alterado por outra pessoa. Atualize e tente de novo.",
        410: "Este código venceu. Gere um novo código.",
        422: "Não foi possível concluir. Confira os dados desta ação.",
        429: "Muitas tentativas. Aguarde para tentar de novo.",
      } as Record<number, string>
    )[status] || "Não conseguimos concluir agora. Nada foi alterado."
  );
}
export function friendlyError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Não conseguimos concluir agora. Nada foi alterado.";
}
export function tokenFor(scope: Scope) {
  return scope === "staff"
    ? useSession.getState().staff?.token
    : scope === "tablet"
      ? useSession.getState().tablet
      : null;
}
export function expire(scope: Scope) {
  if (scope === "staff") useSession.getState().setStaff(null);
  if (scope === "tablet") useSession.getState().setTablet(null);
}
export async function request<T>(
  scope: Scope,
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const token = tokenFor(scope);
    const response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      if (response.status === 401) expire(scope);
      const retry = response.headers.get("Retry-After");
      const retryAfter = retry
        ? Math.max(
            1,
            Number(retry) || Math.ceil((Date.parse(retry) - Date.now()) / 1000),
          )
        : 30;
      throw new ApiError(response.status, problem, retryAfter);
    }
    const text = await response.text();
    if (!text) return undefined as T;
    const value: unknown = JSON.parse(text);
    const route = path.split("?")[0];
    if (
      route === "/mesa/comanda" ||
      (/^\/admin\/comandas\/[^/]+$/.test(route) && !route.endsWith("/resumos"))
    )
      return comandaSchema.parse(value) as T;
    if (/^\/admin\/comandas\/[^/]+\/fechar$/.test(route))
      return fechamentoSchema.parse(value) as T;
    if (route === "/admin/kanban") return kanbanSchema.parse(value) as T;
    if (
      route.startsWith("/mesa/pedidos") ||
      /^\/admin\/kanban\/[^/]+\/status$/.test(route)
    )
      return pedidoSchema.parse(value) as T;
    return value as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw error;
    throw new ApiError(0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export const staffApi = <T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
) => request<T>("staff", path, method, body, signal);
export const tabletApi = <T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
) => request<T>("tablet", path, method, body, signal);
export const publicApi = <T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
) => request<T>("public", path, method, body, signal);
export const imageUrl = (path: string) =>
  new URL(path, window.location.origin).href;
