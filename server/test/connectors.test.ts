import { describe, expect, it } from 'vitest';
import { ABS_GFS_ID } from '../src/connectors/abs-gfs.js';
import {
  CONNECTORS,
  CONNECTOR_IDS,
  connectorSummary,
  getConnector,
} from '../src/connectors/index.js';

const LIVE_IDS = [
  'abs-gfs',
  'abs-gfs-pnfc',
  'aihw-health-expenditure',
  'aus-tender',
  'data-gov-au-pbs',
  'grantconnect',
  'nsw-budget',
  'data-nsw-ckan',
  'dubbo-council',
  'dubbo-council-gpfs',
  'city-of-sydney-gpfs',
  'blacktown-gpfs',
  'parramatta-gpfs',
  'northern-beaches-gpfs',
  'canterbury-bankstown-gpfs',
  'sutherland-shire-gpfs',
  'wollongong-gpfs',
  'newcastle-gpfs',
  'lake-macquarie-gpfs',
  'maitland-gpfs',
  'coffs-harbour-gpfs',
  'mid-coast-gpfs',
  'port-macquarie-hastings-gpfs',
  'tweed-shire-gpfs',
  'shoalhaven-gpfs',
  'shellharbour-gpfs',
  'waverley-gpfs',
  'willoughby-gpfs',
  'inner-west-gpfs',
  'bayside-gpfs',
  'randwick-gpfs',
  'ryde-gpfs',
  'north-sydney-gpfs',
  'canada-bay-gpfs',
  'cumberland-gpfs',
  'georges-river-gpfs',
  'fairfield-gpfs',
  'liverpool-gpfs',
  'ku-ring-gai-gpfs',
  'vic-budget',
  'vic-vlgc-vgc1',
  'vic-vlgc-abs',
  'vic-vlgc-fag',
  'vic-lgprf',
  'qld-budget',
  'qld-qgip',
  'acnc-charity',
  'sydney-water',
  'waternsw',
  'hunter-water',
  'essential-energy',
  'forestry-corporation',
  'landcom',
  'port-authority-nsw',
  'tahe',
  'sydney-trains',
  'nsw-trainlink',
];
const STUB_IDS = CONNECTOR_IDS.filter((id) => !LIVE_IDS.includes(id));

