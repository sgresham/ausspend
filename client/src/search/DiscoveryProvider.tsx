import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type Fuse from 'fuse.js';
import { apiGet } from '../api';
import type { DataSourcesResponse, FunctionsResponse, RegionsResponse } from '../api/types';
import { useCoverage } from '../coverage';
import { useApi } from '../hooks/useApi';
import {
  buildDiscoveryItems,
  createDiscoveryFuse,
  searchDiscovery,
  suggestDiscovery,
  type DiscoveryItem,
} from './discovery';

export interface DiscoveryContextValue {
  items: DiscoveryItem[];
  fuse: Fuse<DiscoveryItem> | null;
  loading: boolean;
  error: string | null;
  search: (query: string, limit?: number) => DiscoveryItem[];
  suggest: (query: string) => DiscoveryItem | null;
}

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

/**
 * Loads only the bounded discovery payloads: the COFOG taxonomy, the region
 * directory, the source register and the registered SOC entity metadata that
 * already arrives in `/api/meta/coverage`. No measure rows, no `/api/soc`
 * series and no full-dataset index are fetched.
 */
export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const coverage = useCoverage();
  const functionsState = useApi('discovery:functions', () =>
    apiGet<FunctionsResponse>('/api/functions'),
  );
  const regionsState = useApi('discovery:regions', () =>
    apiGet<RegionsResponse>('/api/regions?limit=200'),
  );
  const sourcesState = useApi('discovery:sources', () =>
    apiGet<DataSourcesResponse>('/api/data-sources'),
  );

  const items = useMemo(
    () =>
      buildDiscoveryItems({
        functions: functionsState.data?.functions ?? [],
        regions: regionsState.data?.regions ?? [],
        sources: sourcesState.data?.sources ?? [],
        coverage: coverage.data,
      }),
    [functionsState.data, regionsState.data, sourcesState.data, coverage.data],
  );

  const fuse = useMemo(() => (items.length > 0 ? createDiscoveryFuse(items) : null), [items]);

  const looseFuse = useMemo(
    () => (items.length > 0 ? createDiscoveryFuse(items, 0.75) : null),
    [items],
  );

  const value = useMemo<DiscoveryContextValue>(() => {
    const search = (query: string, limit?: number) =>
      fuse ? searchDiscovery(fuse, query, limit) : [];
    const suggest = (query: string) => (looseFuse ? suggestDiscovery(looseFuse, query) : null);
    const failed = [functionsState, regionsState, sourcesState].find((state) => state.error);
    return {
      items,
      fuse,
      loading: functionsState.loading || regionsState.loading || sourcesState.loading,
      error: failed?.error?.message ?? null,
      search,
      suggest,
    };
  }, [items, fuse, looseFuse, functionsState, regionsState, sourcesState]);

  return <DiscoveryContext.Provider value={value}>{children}</DiscoveryContext.Provider>;
}

// The provider and its hook belong together; this file intentionally exports both.
// eslint-disable-next-line react-refresh/only-export-components
export function useDiscovery(): DiscoveryContextValue {
  const value = useContext(DiscoveryContext);
  if (!value) {
    throw new Error('useDiscovery must be used inside a DiscoveryProvider');
  }
  return value;
}
