---
# jarvis-kit: generic adaptation of an in-house security-audit skill from a production multi-agent setup; real values replaced with placeholders.
name: security-audit
description: "Load before any security pass. The ordered verification list (OWASP ASVS 5.0 Level 2 plus chosen pull-forwards, OWASP Top 10:2025, OWASP API Security Top 10:2023, CIS Controls v8.1 IG2, NIST SSDF, and the residual risks of AI-authored code), the gate-integrity rules that make a green trustworthy, and the stop-lines. Use for 'security audit', 'security pass', 'verify control X', 'is this endpoint safe', or any lane dispatched as security-auditor."
---

<!-- Origin: written in-house. No outside skill text is vendored here; public checklists were
extracted into the project's own audit standard instead. Nothing in this skill runs a network call
or a subprocess, or writes outside the lane's worktree. -->

# Security audit

You are about to audit a system that holds real personal data and money-adjacent records, and whose code was largely written by agents. The project's audit standard (for example `<REPO_ROOT>/docs/SECURITY_AUDIT_STANDARD.md`) lists the items, each with a verdict. This skill is the procedure for walking them without producing a green that means nothing.

## The standards the audit standard is built from

Build your project's audit standard from these public sources, in this priority, and give every item a verdict (see section 1):

1. **OWASP ASVS 5.0, Level 2**, plus any Level 3 items you choose to pull forward for your highest-risk data (record which and why).
2. **OWASP Top 10:2025** (A01 Broken Access Control first).
3. **OWASP API Security Top 10:2023** (API1 Broken Object Level Authorization first).
4. **CIS Controls v8.1, Implementation Group 2**, for the operational controls (inventory, data protection, secure configuration, account and access management, audit logs, application software security).
5. **NIST SSDF (SP 800-218)** for the development process: protected toolchain, reviewed dependencies, vulnerability response.
6. **AI-authored-code residuals:** the failure classes agent-written code shows most often (cross-site scripting and log injection lead), missing authorization on new endpoints, invented APIs and packages, controls asserted in a comment but absent from the code, and tests that cannot fail.

Re-read each source when you build or refresh the standard; never rely on memory for version-specific details.

## 0. Before you touch anything

1. **A worktree, never the main checkout.** `git worktree add -b lane/<id> <worktrees-dir>/<id> origin/main`, then `git commit --allow-empty -m "wip: <id> started"` so the tree cannot be swept. Never `git stash`.
2. **Copy the ignored environment FIRST, then install dependencies,** if your install step bakes environment paths into generated code. Then run the lane-disarm step and verify it with a search that can see ignored files.
3. **Disarm everything that reaches the outside:** email provider set to mock, every payment and integration toggle off. Enumerate the toggles from the config schema, not from memory: a brief that names three of four lets the fourth send a real message.
4. **If you will boot the app against a database copy, delete stored OAuth grants in the copy first.** Single-use refresh tokens are spent by the first scheduler or route that touches them, and the shared credential dies.
5. **Ask <ORCH> before any whole-workspace test run** and wait for "go". Two concurrent full batteries can exhaust a machine's memory; while another lane holds the slot, run no test invocation of any size in a shared checkout.
6. **Use the finding ids <ORCH> allocated** in your brief (for example `SEC-0100..0119`). Never measure the maximum and buffer: two lanes that do will file at the same id.

## 1. The order of work

Risk to real personal data and money decides the order, not chapter order. Walk the standard in this sequence and do not skip ahead when one step is slow:

| Step | Area | Why it comes here |
|---|---|---|
| 1 | Authorization and tenant isolation | a multi-tenant product's privacy promise is an isolation claim; BOLA is API1 and access control is A01 |
| 2 | Authentication, sessions, tokens | the doors to the data |
| 3 | Data protection and privacy | personal data leaving the building cannot be recalled |
| 4 | Input, injection, output encoding | the two weaknesses AI code fails most (XSS, log injection) live here and in step 5 |
| 5 | Logging, errors, audit trail | the audit log is the regulator's artefact |
| 6 | Cryptography, secrets, configuration | |
| 7 | Supply chain and the AI-authored residuals | the agent toolchain is part of the supply chain |
| 8 | File handling, availability, asset inventory | |

For each item, in this order:

1. **Read the item's verdict in the standard.**
   - `a`: a guard exists. Find it and make it go red once.
   - `a-spec`: a test covers it. Run the test, then look for the sibling the test does not cover.
   - `claimed`: the control has never failed a gate. **Spend your time here.**
   - `b`: known missing. Confirm it is still missing and price the guard.
   - `c`: not applicable. Confirm the reason still holds.
2. **Reproduce at HEAD before any fix.** A finding is a RED capture in `<REPO_ROOT>/docs/evidence/<id>/` with the exact command. "I read the code and it looks wrong" is a hypothesis.
3. **Prove the control bites, by mutation or by probe.**
   - *Mutation:* change the code the guard watches, run the guard, capture exit 1 and the failing line that NAMES the site. Restore with `cp` from a saved copy, not `git checkout --` (that restores from the index, which may hold staged edits). Assert the mutation applied: an in-place edit whose anchor is absent changes nothing, and the green that follows is a green over an unchanged tree.
   - *Probe:* a request against a running stack, byte-compared to a control request from the same run. For enumeration surfaces, compare the whole body and the status. Prove the comparison is sensitive: one trailing space added to the decoy branch must turn the uniformity check red before you believe uniformity.
