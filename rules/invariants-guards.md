<!-- jarvis-kit: generic adaptation of a guard-writing rule from a production multi-agent setup; real values replaced with placeholders. -->

# Rule: writing or editing a guard (an invariant check)

**Applies when** an agent writes or edits a guard: a test whose job is to enforce a property across the codebase (every route is authenticated, every table with personal data is encrypted, every outbound URL is allow-listed). Scope it to your guards directory and frontend test folders.

**Why it exists:** a guard that protects one member of a set leaves the siblings exposed, and a guard that cannot fail gives a green that means nothing. Both look like safety.

## A control that applies to a SET must enumerate its set

Four load-bearing parts:

1. **The set is DERIVED** from its source of truth (the schema, the contract package, the route table, `git ls-files`), never a hand-kept list.
2. **Every member is verified.**
3. **Exceptions are allow-listed with a written reason** and pinned at their exact count.
4. **A new unclassified member FAILS.** Adding a route, a table or a file without classifying it turns CI red.

Pick two or three good guards in your repo as the canonical shapes and copy them; do not invent a new shape each time.

## Comments are not controls

Every source-scanning guard strips comments before matching (per language), and classifies any exception with a reason. Every scanner asserts a **non-zero scan count**, so a walk that matched nothing cannot pass.

## Demonstrations must be able to fail

- A per-file floor ("at least N subjects scanned") does not protect each individual demonstration inside the file. Raise the floor to an impossible value once and watch it go red.
- Keep a control arm beside the mutated arm in the SAME test.
- Never assert a tautology (for example `raw >= filtered`) over a comparison you did not actually run.

## Fail-then-pass is the evidence

A new control is shown red on a single mutation before it is shown green. A guard that passes under both the old and the new implementation proves nothing about the change.

## Pins carry no slack

An allow-list's size is asserted EQUAL to its pinned count. When an entry is repaired, delete it and lower the count; do not leave headroom. Re-key an entry when its subject moves (the path is part of the key).

## Running guards

- The whole guard suite is one gate (`<GATE_CMD>` for guards), run as one invocation per checkout, through the shared test slot if you have one, against your own private test database copy.
- After touching anything a guard reads (docs, the root instruction file, a contract, a manifest), run the guard suite whole, not the one spec you think covers it.
- Never run two test invocations in one checkout at once if they share setup that resets databases.

## Search tools lie by omission

- `git grep` sees tracked files only. A grep alias that honours ignore files cannot see ignored files such as `.env`. Plain `grep` may skip files containing a NUL byte unless given `-a`.
- `git ls-files | xargs grep` breaks on paths with spaces and can return a confident zero.
- When the answer matters, read bytes with a small script (Node, Python) and count.
- In `git grep -E`, `\b` may not mean a word boundary; test your pattern on a known hit first.

## Example of the shape (atomic state change)

A state transition that must happen once (a ticket checked in, an invoice settled) is an atomic guarded compare-and-swap: `UPDATE ... SET state='used' WHERE id=? AND state='valid'`, inside a transaction; zero rows updated means someone else won. A guard can enumerate every such transition from the schema's state columns and require that each writer uses the guarded form.
