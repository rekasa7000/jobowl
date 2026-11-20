# Product

## The problem

Job hunting is repetitive work that punishes cutting corners. You check the same boards every day, skim dozens of postings to find the few that fit, rewrite your resume for each one, and fill in the same form fields again and again. Tools that automate this either spray low-quality applications everywhere, invent experience to game keyword filters, or need you to hand your data to someone's server.

## What JobOwl is

A Windows desktop app that does the legwork of a job search on your own PC, with you in charge of every decision that matters:

- It **finds** openings that match what you want.
- It **ranks** them against your actual experience and says why.
- It **tailors** your resume for the ones you pick, using only what's true.
- It **prepares** the application and waits for you to submit it.
- It **tracks** where every application stands.

## Who it's for

One person: the owner of the PC. Usually a software or technical professional comfortable installing a desktop app and, optionally, pasting in an API key or running Ollama. The first user is the author.

It is open source so anyone can run their own copy. It is not multi-user, not a SaaS, and not for recruiters.

## Principles

These decide arguments. If a feature breaks one, the feature loses.

1. **True or nothing.** Every fact on a generated resume, cover note or form answer traces back to the user's profile. The AI chooses, orders and rephrases; it never adds. ([ADR 0004](adr/0004-profile-is-source-of-truth.md))
2. **The user presses send.** JobOwl never submits an application or sends an email by itself. ([ADR 0005](adr/0005-human-approval-for-outbound-actions.md))
3. **Your machine, your data.** No accounts, no server, no telemetry. Data leaves the PC only to reach a job source or an AI provider the user configured. ([ADR 0007](adr/0007-local-only.md))
4. **Polite on the web.** Use public APIs and structured data. Respect terms of service and robots.txt. No CAPTCHA solving or bot evasion. ([ADR 0003](adr/0003-job-sources-policy.md))
5. **Fewer, better applications.** The product optimises for applications that are a real fit and read like a person wrote them, not for volume.
6. **Show the work.** Every score has reasons; every tailored line shows where it came from; every AI call is logged with its cost.

## Non-goals (v1)

- Auto-submitting applications or auto-sending emails, at any confidence level.
- Scraping LinkedIn, Indeed, Glassdoor or other sites whose terms forbid automated access.
- Solving CAPTCHAs, rotating proxies, faking browser fingerprints.
- Accounts, sync between devices, cloud backup, mobile apps.
- Writing experience the user doesn't have, or "keyword stuffing" invisible text.
- macOS and Linux installers (the code stays cross-platform where it's free to; only Windows is tested and shipped).
- Interview prep, salary negotiation coaching, networking/CRM features.

## Features

### F1. Profile

- Import a resume from PDF, DOCX or pasted text.
- The Parser layer turns it into a structured profile; the user reviews every item before it's saved.
- Edit the profile directly: experiences, bullets, skills, education, projects, certifications, links.
- **Standard answers** for recurring form questions: work authorisation, notice period, salary expectation, willingness to relocate, pronouns, EEO responses (default: decline to answer).
- **Writing samples** (optional): a few paragraphs the user wrote, used to match their voice.
- Profile is versioned. Every tailored resume records which version it came from.

### F2. Searches

- One or more searches, each with: target titles, must-have keywords, nice-to-have keywords, excluded words (for example "clearance required", "unpaid"), locations, remote mode (remote / hybrid / on-site / any), seniority, salary floor and currency, excluded companies.
- Searches are enabled or paused independently.

### F3. Discovery runs

- A run starts automatically when the app launches if the last run is older than the configured interval (default 6 hours), and on demand with **Run now**.
- A run fetches from every enabled source, deduplicates, applies hard filters, then scores the survivors.
- Progress is visible while it runs: which source, how many jobs, how many new, errors.
- Optional: start JobOwl with Windows (minimised to tray) so the run happens when you log in.

### F4. Job feed

- New matches sorted by score, with the score's reasons: matched requirements, gaps, dealbreakers.
- Filters: search, score range, source, remote mode, date posted, "new since last run".
- Actions per job: **Shortlist**, **Dismiss** (with optional reason, which feeds future scoring), **Open posting**.

### F5. Tailoring

- For a shortlisted job, generate a tailored resume.
- Side-by-side view: job requirements on one side, the tailored resume on the other, each line labelled with its source in the profile.
- The Checker's verdict on each line. Lines it rejected are shown and reverted to the original profile wording.
- The user can edit, swap bullets in or out from the profile, and regenerate.
- Export to PDF and DOCX using the selected template.

### F6. Approval queue and applying

- Approving a tailored resume creates an **application draft** in the queue.
- If the job has a supported application form: **Open and fill** launches Edge, fills the form, attaches the resume, drafts answers to free-text questions (shown in JobOwl for approval first), and stops. The user reviews and clicks Submit in the browser. JobOwl detects the confirmation page, or the user marks it submitted.
- If there's no form but there is a contact email: **Draft email** writes a short email, attaches the resume, and opens it in the default mail app as an unsent draft.
- If neither: the application stays in the queue with the posting link and the files ready.

### F7. Application tracker

Everything v0.1 did, kept:

- Statuses: Draft, Applied, Interview, Offer, Rejected, Withdrawn.
- Automatic activity history for every status change and edit.
- Notes per application.
- Search across company, position and notes; filter by status.
- Sort by status priority: Interview → Offer → Applied → Draft → Rejected → Withdrawn.
- Manual entries for applications made outside JobOwl.
- One-time import of the v0.1 `applications.json`.

### F8. Settings

- AI providers: Ollama (local), Anthropic, OpenAI, any OpenAI-compatible endpoint. API keys stored with Windows encryption.
- Model per layer, with a test button and a running cost estimate.
- Monthly spending cap; runs pause when it's reached.
- Sources: enable/disable, add company boards, add career-page URLs, aggregator API keys.
- Run interval, start with Windows, theme (dark / light / system), data folder location, export/backup.

## Main flows

### First run

1. Welcome screen explains in three sentences what JobOwl does and that data stays local.
2. Choose AI: detect Ollama if running; otherwise paste an API key. Skippable (the tracker works without AI).
3. Import resume → review parsed profile → save as profile v1.
4. Create the first search.
5. Pick sources (Greenhouse/Lever/Ashby boards and aggregators are pre-listed; user adds companies).
6. First run starts; user lands on the feed.

### Daily use

1. Launch (or log in, with start-with-Windows on). Run starts if due.
2. Open the feed. Read the top matches and their reasons. Shortlist two, dismiss the rest.
3. Tailor each shortlisted job; review the diff; approve.
4. Open the approval queue. **Open and fill** the first; review in Edge; Submit. **Draft email** for the second; send from Outlook.
5. Both move to Applied in the tracker with their files attached.

### Updating the profile

1. Edit the profile or import a new resume.
2. Save creates profile v(n+1). Existing tailored resumes keep pointing at the version they used.
3. Optionally re-score open matches against the new version.

## Success criteria for v1

- From launch to a reviewed, filled-in application in under 10 minutes for a Greenhouse or Lever job.
- Zero fabricated facts across the tailoring eval set (see [TESTING.md](TESTING.md#tailoring-eval)).
- A full daily run on a local model costs nothing; on a cloud model, the cost per run is shown and stays under the user's cap.
- The app works offline for tracking and editing; only runs and AI need the network.
