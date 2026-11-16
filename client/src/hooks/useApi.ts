import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Run an API loader whenever `key` changes. The loader is held in a ref so the
 * effect only depends on the explicit key (which callers build from route
 * params), avoiding accidental request loops from freshly-created closures.
 */
export function useApi<T>(key: string, load: () => Promise<T>): ApiState<T> {
  const loadRef = useRef(load);
  loadRef.current = load;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: null });

    loadRef.current().then(
      (data) => {
        if (active) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (!active) return;
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(error instanceof Error ? error.message : String(error), null, 'http');
        setState({ data: null, loading: false, error: apiError });
      },
    );

    return () => {
      active = false;
    };
  }, [key]);

  return state;
}
