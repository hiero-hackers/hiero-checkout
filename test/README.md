# Test layout

Two kinds of suites, deliberately:

**Mirrors** — one file per source module, same names, same tree:

| Test                                                                                              | Source           |
| ------------------------------------------------------------------------------------------------- | ---------------- |
| `views/payer.test.ts` · `views/landing.test.ts` · `views/invoice.test.ts` · `views/error.test.ts` | `src/views/*`    |
| `builder.test.ts`                                                                                 | `src/builder.ts` |
| `confirm.test.ts`                                                                                 | `src/confirm.ts` |
| `mirror.test.ts`                                                                                  | `src/mirror.ts`  |
| `route.test.ts`                                                                                   | `src/route.ts`   |
| `tour.test.ts` (the script) · `tour-playback.test.ts` (the playback)                              | `src/tour.ts`    |

**Cross-cutting** — suites that exist to hold properties across modules, kept
flat at the root because they own no single source file:

- `inventory.test.ts` — pins the EXACT set of interactive controls per view;
  a new button fails CI until inventoried (and tested in `interactions`).
- `interactions.test.ts` — every wired handler clicked, platform stubbed.
- `parse.test.ts` — input handling against the OFFICIAL wire vectors.
- `mirror-map.test.ts` — the full REST → receipts → match pipeline.
- `coverage-gaps.test.ts` — corners found by coverage, kept by it.
- `repo-hygiene.test.ts` — SPDX headers on every source file.

`helpers.ts` is the one fixtures/DOM-helpers module — narrow per-suite,
never fork. Coverage floors ratchet in `vitest.config.ts`.
