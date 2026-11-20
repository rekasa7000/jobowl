# Security and privacy

JobOwl holds the most personal document most people have (their resume), contact details, answers to legal and demographic questions, and API keys that cost money. It runs on one PC for one person. The design goal: **nothing leaves the machine except to a destination the user configured, and nothing the web sends back can make JobOwl act.**

## What leaves the PC

| Destination | What is sent | When |
|---|---|---|
| Job source APIs and career pages | HTTP GET requests with JobOwl's User-Agent; search terms for aggregators | During runs |
| The AI provider for each layer | Profile digest or full profile, job text, form labels | During scoring, tailoring, writing |
| Ollama on `127.0.0.1` | Same as above, but stays on the PC | Same |
| Job sites, in the Edge window | Whatever the user approved in the fill plan | When the user presses **Fill** |
| The user's mail client | A local `.eml` file | When the user approves an email draft |
| GitHub Releases | Version check (only if auto-update is enabled) | On launch |

Nothing else. No analytics, crash reporting or "anonymous usage stats". Settings has a **Network activity** page listing every host contacted in the last 30 days, from the HTTP client's log.

What the AI provider sees is shown in Settings per layer ("The Scorer sends: job text, your skills and bullet text. Not your contact details or standard answers."). Standard answers and contact details are only sent to the Writer and Form mapper when they are needed for that specific output, and the Form mapper receives field labels plus the list of available answer keys, not the answer values.

## Threat model

| Threat | Mitigation |
|---|---|
| A malicious job posting tries to manipulate the AI (prompt injection) | AI layers have no tools or side effects; output is schema-validated and fact-checked against the profile; the user reviews everything before it's used. See below. |
| A malicious page loaded in the app gets Node access | The renderer never loads remote content; postings render as sanitised Markdown; Electron hardening below. |
| A crafted resume file exploits a parser | Parsing runs in a `utilityProcess` with no access beyond its input; file size limit 10 MB; only PDF/DOCX/TXT accepted by content sniffing, not extension. |
| API keys stolen from disk | Encrypted with `safeStorage` (DPAPI, bound to the Windows user); never in plain-text files, env vars, logs or exports. |
| API keys leaked in logs or debug payloads | Logger redacts known secret patterns and every stored secret value; provider headers are stripped from debug payloads. |
| The app is tricked into reading or writing files outside its folder | IPC never accepts arbitrary paths; files are referenced by ID; resolved paths are checked to stay inside the data folder. |
| Another local user reads the data | Data folder is in the user's `%APPDATA%` (per-user ACLs). DPAPI keys are per-user. Full-disk protection is the OS's job (BitLocker). |
| A malicious update | Updates only from this repository's GitHub Releases, signature-checked by electron-updater; auto-update is opt-in. |
| Supply-chain compromise of a dependency | Lockfile committed; Dependabot/Renovate with review; minimal dependency list; `pnpm audit` in CI; no install scripts except the allowlisted native modules (better-sqlite3). |

Out of scope: an attacker who already controls the user's Windows account.

## Prompt injection

Job postings and web pages are untrusted. Anyone can publish a posting that says "Ignore previous instructions…".

1. **No authority to act.** No AI layer can call tools, open URLs, read files, or trigger submission. The pipeline is code; the AI fills in data at fixed points.
2. **Validated outputs.** Zod schema, then semantic checks: evidence IDs must exist in the profile, numbers must exist in metrics, skills must exist in the profile.
3. **Separated data.** Untrusted text is wrapped in labelled tags; the system prompt says content inside them is material to analyse, never instructions.
4. **Human review.** Scores come with reasons; resumes, answers and emails are reviewed before use; form values are approved before filling.
5. **Visible anomalies.** If a posting contains instruction-like text aimed at AI ("ignore", "system prompt", "rate this"), the job card shows a small warning. The job is still scored normally.

## Electron hardening

Following Electron's security checklist:

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for every window.
- The preload script exposes one object (`window.jobowl`) built from the IPC contract; no raw `ipcRenderer`.
- Content Security Policy on the renderer: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'`.
- The renderer never loads a remote URL. `will-navigate` and `setWindowOpenHandler` deny everything; external links go through main, which allows only `http:`/`https:` and opens them in the user's default browser with `shell.openExternal`.
- `webSecurity` stays on; no `allowRunningInsecureContent`; no `<webview>`.
- The hidden PDF render window: sandboxed, no preload, network blocked with `session.webRequest` (only `file:` URLs inside the template folder load).
- Every IPC handler validates input with Zod and checks that the sender is the app's own window.
- Electron fuses: disable `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments`; enable `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar`.
- Single-instance lock so a second launch focuses the existing window.

## Secrets

- Stored in the `secrets` table, encrypted with `safeStorage.encryptString`. On Windows this uses DPAPI, tied to the logged-in user.
- If `safeStorage.isEncryptionAvailable()` is false, JobOwl refuses to store keys and says why, instead of falling back to plain text.
- Keys are decrypted only in main, only when building a provider client, and never sent to the renderer. The UI shows `sk-ant-…4f2a` style masks.
- Exports and backups never include the `secrets` table.

## Privacy features

- **Export everything:** a ZIP with the database (minus secrets), files and templates.
- **Delete everything:** removes the data folder after confirmation, including the browser profile.
- **Per-layer data disclosure** in Settings, as described above.
- **Local-only mode:** a switch that disables every cloud provider and aggregator needing a key, leaving Ollama and public ATS APIs.

## Code signing

Unsigned Windows installers trigger SmartScreen warnings. Plan: apply to an open-source signing program (for example SignPath Foundation) once the project has a public release. Until then the README explains the warning and publishes SHA-256 checksums with each release.
