import { useEffect, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { apiGet } from '../api';
import type { SearchResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { EmptyState, LoadingState, ApiErrorState } from '../components/StatusViews';
import { ProvenanceFooter } from '../components/Provenance';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim();
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  const state = useApi(`search:${query}`, () =>
    query
      ? apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`)
      : Promise.resolve(null),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = draft.trim();
    setSearchParams(next ? { q: next } : {}, { replace: true });
  };

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Search
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Search region names/codes and COFOG function names/codes. The API returns at most 20 results
        of each kind for a query.
      </Typography>

      <ProvenanceFooter
        sources={[]}
        note="Search returns region and COFOG taxonomy records, not spending amounts; any figure is shown on the linked page with its source."
      />

      <Box component="form" onSubmit={submit} role="search" sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label="Search regions and functions"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            size="small"
            fullWidth
            autoFocus
          />
          <Button type="submit" variant="contained" sx={{ minWidth: 120 }}>
            Search
          </Button>
        </Stack>
      </Box>

      {!query ? (
        <EmptyState
          title="Enter a search term"
          message="Try “health”, “education” or “NSW”. Results link to function pages and to region pages by region _id."
        />
      ) : state.loading ? (
        <LoadingState label={`Searching for “${query}”…`} />
      ) : state.error ? (
        <ApiErrorState error={state.error} />
      ) : state.data ? (
        state.data.count === 0 ? (
          <EmptyState
            title={`No results for “${query}”`}
            message="No region or function name/code matched. Nothing is inferred or filled in."
          />
        ) : (
          <Stack spacing={3} data-testid="search-results">
            <Typography variant="body2" color="text.secondary">
              {state.data.count} result{state.data.count === 1 ? '' : 's'} for “{state.data.q}”.
            </Typography>

            <Card variant="outlined" data-testid="search-regions">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Regions ({state.data.regions.length})
                </Typography>
                {state.data.regions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No matching regions.
                  </Typography>
                ) : (
                  <List dense>
                    {state.data.regions.map((region) => (
                      <ListItem key={region._id} disableGutters>
                        <ListItemText
                          primary={
                            <Link component={RouterLink} to={`/regions/${region._id}`}>
                              {region.code} — {region.name}
                            </Link>
                          }
                          secondary={`Region _id ${region._id} · ${region.level}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined" data-testid="search-functions">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Functions ({state.data.functions.length})
                </Typography>
                {state.data.functions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No matching functions.
                  </Typography>
                ) : (
                  <List dense>
                    {state.data.functions.map((fn) => (
                      <ListItem key={fn.code} disableGutters>
                        <ListItemText
                          primary={
                            <Link component={RouterLink} to={`/functions/${fn.code}`}>
                              {fn.code} — {fn.name}
                            </Link>
                          }
                          secondary={`COFOG ${fn.level}${fn.parent_code ? ` · parent ${fn.parent_code}` : ''}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Stack>
        )
      ) : null}
    </Box>
  );
}
