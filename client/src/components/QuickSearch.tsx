import { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet, errorMessage } from '../api';
import type { FunctionRef, RegionRef, RegionsResponse, SearchResponse } from '../api/types';

interface QuickSearchProps {
  label?: string;
  autoFocus?: boolean;
  /** When provided, picking a result runs this instead of navigating. */
  onPickFunction?: (code: string) => void;
  onPickRegion?: (region: RegionRef) => void;
}

function regionHref(region: RegionRef): string {
  return region.level === 'state' ? `/states/${region.code}` : `/regions/${region._id}`;
}

/**
 * Bounded, debounced name search over `/api/regions` and `/api/search`.
 * Results either link to their pages (home) or apply a spending filter
 * (search explorer "jump to").
 */
export function QuickSearch({
  label = 'Search regions and functions',
  autoFocus = false,
  onPickFunction,
  onPickRegion,
}: QuickSearchProps) {
  const [query, setQuery] = useState('');
  const [regions, setRegions] = useState<RegionRef[]>([]);
  const [functions, setFunctions] = useState<FunctionRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRegions([]);
      setFunctions([]);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      Promise.all([
        apiGet<RegionsResponse>(`/api/regions?q=${encodeURIComponent(q)}&limit=10`),
        apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`),
      ]).then(
        ([regionResponse, searchResponse]) => {
          if (!active) return;
          setRegions(regionResponse.regions);
          setFunctions(searchResponse.functions);
          setError(null);
          setLoading(false);
        },
        (err: unknown) => {
          if (!active) return;
          setRegions([]);
          setFunctions([]);
          setError(errorMessage(err));
          setLoading(false);
        },
      );
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const trimmed = query.trim();
  const showResults = trimmed.length >= 2;
  const noResults =
    showResults && !loading && !error && regions.length === 0 && functions.length === 0;

  return (
    <Box data-testid="quick-search">
      <TextField
        fullWidth
        size="small"
        autoFocus={autoFocus}
        label={label}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        helperText="Type at least two characters. Results are bounded by the API."
      />
      {showResults ? (
        <Paper variant="outlined" sx={{ mt: 1, p: 1 }} data-testid="quick-search-results">
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Searching…
              </Typography>
            </Box>
          ) : null}
          {error ? (
            <Typography variant="body2" color="error" sx={{ p: 1 }}>
              Search failed: {error}
            </Typography>
          ) : null}
          {noResults ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
              No regions or functions match “{trimmed}”. Nothing is inferred.
            </Typography>
          ) : null}

          {regions.length > 0 ? (
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
                Regions ({regions.length})
              </Typography>
              <List dense disablePadding>
                {regions.map((region) =>
                  onPickRegion ? (
                    <ListItemButton
                      key={region._id}
                      onClick={() => onPickRegion(region)}
                      data-testid="quick-region-result"
                    >
                      <ListItemText
                        primary={`${region.code} — ${region.name}`}
                        secondary={`${region.level} · region _id ${region._id}`}
                      />
                    </ListItemButton>
                  ) : (
                    <ListItemButton
                      key={region._id}
                      component={RouterLink}
                      to={regionHref(region)}
                      data-testid="quick-region-result"
                    >
                      <ListItemText
                        primary={`${region.code} — ${region.name}`}
                        secondary={`${region.level} · region _id ${region._id}`}
                      />
                    </ListItemButton>
                  ),
                )}
              </List>
            </Box>
          ) : null}

          {functions.length > 0 ? (
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
                Functions ({functions.length})
              </Typography>
              <List dense disablePadding>
                {functions.map((fn) =>
                  onPickFunction ? (
                    <ListItemButton
                      key={fn.code}
                      onClick={() => onPickFunction(fn.code)}
                      data-testid="quick-function-result"
                    >
                      <ListItemText
                        primary={`${fn.code} — ${fn.name}`}
                        secondary={`COFOG ${fn.level}${fn.parent_code ? ` · parent ${fn.parent_code}` : ''}`}
                      />
                    </ListItemButton>
                  ) : (
                    <ListItemButton
                      key={fn.code}
                      component={RouterLink}
                      to={`/functions/${fn.code}`}
                      data-testid="quick-function-result"
                    >
                      <ListItemText
                        primary={`${fn.code} — ${fn.name}`}
                        secondary={`COFOG ${fn.level}${fn.parent_code ? ` · parent ${fn.parent_code}` : ''}`}
                      />
                    </ListItemButton>
                  ),
                )}
              </List>
            </Box>
          ) : null}
        </Paper>
      ) : null}
    </Box>
  );
}
