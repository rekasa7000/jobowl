# Security policy

JobOwl handles a resume, personal details and AI provider API keys, so security bugs matter even though everything runs locally.

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on this repository.

Include what you found, how to reproduce it, and what an attacker could do with it. You'll get a reply within 7 days.

## In scope

- Anything that sends user data, files or API keys somewhere the user didn't choose.
- A job posting, web page or resume file that can make JobOwl take an action (submit, send, read files, run code).
- Electron hardening gaps: renderer reaching Node, IPC without validation, remote content loaded into the app window.
- Secrets written to disk or logs in plain text.

## Out of scope

- Attacks that already require control of the user's Windows account.
- Third-party job boards or AI providers themselves.

See [`docs/SECURITY_PRIVACY.md`](docs/SECURITY_PRIVACY.md) for the threat model.
