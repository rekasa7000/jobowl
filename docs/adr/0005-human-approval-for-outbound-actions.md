# 0005. A person approves every outbound action

- Status: accepted
- Date: 2026-11-20

## Context

The user wants jobowl to apply automatically, with their approval. Fully automatic submission risks sending wrong answers to legal questions (work authorisation, salary), applying to bad-fit jobs, and tripping anti-bot defences. An application can't be taken back.

"Approval" can mean clicking a button in jobowl that then submits, or the user submitting themselves. The first still lets a bug or a misread form submit something the user didn't see.

## Decision

- jobowl prepares; the user sends. jobowl fills forms in a visible Edge window and stops before submitting; the user clicks the site's own submit button. jobowl writes email drafts and opens them in the user's mail client; the user clicks Send.
- Before filling, the user approves the full list of values jobowl will enter.
- Form adapters contain no code path that clicks submit controls, and tests enforce it.
- Legal, salary, availability and demographic answers come only from the user's saved standard answers, never from AI.

## Consequences

- Each application takes a minute of the user's attention. That's intended: the product optimises for fewer, better applications.
- No mail credentials or OAuth tokens are needed for email.
- CAPTCHAs and logins are handled by the user like any visitor, so no evasion is needed.
- If a future version offers one-click submission, it needs a new ADR.
