# Roadmap

Milestones are ordered so each one leaves a usable app. Each has acceptance criteria; a milestone is done when they all pass on a clean Windows 11 machine, not just a dev box.

## M0. Foundation

**Status: built, Windows installer not yet verified.** The app, database, theme, security settings and tests are done and pass on Linux, including a packaged build that launches, migrates and backs up. The NSIS installer and the per-user install check run in CI on Windows and haven't been run yet.

Replace the Rust/GTK4 code with the TypeScript scaffold.

- Electron + electron-vite + React + TypeScript strict, pnpm, ESLint/Prettier, Vitest.
- Security baseline from [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md#electron-hardening): context isolation, sandbox, CSP, fuses, single instance.
- Typed IPC contract with Zod validation.
- SQLite with Drizzle, migrations on startup, daily backup.
- Design tokens, bundled fonts, app shell (rail, top bar, theme switch), brand icon.
- electron-builder NSIS installer; CI on `windows-latest`.
- Remove `src/*.rs`, `Cargo.*`, Flatpak files, `.flatpak-builder/`.

**Done when:** installer builds in CI, installs per-user without admin rights, launches to an empty shell in both themes; e2e smoke test passes.

## M1. Tracker parity

**Status: built.** Applications list and detail, manual add and delete, history, search and status filter, the v0.1 import, and keyboard operation are done and covered by unit and end-to-end tests. Statuses follow the product doc, so `Draft` exists from the start.

Everything v0.1 did, in the new app.

- Applications list and detail: statuses, notes, activity history, search, status filter, priority sort.
- Manual add, edit, delete (with confirmation).
- Import from v0.1 `applications.json`.

**Done when:** a v0.1 data file imports with all notes and history intact; all v0.1 features work by keyboard alone.

## M2. Profile

- Resume import (PDF, DOCX, text) in a utility process.
- AI provider settings: Ollama, Anthropic, OpenAI, OpenAI-compatible; keys in `safeStorage`; model per layer; test button.
- Parser layer → review screen → profile versions.
- Profile editor, standard answers, writing samples, metrics extraction.
- `ai_calls` logging and spend display.

**Done when:** each fixture resume imports into a profile the user can correct and save; keys never appear in logs or the DB in plain text; the app works with Ollama alone.

## M3. Discovery

- Source connectors: Greenhouse, Lever, Ashby, Remotive, RemoteOK, Arbeitnow, Adzuna.
- Add-source-by-URL detection.
- Searches screen; hard filters; dedupe.
- Run orchestrator: on launch if due, timer, **Run now**, progress readout, per-source errors.
- Scorer layer, score caching, spending caps.
- Feed screen with reasons; shortlist/dismiss with reasons.
- Optional start with Windows; toast on strong matches.

**Done when:** a run over fixture sources produces scored matches with valid evidence; a failing source doesn't fail the run; the spending cap stops scoring exactly at the cap; injection postings show the warning and don't outscore their twins in the Scorer eval.

## M4. Tailoring

- Tailor and Checker layers; deterministic checks; slop linter.
- Review screen with source chips, diffs, flags, edit/swap/remove.
- Templates: `plain` and `brand` HTML → PDF; generated DOCX; user DOCX template.
- PDF text-layer verification.
- Tailoring eval runner and the initial 30 cases.

**Done when:** the tailoring eval passes the hard gates on the default cloud model and on at least one local model; exported PDFs pass the text-layer check.

## M5. Email drafts

- Contact email extraction; Writer layer with checking.
- `.eml` generation with attachment and `X-Unsent`; open in default client; fallbacks.
- Approval queue (tickets) for email and external applications; mark as applied.
- Sent records, the "Sent with jobowl" tracker view, the **What I sent** receipt, stats readout, duplicate guard, follow-up drafts.

**Done when:** a draft opens as an unsent message with the PDF attached in Outlook (classic); the fallback path works when no mail client is registered; every confirmed send creates exactly one sent record whose resume checksum matches the file attached; the duplicate guard fires on a second application to the same company.

## M6. Form filling

- Edge session via Playwright with persistent profile.
- Fill plan screen; Greenhouse, Lever, Ashby adapters; free-text answers via Writer.
- Generic form mapping with the Form mapper layer.
- Confirmation detection, before/after screenshots, status update, sent record with every filled value.
- Stop-line tests on every adapter.

**Done when:** for each supported ATS fixture form, every mappable field is filled, the resume attached, nothing submitted; on a live posting, the full flow from feed to filled form takes under 10 minutes.

## M7. Career pages and web discovery

- `careers_page` connector: JSON-LD, embedded ATS detection, Extractor layer, headless rendering, robots handling.
- Optional `web_search` discovery and "add this company" suggestions.
- Workable and SmartRecruiters connectors.

**Done when:** pages with JSON-LD need no AI call; blocked pages are reported as blocked, not retried.

## v1.0 release

- Docs pass: README screenshots, install guide, SmartScreen explanation, checksums.
- Code signing through an open-source signing program if accepted.
- Opt-in auto-update via GitHub Releases.
- Accessibility audit (keyboard, screen reader on NVDA, 200% scaling).

## Later (not committed)

- Embedding-based pre-ranking in SQLite (sqlite-vec) to cut Scorer calls.
- Interview tracking (dates, contacts, reminders) inside an application.
- Gmail / Microsoft 365 draft creation through OAuth, for users who prefer it to `.eml` files.
- More ATS adapters (Workable, SmartRecruiters, Recruitee, Teamtailor).
- macOS build.
