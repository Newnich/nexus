"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type ZodType } from "zod";
import { validatedFetcher } from "@/lib/utils";

interface UseApiDataOptions {
  /** Skip fetching on mount (e.g., wait for user action) */
  enabled?: boolean;
  /** Additional fetch options passed to validatedFetcher */
  fetchOptions?: RequestInit;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the data manually */
  refetch: () => void;
  /** Set data directly (for optimistic updates) */
  setData: (data: T | null) => void;
  /** Clear error state */
  clearError: () => void;
}

/**
 * A React hook that fetches data from an API endpoint with Zod runtime
 * validation, loading/error state management, and request cancellation.
 *
 * @example
 * ```ts
 * const { data, loading, error } = useApiData("/api/dashboard", DashboardStatsSchema);
 * ```
 */
export function useApiData<T>(
  url: string | null,
  schema: ZodType<T, any, any>,
  options: UseApiDataOptions = {},
): UseApiDataResult<T> {
  const { enabled = true, fetchOptions } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const urlRef = useRef(url);
  urlRef.current = url;

  const fetchData = useCallback(async () => {
    const currentUrl = urlRef.current;
    if (!currentUrl || !enabled) {
      setLoading(false);
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const mergedOptions: RequestInit = {
        signal: controller.signal,
        ...fetchOptions,
      };

      const result = await validatedFetcher(currentUrl, schema, mergedOptions);
      if (mountedRef.current && !controller.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // Request was cancelled, don't update state
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [schema, enabled, fetchOptions]);

  // Fetch on mount and when URL/schema changes
  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [fetchData, url]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    setData,
    clearError,
  };
}
