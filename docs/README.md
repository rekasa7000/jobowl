# JobOwl documentation

These documents are the plan for JobOwl v1, the TypeScript rewrite. They come before the code: when code and docs disagree, one of them is a bug, and the fix lands in the same change.

## Read in this order

1. [PRODUCT.md](PRODUCT.md): what JobOwl is for, what it won't do, the main flows.
2. [ARCHITECTURE.md](ARCHITECTURE.md): how the pieces fit, the folder layout, the run pipeline.
3. [DATA_MODEL.md](DATA_MODEL.md): the SQLite schema and the profile format everything else depends on.
4. Whichever subsystem you're working on:
   - [AI_PIPELINE.md](AI_PIPELINE.md): the AI layers, providers, prompts, cost control.
   - [JOB_SOURCES.md](JOB_SOURCES.md): connectors and the rules for fetching jobs.
   - [RESUME_ENGINE.md](RESUME_ENGINE.md): import, tailoring, verification, templates.
   - [APPLY_AND_EMAIL.md](APPLY_AND_EMAIL.md): form filling and email drafts.
5. [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md): the threat model. Read it before touching IPC, secrets, or anything that handles web content.
6. [DESIGN.md](DESIGN.md) and [ANTI_SLOP.md](ANTI_SLOP.md): how it looks, how it writes, what it never does.
7. [TESTING.md](TESTING.md) and [ROADMAP.md](ROADMAP.md).

## Decisions

Architecture decision records live in [`adr/`](adr/). Each one is short: context, decision, consequences. To change a decision, write a new ADR that supersedes the old one rather than editing history.

| ADR | Decision |
|---|---|
| [0001](adr/0001-electron-typescript.md) | Electron + TypeScript, replacing Rust/GTK4 |
| [0002](adr/0002-sqlite-local-storage.md) | SQLite in the user's AppData as the only datastore |
| [0003](adr/0003-job-sources-policy.md) | Public APIs and structured data first; no scraping against terms |
| [0004](adr/0004-profile-is-source-of-truth.md) | The profile is the source of truth; AI selects and rephrases, never invents |
| [0005](adr/0005-human-approval-for-outbound-actions.md) | A person approves every outbound action |
| [0006](adr/0006-llm-provider-interface.md) | Own provider interface, official SDK per provider |
| [0007](adr/0007-local-only.md) | No accounts, no server, no telemetry |

## Glossary

| Term | Meaning |
|---|---|
| **Profile** | The structured, user-verified version of the resume: jobs, bullets, skills, education, links, standard answers. Versioned. The only source of facts. |
| **Search** | What the user is looking for: titles, keywords, locations, remote mode, salary floor, exclusions. A user can have several. |
| **Source** | Where jobs come from: one connector type plus its config (for example, Greenhouse board `acme`). |
| **Job** | A posting fetched from a source and stored locally, deduplicated. |
| **Match** | A job scored against a search and the profile. |
| **Run** | One pass of the pipeline: fetch → filter → score. Happens on launch and on demand. |
| **Tailored resume** | A resume built for one job from profile items, verified line by line. |
| **Application** | A job the user has applied to (or is preparing to), with status and history. Carries over from v0.1. |
| **Layer** | One AI step in the pipeline (Parser, Scorer, Tailor, Checker, Writer, Form mapper). Each can use a different model. |
| **Approval queue** | Where prepared applications wait for the user to review and submit. |
