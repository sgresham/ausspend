# Connector landing gate

`npm run test:merge-gate` is the required gate for connector changes. CI
(`.github/workflows/merge-gate.yml`) runs the same command on every push and
pull request.

## What it checks

1. Regenerates `server/src/connectors/generated-connectors.ts`,
   `server/test/generated-gpfs-fixtures.ts` and `docs/sources/**` from the
   connector modules.
2. Fails if the generated output is not committed/current. A new connector
   therefore cannot land without its source-register doc and manifest entries.
3. Runs, sequentially:
   - `server/test/connectors.test.ts`
   - `server/test/gpfs-modules-golden.test.ts`
   - `server/test/m2-api.test.ts`

The gate requires `TEST_MONGO_URL` (or `MONGO_URL`) because `m2-api` drops and
reseeds its target database. It always rewrites the database name to an
`ausspend_gate_*` scratch database, so a shared dev/test database is never
cleared.

```bash
TEST_MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev npm run test:merge-gate
```

## Worker areas

Council connector items keep narrow areas (the connector directory and its
test) so councils can run in parallel. Shared docs/registration are
landing-owned:

- `docs/NSW_COUNCILS.md`
- `docs/sources/**`
- `server/src/connectors/generated-connectors.ts`
- `server/test/generated-gpfs-fixtures.ts`
- `server/test/connectors.test.ts`
- `server/test/m2-api.test.ts`
- `scripts/ingest-nsw.ts`, `scripts/audit.mjs`, README counts

If a worker reaches the docs stage and asks for one of these, grant it only
when no other worker holds it. Otherwise let the landing gate regenerate the
generated files and add the council section before pushing.