describe('federal connector registry', () => {
  it('ships sixty connectors with unique ids including the federal source ids', () => {
    expect(CONNECTORS).toHaveLength(60);
    expect(new Set(CONNECTOR_IDS).size).toBe(60);
    expect(CONNECTOR_IDS).toEqual(CONNECTOR_IDS.map((id) => id.toLowerCase()));
    expect(CONNECTOR_IDS).toEqual(
      expect.arrayContaining(['aus-tender', 'data-gov-au-pbs', 'grantconnect']),
    );
  });

  it('registers the federal/state/local/charity sources as live and the remaining sources as stubs', () => {
    for (const id of LIVE_IDS) {
      const connector = getConnector(id);
      expect(connector?.status).toBe('active');
      expect(typeof connector?.fetch).toBe('function');
    }

    for (const id of STUB_IDS) {
      const connector = getConnector(id);
      expect(connector?.status).toBe('stub');
      expect(() => connector?.fetch()).toThrow(/not implemented/i);
      expect(() => connector?.fetch()).toThrow(new RegExp(connector!.id));
      expect(connector?.transform([{ id: 'raw' }])).toEqual([]);
    }
  });

  it('exposes serialisable coverage and run metadata only', () => {
    const summaries = CONNECTORS.map(connectorSummary);
    expect(JSON.parse(JSON.stringify(summaries))).toEqual(summaries);
    for (const summary of summaries) {
      expect(Object.keys(summary).sort()).toEqual([
        'deferred_resources',
        'errors',
        'fetch_strategy',
        'id',
        'jurisdiction_level',
        'last_fetched_at',
        'name',
        'publisher',
        'records_ingested',
        'source_url',
        'status',
      ]);
      expect(summary.jurisdiction_level).toBeTruthy();
      expect(summary.source_url).toMatch(/^https:\/\//);
    }
    for (const id of LIVE_IDS) {
      expect(summaries.find((summary) => summary.id === id)?.status).toBe('active');
    }
    for (const summary of summaries.filter((entry) => !LIVE_IDS.includes(entry.id))) {
      expect(summary.status).toBe('stub');
      expect(summary.last_fetched_at).toBeNull();
      expect(summary.records_ingested).toBe(0);
      expect(summary.errors).toEqual([]);
    }
  });

  it('looks connectors up by id and marks GrantConnect as a manual-export connector', () => {
    expect(getConnector('federal-budget-portal')?.publisher).toMatch(/Finance/);
    expect(getConnector(ABS_GFS_ID)?.status).toBe('active');
    expect(getConnector(ABS_GFS_ID)?.jurisdiction_level).toBe('federal');
    expect(getConnector(ABS_GFS_ID)?.source_url).toContain('abs.gov.au');
    expect(getConnector(ABS_GFS_ID)?.notes).toMatch(/benchmark/i);
    expect(getConnector('abs-gfs-pnfc')?.status).toBe('active');
    expect(getConnector('abs-gfs-pnfc')?.jurisdiction_level).toBe('pnfc');
    expect(getConnector('abs-gfs-pnfc')?.notes).toMatch(/sector aggregate/i);
    expect(getConnector('aus-tender')?.jurisdiction_level).toBe('federal');
    expect(getConnector('aus-tender')?.publisher).toMatch(/Finance/);
    expect(getConnector('data-gov-au-pbs')?.status).toBe('active');
    expect(getConnector('data-gov-au-pbs')?.source_url).toContain('data.gov.au');
    expect(getConnector('grantconnect')?.status).toBe('active');
    expect(getConnector('grantconnect')?.jurisdiction_level).toBe('federal');
    expect(getConnector('grantconnect')?.source_url).toContain('grants.gov.au');
    expect(getConnector('grantconnect')?.notes).toMatch(/manual export/i);
    expect(getConnector('nsw-budget')?.status).toBe('active');
    expect(getConnector('nsw-budget')?.jurisdiction_level).toBe('state');
    expect(getConnector('nsw-budget')?.source_url).toContain('budget.nsw.gov.au');
    expect(getConnector('data-nsw-ckan')?.status).toBe('active');
    expect(getConnector('data-nsw-ckan')?.jurisdiction_level).toBe('state');
    expect(getConnector('data-nsw-ckan')?.source_url).toContain('data.nsw.gov.au');
    expect(getConnector('data-nsw-ckan')?.deferredResources).toEqual([]);
    expect(getConnector('dubbo-council')?.status).toBe('active');
    expect(getConnector('dubbo-council')?.jurisdiction_level).toBe('local');
    expect(getConnector('dubbo-council')?.source_url).toContain('dubbo.nsw.gov.au');
    expect(getConnector('dubbo-council-gpfs')?.status).toBe('active');
    expect(getConnector('dubbo-council-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('dubbo-council-gpfs')?.source_url).toContain('dubbo.nsw.gov.au');
    expect(getConnector('dubbo-council-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('blacktown-gpfs')?.status).toBe('active');
    expect(getConnector('blacktown-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('blacktown-gpfs')?.source_url).toContain('blacktown.nsw.gov.au');
    expect(getConnector('blacktown-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('parramatta-gpfs')?.status).toBe('active');
    expect(getConnector('parramatta-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('parramatta-gpfs')?.source_url).toContain('cityofparramatta.nsw.gov.au');
    expect(getConnector('parramatta-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('northern-beaches-gpfs')?.status).toBe('active');
    expect(getConnector('northern-beaches-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('northern-beaches-gpfs')?.source_url).toContain(
      'northernbeaches.nsw.gov.au',
    );
    expect(getConnector('northern-beaches-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('canterbury-bankstown-gpfs')?.status).toBe('active');
    expect(getConnector('canterbury-bankstown-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('canterbury-bankstown-gpfs')?.source_url).toContain('cbcity.nsw.gov.au');
    expect(getConnector('canterbury-bankstown-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('sutherland-shire-gpfs')?.status).toBe('active');
    expect(getConnector('sutherland-shire-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('sutherland-shire-gpfs')?.source_url).toContain(
      'sutherlandshire.nsw.gov.au',
    );
    expect(getConnector('sutherland-shire-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('wollongong-gpfs')?.status).toBe('active');
    expect(getConnector('wollongong-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('wollongong-gpfs')?.source_url).toContain('wollongong.nsw.gov.au');
    expect(getConnector('wollongong-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('newcastle-gpfs')?.status).toBe('active');
    expect(getConnector('newcastle-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('newcastle-gpfs')?.source_url).toContain('newcastle.nsw.gov.au');
    expect(getConnector('newcastle-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('lake-macquarie-gpfs')?.status).toBe('active');
    expect(getConnector('lake-macquarie-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('lake-macquarie-gpfs')?.source_url).toContain('lakemac.com.au');
    expect(getConnector('lake-macquarie-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('maitland-gpfs')?.status).toBe('active');
    expect(getConnector('maitland-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('maitland-gpfs')?.source_url).toContain('maitland.nsw.gov.au');
    expect(getConnector('maitland-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('coffs-harbour-gpfs')?.status).toBe('active');
    expect(getConnector('coffs-harbour-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('coffs-harbour-gpfs')?.source_url).toContain('coffsharbour.nsw.gov.au');
    expect(getConnector('coffs-harbour-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('mid-coast-gpfs')?.status).toBe('active');
    expect(getConnector('mid-coast-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('mid-coast-gpfs')?.source_url).toContain('midcoast.nsw.gov.au');
    expect(getConnector('mid-coast-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('port-macquarie-hastings-gpfs')?.status).toBe('active');
    expect(getConnector('port-macquarie-hastings-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('port-macquarie-hastings-gpfs')?.source_url).toContain('pmhc.nsw.gov.au');
    expect(getConnector('port-macquarie-hastings-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('tweed-shire-gpfs')?.status).toBe('active');
    expect(getConnector('tweed-shire-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('tweed-shire-gpfs')?.source_url).toContain('tweed.nsw.gov.au');
    expect(getConnector('tweed-shire-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('shoalhaven-gpfs')?.status).toBe('active');
    expect(getConnector('shoalhaven-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('shoalhaven-gpfs')?.source_url).toContain('shoalhaven.nsw.gov.au');
    expect(getConnector('shoalhaven-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('shellharbour-gpfs')?.status).toBe('active');
    expect(getConnector('shellharbour-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('shellharbour-gpfs')?.source_url).toContain('shellharbour.nsw.gov.au');
    expect(getConnector('shellharbour-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('waverley-gpfs')?.status).toBe('active');
    expect(getConnector('waverley-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('waverley-gpfs')?.source_url).toContain('waverley.nsw.gov.au');
    expect(getConnector('waverley-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('willoughby-gpfs')?.status).toBe('active');
    expect(getConnector('willoughby-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('willoughby-gpfs')?.source_url).toContain('willoughby.nsw.gov.au');
    expect(getConnector('willoughby-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('inner-west-gpfs')?.status).toBe('active');
    expect(getConnector('inner-west-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('inner-west-gpfs')?.source_url).toContain('innerwest.nsw.gov.au');
    expect(getConnector('inner-west-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('bayside-gpfs')?.status).toBe('active');
    expect(getConnector('bayside-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('bayside-gpfs')?.source_url).toContain('bayside.nsw.gov.au');
    expect(getConnector('bayside-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('randwick-gpfs')?.status).toBe('active');
    expect(getConnector('randwick-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('randwick-gpfs')?.source_url).toContain('randwick.nsw.gov.au');
    expect(getConnector('randwick-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('ryde-gpfs')?.status).toBe('active');
    expect(getConnector('ryde-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('ryde-gpfs')?.source_url).toContain('ryde.nsw.gov.au');
    expect(getConnector('ryde-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('north-sydney-gpfs')?.status).toBe('active');
    expect(getConnector('north-sydney-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('north-sydney-gpfs')?.source_url).toContain('northsydney.nsw.gov.au');
    expect(getConnector('north-sydney-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('canada-bay-gpfs')?.status).toBe('active');
    expect(getConnector('canada-bay-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('canada-bay-gpfs')?.source_url).toContain('canadabay.nsw.gov.au');
    expect(getConnector('canada-bay-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('cumberland-gpfs')?.status).toBe('active');
    expect(getConnector('cumberland-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('cumberland-gpfs')?.source_url).toContain('cumberland.nsw.gov.au');
    expect(getConnector('cumberland-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('georges-river-gpfs')?.status).toBe('active');
    expect(getConnector('georges-river-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('georges-river-gpfs')?.source_url).toContain('georgesriver.nsw.gov.au');
    expect(getConnector('georges-river-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('fairfield-gpfs')?.status).toBe('active');
    expect(getConnector('fairfield-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('fairfield-gpfs')?.source_url).toContain('fairfieldcity.nsw.gov.au');
    expect(getConnector('fairfield-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('liverpool-gpfs')?.status).toBe('active');
    expect(getConnector('liverpool-gpfs')?.jurisdiction_level).toBe('local');
    expect(getConnector('liverpool-gpfs')?.source_url).toContain('liverpool.nsw.gov.au');
    expect(getConnector('liverpool-gpfs')?.notes).toMatch(/non-additive/i);
    expect(getConnector('vic-budget')?.status).toBe('active');
    expect(getConnector('vic-budget')?.jurisdiction_level).toBe('state');
    expect(getConnector('vic-budget')?.source_url).toContain('discover.data.vic.gov.au');
    expect(getConnector('qld-budget')?.status).toBe('active');
    expect(getConnector('qld-budget')?.jurisdiction_level).toBe('state');
    expect(getConnector('qld-budget')?.source_url).toContain('data.qld.gov.au');
    expect(getConnector('qld-qgip')?.status).toBe('active');
    expect(getConnector('qld-qgip')?.jurisdiction_level).toBe('state');
    expect(getConnector('qld-qgip')?.source_url).toContain('data.qld.gov.au');
    expect(getConnector('qld-qgip')?.notes).toMatch(/grant_award/);
    expect(getConnector('nope')).toBeUndefined();
  });
});
