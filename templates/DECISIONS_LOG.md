<!-- jarvis-kit: template decisions log; fictional entries. -->
# DECISIONS_LOG.md

Every consequential decision and ambiguity resolution, newest last. Ids are allocated by the
orchestrator. A decision taken in the owner's absence is tagged `[OWNER REVIEW]` until the owner answers.

## DEC-017 Retry webhooks with exponential backoff, max 6 tries [OWNER REVIEW] (2030-01-12)
- **Context:** a provider's webhooks fail during their maintenance windows.
- **Options:** (a) no retry; (b) fixed retry; (c) exponential backoff with a dead-letter queue. Recommended: (c).
- **Decision:** (c), 6 tries over about 2 hours, then dead-letter with an alert.
- **Why:** no lost events; bounded load on the provider.
- **Reversible by:** setting the retry count to 0 in config.
- **Owner's answer:** (pending)

## DEC-018 Adopt a reviewed skill library for build lanes (2030-01-14)
- **Owner's words:** "approve all of them" (typed choice on a decision prompt).
- **Decision:** vendor 12 skills project-scoped, each with an origin and review header; reject 8 (reasons
  listed); new lane briefs only.
- **Reversible by:** removing the skill directories and their manifest entries in one commit.
