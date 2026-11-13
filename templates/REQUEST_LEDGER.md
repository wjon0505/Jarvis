<!-- jarvis-kit: template request ledger; fictional rows. -->
# REQUEST_LEDGER.md

Every owner request gets a row **before** the reply. Quote the words. FILED is not SHIPPED: a row closes
only when the work is in code, with where. Watch the passing ask ("also...", "make sure...") and the
narrowed ask; the owner decides whether a narrowing stands.

| Id | Date | Owner's words (verbatim) | Interpretation | Status | Where |
|---|---|---|---|---|---|
| REQ-0041 | 2030-01-10 | "the export should include the store name" | add a store-name column to the CSV export | SHIPPED 2030-01-11 | api/export/csv.ts:88 |
| REQ-0042 | 2030-01-12 | "make sure reset emails expire, also log who asked" | two asks: 30-min expiry; audit row per request | FILED (second ask narrowed: audit only on success; owner to confirm) | BACKLOG B-0310 |
