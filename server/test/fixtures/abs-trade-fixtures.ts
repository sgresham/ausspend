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
