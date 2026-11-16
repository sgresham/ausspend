import { Alert, Button, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { apiGet, buildQuery } from '../api';
import type { FunctionDetail, MeasureRow } from '../api/types';
import { useApi } from '../hooks/useApi';
import { fiscalYearsFromRows, LIMIT_FOR_TOTALS, measureTypeTotals } from '../measures';
import { FilterBar, type FilterSelection } from './FilterBar';
import { uniqueSources } from '../provenance';
import { MeasureTypeStackedBar, SpendingBarChart, type BarDatum } from './SpendingCharts';
import { MeasureRowsTable, MeasureTypeBreakdownTable, RankedStatesTable } from './SpendingTables';
import { ApiErrorState, EmptyState, LoadingState } from './StatusViews';
import { TotalsPanel } from './TotalsPanel';

function detailUrl(code: string, filters: FilterSelection): string {
  return `/api/functions/${encodeURIComponent(code)}${buildQuery({
    fiscal_year: filters.fiscalYear || undefined,
    measure_type: filters.measureType || undefined,
    limit: LIMIT_FOR_TOTALS,
  })}`;
}

export function FunctionDetailView() {
  const { code = '' } = useParams<{ code: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selection: FilterSelection = {
    fiscalYear: searchParams.get('fiscal_year') ?? '',
    measureType: searchParams.get('measure_type') ?? '',
  };
  const filterActive = selection.fiscalYear !== '' || selection.measureType !== '';

  const base = useApi(`function-base:${code}`, () =>
    apiGet<FunctionDetail>(detailUrl(code, { fiscalYear: '', measureType: '' })),
  );
  const filtered = useApi(
    `function-view:${code}:${selection.fiscalYear}:${selection.measureType}`,
    () =>
      filterActive ? apiGet<FunctionDetail>(detailUrl(code, selection)) : Promise.resolve(null),
  );

  const detail = filterActive ? filtered.data : base.data;
  const loading = base.loading || (filterActive && filtered.loading);
  const error = base.error ?? filtered.error;

  const years = base.data ? fiscalYearsFromRows(base.data.measures) : [];
  const measureTypes = base.data?.measure_types ?? [];

  const setFilters = (next: FilterSelection) => {
    const params = new URLSearchParams(searchParams);
    if (next.fiscalYear) params.set('fiscal_year', next.fiscalYear);
    else params.delete('fiscal_year');
    if (next.measureType) params.set('measure_type', next.measureType);
    else params.delete('measure_type');
    setSearchParams(params, { replace: true });
  };

  const backLink = (
    <Button component={RouterLink} to="/functions" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
      All COFOG functions
    </Button>
  );

  if (loading && !detail) {
    return (
      <>
        {backLink}
        <LoadingState label={`Loading function ${code}…`} />
      </>
    );
  }

  if (error && !detail) {
    return (
      <>
        {backLink}
        <ApiErrorState
          error={error}
          hint="Function codes are two digits (01–10) or a three-digit subdivision. Check the code and try again."
        />
      </>
    );
  }

  if (!detail) {
    return (
      <>
        {backLink}
        <LoadingState label={`Loading function ${code}…`} />
      </>
    );
  }

  const sources = uniqueSources(detail.measures);
  const totals = measureTypeTotals(detail.measures);
  const regionNames = new Map(
    detail.by_region.map((group) => [
      group.region._id,
      `${group.region.code} — ${group.region.name}`,
    ]),
  );
  const labelFor = (row: MeasureRow) => regionNames.get(row.region_id) ?? row.region_id;
  const scopeLabel = `${detail.function.name} (${detail.function.code})`;
  const ranked = detail.ranked_states ?? [];
  const rankedRegionIds = new Set(ranked.map((entry) => entry.region._id));
  const rankedSources = uniqueSources(
    detail.by_region
      .filter((group) => rankedRegionIds.has(group.region._id))
      .flatMap((group) => group.measures),
  );
  const rankedBarData: BarDatum[] = ranked.map((entry) => ({
    label: `${entry.region.code} — ${entry.region.name}`,
    value: entry.total_cents,
  }));

  return (
    <>
      {backLink}
      <Typography variant="overline" color="text.secondary">
        COFOG {detail.function.level}
      </Typography>
      <Typography variant="h1" gutterBottom>
        {detail.function.name} ({detail.function.code})
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Spending recorded against this function in the Phase 1 synthetic seed. Filters and the
        measure-type rule below determine whether any total can be shown.
      </Typography>

      <FilterBar
        years={years}
        measureTypes={measureTypes}
        selection={selection}
        onChange={setFilters}
        limitNote={`limit=${LIMIT_FOR_TOTALS} requested`}
      />

      {detail.count === 0 ? (
        <EmptyState
          title="No measures for this view"
          message={`No measure rows match fiscal year “${selection.fiscalYear || 'all'}” and measure type “${selection.measureType || 'all'}” for ${scopeLabel}. Nothing is being estimated or filled in.`}
        />
      ) : (
        <>
          <TotalsPanel
            summary={detail}
            sources={sources}
            scopeLabel={scopeLabel}
            limit={detail.filters.limit}
            note="Phase 1 synthetic seed; every row is verified:false."
          />

          {detail.mixed ? (
            <>
              <MeasureTypeStackedBar
                measureTypes={detail.measure_types}
                totals={totals}
                sources={sources}
                note={`Computed from ${detail.count} rows with limit=${detail.filters.limit}.`}
              />
              <MeasureTypeBreakdownTable
                measureTypes={detail.measure_types}
                rows={detail.measures}
                limit={detail.filters.limit}
              />
            </>
          ) : ranked.length > 0 ? (
            <>
              <SpendingBarChart
                title="Ranked state totals"
                description="State and territory totals for the single measure type in this view. National and sub-state rows are excluded from the ranking."
                data={rankedBarData}
                sources={rankedSources}
                note={`Ranked from ${detail.count} measure rows (limit=${detail.filters.limit}).`}
              />
              <RankedStatesTable ranked={ranked} byRegion={detail.by_region} />
            </>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }} data-testid="no-ranked-states">
              This single-type view has no ranked state list. The API returns national or sub-state
              rows that cannot be ranked as states, so no ranking is invented.
            </Alert>
          )}

          <MeasureRowsTable
            rows={detail.measures}
            labelFor={labelFor}
            caption="Every row carries its own source id, source URL and verification status."
            testId="function-measure-rows"
          />
        </>
      )}
    </>
  );
}
