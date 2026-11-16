import { createContext, useContext, type ReactNode } from 'react';
import { apiGet } from './api';
import type { CoverageResponse } from './api/types';
import { useApi, type ApiState } from './hooks/useApi';

const CoverageContext = createContext<ApiState<CoverageResponse> | null>(null);

/**
 * Fetch the Phase 1 coverage metadata once and share it with every page. The
 * banner, home counts, filters and data-sources connector list all read from
 * here, so there is a single request per page load and one honest fallback.
 */
export function CoverageProvider({ children }: { children: ReactNode }) {
  const state = useApi('coverage:meta', () => apiGet<CoverageResponse>('/api/meta/coverage'));
  return <CoverageContext.Provider value={state}>{children}</CoverageContext.Provider>;
}

// The provider and its hook belong together; this file intentionally exports both.
// eslint-disable-next-line react-refresh/only-export-components
export function useCoverage(): ApiState<CoverageResponse> {
  const state = useContext(CoverageContext);
  if (!state) {
    throw new Error('useCoverage must be used inside a CoverageProvider');
  }
  return state;
}
