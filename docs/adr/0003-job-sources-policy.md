# 0003. Public APIs and structured data first; no scraping against terms

- Status: accepted
- Date: 2026-11-20

## Context

The original idea was "an AI scraping the internet for jobs". The biggest job sites (LinkedIn, Indeed, Glassdoor) prohibit automated access in their terms, block it aggressively, and can ban the user's account. Open-source scrapers for them break constantly and expose users to that risk. Meanwhile, a large share of tech jobs are hosted on applicant tracking systems (Greenhouse, Lever, Ashby and others) that publish public, read-only JSON APIs, and many career pages embed schema.org `JobPosting` data.

## Decision

Sources, in order of preference:

1. Official public APIs (ATS job boards, aggregators with APIs).
2. Structured data on pages (schema.org JSON-LD), and embedded ATS boards.
3. AI extraction from career pages that allow crawling per robots.txt.
4. Optional web search for ATS-hosted postings, then fetching them through the ATS API.

JobOwl never fetches from sites whose terms prohibit it, never solves CAPTCHAs, never rotates proxies or spoofs browsers, and treats a block as a "no". Users can paste postings from those sites manually.

## Consequences

- Fewer total jobs than a scraper that ignores the rules; better data, no breakage chasing anti-bot changes, no risk to the user's accounts.
- ATS-hosted jobs lead to forms JobOwl can fill, which suits the apply flow.
- The user curates companies to watch; web search discovery helps them find more.
- Every connector documents its endpoint and the terms it relies on.
