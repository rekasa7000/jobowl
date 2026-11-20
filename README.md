# jobowl

A job-hunting desktop app for Windows that runs entirely on your own PC.

jobowl finds job openings that match what you're looking for, tailors your resume to each one without inventing anything, and prepares the application. You approve every application before it goes out. Where a job has no application form, jobowl writes the email for you to send.

No accounts. No server. No telemetry. Your resume, your data, and your API keys stay on your machine.

> **Status: profile built (M0 to M2).** jobowl tracks your applications locally, imports your jobowl 0.1 data, and reads your resume into a profile you check and correct, using an AI model on your PC or with your own key. Job discovery, tailoring and applying come next; see [the roadmap](docs/ROADMAP.md) and start with [`docs/README.md`](docs/README.md). The original Rust/GTK4 tracker (v0.1) is gone from the tree but stays in git history.

## What it does

1. **You set up a profile once.** Upload your resume (PDF or DOCX). jobowl turns it into a structured profile you review and correct. That profile is the source of truth: the AI can choose, reorder and rephrase what's in it, never add to it.
2. **You say what you're looking for.** Job titles, keywords, locations, remote or on-site, salary floor, things to avoid.
3. **Each launch, jobowl looks for openings.** It pulls from public job-board APIs (Greenhouse, Lever, Ashby and others), aggregators, and career pages you add, then scores each job against your profile.
4. **For jobs you shortlist, it tailors your resume.** A second AI pass checks every line against your profile and throws out anything it can't trace back.
5. **You approve, it applies.** jobowl fills in the application form in a visible Edge window and stops. You review it and click Submit yourself. No form? It drafts an email with your resume attached and opens it in your mail app.
6. **It tracks everything you send.** Every application sent through jobowl is recorded automatically with exactly what went out: the resume file, every answer, the email, screenshots, and the posting as it was. Statuses, notes, history, follow-up reminders and simple stats (response rate, time to reply) sit on top, along with anything you applied to outside the app.

## Bring your own AI

Use a model running on your PC through [Ollama](https://ollama.com), a cloud model with your own API key, or both. Each AI step can use a different model. For example, a local model can score jobs and a stronger cloud model can tailor resumes.

## Documentation

| Doc | What it covers |
|---|---|
| [Product](docs/PRODUCT.md) | Goals, non-goals, features, user flows |
| [Architecture](docs/ARCHITECTURE.md) | Processes, modules, folder layout, data flow |
| [Data model](docs/DATA_MODEL.md) | SQLite schema and the profile format |
| [AI pipeline](docs/AI_PIPELINE.md) | The AI layers, providers, prompts, cost control |
| [Job sources](docs/JOB_SOURCES.md) | Where jobs come from and the rules for fetching them |
| [Resume engine](docs/RESUME_ENGINE.md) | Import, tailoring, verification, templates |
| [Apply and email](docs/APPLY_AND_EMAIL.md) | Form filling, approval, email drafts |
| [Security and privacy](docs/SECURITY_PRIVACY.md) | Threat model, secrets, Electron hardening |
| [Design](docs/DESIGN.md) | Brand, tokens, type, components, screens |
| [Anti-slop rules](docs/ANTI_SLOP.md) | What the UI, the AI's writing and the code must never do |
| [Testing](docs/TESTING.md) | Test layers, fixtures, the tailoring eval |
| [Roadmap](docs/ROADMAP.md) | Milestones and acceptance criteria |
| [Decisions](docs/adr/) | Architecture decision records |

## Stack

Electron, TypeScript, React, Vite, SQLite, Playwright (driving the Edge already installed on Windows). See [ADR 0001](docs/adr/0001-electron-typescript.md) for why.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
