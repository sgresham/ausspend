import { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { apiGet, buildQuery } from '../api';
import type {
  FunctionsResponse,
  JurisdictionLevel,
  MeasureType,
  RegionRef,
  RegionsResponse,
  SpendingResponse,
  SpendingSort,
} from '../api/types';
import { useApi } from '../hooks/useApi';
import { useCoverage } from '../coverage';
import { titleCase } from '../format';
import { GRANTCONNECT_CAVEAT, PBS_CAVEAT, uniqueSources } from '../provenance';
import { QuickSearch } from '../components/QuickSearch';
import { SpendingSummaryPanel } from '../components/SpendingSummaryPanel';
import { SpendingRowsTable } from '../components/SpendingRowsTable';
import { AreaPanels } from '../components/AreaPanels';
import { ApiErrorState, EmptyState, LoadingState } from '../components/StatusViews';

const SORTS: SpendingSort[] = ['amount_desc', 'amount_asc', 'fiscal_year_desc', 'fiscal_year_asc'];

const SORT_LABELS: Record<SpendingSort, string> = {
  amount_desc: 'Amount, high to low',
  amount_asc: 'Amount, low to high',
  fiscal_year_desc: 'Fiscal year, newest first',
  fiscal_year_asc: 'Fiscal year, oldest first',
};

const MEASURE_TYPES: MeasureType[] = ['actual', 'budget', 'estimate', 'contract', 'grant_award'];
const JURISDICTION_LEVELS: JurisdictionLevel[] = [
  'federal',
  'state',
  'territory',
  'local',
  'charity',
  'other',
];
const EXPENSE_CATEGORIES = [
  ['total', 'Total expenses'],
  ['employee_expenses', 'Employee expenses'],
  ['interest_expenses', 'Interest expenses'],
  ['grants_and_donations_australia', 'Grants and donations made for use in Australia'],
  ['grants_and_donations_overseas', 'Grants and donations made for use outside Australia'],
  ['all_other_expenses', 'All other expenses'],
] as const;
const PAGE_SIZES = [10, 20, 50, 100];

function positiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

function dollarValue(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function isSort(raw: string | null): raw is SpendingSort {
  return raw !== null && (SORTS as string[]).includes(raw);
}

function isMeasureType(raw: string | null): raw is MeasureType {
  return raw !== null && (MEASURE_TYPES as string[]).includes(raw);
}

function isJurisdictionLevel(raw: string | null): raw is JurisdictionLevel {
  return raw !== null && (JURISDICTION_LEVELS as string[]).includes(raw);
}

export function SearchPage() {
  const coverage = useCoverage();
  const [searchParams, setSearchParams] = useSearchParams();
  const functionsState = useApi('search:functions', () =>
    apiGet<FunctionsResponse>('/api/functions'),
  );

  const functionCode = searchParams.get('function') ?? '';
  const q = searchParams.get('q') ?? '';
  const regionId = searchParams.get('region') ?? '';
  const areaSlug = searchParams.get('area') ?? '';
  const fiscalYear = searchParams.get('fiscal_year') ?? '';
  const rawMeasureType = searchParams.get('measure_type');
  const measureType = isMeasureType(rawMeasureType) ? rawMeasureType : '';
  const rawJurisdiction = searchParams.get('jurisdiction_level');
  const jurisdictionLevel = isJurisdictionLevel(rawJurisdiction) ? rawJurisdiction : '';
  const locationState = searchParams.get('state') ?? '';
  const postcode = searchParams.get('postcode') ?? '';
  const expenseCategory = searchParams.get('expense_category') ?? '';
  const minAmount = dollarValue(searchParams.get('min_amount'));
  const maxAmount = dollarValue(searchParams.get('max_amount'));
  const rawSort = searchParams.get('sort');
  const sort: SpendingSort = isSort(rawSort) ? rawSort : 'amount_desc';
  const page = positiveInt(searchParams.get('page'), 1);
  const rawPageSize = positiveInt(searchParams.get('page_size'), 20);
  const pageSize = PAGE_SIZES.includes(rawPageSize) ? rawPageSize : 20;

  const spendingQuery = buildQuery({
    function: functionCode || undefined,
    q: q || undefined,
    region: regionId || undefined,
    area: areaSlug || undefined,
    fiscal_year: fiscalYear || undefined,
    measure_type: measureType || undefined,
    jurisdiction_level: jurisdictionLevel || undefined,
    state: locationState || undefined,
    postcode: postcode || undefined,
    expense_category: expenseCategory || undefined,
    min_amount: minAmount !== null ? Math.round(minAmount * 100) : undefined,
    max_amount: maxAmount !== null ? Math.round(maxAmount * 100) : undefined,
    sort,
    page,
    page_size: pageSize,
  });

  const state = useApi(`spending:${spendingQuery}`, () =>
    apiGet<SpendingResponse>(`/api/spending${spendingQuery}`),
  );

  const [regionOptions, setRegionOptions] = useState<RegionRef[]>([]);
  const [regionInput, setRegionInput] = useState('');
  const [qDraft, setQDraft] = useState(q);
  const [minDraft, setMinDraft] = useState(minAmount !== null ? String(minAmount) : '');
  const [maxDraft, setMaxDraft] = useState(maxAmount !== null ? String(maxAmount) : '');

  useEffect(() => {
    let active = true;
    apiGet<RegionsResponse>('/api/regions?limit=200').then(
      (response) => {
        if (active) setRegionOptions(response.regions);
      },
      () => {
        /* the filter simply has no options; the page reports API errors separately */
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const query = regionInput.trim();
    if (query.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      apiGet<RegionsResponse>(`/api/regions?q=${encodeURIComponent(query)}&limit=20`).then(
        (response) => {
          if (!active) return;
          setRegionOptions((previous) => {
            const merged = new Map(previous.map((region) => [region._id, region]));
            for (const region of response.regions) merged.set(region._id, region);
            return [...merged.values()];
          });
        },
        () => {
          /* keep the already-loaded options */
        },
      );
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [regionInput]);

  useEffect(() => {
    setQDraft(q);
  }, [q]);

  useEffect(() => {
    setMinDraft(minAmount !== null ? String(minAmount) : '');
  }, [minAmount]);

  useEffect(() => {
    setMaxDraft(maxAmount !== null ? String(maxAmount) : '');
  }, [maxAmount]);

  const allFunctions =
    functionsState.data?.functions.flatMap((division) => [division, ...division.subdivisions]) ??
    [];
  const selectedFunction = allFunctions.find((fn) => fn.code === functionCode) ?? null;
  const selectedRegion = regionOptions.find((region) => region._id === regionId) ?? null;
  const yearOptions = coverage.data?.fiscal_years ?? [];
  const measureTypeOptions = coverage.data?.measure_types ?? MEASURE_TYPES;

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    setSearchParams(next);
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  };

  const reset = () => setSearchParams(new URLSearchParams());

  const commitDollar = (param: 'min_amount' | 'max_amount', raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      update({ [param]: null });
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    update({ [param]: String(parsed) });
  };

  const commitText = () => {
    const trimmed = qDraft.trim();
    if (trimmed === q) return;
    update({ q: trimmed || null });
  };

  const applied: string[] = [];
  if (functionCode) {
    applied.push(
      `Function: ${selectedFunction ? `${selectedFunction.code} — ${selectedFunction.name}` : functionCode}`,
    );
  }
  if (regionId) {
    applied.push(
      `Region: ${selectedRegion ? `${selectedRegion.code} — ${selectedRegion.name}` : regionId}`,
    );
  }
  if (areaSlug) applied.push(`Area: ${areaSlug}`);
  if (fiscalYear) applied.push(`Fiscal year: ${fiscalYear}`);
  if (measureType) applied.push(`Measure type: ${titleCase(measureType)}`);
  if (jurisdictionLevel) applied.push(`Jurisdiction: ${titleCase(jurisdictionLevel)}`);
  if (locationState) applied.push(`State: ${locationState}`);
  if (postcode) applied.push(`Postcode: ${postcode}`);
  if (expenseCategory) {
    applied.push(
      `Expense category: ${
        EXPENSE_CATEGORIES.find(([value]) => value === expenseCategory)?.[1] ?? expenseCategory
      }`,
    );
  }
  if (minAmount !== null) applied.push(`Min amount: $${minAmount.toLocaleString('en-AU')}`);
  if (maxAmount !== null) applied.push(`Max amount: $${maxAmount.toLocaleString('en-AU')}`);

  const pageSources = uniqueSources((state.data?.data ?? []).map((row) => row.provenance));
  const showPbsCaveat =
    (measureType === 'budget' && jurisdictionLevel === 'federal') ||
    pageSources.some((source) => source.source_id === 'data-gov-au-pbs');
  const showGrantNote =
    measureType === 'grant_award' ||
    pageSources.some((source) => source.source_id === 'grantconnect');
  const showNswNote =
    jurisdictionLevel === 'state' ||
    pageSources.some(
      (source) => source.source_id === 'nsw-budget' || source.source_id === 'data-nsw-ckan',
    );
  const showCharityNote =
    jurisdictionLevel === 'charity' ||
    pageSources.some((source) => source.source_id === 'acnc-charity');

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Spending explorer
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Query every measure through <code>/api/spending</code>: live AusTender federal contract
        records, PBS budget line items, NSW/VIC/QLD Budget rows, selected data.nsw.gov.au CKAN state
        datasets (CSV/XLSX downloads and DataStore pages), Dubbo council rows, GrantConnect grant
        awards from an archived manual export, ACNC charity expenses and the ABS GFS benchmark
        (benchmark rows are shown separately and never summed with project data). Measure types are
        never added together, and NSW budget figures are labelled <strong>Budgeted</strong>; some
        CKAN rows are <strong>provisional</strong> where the source does not state a unit. Filters,
        sort and pagination live in the URL, so reload and browser back/forward restore the same
        view. Amounts are entered in dollars and sent to the API as integer cents.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          onClick={() =>
            update({ measure_type: 'contract', jurisdiction_level: 'federal', sort: 'amount_desc' })
          }
        >
          Show federal contracts (AusTender)
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            update({
              measure_type: 'contract',
              jurisdiction_level: 'federal',
              sort: 'fiscal_year_desc',
            })
          }
        >
          Latest federal contracts
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            update({
              measure_type: 'budget',
              jurisdiction_level: 'federal',
              sort: 'amount_desc',
            })
          }
        >
          Show federal budget (PBS)
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            update({
              jurisdiction_level: 'state',
              measure_type: 'budget',
              sort: 'amount_desc',
            })
          }
        >
          Show NSW state budget (Budgeted)
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            update({
              jurisdiction_level: 'charity',
              expense_category: 'total',
              sort: 'amount_desc',
            })
          }
        >
          Show charity total expenses (ACNC)
        </Button>
      </Stack>

      {showCharityNote ? (
        <Alert severity="info" data-testid="acnc-charity-note" sx={{ mb: 3 }}>
          <strong>ACNC charity expenses are not government spending.</strong> These are actual
          expenses reported by ACNC-registered charities. They have no COFOG function and are never
          merged with federal/state/local spending. The source publishes a total-expenses row and
          five explicit component categories; ausspend never adds a total and its components
          together. Filter <code>expense_category=total</code> for a headline figure, or pick one
          component to read it on its own. State/postcode comes only from AIS program operating
          locations, is single-state only and is flagged approximate.
        </Alert>
      ) : null}

      {showNswNote ? (
        <Alert severity="info" data-testid="nsw-budgeted-note" sx={{ mb: 3 }}>
          <strong>NSW state rows are Budgeted.</strong> The NSW Budget 2025-26 figures are
          statement/capital budget lines, not actual or spent amounts. Capital projects are Budgeted
          for 2025-26, and rows never carry an invented LGA. data.nsw.gov.au CKAN rows include
          budget allocations, reported historical spend and provisional inferred units; their
          provenance and deferred PDF/DOCX resources are listed on the Data sources page. Measure
          types are not summed.
        </Alert>
      ) : null}

      {showPbsCaveat ? (
        <Alert severity="warning" data-testid="pbs-caveat" sx={{ mb: 3 }}>
          <strong>PBS line-item caveat.</strong> {PBS_CAVEAT} The per-measure-type budget total
          below is the PBS line-item sum only.
        </Alert>
      ) : null}

      {showGrantNote ? (
        <Alert severity="info" data-testid="grantconnect-partial" sx={{ mb: 3 }}>
          <strong>GrantConnect is a manual export.</strong> {GRANTCONNECT_CAVEAT}
        </Alert>
      ) : null}

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="jump-search">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Jump to a function or region
          </Typography>
          <QuickSearch
            label="Find a function or region"
            onPickFunction={(code) => update({ function: code })}
            onPickRegion={(region) => {
              setRegionInput(`${region.code} — ${region.name}`);
              update({ region: region._id, area: null });
            }}
          />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="spending-filters">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            <TextField
              size="small"
              label="Project or item"
              value={qDraft}
              onChange={(event) => setQDraft(event.target.value)}
              onBlur={commitText}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitText();
                }
              }}
              placeholder="e.g. New Dubbo Bridge"
              helperText={
                q
                  ? state.data
                    ? `${state.data.pagination.total} matching row${state.data.pagination.total === 1 ? '' : 's'}`
                    : 'Matching project name, description or delivery entity'
                  : 'Text match over project name, description or delivery entity — not fuzzy'
              }
              inputProps={{ maxLength: 100 }}
            />

            <TextField
              select
              size="small"
              label="Function"
              value={functionCode}
              onChange={(event) => update({ function: event.target.value })}
            >
              <MenuItem value="">All functions</MenuItem>
              {allFunctions.map((fn) => (
                <MenuItem key={fn.code} value={fn.code}>
                  {fn.code} — {fn.name}
                </MenuItem>
              ))}
            </TextField>

            <Autocomplete
              options={regionOptions}
              value={selectedRegion}
              onChange={(_, value) => update({ region: value?._id ?? null, area: null })}
              onInputChange={(_, value) => setRegionInput(value)}
              getOptionLabel={(option) => `${option.code} — ${option.name}`}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              renderInput={(params) => (
                <TextField {...params} label="Region" size="small" placeholder="All regions" />
              )}
            />

            <TextField
              select
              size="small"
              label="Fiscal year"
              value={fiscalYear}
              onChange={(event) => update({ fiscal_year: event.target.value })}
            >
              <MenuItem value="">All fiscal years</MenuItem>
              {yearOptions.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Measure type"
              value={measureType}
              onChange={(event) => update({ measure_type: event.target.value })}
            >
              <MenuItem value="">All measure types</MenuItem>
              {measureTypeOptions.map((type) => (
                <MenuItem key={type} value={type}>
                  {titleCase(type)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Jurisdiction"
              value={jurisdictionLevel}
              onChange={(event) => update({ jurisdiction_level: event.target.value })}
            >
              <MenuItem value="">All jurisdictions</MenuItem>
              {JURISDICTION_LEVELS.map((level) => (
                <MenuItem key={level} value={level}>
                  {titleCase(level)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              label="State"
              value={locationState}
              onChange={(event) => update({ state: event.target.value.toUpperCase() })}
              placeholder="e.g. NSW"
            />

            <TextField
              size="small"
              label="Postcode"
              value={postcode}
              onChange={(event) =>
                update({ postcode: event.target.value.replace(/\D/g, '').slice(0, 4) })
              }
              placeholder="e.g. 2000"
            />

            <TextField
              select
              size="small"
              label="Expense category"
              value={expenseCategory}
              onChange={(event) => update({ expense_category: event.target.value })}
            >
              <MenuItem value="">All expense categories</MenuItem>
              {EXPENSE_CATEGORIES.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              type="number"
              label="Min amount (AUD)"
              value={minDraft}
              onChange={(event) => setMinDraft(event.target.value)}
              onBlur={() => commitDollar('min_amount', minDraft)}
              inputProps={{ min: 0, step: 1 }}
            />

            <TextField
              size="small"
              type="number"
              label="Max amount (AUD)"
              value={maxDraft}
              onChange={(event) => setMaxDraft(event.target.value)}
              onBlur={() => commitDollar('max_amount', maxDraft)}
              inputProps={{ min: 0, step: 1 }}
            />

            <TextField
              select
              size="small"
              label="Sort"
              value={sort}
              onChange={(event) => update({ sort: event.target.value })}
            >
              {SORTS.map((option) => (
                <MenuItem key={option} value={option}>
                  {SORT_LABELS[option]}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" onClick={reset}>
              Reset filters
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="applied-filters">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Applied filters
          </Typography>
          {applied.length === 0 && !q ? (
            <Typography variant="body2" color="text.secondary">
              No filters applied — showing every measure in the database, whatever its source.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {q ? (
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={`Project or item: “${q}”`}
                  onDelete={() => update({ q: null })}
                />
              ) : null}
              {applied.map((label) => (
                <Chip key={label} size="small" label={label} />
              ))}
            </Stack>
          )}
          <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 1 }}>
            Sort: {SORT_LABELS[sort]} · Page {page}
            {state.data ? ` of ${Math.max(1, state.data.pagination.total_pages)}` : ''} · Page size{' '}
            {pageSize}
          </Typography>
        </CardContent>
      </Card>

      {state.loading ? <LoadingState label="Loading spending rows…" /> : null}
      {!state.loading && state.error ? <ApiErrorState error={state.error} /> : null}
      {!state.loading && !state.error && state.data ? (
        state.data.summary.count === 0 ? (
          <EmptyState
            title={
              coverage.data?.synthetic === false
                ? 'No real data for this dimension yet'
                : 'No spending rows match these filters'
            }
            message={
              coverage.data?.synthetic === false
                ? 'No real published spending rows match this filter combination. The synthetic seed is not present and no real feed covers this dimension yet. Nothing is estimated, zero-filled or invented. Reset the filters to see the whole database.'
                : 'The API returned no rows for this filter combination. Nothing is estimated, zero-filled or invented. Reset the filters to see the whole database.'
            }
          />
        ) : (
          <>
            {state.data.area_profile ? (
              <AreaPanels profile={state.data.area_profile} />
            ) : (
              <SpendingSummaryPanel
                summary={state.data.summary}
                sources={pageSources}
                note="Summary provenance is taken from the returned page rows; each row names its own source."
              />
            )}

            {state.data.data.length === 0 ? (
              <EmptyState
                title="This page is empty"
                message={`The filtered set has ${state.data.pagination.total} rows but page ${state.data.pagination.page} has none. Use the pagination controls or reset filters.`}
              />
            ) : (
              <SpendingRowsTable rows={state.data.data} />
            )}

            <Card variant="outlined" data-testid="pagination">
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Typography variant="body2">
                    Page {state.data.pagination.page} of{' '}
                    {Math.max(1, state.data.pagination.total_pages)} · {state.data.pagination.total}{' '}
                    rows
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField
                      select
                      size="small"
                      label="Page size"
                      value={pageSize}
                      onChange={(event) => update({ page_size: event.target.value })}
                      sx={{ minWidth: 130 }}
                    >
                      {PAGE_SIZES.map((size) => (
                        <MenuItem key={size} value={String(size)}>
                          {size}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="outlined"
                      disabled={state.data.pagination.page <= 1}
                      onClick={() => goToPage(state.data!.pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={!state.data.pagination.has_next}
                      onClick={() => goToPage(state.data!.pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </>
        )
      ) : null}
    </Box>
  );
}
