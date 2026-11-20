# 0006. Own provider interface, official SDK per provider

- Status: accepted
- Date: 2026-11-20

## Context

The user wants to choose between a local model (Ollama) and cloud models with an API key, and to use different models for different steps. The first proposal was the Vercel AI SDK, which wraps many providers behind one API.

JobOwl needs only two operations (structured output and streamed text) but depends on provider-specific details to do them well: structured-output modes, effort settings, prompt caching, refusal handling, model listing, token usage. Generic wrappers tend to lag behind provider features or flatten them, and add a large dependency for a small surface.

## Decision

Define a small `LlmProvider` interface in `src/main/ai/` (`listModels`, `generateObject`, `streamText`) and implement one adapter per provider using that provider's official SDK: `@anthropic-ai/sdk`, `openai` (also used for OpenAI-compatible endpoints), and `ollama`. Layers depend only on the interface. Zod schemas define outputs; each adapter converts them to the provider's schema format and validates the result.

## Consequences

- Each adapter can use its provider's features directly (Anthropic prompt caching and effort control, Ollama keep-alive and JSON-schema format).
- A few hundred lines of adapter code to own and test, instead of a dependency.
- New providers need an adapter; the OpenAI-compatible adapter covers many local servers and routers without new code.
- Supersedes the Vercel AI SDK suggestion from the planning discussion.
