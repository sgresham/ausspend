import { Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { apiGet, buildQuery } from '../api';
import type { MeasureRow, RegionDetail } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useCoverage } from '../coverage';
import { typeTotalsFromApi } from '../measures';
import { titleCase } from '../format';
import { FilterBar, type FilterSelection } from './FilterBar';
import { uniqueSources } from '../provenance';
import { MeasureTypeStackedBar, SpendingBarChart, type BarDatum } from './SpendingCharts';
import {
  FunctionBreakdownTable,
  MeasureRowsTable,
  MeasureTypeBreakdownTable,
} from './SpendingTables';
import { ApiErrorState, EmptyState, LoadingState } from './StatusViews';
import { TotalsPanel } from './TotalsPanel';

interface RegionDetailViewProps {
  regionId?: string;
  stateCode?: string;
}

export function RegionDetailView({ regionId, stateCode }: RegionDetailViewProps) {
  const isState = Boolean(stateCode);
  const scope = isState ? `state:${stateCode}` : `region:${regionId}`;
  const coverage = useCoverage();
  const [searchParams, setSearchParams] = useSearchParams();
  const selection: FilterSelection = {
    fiscalYear: searchParams.get('fiscal_year') ?? '',
    measureType: searchParams.get('measure_type') ?? '',
  };
  const filterActive = selection.fiscalYear !== '' || selection.measureType !== '';

  const basePath = isState
    ? `/api/states/${encodeURIComponent(stateCode ?? '')}`
    : `/api/regions/${encodeURIComponent(regionId ?? '')}`;

  const detailUrl = (filters: FilterSelection) =>
    `${basePath}${buildQuery({
      fiscal_year: filters.fiscalYear || undefined,
      measure_type: filters.measureType || undefined,
    })}`;

  const base = useApi(`${scope}:base`, () =>
    apiGet<RegionDetail>(detailUrl({ fiscalYear: '', measureType: '' })),
  );
  const filtered = useApi(`${scope}:view:${selection.fiscalYear}:${selection.measureType}`, () =>
    filterActive ? apiGet<RegionDetail>(detailUrl(selection)) : Promise.resolve(null),
  );

  const detail = filterActive ? filtered.data : base.data;
  const loading = base.loading || (filterActive && filtered.loading);
  const error = base.error ?? filtered.error;

  const years = coverage.data?.fiscal_years ?? [];
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
    <Button
      component={RouterLink}
      to={isState ? '/states' : '/regions'}
      startIcon={<ArrowBackIcon />}
      sx={{ mb: 2 }}
    >
      {isState ? 'All states and territories' : 'All regions'}
    </Button>
  );

  if (loading && !detail) {
    return (
      <>
        {backLink}
        <LoadingState label={`Loading ${isState ? 'state' : 'region'}…`} />
      </>
    );
  }

  if (error && !detail) {
    return (
      <>
        {backLink}
        <ApiErrorState
          error={error}
          hint={
            isState
              ? 'State codes are abbreviations such as NSW, VIC, QLD, WA, SA, TAS, ACT and NT.'
              : 'Region pages require the 24-character hex region _id from the regions directory or search results, not a region code.'
          }
        />
      </>
    );
  }

  if (!detail) {
    return (
      <>
        {backLink}
        <LoadingState label="Loading region…" />
      </>
    );
  }

  const region = detail.region;
  const sources = uniqueSources(detail.measures);
  const totals = typeTotalsFromApi(detail.total_by_measure_type);
  const functionNames = new Map(
    detail.by_function.map((group) => [
      group.function.code,
      `${group.function.code} — ${group.function.name}`,
    ]),
  );
  const labelFor = (row: MeasureRow) =>
    (row.function_code ? functionNames.get(row.function_code) : undefined) ??
    row.function_code ??
    'No COFOG function';
  const singleFunctionGroups = detail.by_function.filter((group) => group.total_cents !== null);
  const functionBarData: BarDatum[] = singleFunctionGroups.map((group) => ({
    label: `${group.function.code} — ${group.function.name}`,
    value: group.total_cents as number,
  }));
  const functionBarSources = uniqueSources(singleFunctionGroups.flatMap((group) => group.measures));

  const exploreParams = new URLSearchParams({ region: region._id });
  if (detail.filters.fiscal_year) exploreParams.set('fiscal_year', detail.filters.fiscal_year);
  if (detail.filters.measure_type) exploreParams.set('measure_type', detail.filters.measure_type);
  const exploreUrl = `/search?${exploreParams.toString()}`;

  return (
    <>
      {backLink}
      <Typography variant="overline" color="text.secondary">
        {titleCase(region.level)} region
      </Typography>
      <Typography variant="h1" gutterBottom>
        {region.name} ({region.code})
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Spending recorded for this region in the Phase 1 synthetic seed. Region detail is fetched by
        the region&apos;s <code>_id</code>; state pages use the state/territory abbreviation. Group
        totals and per-type totals come from the API.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Button
          component={RouterLink}
          to={exploreUrl}
          size="small"
          variant="outlined"
          startIcon={<SearchIcon />}
        >
          Explore this in the spending search
        </Button>
      </Stack>

      <FilterBar
        years={years}
        measureTypes={measureTypes}
        selection={selection}
        onChange={setFilters}
      />

      {detail.count === 0 ? (
        <EmptyState
          title="No measures for this view"
          message={`No measure rows match fiscal year “${selection.fiscalYear || 'all'}” and measure type “${selection.measureType || 'all'}” for ${region.name}. Nothing is being estimated or filled in.`}
        />
      ) : (
        <>
          <TotalsPanel
            summary={detail}
            sources={sources}
            scopeLabel={region.name}
            note="Phase 1 synthetic seed; every row is verified:false."
          />

          {detail.mixed ? (
            <>
              <MeasureTypeStackedBar
                measureTypes={detail.measure_types}
                totals={totals}
                sources={sources}
                note={`Per-type totals from the API over ${detail.count} rows.`}
              />
              <MeasureTypeBreakdownTable
                totals={detail.total_by_measure_type}
                rows={detail.measures}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Per-function totals are withheld because this view mixes measure types. The
                per-function table shows each function&apos;s API totals instead.
              </Typography>
            </>
          ) : (
            <SpendingBarChart
              title="Spending by COFOG function"
              description="Totals by function for the single measure type in this view. Functions with no rows are absent rather than zero-filled."
              data={functionBarData}
              sources={functionBarSources}
              note={`Totals from the API over ${detail.count} measure rows.`}
            />
          )}

          <FunctionBreakdownTable groups={detail.by_function} />

          <MeasureRowsTable
            rows={detail.measures}
            labelFor={labelFor}
            caption="Every row carries its own source id, source URL and verification status."
            testId="region-measure-rows"
          />
        </>
      )}
    </>
  );
}
