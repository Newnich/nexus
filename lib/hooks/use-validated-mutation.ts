"use client";

import { useState, useCallback, useRef } from "react";
import { type ZodSchema } from "zod";
import { validatedFetcher } from "@/lib/utils";

interface MutationOptions<TBody, TResponse> {
  /** HTTP method (default: POST) */
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  /** URL to send the request to */
  url: string;
  /** Zod schema to validate the response */
  schema: ZodSchema<TResponse>;
  /** Optional success/error callbacks */
  onSuccess?: (data: TResponse) => void;
  onError?: (error: string) => void;
  /** Extra headers beyond Content-Type */
  headers?: Record<string, string>;
}

interface MutationState<TResponse> {
  data: TResponse | null;
  loading: boolean;
  error: string | null;
}

type MutateFn<TBody> = (body?: TBody) => Promise<void>;

/**
 * A hook for performing mutations (POST/PUT/PATCH/DELETE) with:
 * - Zod-validated responses
 * - Loading/error state management
 * - AbortController cancellation
 * - Optimistic update placeholder
 *
 * @example
 * ```ts
 * const { mutate, loading, error, data } = useValidatedMutation({
 *   url: "/api/items",
 *   method: "POST",
 *   schema: ItemCreateResponseSchema,
 *   onSuccess: (data) => toast.success(`Created item ${data.id}`),
 * });
 *
 * await mutate({ title: "My Item", type: "note" });
 * ```
 */
export function useValidatedMutation<TBody, TResponse>(
  options: MutationOptions<TBody, TResponse>,
): MutationState<TResponse> & { mutate: MutateFn<TBody>; reset: () => void } {
  const { url, method = "POST", schema, onSuccess, onError, headers } = options;

  const [state, setState] = useState<MutationState<TResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const mutate = useCallback(
    async (body?: TBody) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const fetchOptions: RequestInit = {
          method,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
        };

        if (body !== undefined) {
          fetchOptions.body = JSON.stringify(body);
        }

        const result = await validatedFetcher(url, schema, fetchOptions);

        if (!controller.signal.aborted) {
          setState({ data: result, loading: false, error: null });
          onSuccess?.(result);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        const message = err instanceof Error ? err.message : "An error occurred";
        if (!controller.signal.aborted) {
          setState((prev) => ({ ...prev, loading: false, error: message }));
          onError?.(message);
        }
      }
    },
    [url, method, schema, onSuccess, onError, headers],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}
