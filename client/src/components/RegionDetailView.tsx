import { Alert, AlertTitle, Box, Button, Stack, Typography } from '@mui/material';
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
import { Amount } from './Provenance';
import { MeasureTypeStackedBar, SpendingBarChart, type BarDatum } from './SpendingCharts';
import {
  FunctionBreakdownTable,
  MeasureRowsTable,
  MeasureTypeBreakdownTable,
} from './SpendingTables';
import { ApiErrorState, EmptyState, LoadingState } from './StatusViews';
import { TotalsPanel } from './TotalsPanel';
import { AreaPanels } from './AreaPanels';

interface RegionDetailViewProps {
  regionId?: string;
  stateCode?: string;
}

/**
 * Coverage note added to the region/state detail response. Kept local so the
 * component consumes the new API field without widening the shared response
 * types in this cure.
 */
interface RegionCoverage {
  scope: 'national' | 'state' | 'region';
  reason:
    'has-additive-rows' | 'national-no-project-series' | 'benchmark-only' | 'no-additive-rows';
  additive_count: number;
  benchmark_count: number;
  benchmark_sources: string[];
  benchmark_available: boolean;
  benchmark_href: string;
  message: string | null;
}

type RegionDetailWithCoverage = RegionDetail & { coverage?: RegionCoverage };

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
    apiGet<RegionDetailWithCoverage>(detailUrl({ fiscalYear: '', measureType: '' })),
  );
  const filtered = useApi(`${scope}:view:${selection.fiscalYear}:${selection.measureType}`, () =>
    filterActive ? apiGet<RegionDetailWithCoverage>(detailUrl(selection)) : Promise.resolve(null),
  );

  const detail = filterActive ? filtered.data : base.data;
  const loading = base.loading || (filterActive && filtered.loading);
  const error = base.error ?? filtered.error;

  const years = coverage.data?.fiscal_years ?? [];
  const measureTypes = base.data?.measure_types ?? [];
  const syntheticPresent = coverage.data?.synthetic ?? false;

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
  const areaProfile = detail.area_profile ?? null;
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
  const additiveRows = detail.measures.filter(
    (row) =>
      row.aggregation_role !== 'agency_detail' &&
      row.aggregation_role !== 'policy_measure' &&
      row.aggregation_role !== 'benchmark',
  );
  const nonAdditiveBlocks =
    detail.non_additive && detail.non_additive.length > 0
      ? detail.non_additive
      : detail.agency_detail
        ? [detail.agency_detail]
        : [];
  const sources = uniqueSources(additiveRows);

  const regionCoverage = detail.coverage;
  const coverageTitle =
    regionCoverage?.reason === 'national-no-project-series'
      ? 'No national project series in this layer'
      : regionCoverage?.reason === 'benchmark-only'
        ? 'No additive rows; benchmark data exists separately'
        : syntheticPresent
          ? 'No measures for this view'
          : 'No additive data for this dimension yet';
  const coverageMessage =
    !syntheticPresent && regionCoverage?.message
      ? regionCoverage.message
      : syntheticPresent
        ? `No measure rows match fiscal year “${selection.fiscalYear || 'all'}” and measure type “${selection.measureType || 'all'}” for ${region.name}. Nothing is being estimated or filled in.`
        : `No real published additive rows match fiscal year “${selection.fiscalYear || 'all'}” and measure type “${selection.measureType || 'all'}” for ${region.name}. Benchmark and other non-additive layers are never merged into these totals. Nothing is estimated, zero-filled or replaced with a placeholder.`;

  const exploreParams = new URLSearchParams(
    areaProfile ? { area: areaProfile.area.slug } : { region: region._id },
  );
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
        {areaProfile
          ? 'Area profile: local Dubbo rows, NSW-wide state rows, NSW-tagged federal AusTender rows and a separate Commonwealth-wide PBS panel. These levels overlap and are never added together.'
          : detail.coverage?.reason === 'national-no-project-series'
            ? 'National coverage note: no actual, budget or estimate project series is recorded against a curated national region. The ABS GFS COFOG-A benchmark is a separate, non-additive statistical layer at /benchmark; federal contracts and grants are not mapped to a national region and no national total is invented.'
            : syntheticPresent
              ? 'Spending recorded for this region in the Phase 1 synthetic seed and live ingestions. Region detail is fetched by the region _id or a case-insensitive slug/name; state pages use the state/territory abbreviation. Group totals and per-type totals come from the API.'
              : 'Real spending recorded for this region. Region pages match a curated region _id; state and territory pages match the government jurisdiction (not merely a location tag), including ACT/NT territory budget rows. Benchmark-only layers such as TAS are listed separately at /benchmark and never added to these totals. Group totals and per-type totals come from the API over the full match set.'}
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
        <EmptyState title={coverageTitle} message={coverageMessage}>
          {regionCoverage?.benchmark_available ? (
            <Button
              component={RouterLink}
              to={regionCoverage.benchmark_href}
              size="small"
              variant="outlined"
              sx={{ mt: 1 }}
            >
              Open the non-additive benchmark
            </Button>
          ) : null}
        </EmptyState>
      ) : areaProfile ? (
        <>
          <AreaPanels profile={areaProfile} />
          <MeasureRowsTable
            rows={detail.measures}
            labelFor={labelFor}
            caption="Local, state and NSW-tagged federal rows keep their own jurisdiction level, measure type, source id and source URL. Panels are not additive."
            testId="region-measure-rows"
          />
        </>
      ) : (
        <>
          <TotalsPanel
            summary={detail}
            sources={sources}
            scopeLabel={region.name}
            note={
              syntheticPresent
                ? 'Phase 1 synthetic seed and live ingestions; every row is verified:false.'
                : 'Real published rows only; every row is unverified until human-checked.'
            }
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

          {detail.rows_truncated ? (
            <Alert severity="info" sx={{ mb: 2 }} data-testid="rows-truncated-note">
              Showing the first {detail.rows_returned ?? detail.measures.length} of{' '}
              {detail.count.toLocaleString()} matching rows. All totals above cover the full{' '}
              {detail.count.toLocaleString()} rows: the row page is paged separately from the
              aggregates.
            </Alert>
          ) : null}

          <MeasureRowsTable
            rows={additiveRows}
            labelFor={labelFor}
            caption="Additive rows only. Non-additive detail is listed separately below."
            testId="region-measure-rows"
          />

          {nonAdditiveBlocks.map((block) => (
            <Box key={block.aggregation_role}>
              <Alert
                severity="info"
                sx={{ mb: 2 }}
                data-testid={
                  block.aggregation_role === 'agency_detail'
                    ? 'agency-detail-note'
                    : 'policy-detail-note'
                }
              >
                <AlertTitle>{block.label}</AlertTitle>
                {block.count} non-additive row(s)
                {block.total_cents !== null && block.total_cents !== undefined ? (
                  <>
                    {' '}
                    totalling <Amount cents={block.total_cents} />
                  </>
                ) : null}
                . {block.description ?? 'Excluded from the headline total and every additive view.'}
              </Alert>
              <MeasureRowsTable
                rows={block.measures}
                labelFor={labelFor}
                caption="Non-additive detail: shown for provenance, never added to additive totals."
                testId={
                  block.aggregation_role === 'agency_detail'
                    ? 'agency-detail-rows'
                    : 'policy-detail-rows'
                }
              />
            </Box>
          ))}
        </>
      )}
    </>
  );
}
