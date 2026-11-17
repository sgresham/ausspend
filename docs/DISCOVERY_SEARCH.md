# Bounded discovery search (Phase 1)

The main-entry search box on `/` (and the compact box in the header) is a
typo-tolerant **discovery** search. It is deliberately not a full-dataset
search engine.

## What is indexed

The browser fetches only these small, existing payloads and builds a Fuse.js
index in memory:

| Group            | Payload                                              | Fields searched                        | Link                                                |
| ---------------- | ---------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| Functions        | `GET /api/functions`                                 | COFOG code, name, level, parent code   | `/functions/:code`                                  |
| Regions          | `GET /api/regions?limit=200`                         | name, code, level, parent code, slug   | `/states/:code`, `/regions/:id` or `/regions/:slug` |
| Data sources     | `GET /api/data-sources`                              | name, `source_id`, publisher, licence  | `/data-sources#<source_id>`                         |
| NSW SOC entities | `soc_ingestion.entities` in `GET /api/meta/coverage` | entity name, `source_id`, jurisdiction | `/soc?entity=<entity>`                              |

The index contains no measure rows. It does not call `/api/spending`, does not
load the 515k-row measure set and does not fetch `/api/soc` statement series
just to build suggestions. SOC entities come from the bounded coverage
metadata (always the ten registered NSW entities), so the typeahead works even
before a SOC statement has rows.

## Behaviour

- Matching is case-insensitive and typo-tolerant, for example `waternsw`,
  `sydny water`, `dubbo`, `hunter wter` and `health`.
- Results are grouped and labelled: Functions, Regions, Data sources, NSW SOC
  entities.
- The input is an ARIA combobox: `aria-expanded`, `aria-controls`,
  `aria-activedescendant`, `role="listbox"`/`role="option"`, arrow-key
  selection and Enter selection. Escape closes the list.
- Pressing Enter with no active option sends the literal query to the existing
  explorer: `/search?q=...`. The explorer still matches words literally.
- If the explorer returns no rows for a `q`, a bounded "did you mean" suggestion
  links to the nearest discovery item instead of ending in a dead end.
- All requests are GETs. No auth, analytics, PII or write path is added.

## Phase 2 (not in this item)

Ranking results over every measure row is out of scope. Doing it honestly needs
a dedicated index (for example Meilisearch/Typesense, Postgres trigram, or a
deliberate MongoDB n-gram index) with its own ingestion and relevance checks.
The UI says this explicitly and Phase 1 does not claim full-dataset fuzzy
search.
