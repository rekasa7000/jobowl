# Contributing to jobowl

jobowl is a personal tool that's open source so anyone can run their own copy. Contributions are welcome if they fit the [product principles](docs/PRODUCT.md#principles).

## Before you start

- Open an issue first for anything bigger than a bug fix, so we can agree on the approach.
- Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ANTI_SLOP.md`](docs/ANTI_SLOP.md).
- New job source? Read [`docs/JOB_SOURCES.md`](docs/JOB_SOURCES.md#adding-a-source) first. Sources that need scraping a site against its terms won't be merged.

## Setup

Requirements: Windows 10/11 (macOS and Linux work for development, but Windows is the target), Node.js LTS, pnpm, Microsoft Edge.

```powershell
pnpm install
pnpm dev          # run the app with hot reload
pnpm test         # unit + integration tests
pnpm lint         # ESLint + Prettier check
pnpm typecheck
pnpm build:win    # build the Windows installer into dist/
```

Optional: install [Ollama](https://ollama.com) and pull a model to try local AI.

## Pull requests

- One topic per PR. Small is better.
- Conventional Commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Tests for new behaviour. Connectors need recorded fixtures, not live network calls.
- Update the docs in the same PR when behaviour changes.
- Screenshots for UI changes, in both dark and light themes.
- CI must pass on `windows-latest`.

## Code style

- TypeScript strict. Prettier formats, ESLint lints. Don't argue with the formatter.
- Names say what things are. No `utils.ts` dumping grounds, no `Manager`/`Helper` suffixes without a reason.
- Comments explain *why*, never *what*.
- See the code section of [`docs/ANTI_SLOP.md`](docs/ANTI_SLOP.md#c-code).

## License

By contributing you agree your work is released under the [MIT License](LICENSE).
