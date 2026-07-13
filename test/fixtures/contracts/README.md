# Vendored component contract schemas

These JSON Schema (Draft-07) files are vendored, hand-authored copies of the canonical component payload contracts from the MMX-468 plan. When the hub's schema export (its Task 10) ships, its exported canonical files replace these, and `src/components/core/contracts.test.ts` validates the renderer fixtures against them. Any drift between hub and widget contracts then fails CI by design.
