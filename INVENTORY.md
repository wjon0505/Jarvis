<!-- jarvis-kit: build ledger of this kit (what was taken from the source environment, and why). -->
# INVENTORY: what the kit takes from the source environment

Build ledger for this kit. Every candidate item from the source environment gets one verdict:

- **COPY-GENERIC**: our own work. It is copied, every real value is replaced by a placeholder (`<COMPANY>`, `<OWNER>`, `<PROJECT_ID>`, `<DOMAIN>`, `example.com`) or a fictional example, and each file gets a one-line origin header.
- **LINK**: third-party work. THIRD_PARTY.md gives the source URL, the licence read from the upstream LICENSE, what it is for, how to install it, and the read-the-raw-source-first rule. No bytes are copied.
- **EXCLUDE**: not shipped, with a reason.

Source paths below are relative to the source environment's roots: `repo/` (the product repository), `mailbox/` (the orchestration mailbox), `hq/` (department head workspaces), `blind/` (the blind reviewer), and `home/` (user-level tool config). No absolute path from the source machine appears in the kit.

Status: **DRAFT 1**. The Jarvis-side sweep is done. The section marked **MAC BUNDLE** waits for MAIN's pre-swept bundle (user-level skills, plugins, MCP servers, hook shapes, the memory folder format, doorbell/STATUS scripts, mac-guard).

## 1. Agents (repo/.claude/agents/, 12 files): COPY-GENERIC → agents/ and adapters/claude-code/agents/

