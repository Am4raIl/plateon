import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { ApiError, friendlyError, request, type Scope } from "./client";
import { useNotices } from "../app/store";
export function useRead<T>(
  scope: Scope,
  path: string,
  interval?: number,
  enabled = true,
) {
  return useQuery({
    queryKey: [scope, path],
    queryFn: async ({ signal }) =>
      (await request<T>(scope, path, "GET", undefined, signal)) ?? null,
    enabled,
    refetchInterval: interval,
    refetchIntervalInBackground: false,
  });
}
export function useAction<T = unknown, V = void>(
  action: (variables: V) => Promise<T>,
  options?: {
    success?: (data: T, variables: V) => void;
    error?: (error: ApiError) => void;
    invalidate?: QueryKey[];
    quiet?: boolean;
  },
) {
  const client = useQueryClient();
  const add = useNotices((s) => s.add);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const last = useRef<V | undefined>(undefined);
  const mutation = useMutation({
    mutationFn: async (v: V) => {
      last.current = v;
      try {
        return await action(v);
      } catch (error) {
        throw error instanceof ApiError ? error : new ApiError(0);
      }
    },
    onSuccess: (data, v) => {
      client.invalidateQueries({ queryKey: ["tablet"] });
      for (const key of options?.invalidate ?? [["staff"]])
        client.invalidateQueries({ queryKey: key });
      options?.success?.(data, v);
    },
    onError: async (e: ApiError) => {
      if (e.status === 429) setBlockedUntil(Date.now() + e.retryAfter * 1000);
      if (e.status === 409 || e.status === 422)
        await client.invalidateQueries();
      options?.error?.(e);
      if (!options?.quiet) add(friendlyError(e), "error");
    },
  });
  const retry = mutation.mutate;
  useEffect(() => {
    if (!blockedUntil) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTick(now);
      if (now >= blockedUntil) {
        clearInterval(timer);
        setBlockedUntil(0);
        retry(last.current as V);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [blockedUntil, retry]);
  return {
    ...mutation,
    remaining: Math.max(0, Math.ceil((blockedUntil - tick) / 1000)),
    busy: mutation.isPending || blockedUntil > Date.now(),
    forbidden: mutation.error?.status === 403,
  };
}
