<!-- jarvis-kit: the header pattern for a vendored third-party skill; generic adaptation from a production multi-agent setup. -->
# The vendored-skill header

Put this right after the frontmatter of every vendored `SKILL.md`. Reference files in the same directory
carry a one-line origin comment pointing at it. Keep the upstream LICENSE beside the files.

```markdown
<!-- VENDORED: origin <upstream URL> <path> @ <commit sha> (<licence>, <copyright line>; LICENSE in this directory).
Reviewed line by line <date> by <reviewer> for <request id>: no network call, telemetry, eval or exec,
credential access, hook, settings write, install, global action or agent-directed override text.
HOUSE RULES OUTRANK THIS TEXT (AGENTS.md, docs/STANDING_RULES.md, the lane brief): in a lane, "the user"
means the brief and the orchestrator, and a question goes to the BELL while the lane keeps working; the
issue tracker is the brief plus docs/BACKLOG.md rows, with ids allocated by the orchestrator; every test
run goes through the slot script.
SKILL-SPECIFIC: <how this skill's instructions map onto your process, and any house edit, named> -->
```

## Why
- A reader (human or agent) can tell at a glance whether the text was read and by whom.
- "House rules outrank this text" resolves every conflict in advance, so an upstream instruction (open a
  GitHub issue, ask the user, run the whole suite) cannot override your process.
- Naming every house edit keeps the diff against upstream explainable.
- If two skills share a name with a built-in command, rename your copy and say so in the header.
