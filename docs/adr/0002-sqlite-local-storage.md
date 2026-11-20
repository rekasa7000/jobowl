# 0002. SQLite in AppData as the only datastore

- Status: accepted
- Date: 2026-11-20

## Context

v0.1 stored applications in one JSON file. v1 stores thousands of jobs, scores, versioned profiles, generated files, AI call logs and settings, with queries like "unscored jobs for this search and profile version" and "spend this month by layer". Data must stay on the user's PC.

## Decision

One SQLite database (`jobowl.db`, WAL mode) in the data folder, accessed through better-sqlite3 and Drizzle ORM, with drizzle-kit migrations applied at startup. Generated and imported files live beside it in `files/`, referenced by relative path. The profile is stored as versioned JSON documents inside SQLite.

## Consequences

- Real queries, indexes, transactions and migrations; one file to back up.
- better-sqlite3 is a native module: electron-builder must rebuild it for Electron's Node ABI. CI covers this.
- Synchronous queries on the main process are fine at this scale (thousands of rows). If that stops being true, the database moves to a utility process behind the same repository interface.
- A backup is taken before every migration and daily, keeping 14.
