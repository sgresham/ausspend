/**
 * Trimmed SDMX-JSON fixtures copied from the ABS Data API Beta responses.
 * Goods: ITGS 1.2.0, M1 current prices, TSEST 10 original, REGION AUS, FREQ M.
 * Services: TRADE_SERV_CNTRY_FY 1.0.0, EBOPS TOTAL, COUNTRY TOT, FREQ A.
 * Both carry UNIT_MEASURE AUD and UNIT_MULT 6 (millions of dollars).
 */
export const ABS_GOODS_FIXTURE = {
  data: {
    dataSets: [
      {
        series: {
          '0:0:0:0:0': { observations: { '0': [41697], '1': [44537] } },
          '0:1:0:0:0': { observations: { '0': [-38801], '1': [-40693] } },
          '0:2:0:0:0': { observations: { '0': [10000], '1': [11000] } },
        },
      },
    ],
    structures: [
      {
        dimensions: {
          series: [
            { id: 'MEASURE', values: [{ id: 'M1', name: 'Current Prices' }] },
            {
              id: 'DATA_ITEM',
              values: [
                { id: '1000', name: 'Goods Credit; Total goods' },
                { id: '2000', name: 'Goods Debit; Total goods' },
                { id: '1400', name: 'Goods Credit; Metal ores and minerals' },
              ],
            },
            { id: 'TSEST', values: [{ id: '10', name: 'Original' }] },
            { id: 'REGION', values: [{ id: 'AUS', name: 'Australia' }] },
            { id: 'FREQ', values: [{ id: 'M', name: 'Monthly' }] },
          ],
          observation: [
            {
              id: 'TIME_PERIOD',
              values: [
                { id: '2024-07', name: '2024-07' },
                { id: '2024-08', name: '2024-08' },
              ],
            },
          ],
        },
        attributes: {
          dataSet: [
            { id: 'UNIT_MEASURE', values: [{ id: 'AUD' }] },
            { id: 'UNIT_MULT', values: [{ id: '6' }] },
          ],
        },
      },
    ],
  },
};

export const ABS_SERVICES_FIXTURE = {
  data: {
    dataSets: [
      {
        series: {
          '0:0:0:0': { observations: { '0': [-172051] } },
          '1:0:0:0': { observations: { '0': [134324] } },
        },
      },
    ],
    structures: [
      {
        dimensions: {
          series: [
            {
              id: 'EXP_IMP',
              values: [
                { id: 'IMP', name: 'Debits' },
                { id: 'EXP', name: 'Credits' },
              ],
            },
            { id: 'EBOPS', values: [{ id: 'TOTAL', name: 'Total Services (BPM basis)' }] },
            { id: 'COUNTRY', values: [{ id: 'TOT', name: 'Total all countries' }] },
            { id: 'FREQ', values: [{ id: 'A', name: 'Annual' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2024', name: '2024' }] }],
        },
        attributes: {
          dataSet: [
            { id: 'UNIT_MEASURE', values: [{ id: 'AUD' }] },
            { id: 'UNIT_MULT', values: [{ id: '6' }] },
          ],
        },
      },
    ],
  },
};

/**
 * Multi-period history fixtures used by the full-history tests. The values are
 * trimmed but preserve the published dimension order and monthly/annual IDs.
 */
const GOODS_SERIES_META = [
  { id: '1000', name: 'Goods Credit; Total goods' },
  { id: '2000', name: 'Goods Debit; Total goods' },
  { id: '1400', name: 'Goods Credit; Metal ores and minerals' },
] as const;

const GOODS_HISTORY_VALUES: Record<string, [number, number, number]> = {
  '1971-07': [423, -340, 100],
  '1971-08': [401, -346, 90],
  '2015-07': [3000, -3100, 500],
  '2015-08': [3100, -3200, 510],
  '2024-07': [41697, -38801, 10000],
  '2025-06': [44537, -40693, 11000],
  '2026-07': [48000, -46000, 12000],
  '2026-08': [48100, -46100, 12100],
  '2026-09': [48173, -46547, 12200],
};

export function goodsFixtureForPeriods(periods: readonly string[]) {
  const series = Object.fromEntries(
    GOODS_SERIES_META.map((_, seriesIndex) => [
      `0:${seriesIndex}:0:0:0`,
      {
        observations: Object.fromEntries(
          periods.map((period, obsIndex) => [
            String(obsIndex),
            [GOODS_HISTORY_VALUES[period]?.[seriesIndex] ?? 1000],
          ]),
        ),
      },
    ]),
  );
  return {
    data: {
      dataSets: [{ series }],
      structures: [
        {
          dimensions: {
            series: [
              { id: 'MEASURE', values: [{ id: 'M1', name: 'Current Prices' }] },
              {
                id: 'DATA_ITEM',
                values: GOODS_SERIES_META.map((item) => ({ id: item.id, name: item.name })),
              },
              { id: 'TSEST', values: [{ id: '10', name: 'Original' }] },
              { id: 'REGION', values: [{ id: 'AUS', name: 'Australia' }] },
              { id: 'FREQ', values: [{ id: 'M', name: 'Monthly' }] },
            ],
            observation: [
              {
                id: 'TIME_PERIOD',
                values: periods.map((period) => ({ id: period, name: period })),
              },
            ],
          },
          attributes: {
            dataSet: [
              { id: 'UNIT_MEASURE', values: [{ id: 'AUD' }] },
              { id: 'UNIT_MULT', values: [{ id: '6' }] },
            ],
          },
        },
      ],
    },
  };
}

const SERVICES_HISTORY_VALUES: Record<string, [number, number]> = {
  '2000': [-200000, 150000],
  '2001': [-210000, 160000],
  '2023': [-160000, 120000],
  '2024': [-172051, 134324],
};

export function servicesFixtureForYears(years: readonly string[]) {
  const series = {
    '0:0:0:0': {
      observations: Object.fromEntries(
        years.map((year, obsIndex) => [
          String(obsIndex),
          [SERVICES_HISTORY_VALUES[year]?.[0] ?? -100000],
        ]),
      ),
    },
    '1:0:0:0': {
      observations: Object.fromEntries(
        years.map((year, obsIndex) => [
          String(obsIndex),
          [SERVICES_HISTORY_VALUES[year]?.[1] ?? 100000],
        ]),
      ),
    },
  };
  return {
    data: {
      dataSets: [{ series }],
      structures: [
        {
          dimensions: {
            series: [
              {
                id: 'EXP_IMP',
                values: [
                  { id: 'IMP', name: 'Debits' },
                  { id: 'EXP', name: 'Credits' },
                ],
              },
              { id: 'EBOPS', values: [{ id: 'TOTAL', name: 'Total Services (BPM basis)' }] },
              { id: 'COUNTRY', values: [{ id: 'TOT', name: 'Total all countries' }] },
              { id: 'FREQ', values: [{ id: 'A', name: 'Annual' }] },
            ],
            observation: [
              {
                id: 'TIME_PERIOD',
                values: years.map((year) => ({ id: year, name: year })),
              },
            ],
          },
          attributes: {
            dataSet: [
              { id: 'UNIT_MEASURE', values: [{ id: 'AUD' }] },
              { id: 'UNIT_MULT', values: [{ id: '6' }] },
            ],
          },
        },
      ],
    },
  };
}
