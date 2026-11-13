<!-- jarvis-kit: generic adaptation of a "third-party UI enters as raw source" rule from a production multi-agent setup; real values replaced with placeholders. -->

# Rule: third-party UI enters as reviewed RAW SOURCE only

**Applies when** an agent touches frontend source, a component-registry config, or an icon package. Put this rule verbatim in any UI-touching brief you write.

**Why it exists:** a component package is code you did not read, updated by someone else, running in your users' browsers. Agents install packages casually. Vendoring raw source forces a line-by-line read and makes every change to that code a reviewed diff in your repo.

## The rule

- Third-party UI components (from any registry or collection) enter the repo **only as vendored raw source**: never as an npm component package, and never through a registry CLI that writes straight into the tree. A registry browser (CLI or MCP server) is for browse, discover and fetch ONLY.
- **Order of work:**
  1. **Licence first.** Read the licence from the upstream repository's LICENSE file (for GitHub: `gh api repos/<owner>/<repo> --jq '.license.spdx_id'`) BEFORE reading a line. Marketing pages are not the artefact. Watch for: copyleft licences with per-directory carve-outs (check the exact path), "source available" with no licence at all (reference only), and permissive licences with a non-commercial rider.
  2. **Read every line** for network calls, `eval`, raw-HTML injection, telemetry, storage writes, and event listeners that are never cleaned up.
  3. **Adapt** to your design tokens and your motion rules. Motion is decoration, never information: data never depends on an animation completing, and reduced-motion turns movement into a fade or nothing.
  4. **Vendor with a header** recording origin (URL, commit), licence, reviewer and date.
- **Engines already in the tree stay npm dependencies** (your framework, your animation engine, your chart maths). **Any NEW engine-level dependency needs explicit <OWNER> approval.** Record each approved exception with the exact pinned version, the apps it may appear in, and what it may supply (for example "overlay behaviour only, through our own wrapper"). Every version bump of an exception is a review event.
- **A unit-test DOM computes no layout.** A green unit run says nothing about geometry. Any claim that something renders needs a real-browser check (desktop and a phone viewport), and a UI item's acceptance includes a picture a person looked at.
- **One doorway per concept.** Every new top-level route goes in the route catalog, enforced by a test. A change that supersedes a surface retires the old doorway in the same change.

## Owner design rules: keep them verbatim

If <OWNER> gives design rules (a list of patterns to avoid, a set of motion rules), store them verbatim in one file and paste them into every UI brief. Do not paraphrase; paraphrase drifts. A short fictional example of such a list:

- avoid: gradient backgrounds, decorative pills and tags, ALL-CAPS subtitles, excessive dividers, bordered containers inside bordered containers
- motion: ease-out for entrances, exits about 20% shorter than entrances, no bounce on everyday UI, durations and easings come from one token set

State pills are allowed only where they carry status a person acts on, with a reason. Honesty copy (disclosures, labels that keep estimated figures apart) stays even when trimming text.
