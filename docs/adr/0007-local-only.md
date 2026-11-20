# 0007. No accounts, no server, no telemetry

- Status: accepted
- Date: 2026-11-20

## Context

jobowl is used by one person on their own PC and published as open source so others can run their own copy. It handles a resume, contact details, legal and demographic answers, and API keys.

## Decision

- No user accounts or login screen. Whoever can use the Windows account can use jobowl; protecting that account is the OS's job.
- No backend server, no sync, no cloud storage operated by the project.
- No telemetry, analytics or crash reporting. Diagnostics are local log files the user can choose to share.
- The only network destinations are those the user configures (job sources, AI providers) and, if enabled, GitHub Releases for updates.
- The app opens no listening ports.

## Consequences

- Nothing to host, pay for or secure on the project's side.
- No usage data to guide development; feedback comes through GitHub issues.
- Backup is the user's responsibility; jobowl makes it easy (automatic local backups, export ZIP, movable data folder).
- Bugs are reproduced from user-provided logs, which are redacted of secrets by default.