| Source | Verdict | Kit form |
|---|---|---|
| backend-dev.md, frontend-dev.md | COPY-GENERIC | build lanes: one scoped item, own worktree, red-first, gates, commit; stack names become `<STACK>` |
| connector-builder.md | COPY-GENERIC | "integration lane": central brain, thin adapters, research-first, live adapter plus mock |
| security-auditor.md | COPY-GENERIC | findings-first audit lane, reproduce before fixing |
| verifier.md | COPY-GENERIC | independent gate runner, never fixes |
| persona-auditor.md | COPY-GENERIC | walk the live product as a persona and file complaints; personas made generic |
| env-improver.md | COPY-GENERIC | environment-improvement department (this kit's own author role) |
| devops-sre.md, finance.md, growth.md, legal-counsel.md, product-research.md | COPY-GENERIC | department heads; every partner, provider, market and money value removed; the "prepares, never spends or sends" boundary is kept |

The tool-neutral role text goes in `agents/<role>.md`. The Claude Code frontmatter (tools, model, isolation) goes in `adapters/claude-code/agents/`.

## 2. Rules (repo/.claude/rules/, 5 files)

| Source | Verdict | Reason |
|---|---|---|
| docs-ledgers.md | COPY-GENERIC | ledger discipline (request row before reply, SHIPPED is not MARKED) |
| invariants-guards.md | COPY-GENERIC | "a control over a set enumerates its set"; comments are not controls |
| ui-raw-source.md | COPY-GENERIC | third-party UI enters as reviewed raw source |
| connectors.md | COPY-GENERIC | adapter pattern; provider names removed |
| prisma-db.md | EXCLUDE | stack-specific to the product's ORM; the generic idea (atomic compare-and-swap) moves into the rules doc as one example |

## 3. Skills (repo/.claude/skills/, 46)

### 3a. Ours: COPY-GENERIC → skills/

| Skill | Note |
|---|---|
| security-audit | in-house; the ordered list of public standards (ASVS, OWASP, CIS, SSDF) stays, product doors and paths become placeholders |
| the vendoring header pattern (house override block on each vendored SKILL.md) | ours; shipped as `templates/VENDORED-HEADER.md`, a pattern for "house rules outrank this text" |

### 3b. Third-party: LINK in THIRD_PARTY.md (no bytes copied; upstream LICENSE read before each row is written)

| Upstream | Skills we use | Licence on record (to re-read upstream) |
|---|---|---|
| github.com/mattpocock/skills | tdd, diagnosing-bugs, code-review (we rename it two-axis-review), to-spec, to-tickets, implement, codebase-design, domain-modeling, improve-codebase-architecture, research, retro, pr, prototype, handoff, writing-for-agents, grilling | MIT |
| github.com/humanlayer/skills | the show-me text inside `pr` | MIT |
| Emil Kowalski's skills (**repo URL to confirm**: the local LICENSE names the author only) | animate, animation-vocabulary, apple-design, emil-design-eng, find-animation-opportunities, improve-animations, review-animations | MIT |
| Leonxlnx's taste skills (**repo URL to confirm**) | taste (design-taste-frontend), taste-redesign | MIT |
| github.com/cursor/plugins | blast-radius, principle-guard-the-context-window, principle-never-block-on-the-human, technical-writing, unslop | MIT (per header) |
| github.com/multica-ai/andrej-karpathy-skills | karpathy-guidelines | MIT (per header) |
| github.com/nextlevelbuilder/ui-ux-pro-max-skill | ui-ux-pro-max | MIT (per header) |
| github.com/pbakaus/impeccable | impeccable | Apache-2.0 |
| "ECC" (**repo URL to confirm**; the local headers say only "ECC") | api-connector-builder, contract-first, database-migrations, e2e-testing, error-handling, nestjs-patterns, postgres-patterns, prisma-patterns, react-testing, redis-patterns, vite-patterns | to read upstream |
| github.com/anthropics/claude-for-legal, github.com/sboghossian/master-claude-for-legal | legal-pack | to read upstream |

Our house edits to these skills (the override headers) are not copied as edited files. The kit explains the pattern, and a reader applies it to their own vendored copy.

### 3c. Commands (repo/.claude/commands/, 5)

| Source | Verdict | Reason |
|---|---|---|
| competitor-matrix, go-to-market, metrics-dashboard, pricing-strategy, user-interviews | LINK (github.com/emotixco/claude-skills-founder, to confirm) or EXCLUDE | third-party; zero uses in 900+ transcripts (our own removal proposal P1), so they are listed as "tried, unused" at most |

## 4. Gates, guards and scripts (repo/)

| Source | Verdict | Kit form / reason |
|---|---|---|
| scripts/secrets-sweep.sh | COPY-GENERIC | the pattern list and the "chain with &&" usage; product-specific allow-list entries removed |
| scripts/lane-disarm.sh | COPY-GENERIC (cut down) | the idea is "a lane's copied env cannot reach live systems": blank live credentials, point at local services, verify with a grep that sees ignored files. 990 lines of product-specific keys reduced to a generic skeleton |
| scripts/usage-meter.mjs | COPY-GENERIC | pace dispatch on the usage window; plan names and caps become config |
| scripts/run-gate.sh | COPY-GENERIC | gate wrapper: clean tree check, captured exit, log with counts |
| scripts/recall/ (recall.mjs, lib, self-test, eval) | COPY-GENERIC | the local recall index over docs, memory and transcripts. Ships the code only; no index, no transcript |
| scripts/npm-audit-gate.mjs + security/npm-audit-allowlist.json shape | COPY-GENERIC | dependency gate with a reasoned allow-list (empty example) |
| security/approved-skill-content.json + invariants/skill-content-approval.guard.spec.ts | COPY-GENERIC | "skill bytes are approved by the owner": a hash manifest plus a guard. Shipped as a Node script, not a jest spec, with a fictional manifest |
| invariants/agent-text-exec-pins, agent-toolchain-inventory guards | COPY-GENERIC (as described checks) | agent text may not fetch-and-run unpinned tools; every executable script in agent dirs is inventoried |
| other invariant guards (account-address-identity, etc.) | EXCLUDE | product domain; the "enumerate the set" method is documented generically instead |
| scripts/gate-api-split.sh, turnon-secret-version.sh, audit-live-gate.mjs, lane-redis-release.sh | EXCLUDE | product- or estate-specific |
| security/codeql-baseline.json | EXCLUDE | product findings |

## 5. Docs (repo/Docs/): formats and mechanisms only, never content

| Source | Verdict | Kit form |
|---|---|---|
| STANDING_RULES.md + the CLAUDE.md headlines | COPY-GENERIC | docs/03 and templates/STANDING_RULES.md: the 21 rules kept as mechanisms (dirty-tree gates, one gate at a time, slot release on the holder's word, capture $?, kill the driver first, crashed runner is not a result, verify before dispatch, a lane is a shared resource...). Evidence and incidents are paraphrased fictionally or dropped |
| RECALL_MAP.md | COPY-GENERIC | templates/RECALL_MAP.md: the question-to-artefact index plus "how to reach a raw transcript" |
| ORCHESTRATION.md, AUTONOMY.md, ORCHESTRATOR_KICKOFF.md | COPY-GENERIC | docs/01: tiers, lanes, per-item gates, the owner-gated boundary, the kickoff prompt |
| SYSTEM_PROMPTS.md | COPY-GENERIC | templates/BRIEF.md and the lane preamble |
| REQUEST_LEDGER, DECISIONS_LOG, WAVE_HISTORY, FOUNDER_TRACK, AUTONOMY_BACKLOG | COPY-GENERIC (format only) | templates with 2-3 fictional rows each; no real row |
| SECURITY_AUDIT_STANDARD.md | COPY-GENERIC | structure and the public standards list; product doors removed |
| HQ/Home.md, HQ/COO.md, HQ/Departments/ | COPY-GENERIC (structure) | docs/01 "company HQ": COO dashboard and departments, as an Obsidian-optional vault layout |
| HQ/Budget.md, Decisions-waiting-for-<owner>.md, HQ/Projects, Integrations, Research | EXCLUDE | business content |
| CLAUDE.md | COPY-GENERIC | templates/CLAUDE.md: session-start ritual, prime directives (generic), Compact Instructions, living-docs table |
| AUDIT_*, PROJECT_UPDATE_*, DESIGN_LOCK_*, FINDINGS_*, SECURITY_FINDINGS_*.csv, *_RESUMPTION.md, every other product doc | EXCLUDE | product content |

## 6. Orchestration mailbox (mailbox/)

| Source | Verdict | Kit form / reason |
|---|---|---|
| gate-run.sh, slot.sh | COPY-GENERIC | the single test slot: acquire, run, release, log; LOW_MEMORY wait |
| orch-watch.sh, pane-nudge.sh | COPY-GENERIC | tmux watchdog for long-running head sessions (liveness, nudge); warning kept that a nudge keystroke is never approval |
| the mailbox protocol, standing orders, kickoff and a head's opening prompt | COPY-GENERIC | BELL/STATE/INBOX protocol, standing orders, a head's opening prompt |
| jarvis-health-remote.sh | EXCLUDE (pattern described) | carries remote-host addressing; docs/01 describes a health probe generically |
| inbox/, outbox/, context/, done/, staging/, work/, backup/, rescued-*/, *.log, *.state | EXCLUDE | real briefs, findings and logs |
| gate-run.sh.* and *.pre-* backups | EXCLUDE | history copies |

## 7. Department workspaces (hq/)

| Source | Verdict | Kit form |
|---|---|---|
| hq/<dept>/ layout: STATE, NOTES, INBOX, BELL, CYCLE-<date> | COPY-GENERIC | templates/hq-dept/ with fictional entries; docs/01 explains each file |
| hq/env/review/ (read-only clones of third-party repos) | EXCLUDE | third-party bytes; the "clone outside the repo, read, never execute" procedure is documented |
| every real STATE, NOTES, CYCLE, review | EXCLUDE | content |

## 8. Blind reviewer (blind/)

| Source | Verdict | Kit form |
|---|---|---|
| CHARTER.md, OPENING.md, CHECK-1..4.md | COPY-GENERIC | docs/04 and templates/blind-review/: a reviewer who never sees the code or the team's reasoning, scores rounds against a rubric |
| client-brief.md, in/, out/, inbox/ | EXCLUDE | real product brief and outputs; replaced by a fictional client brief |

## 9. Tool config (home/ and repo/)

| Source | Verdict | Kit form / reason |
|---|---|---|
| repo/.claude/settings.json (permission allow/deny lists) | COPY-GENERIC | adapters/claude-code/settings.example.json; the deny list (force push, rm -rf of roots and .git) is the useful part |
| home/.claude/settings.json (model, effort, prompt suggestions off) | COPY-GENERIC (documented) | adapters/claude-code/README: model routing note (orchestration on the strongest model, workers on the next), no account values |
| repo/.mcp.json: shadcn MCP (pinned version) | LINK | browse/fetch only; pinned, never `add` into the tree |
| herdr config.toml (7 lines) | LINK + config shape | herdr is a third-party terminal session tool; link and a generic example |
| autoCompactWindow per agent (trial) | COPY-GENERIC (documented) | docs/02, marked "observed, not proven" |
| home/.claude/projects/*/memory/ (MEMORY.md + one-fact files) | COPY-GENERIC (format only) | templates/MEMORY.md and templates/memory-file.md with fictional facts; **no real memory content** |
| repo/.claude/agent-memory/<agent>/MEMORY.md | EXCLUDE (content); format documented | per-agent memory |
| session transcripts (*.jsonl) | EXCLUDE | hard rule 1 |
| home/.claude/skills/synced, plugins/ caches | EXCLUDE | synced copies and caches |
| .env*, credentials, service-account JSON, tokens | EXCLUDE | hard rule 1 |

## 10. MAC BUNDLE (INVENTORY-MAC.md and its hooks/ and hq/ scripts received and read)

Correction to draft 1: the session-start hook script is the terminal manager's own managed integration
("installed by herdr; overwritten on update"), so it is **LINK**, not ours; the kit ships only the hook
wiring and the patterns (hooks/README.md). The doorbell, guard and launchers are ours: COPY-GENERIC to
scripts/hq/ (doorbell.sh, load-guard.sh, launch-head.sh, one launcher for both machines). The department-head model
went into docs/01 and templates/hq/.

| Source | Verdict | Kit form / reason |
|---|---|---|
| gstack skill family (about 55 skills; upstream named as garrytan/gstack, **to verify with licence**) | LINK | one THIRD_PARTY row for the family plus the handful we lean on, each with why |
| AWS agent skills family (23; **upstream to verify**) | LINK | one row for the family |
| Plugins: superpowers, frontend-design, code-review, security-guidance, skill-creator, claude-md-management, github, context7, typescript-lsp, commit-commands, playwright, feature-dev, figma, remember, legalzoom; marketplace thedotmack (**identify**) | LINK | one row each: marketplace, what we use it for |
| MCP: aws-mcp (user), shadcn (project) | LINK | shadcn browse/fetch only |
| Hosted connectors: mail, drive, calendar, docs, browser automation | LINK (tool-neutral) | described as "connectors", no account |
| SessionStart hook (matcher startup/resume/clear/compact/fork → pane-state script, 10 s timeout) | COPY-GENERIC | hooks/session-start-pane-state.sh + adapters/claude-code/settings hook block. **Waiting on the script** |
| Compact-time REMEMBER block and the .remember/ layout (now.md, today-*.md, recent.md, archive*.md, core-memories.md) | COPY-GENERIC (layout) | docs/02; the plugin itself is LINK |
| doorbell.sh (one watcher, exits on any BELL change, a remote reviewer BELL, or an Engineering stall; orchestrator re-arms) | COPY-GENERIC | scripts/doorbell.sh. **Waiting on the script** |
| mac-guard/guard.sh (stop lanes on admin-machine load) | COPY-GENERIC | scripts/load-guard.sh. **Waiting** |
| launch-head.sh, launch-head-jarvis.sh | COPY-GENERIC | scripts/launch-head.sh (one script, host as a variable). **Waiting** |
| the department-head model doc | COPY-GENERIC | docs/01 "heads are real sub-orchestrators; the orchestrator reads STATUS/BELL only". **Waiting** if MAIN sends the text; otherwise written from the bundle's description |
| hq layout: per-department BELL, STATUS, outbox; BELL-ARCHIVE.log; main/; MORNING.md | COPY-GENERIC | templates/hq/ with fictional entries |
| memory format and rules | COPY-GENERIC | templates/MEMORY.md, templates/memory-file.md (fictional) |
| usage policy (97% stop, pace on session window, never paid overage) | COPY-GENERIC | docs/05 and scripts/usage-meter config |
| ledgers: main log, request ledger, decisions log with [OWNER REVIEW], resume file | COPY-GENERIC (formats) | templates/ |

## 11. Open questions for MAIN

1. **Upstream URLs to confirm** for Emil Kowalski's skills, Leonxlnx's taste skills, "ECC", and the 5 commands. I will not guess a URL. I can read them with a plain `git clone` into the review area if MAIN allows; `gh api` is denied on this host.
2. **LICENSE** for the kit itself: a placeholder until the founder chooses.
3. **Product-specific skill:** `security-audit` ships generic. Should the ECC stack skills (NestJS, Prisma, Redis, Vite) appear in THIRD_PARTY.md as "what a TypeScript monorepo used"? I recommend yes, under a "stack-specific" heading.
