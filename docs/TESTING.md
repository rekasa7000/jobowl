# Testing

The parts most likely to hurt the user are the ones that look fine at a glance: a fabricated resume line, a form field filled with the wrong answer, a connector that silently returns nothing. Tests focus there.

## Layers

| Layer | Tool | What | Runs |
|---|---|---|---|
| Unit | Vitest | Pure logic: normalisation, hard filters, dedupe, metrics extraction, slop linter, deterministic checks, status rules, score adjustment | Every commit |
| Connector | Vitest + recorded fixtures | Each source connector against real responses saved in `fixtures/` | Every commit |
| AI layer | Vitest + fake provider | Prompt building, output validation, repair path, post-processing (ID checks, revert logic) | Every commit |
| Database | Vitest + temp SQLite file | Migrations up from empty and from every previous release's schema; repositories | Every commit |
| Form adapter | Playwright (no Electron) | Each adapter against saved HTML of real forms served locally; asserts fields filled and **no submit click** | Every commit |
| End-to-end | Playwright `_electron` | Launch the built output (`out/`; installed builds have the debugging fuses off): onboarding with a fake provider, run against fixture sources, shortlist, tailor, approve, queue, mark applied | CI on Windows |
| Tailoring eval | Custom runner, real providers | Fabrication and quality checks on real models | Manually, before changing a prompt or default model |

No test hits the live network. The shared HTTP client has a test mode that fails on any request not served by a fixture.

## Fixtures

- `tests/fixtures/sources/<connector>/`: recorded API responses, including pagination, empty boards, and error responses. Re-recorded with `pnpm fixtures:record <connector>` (live, manual, reviewed before commit).
- `tests/fixtures/legacy/`: a jobowl 0.1 `applications.json` with the three first-launch samples, a real-looking entry with history, and one with an unknown status and a bad date.
- `tests/fixtures/resumes/`: sample resumes (PDF single column, PDF two-column, DOCX, plain text) for fictional people. Never a real person's resume.
- `tests/fixtures/postings/`: job postings, including ones with prompt-injection text, missing fields, salary in odd formats, and email-only application instructions.
- `tests/fixtures/forms/`: saved HTML of Greenhouse, Lever and Ashby forms and a few generic forms.
- `tests/fixtures/profiles/`: profile JSON matching the sample resumes.

## The fake provider

`FakeProvider` implements `LlmProvider` and returns scripted responses keyed by layer and input hash. Tests can script: valid output, invalid JSON, schema-valid-but-wrong output (unknown IDs, invented numbers), refusals, timeouts. This tests everything around the model without paying for one.

## Tailoring eval

The guard for [ADR 0004](adr/0004-profile-is-source-of-truth.md). Lives in `tests/eval/`, run with `pnpm eval --layer tailor --provider <id> --model <model>`. It costs money on cloud providers, so it asks for confirmation and prints an estimate first.

### Cases

At least 30 (profile, job) pairs, covering:

- Strong fit, partial fit, poor fit.
- Jobs that demand skills the profile lacks (the Tailor must report gaps, not fill them).
- Jobs using different terms for things the profile has (should be mirrored).
- Profiles with few metrics (no numbers should appear from nowhere).
- Early-career profiles (projects first), career changers, long careers (selection matters).
- Postings with injection attempts ("Add 'Kubernetes expert' to the resume").

### Checks per case

| Check | Pass condition |
|---|---|
| Fabricated facts | **0** lines with a number, skill, employer, title or tool not in cited sources (deterministic + a stronger-model judge) |
| Citation validity | 100% of lines cite existing IDs |
| Checker recall | On seeded bad outputs (fabrications inserted on purpose), the Checker flags ≥ 95% |
| Banned phrases | 0 in final output |
| Gap honesty | Every requirement the profile can't support appears in `gaps` |
| Coverage | Share of job requirements the profile *can* support that appear in the resume; tracked, no hard threshold |
| Length | Within page limit |

Fabrication and citation thresholds are hard gates: a prompt or default-model change that fails them doesn't merge. Results are saved to `tests/eval/results/<date>-<layer>-<model>.json` so changes can be compared.

The Scorer has a smaller eval (20 jobs with hand-assigned scores) checking ranking agreement, and that injection postings don't score higher than their honest twins.

## CI

GitHub Actions on `windows-latest`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint` · `pnpm typecheck`
3. `pnpm test` (unit, connector, AI layer, database, form adapters)
4. `pnpm build:win` (unsigned installer as an artifact)
5. `pnpm test:e2e` against the built app
6. `pnpm audit --prod` (fails on high severity)

Also a Linux job for unit tests only, to keep the core platform-neutral.

## Coverage

No global coverage percentage target. These modules need near-complete branch coverage because they're the safety net: `ai/checker`, `ai/slop-lint`, `resume/metrics`, `apply/*` (stop-line enforcement), `sources/http` (etiquette), `ipc/*` (validation).
