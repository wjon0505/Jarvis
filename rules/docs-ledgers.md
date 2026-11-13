<!-- jarvis-kit: generic adaptation of a docs-and-ledgers editing rule from a production multi-agent setup; real values replaced with placeholders. -->

# Rule: editing the living docs and ledgers

**Applies when** an agent edits any project doc, ledger, or the root instruction file (CLAUDE.md, AGENTS.md or equivalent). If your tool supports path-scoped rules, scope it to `docs/**/*.md` and the root instruction file; otherwise link it from the root file.

**Why it exists:** in a multi-agent setup the docs are the continuity. Context is lost between sessions; the ledgers are what the next session believes. A ledger that drifts from the code produces confident wrong work.

## The rules

- **Ids come from the orchestrator's brief.** Backlog row ids (for example `REQ-0042`) and decision ids (`DEC-017`) are allocated in blocks by <ORCH>. Never "measure the current maximum and add a buffer": the set in flight is visible only to <ORCH>, and two lanes that both measure will pick the same number. Decisions a lane makes in <OWNER>'s absence are tagged `[OWNER REVIEW]`. Heading ids and row ids are unique per document; a check should enforce it.
- **MEASURED is not FILED. FILED is not SHIPPED. SHIPPED is not MARKED.**
  - A finding goes in the backlog as a row before it goes in a code comment or a report sentence.
  - A doc describing a feature is not the feature.
  - Closing a lane closes its rows in the same merge, naming the lane, the date and where in the code, verified in the artefact that executes (not in the diff).
- **Every request from <OWNER> gets a request-ledger row BEFORE the reply is written.** Watch the passing ask ("also...", "make sure...") and the narrowed ask: a justified narrowing is still a narrowing, and <OWNER> decides whether to accept it.
- **Tables are data.** A literal pipe inside a cell is escaped (`\|`). Every row has exactly the header's cell count and ends with a pipe. No prose on a header row. If old rows break this, pin them in a ratchet so no new offender appears.
- **Moving text out of a doc is a rotation, not a deletion.** The block lands byte-identical in its destination: compare the SHA-256 of the extract with the appended region before cutting the source, and assert both boundary lines. History entries go to the END of a history doc, never inline in the root instruction file.
- **A dated row is a measurement, not a fact.** Before acting on a backlog row, open the code it cites and re-derive the reason it was parked. Before closing it, verify in code. Never rewrite a dated historical entry to satisfy a check; record why the byte is there instead.
- **Agent instruction files are scanned.** A check should refuse invisible characters and classify any quoted "ignore previous instructions"-style wording at its exact count, with the sentence that added it. After touching anything under `docs/` or the root instruction file, run the whole guard suite, not the one check you think covers it.
