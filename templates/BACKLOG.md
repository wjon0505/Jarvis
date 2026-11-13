<!-- jarvis-kit: template backlog; fictional rows. -->
# BACKLOG.md

One row per piece of work. A finding outside your item becomes a row here before it becomes a comment.
Cite code at a sha so the next lane can verify before dispatch.

| Id | Title | Evidence (file:line @ sha) | Blocked by | Acceptance criteria | Status |
|---|---|---|---|---|---|
| B-0310 | audit row per reset-email request | api/auth/reset.ts:41 @ 3f9a1c2 | none | a row per request; red-first test | OPEN |
| B-0311 | export times out over 50k rows | api/export/csv.ts:120 @ 3f9a1c2 | B-0305 (stream API) | 200k rows under 30 s | PARKED 2030-01-12: stream API not merged; re-check that before dispatch |
| B-0312 | store name in export | api/export/csv.ts:88 | none | column present | DONE 2030-01-11 by lane EXPORT-2, api/export/csv.ts:88 |
