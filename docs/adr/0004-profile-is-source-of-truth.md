# 0004. The profile is the source of truth; AI selects and rephrases, never invents

- Status: accepted
- Date: 2026-11-20

## Context

The user wants each resume adjusted to each job, with their own resume and skills as the source of truth. Language models asked to "tailor a resume" routinely add skills, inflate scope and invent metrics to match the job description. One fabricated line can cost the user a job or their credibility, and they may not notice it in a confident rewrite.

Letting the AI edit the uploaded document directly makes this impossible to check: there's no record of what the original claimed.

## Decision

- The uploaded resume is converted once into a structured **profile** that the user reviews and saves. Profile versions are immutable.
- Tailored resumes are built from profile items. Every output line cites the profile item IDs it came from. Headers (employers, titles, dates, schools) are rendered from the profile by templates, never written by the AI.
- The AI may select, order, trim, reword and combine. It may not add facts.
- A Checker verifies every line, deterministically (IDs, numbers against extracted metrics, skills, names, dates) and with a second AI pass. Failing lines revert to the user's own wording and are flagged.
- Requirements the profile can't support are reported as gaps, not filled.

## Consequences

- Tailoring is more constrained and sometimes less "impressive" than unconstrained rewriting. That's the point.
- The profile editor becomes a core feature: if something true is missing, the fix is adding it to the profile.
- Prompt and model changes are gated by the tailoring eval (zero fabrications).
- The same rule covers emails and form answers.
