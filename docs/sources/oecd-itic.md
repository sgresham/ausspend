# OECD International Transport and Insurance Costs of Merchandise Trade (ITIC)

- id: `oecd-itic`
- publisher: Organisation for Economic Co-operation and Development
- source: <https://sdmx.oecd.org/public/rest/dataflow/OECD.SDD.TPS/DSD_ITIC@DF_ITIC>
- jurisdiction: federal
- status: active
- licence: © OECD. OECD data used under the OECD Terms and Conditions; the ITIC dataset is a combination of reported figures and model-based, derived and adjusted estimates. Not an open-data licence grant for third-party reuse.

OECD ITIC CIF/FOB margins from the public OECD SDMX dataflow (OECD.SDD.TPS, DSD_ITIC@DF_ITIC, 1.1). Australia is the reference/importer, COUNTERPART_AREA the exporter, MEASURE=C_F and UNIT_MEASURE=PT_IM_CIF (percentage of CIF import value). The connector ingests per-partner totals (COMM_HS2017=_T) for 2019–2022 and Australia–World HS 2017 4-digit product margins for 2019 and 2022. Every row is a border cost (`cif_fob_margin`), never profit, and margins are non-additive with trade values and port costs. OBS_STATUS/METHODOLOGY_TYPE are preserved so modelled, derived, interpolated and adjusted observations are flagged estimated/provisional, never observed. Raw SDMX-JSON is SHA-256 archived outside the repo. The requested 2019 ≈ 3.5% / 2022 ≈ 6.4% headline is a CIF-import-value-weighted aggregate that ITIC does not publish and cannot be reproduced without trade values: the connector records the unweighted HS4 diagnostic and flags any mismatch instead of adjusting a value.
