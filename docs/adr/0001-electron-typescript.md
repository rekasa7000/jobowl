# 0001. Electron and TypeScript, replacing Rust and GTK4

- Status: accepted
- Date: 2026-11-20

## Context

JobOwl v0.1 is a ~950-line Rust/GTK4 job tracker targeting Linux. v1 changes scope: a Windows desktop app that fetches jobs, drives a browser to fill application forms, calls several AI providers, and reads and writes PDF and DOCX files.

The deciding factor is library maturity for those jobs:

- Browser automation: Playwright is first-class in TypeScript; Rust options are thinner.
- AI provider SDKs: official TypeScript SDKs exist for Anthropic, OpenAI and Ollama.
- Documents: mature TypeScript libraries for PDF text, DOCX reading, DOCX generation and templating.
- GTK4 on Windows is possible but packaging and look-and-feel are poor compared to web UI.

Options considered: Tauri 2 (Rust core, web UI), Tauri with a Node or Python sidecar, Electron with TypeScript, a Python desktop app.

## Decision

Electron with TypeScript for main, preload and renderer; React for the UI; electron-vite for builds; electron-builder for the Windows installer.

## Consequences

- One language across the app; Playwright, AI SDKs and document libraries are used directly.
- Electron's PDF rendering (`printToPDF`) replaces a separate headless browser.
- Larger installer (~100 MB) and memory use than Tauri. Acceptable for a single-user desktop tool.
- Electron's security model needs deliberate hardening (see [SECURITY_PRIVACY.md](../SECURITY_PRIVACY.md#electron-hardening)).
- The Rust code is removed in M0. v0.1 data is imported, not the code.
