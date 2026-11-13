<!-- jarvis-kit: generic adaptation of an agent-role catalogue from a production multi-agent setup; real values replaced with placeholders. -->

# Agent roles

These files define the agents an orchestrator (<ORCH>) dispatches. Each is plain Markdown and works in any agent tool: paste it into a subagent's system prompt, reference it from AGENTS.md, or wrap it in your tool's agent format. The Claude Code wrappers live in `adapters/claude-code/agents/`.

## Two kinds of agent: lanes and department heads

**Lanes** do one scoped item and exit. A lane gets a written brief from <ORCH>, works in its own git worktree, proves its change red-first, runs the gates, commits on its branch, and hands back at most 25 lines of data: shas, gate numbers with exit codes, a NOT-RUN list, and owner-gated items. It never pushes, never merges, never touches another tree. Many lanes run in parallel; <ORCH> merges, and an independent `verifier` lane gates the merged tree before anything is pushed.

**Department heads** own a standing area (operations, money, sales, legal, product research). A head keeps a desk note that stays true, a memory file of facts and pointers, and the ledgers for its area. Heads **prepare** and never **execute** anything irreversible: devops writes the deploy command set but does not deploy; finance prices the purchase but does not buy; growth drafts the email but does not send it; legal drafts the instrument but does not sign or publish it. Each irreversible step reaches <OWNER> as one decision line through <ORCH>. A dismissed prompt is not consent.

Some roles are both: `security-auditor`, `verifier`, `persona-auditor` and `env-improver` own a department desk but are dispatched as lanes for each pass.

Shared by every role:

- **Per-item gates.** Nothing is "done" until the gates for the touched area are green with real numbers and real captured exit codes, run on a clean tree.
- **Red first.** A fix is first reproduced failing at HEAD; a new check is shown to fire before it is trusted.
- **Honest report.** What ran, what it measured, what did NOT run. "Remediated" and "fixed" are different words.
- **Escalation.** Money, legal wording, credentials, push and deploy always go to <ORCH>, which brings them to <OWNER>.
- **Measured is not filed.** A finding outside the item becomes a backlog row before it becomes a sentence in a report.

## Roles

| Role | Kind | Department | Does | Never |
|---|---|---|---|---|
| `backend-dev` | lane | Engineering | one backend item, end to end | push, deploy, touch credentials |
| `frontend-dev` | lane | Engineering | one frontend item, with a real-browser render check | install UI packages, change legal copy |
| `integration-builder` | lane | Engineering | one adapter to an external system, on the existing pattern | live third-party calls, new credentials |
| `security-auditor` | lane + desk | InfoSec | adversarial audit or one remediation, reproduce first | destructive writes to shared data |
| `verifier` | lane + desk | QA | independent gate battery, verdict INTEGRATE or FIX FIRST | fix anything |
| `persona-auditor` | lane + desk | QA | walks the product as a persona, files complaints | edit product code, use real personal data |
| `env-improver` | lane + desk | Internal tools | surveys and prunes the agent environment, writes proposals | install anything directly |
| `devops-sre` | head | DevOps/SRE | environment state, deploy command sets, DR, compute, cost | deploy, spend, write secrets or DNS |
| `finance` | head | Finance | budget ledger, pricing models, decision prompts | spend, change a price |
| `growth` | head | Growth | pipeline, market index, drafts, partner programs | send, buy, create accounts |
| `legal-counsel` | head | Legal | drafts instruments to near-final with sources | sign, file, publish |
| `product-research` | head | Product | ranked, sourced requirements | build anything |

## How to adapt them

1. **Replace the placeholders.** `<ORCH>` is your orchestrating session, `<OWNER>` the human who holds money, legal and deploy authority, `<HQ>` the folder holding desks and research, `<REPO_ROOT>` your repository, `<GATE_CMD>` your test command.
2. **Name your gates.** Each lane's "Gates before you report done" section lists categories (full suite, type check, invariants, guards, render check). Put your actual commands there.
3. **Write your honesty contract once** in the root instruction file and keep the one-line reference in each role. The examples here ("measured vs estimated never merged") are fictional; use whatever your product must never blur.
4. **Drop roles you do not need.** A small team may keep only the three build lanes, `verifier` and `security-auditor`. Department heads earn their cost once there is a standing area with its own ledger.
5. **Keep the boundaries.** The "prepares, never executes" line is the part most worth keeping. Back it with your tool's permission deny list (see `adapters/claude-code/settings.example.json`) so the boundary does not rest on the prompt alone.
6. **Model routing.** Orchestration, review and verification on the strongest model you have; build lanes on the next tier. Design-heavy and long-form drafting work may justify the stronger model.
