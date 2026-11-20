# Architecture

## Overview

jobowl is a single Electron app with no backend. Everything runs in three kinds of process on the user's PC, plus an Edge window that Playwright drives when applying.

```
┌──────────────────────────────── jobowl.exe ────────────────────────────────┐
│                                                                            │
│  Renderer (React, sandboxed)          Main process (Node, trusted)         │
│  ┌──────────────────────────┐  IPC   ┌──────────────────────────────────┐  │
│  │ Feed · Queue · Tracker   │◄──────►│ ipc/      typed, Zod-validated   │  │
│  │ Profile · Searches       │ (pre-  │ core/     run orchestrator       │  │
│  │ Sources · Settings       │ load)  │ db/       SQLite (better-sqlite3)│  │
│  └──────────────────────────┘        │ secrets/  safeStorage (DPAPI)    │  │
│                                      │ sources/  job connectors         │  │
│                                      │ ai/       provider interface     │  │
│                                      │ resume/   import, tailor, render │  │
│                                      │ apply/    Playwright form filler │  │
│                                      │ email/    .eml drafts            │  │
│                                      └───────┬──────────────┬───────────┘  │
│                                              │              │              │
│                     utilityProcess (Node) ◄──┘              │              │
│                     document parsing (PDF/DOCX)             │              │
└─────────────────────────────────────────────────────────────┼──────────────┘
                                                              │ Playwright
     Network (only to what the user configured):              ▼
     job-board APIs · career pages · AI provider ·     Microsoft Edge (headed,
     Ollama on localhost                               persistent jobowl profile)
```

### Why this shape

