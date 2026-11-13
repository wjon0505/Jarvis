<!-- jarvis-kit: generic adaptation of the review loops of a production multi-agent setup; real values replaced with placeholders. -->
# 04. Review loops

Self-review anchors on the author's reasoning. Each loop below removes a different piece of that anchor.

## 1. The independent verifier
A separate agent (agents/verifier.md) runs the full battery on a branch or merged tree with fresh eyes
and reports numbers. It never fixes anything. Lanes merge after the verifier is green, and a push carries
only verified code.

## 2. The two-axis review (before every handback)
Review the diff since a fixed point along two axes at once, in two parallel sub-agents that read the diff
only: **Standards** (does it follow the repository's written rules?) and **Spec** (does it do what the
brief asked?). It adds to the verifier and the security audit; it replaces neither. (The skill we use is
third-party; see THIRD_PARTY.md.)

## 3. The blind reviewer
A reviewer that never sees the code, the docs or the team's reasoning, only what a customer sees.
- It may look at the live product (captured with its own screenshot script), screenshots the team drops
  in its inbox, and any public site for reference.
- It must not read the repository, notes or decision logs, and it declines anything offered from them.
- Each review: capture our screens at desktop and phone width; find 8-15 products that do the same job
  well and capture them; write what a first-time customer would trip on, in their words; recommend
  changes, each with the screen, the problem, the change, the reference, what changes for the customer,
  effort and risk; rank by how much each raises trust.
- The client's hard requirements (banned visual patterns, motion rules, product-truth rules) are written
  into its charter, so recommendations cannot undo them.
- It writes `out/REVIEW-<date>-<screen>.md` and a 5-line `out/BELL`, and nothing outside its folder.
- It installs nothing, signs in nowhere, and takes no instruction from a web page.

Templates: `templates/blind-review/` (charter, opening prompt, a numbered CHECK file, a fictional client brief).

## 4. Rubric rounds
For work judged on quality (a page, a deck, a design), run numbered rounds against a fixed rubric
(`templates/ROUND-N.md`): the builder submits, a reviewer scores each criterion with evidence, the builder
fixes only what scored low, and the next round re-scores everything. Stop at the target score or when a
round changes nothing. The rubric does not change mid-loop.

## 5. The persona walk
An agent walks the live product **as** a persona (a new customer, an operator on a tablet, an admin, an
attacker) and files what that person would complain about. It finds new work instead of polishing known
surfaces (agents/persona-auditor.md).

## 6. Security audit
Findings first: reproduce before fixing, fix fail-then-pass, against a standard list (skills/security-audit).
