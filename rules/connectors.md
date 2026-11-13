<!-- jarvis-kit: generic adaptation of an integrations-and-deploy-manifests rule from a production multi-agent setup; real values replaced with placeholders. -->

# Rule: external integrations and deploy manifests

**Applies when** an agent touches an adapter to an external system or a deploy manifest. Scope it to your integrations directory and your infrastructure directory.

**Why it exists:** integrations are where a lane can reach the real world (charge a card, send an email, spend a single-use token), and manifests are where a secret can leak into a file. Both need rules a lane cannot miss.

## The rules

- **Central brain, thin adapters.** The backend is the single source of truth. Every external system is a swappable adapter behind a common interface and a config toggle. Do not invent a second architecture: match the established adapters, and update the integration doc (auth, data model, webhooks, rate limits, toggle key) in the same change. A check should confirm that every toggle key the doc publishes is read by the code.
- **Research before building** anything that depends on an external API or standard. No memory-only facts for things that change. Record what you read and the date.
- **No live third-party calls from a lane.** After copying the environment into a worktree, run a disarm step that blanks live credentials, switches providers to mock (email, SMS, payments, every integration toggle), and points at local services. Verify it with a search tool that can see ignored files. Never print `.env` values.
- **Single-use credentials.** Some providers rotate refresh tokens on every use. A service booted over a database copy that holds a live grant spends that token and kills the shared grant permanently. Delete grant rows in a copy before booting anything against it.
- **Environment coherence.** Make the environment (sandbox or live) a single setting from which both the provenance label and the base URL derive, and add a check that refuses a manifest where they disagree. Keep every app id in the repo sandbox-only until <OWNER> turns live on.
- **Disconnect and revoke paths enumerate every provider.** Every writer re-checks its connection inside its own transaction. A stored credential dies with the link that created it.
- **OAuth state is bound to the browser that started the flow** (for example a host-only cookie checked at callback). Read the account identity back from the grant, never from a request parameter. If two entry points complete the same flow, route them through one function.
- **Mock fidelity.** A mock more permissive than the real API hides defects. An adapter built against a replica is validated against the real sandbox before anyone calls it working. A compile pass is not evidence the app starts: keep a test that boots the real dependency graph, because wiring errors often do not fail the type checker.
- **Manifests.** Secrets come from the secret store, never inline. A check enumerates every manifest and every secret reference in it. Health probes: a startup probe that checks the database and migrations (so an image ahead of its database never takes traffic) and a liveness probe that checks only the process.