- **Renderer is untrusted UI only.** It has no Node access and never loads remote content. It talks to main through a small typed API exposed by the preload script. See [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md#electron-hardening).
- **Main owns everything with side effects:** database, files, secrets, network, browser automation. One owner per resource keeps the model simple.
- **Most work is I/O-bound** (HTTP, LLM calls, browser automation), so it runs on main's event loop with `async` code. `better-sqlite3` is synchronous but its queries take microseconds at this data size.
- **CPU-heavy work goes to a `utilityProcess`:** PDF and DOCX text extraction. If profiling shows other hot spots (large HTML parsing, embedding), they move there too. Don't move things speculatively.
- **PDF rendering uses Electron itself:** a hidden `BrowserWindow` loads the resume HTML and calls `webContents.printToPDF()`. No headless Chromium bundled.

## Stack

| Concern | Choice |
|---|---|
| Runtime | Electron (current stable at M0; upgrade each major within 8 weeks) |
| Language | TypeScript, `strict: true` |
| Build | electron-vite on Vite 8 (main, preload and renderer bundles) |
| Packaging | electron-builder → NSIS installer, per-user install, no admin rights |
| Updates | electron-updater against GitHub Releases (opt-in, see [ROADMAP](ROADMAP.md)) |
| UI | React, TanStack Query over IPC; React Router (memory router) |
| Styling | Tailwind CSS v4 with the brand tokens from [DESIGN.md](DESIGN.md); Radix primitives for accessible dialogs, menus, popovers |
| Icons | Lucide |
| Database | SQLite via better-sqlite3, Drizzle ORM and drizzle-kit migrations |
| Validation | Zod (IPC, LLM output, connector payloads, profile) |
| Browser automation | Playwright (`playwright-core`) with `channel: 'msedge'` |
| HTML parsing | linkedom (DOM without a browser), turndown for HTML → Markdown |
| Documents in | unpdf (PDF text), mammoth (DOCX → HTML) |
| Documents out | Handlebars HTML templates → `printToPDF`; docx (generated DOCX); docxtemplater (user's own DOCX template) |
| AI | Own `LlmProvider` interface; official SDKs: `@anthropic-ai/sdk`, `openai`, `ollama` ([ADR 0006](adr/0006-llm-provider-interface.md)) |
| Scheduling | In-app timer plus "run on launch"; optional login item via `app.setLoginItemSettings` |
| Logging | pino → rotating file in the data folder; secrets redacted |
| Tests | Vitest, Playwright (`_electron`) for end-to-end |
| Lint/format | ESLint (typescript-eslint), Prettier |
| Package manager | pnpm |

## Folder layout

```
jobowl/
├─ docs/                      # this documentation
├─ resources/                 # icons and default templates (shipped as-is)
│  ├─ icons/
│  ├─ fonts/                  # added with the resume templates (M4); the UI's fonts come from @fontsource
│  └─ templates/              # resume + email templates
├─ src/
│  ├─ shared/                 # imported by main AND renderer: types only, no Node, no DOM
│  │  ├─ schemas/             # Zod: profile, search, job, match, tailored resume, settings
│  │  ├─ ipc-contract.ts      # every IPC channel: name, input schema, output schema
│  │  └─ statuses.ts          # application statuses and their priority
│  ├─ main/
│  │  ├─ index.ts             # app lifecycle, window creation, single-instance lock
│  │  ├─ ipc/                 # handlers, one file per area; validate in, validate out
│  │  ├─ core/                # run orchestrator, scheduler, event bus to renderer
│  │  ├─ db/                  # Drizzle schema, migrations, repositories
│  │  ├─ secrets/             # safeStorage wrapper
│  │  ├─ legacy/              # one-time import of jobowl 0.1 data
│  │  ├─ sources/             # connector interface + one folder per connector
│  │  ├─ ai/                  # LlmProvider, adapters, layers, prompts, cost tracking
│  │  ├─ resume/              # import, profile builder, tailor pipeline, renderers
│  │  ├─ apply/               # browser session, form adapters, field mapper
│  │  ├─ email/               # contact extraction, .eml writer
│  │  └─ workers/             # utilityProcess entry points
│  ├─ preload/
│  │  └─ index.ts             # contextBridge: exposes window.jobowl, typed from ipc-contract
│  └─ renderer/
│     ├─ app/                 # routes, layout, providers
│     ├─ screens/             # feed, queue, tracker, profile, searches, sources, settings, onboarding
│     ├─ components/          # shared UI built on the design tokens
│     ├─ lib/                 # ipc client (TanStack Query hooks), formatting
│     └─ styles/              # tokens.css, base.css
├─ tests/
│  ├─ fixtures/               # recorded API responses, sample resumes, sample postings
│  ├─ e2e/                    # Playwright against the built app
│  └─ eval/                   # tailoring eval set and runner (opt-in, costs money)
├─ AGENTS.md  CLAUDE.md  CONTRIBUTING.md  SECURITY.md  LICENSE  README.md
└─ package.json  electron.vite.config.ts  electron-builder.yml  drizzle.config.ts
```

Rules for the layout:

- `shared/` has no runtime dependencies except Zod. If renderer code needs something from main, it goes through IPC.
- Every connector, AI layer and form adapter is a folder with its own tests and fixtures beside it.
- No barrel files that re-export everything; import from the module that owns the thing.

## Build notes

Things that are easy to get wrong, learned while building M0:

- **Preload is CommonJS and self-contained.** Sandboxed preload scripts can't be ES modules and can't `require` packages, so electron-vite emits `preload/index.cjs` and bundles zod into it.
- **One SQLite binary for Node and Electron.** better-sqlite3 13 uses N-API, so the prebuilt binary works in both. electron-builder runs with `npmRebuild: false`; there is nothing to recompile.
- **The resume reader is its own build entry.** `workers/extract` is bundled separately and started with `utilityProcess.fork`, one throwaway process per file with a 30 second limit. Only extracted text comes back to main.
- **Key storage is async.** Electron 45 deprecates the synchronous `safeStorage` calls, so the secret store and provider factory are async.
- **Migrations ship as a resource.** The `drizzle/` folder is copied next to the app (`resources/drizzle`) and found through `process.resourcesPath` when packaged.
- **Fuses apply to packaged builds only.** `runAsNode`, Node CLI inspect flags and the Node options variable are off in the installer, so end-to-end tests drive the built output (`out/`), not the installed app.

## Data location

All user data lives in one folder, default `%APPDATA%\jobowl\` (changeable in Settings, for example to a synced drive the user controls):

```
%APPDATA%\jobowl\
├─ jobowl.db              # SQLite (WAL mode)
├─ files\
│  ├─ imports\            # original uploaded resumes, never modified
│  ├─ resumes\            # generated PDF/DOCX, named <company>-<role>-<date>.pdf
│  ├─ emails\             # generated .eml drafts
│  └─ screenshots\        # form state captured before the user submits
├─ templates\             # user's own resume templates (copied from defaults on first run)
├─ browser-profile\       # Edge user-data dir for apply sessions (keeps job-site logins)
├─ backups\               # automatic daily DB backup, last 14 kept
└─ logs\                  # rotating log files
```

Secrets are stored in the database, encrypted with `safeStorage` (Windows DPAPI, tied to the Windows user). See [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md#secrets).

## IPC

- One contract file (`shared/ipc-contract.ts`) lists every channel with Zod schemas for input and output. Preload, main handlers and renderer hooks are all typed from it.
- Request/response uses `ipcRenderer.invoke` / `ipcMain.handle`. Main validates input, runs, validates output.
- **As built in M3, run progress is polled:** the renderer asks `runs:status` once a second while a run is going. The events channel below arrives when something needs push (apply sessions).
- Main pushes events (run progress, job counts, apply-session state) on a single `events` channel with a discriminated-union payload; the renderer subscribes once and updates TanStack Query caches.
- Channel names are `area:verb`, for example `jobs:list`, `jobs:dismiss`, `tailor:generate`, `apply:open`, `settings:update`.
- No channel accepts a file path or URL from the renderer without checking it against an allowlist (paths inside the data folder; http/https URLs only).

## The run pipeline

A run is the background job that turns sources into scored matches. It is owned by `core/run-orchestrator`.

```
start run (on launch if due, timer, or "Run now")
  │
  ├─ 1. Fetch      for each enabled source, in parallel (max 4 at once, per-host rate limit)
  │                → normalise to Job, upsert, track first_seen / last_seen
  │                → a source failing doesn't fail the run; it's recorded on the run
  │
  ├─ 2. Dedupe     same canonical URL, or same (company, normalised title, location) within 30 days
  │
  ├─ 3. Hard filter  deterministic, per search: location, remote mode, excluded words,
  │                  excluded companies, salary floor (when salary is known), posting age
  │
  ├─ 4. Score      Scorer layer on survivors not yet scored for this (search, profile version)
  │                → Match with score 0–100, reasons, gaps, dealbreakers
  │                → stops early if the spending cap is reached
  │
  └─ 5. Finish     record stats; notify renderer; Windows toast if there are new matches ≥ threshold
```

- Runs are **resumable and idempotent.** Jobs are upserted by `(source_id, external_id)`; scoring skips jobs already scored for the current profile version and search. Killing the app mid-run loses nothing but time.
- Only one run at a time. **Run now** during a run does nothing but focus the progress view.
- Tailoring, applying and emailing are **not** part of a run. They happen only when the user asks, per job.

## Per-job flow (user-driven)

```
Match ──Shortlist──► Tailor (Tailor layer) ──► Check (Checker layer + deterministic checks)
                                                  │
                     user reviews & edits ◄───────┘
                              │
                          Approve ──► Application (status Draft) in the approval queue
                                         │
                ┌────────────────────────┼─────────────────────────┐
          form supported           contact email found          neither
     Open and fill (Playwright)    Draft email (.eml)       files + link ready
     user clicks Submit            user sends from mail app  user applies by hand
                └────────────────────────┴─────────────────────────┘
                                         │
                                 status → Applied, files linked, history entry
```

## Error handling

- Connectors throw typed errors (`SourceUnavailable`, `RateLimited`, `BadResponse`, `BlockedByPolicy`). The orchestrator records them on the run and carries on.
- AI calls retry on rate limit and transient errors with backoff (the official SDKs already do this; don't double-wrap). Schema-invalid output gets one repair attempt, then the item is marked failed with the raw output kept for debugging.
- Errors shown to the user say what happened and what to do, in plain words. See [ANTI_SLOP.md](ANTI_SLOP.md#a3-copy).
- Unexpected exceptions in main are logged and shown as a non-blocking banner; they never crash the app silently.

## Migration from v0.1

On first launch, if `%APPDATA%\job-tracker\applications.json` exists, Settings offers **Import from jobowl 0.1**. Each entry becomes an Application with its notes and activity history; ids are reassigned. The old file is left untouched.

## What's deliberately not here

- No local HTTP server. Nothing listens on a port.
- No plugin system in v1. Connectors and form adapters are in-tree.
- No vector database. If embeddings earn a place later, they go in SQLite (sqlite-vec) behind the same repository layer.
