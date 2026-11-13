---
name: test-runs-through-the-slot
description: every whole-workspace test run goes through the slot script; two at once crashed the build machine
metadata:
  type: feedback
---

<!-- jarvis-kit: template memory file; fictional example. Types: user | feedback | project | reference. -->

Every whole-workspace test run (unit, integration, end-to-end, guards) goes through `scripts/slot/gate-run.sh`,
never directly.

**Why:** on 2030-01-15 three lanes ran their suites directly at the same time; memory ran out and the build
machine rebooted, losing every run in flight.

**How to apply:** put "run tests only through gate-run.sh" in every lane brief; a `pgrep` check is not a
substitute. See [[owner-wants-decision-prompts]] for how to ask before raising the lane cap.