4. **Enumerate the set.** When a control holds on the member you probed, derive the set from its source of truth (route table, schema, contract) and check every member. The fix, if needed, is an enumerating guard: set derived not listed, every member verified, exceptions allow-listed with a reason, a new unclassified member fails CI, comments stripped before scanning, scan count asserted non-zero.
5. **Fix red then green.** RED capture at HEAD, fix, GREEN capture, both saved. Say which you achieved: "fixed" is proven against its own reproduction; "remediated in code" is not fixed.
6. **File what you cannot fix here** (needs credentials, a deployed environment, an owner decision) as a backlog row with severity, reproduction and proposed fix. A finding in a code comment is a finding that dies.

## 2. Gate-integrity rules

These are what make a green trustworthy.

- **A check that cannot fail is not a check.** Make every check go red once before trusting it. A sweep, census or ownership check is trusted only after a deliberately dirty input made it fire.
- **Real captured exits.** `cmd > "$LOG" 2>&1; rc=$?` on an unpiped run. A harness notifier may report its wrapper's exit; a pipe reports its last command's. Never read an exit file you did not just write. Chain a gate to the action it protects with `&&`, never `;`, and never print the code and then act anyway.
- **Sleep bracket.** Read the OS sleep log (for example `pmset -g log | grep "Entering Sleep" | tail -1` on macOS) before and after any long run. If it moved: a RED is void, a GREEN stands. Keep-awake utilities are not proof.
- **Contention asymmetry.** Load inflates durations into timeouts: it turns a pass into a fail, never a fail into a pass. An all-pass exit 0 under load stands. A red under load is void only with the signature: timeouts inside lifecycle hooks, or wall time far above the runner's own estimate. A red made of assertion diffs is real whatever the load.
- **Read the shape before the colour.** Failed suites with zero failed tests means a compile error or a crashed worker. Exit 139, 143 or 134 with no test summary is not a result: re-run once and say you re-ran. Check the OS crash reports for an out-of-memory or GC signature before blaming the code.
- **Non-vacuity floors.** Every census asserts a subject count above zero. When the census hunts a defect and the defect is closed, pin the set EMPTY, or the floor argues for keeping one bad member forever.
- **A mutation must prove it changed something.** Diff the file or assert the anchor matched. Two mutations in one pass cannot attribute their failures; a needle that survives as a substring gives exit 0 over a deleted check.
- **Comments are not controls.** Strip comments before scanning. When a comment says a type or contract "makes this structural", grep for the symbol before building on it.
- **A count is not a measurement.** Derive lists (workspaces type-checked, suites run) from the run's log by name. Compare by NAME, never by cardinality: two errors of opposite sign sum to a healthy-looking count.
- **The search tools are blind.** A grep alias may honour ignore files; `git grep` sees tracked files only; plain `grep` may skip NUL-byte files. A claim about "the repo" needs an unfiltered recursive grep or bytes read in a script. `head -N` truncates toward "absent".
- **Verify before dispatch and before believing a row.** Open the code the row cites; re-derive why it was deferred. Rows are named after symptoms and commits after remedies, so an id search returns zero over finished work.
- **Do not commit in a worktree while a render walk runs from it.** A walk that fingerprints the server's sha against `HEAD` will refuse or lie.
- **Two test invocations in one checkout can destroy each other's databases** when setup resets them. That includes the one-file test you run "just to check".

## 3. Stop-lines

- **No real credentials.** Development values from the seed only; nothing from the secret store; no `.env` file that is not an example.
- **No live identity provider.** Social sign-in is probed against a mock provider only.
- **No deploy.** No build submission, no service deploy, no migration against a deployed database. Deploy findings are filed with the exact command for <OWNER>.
- **No secret-store access.** No read or write. An expired cloud credential may return an EMPTY result rather than an error, so a zero from that surface is evidence of nothing.
- **No destructive operation against a shared or deployed database.** Adversarial writes go to a scratch database you created. Never flush a shared cache; delete your own keys by prefix and verify the count. Re-check ownership immediately before destroying anything.
- **No spend.** No paid API, no messaging provider, no cloud resource.
- **No message leaves the building.** Email and SMS providers set to mock before any boot.
- **Secrets never in logs or commits.** Run the secrets sweep's self-test and then the sweep over your own diff before every push, chained with `&&`.
- **Nothing global, nothing outside the worktree.** No user-level agent config writes, no new MCP servers, no shell profile edits.

## 4. Deployed-environment probes (curl only, no credentials)

Keep a probe list for each deployed environment in the audit plan (for example: security headers on the app origin, CORS refusal for a foreign origin, 401 on an authenticated route without a token, uniform responses on the password-reset endpoint for a known and an unknown address at `https://staging.example.com`). Run probes from outside. Every probe has a control request in the same run, so a refusal is distinguished from an outage. Compare the live sha from the health endpoint with `git rev-parse HEAD` before reading any result: a probe against a stale environment is evidence about a tree nobody has.

## 5. Report format

FINDINGS TABLE (id, severity, surface, reproduced?, fixed? or filed as) · gate outputs with real captured exits and the sleep bracket · evidence paths · NOT-RUN list by name · owner-gated items · backlog rows filed, by id · standard items whose verdict you changed, with what you measured.

A pass that changes an item's verdict in the audit standard does so in the same merge and names the guard file. Never renumber an item: other documents cite the ids.
