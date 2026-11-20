# Applying and email drafts

jobowl prepares applications. The user submits them. See [ADR 0005](adr/0005-human-approval-for-outbound-actions.md).

## The approval queue

An application enters the queue with status `draft` when the user approves a tailored resume. Each queue item shows:

- Job title, company, score, how to apply (`form`, `email`, `external`).
- The resume files (PDF/DOCX) and their check status.
- Any free-text answers or email body awaiting approval.
- Actions depending on the apply kind: **Open and fill**, **Draft email**, **Open posting**, **Mark as applied**, **Discard**.

## Form filling

### Browser session

- Playwright `chromium.launchPersistentContext` with `channel: 'msedge'`. Uses the Edge already on every Windows 10/11 PC; nothing bundled.
- Persistent profile in `%APPDATA%\jobowl\browser-profile\`, separate from the user's everyday Edge profile. Logins to job sites (when an ATS requires an account) persist between sessions.
- **Always headed** (visible). The user watches it fill and does the final review there.
- One application per window. jobowl shows a panel listing what it filled, what it left blank, and what needs the user.
- Default automation flags only. No stealth plugins, fingerprint spoofing or CAPTCHA services. If a site shows a CAPTCHA, the user solves it like any visitor would.

### What gets filled

| Field type | Source |
|---|---|
| Name, email, phone, location, links | Profile `person` |
| Resume upload | The approved tailored PDF (or DOCX if the form only takes DOCX) |
| Cover letter upload / text | Writer output, approved in jobowl first; skipped if optional and the user prefers not to send one |
| Work authorisation, sponsorship, notice period, salary, start date, relocation | Standard answers only |
| EEO / demographic questions | Standard answers only (default: decline to answer) |
| "Why do you want to work here?" and other free text | Writer output, approved in jobowl before filling |
| Anything else | Left blank and highlighted |

Before filling, jobowl shows the full list of planned values in its own window. The user can edit any value; nothing is typed into the browser until they press **Fill**.

### The stop line

jobowl fills and attaches, then **stops**. It never clicks a submit, apply or send button. The adapter code has no path that calls it, and a test enforces that each adapter's action log contains no click on a submit control.

After filling, jobowl takes a screenshot (saved to `files/screenshots/`, linked to the application) and watches the page:

- If the page navigates to a recognised confirmation ("Thank you for applying", ATS confirmation URLs), the application becomes `applied` with today's date and an event `submitted`.
- If the user closes the window without submitting, the application stays `draft`.
- The user can always use **Mark as applied** manually.

### ATS adapters

Supported forms have dedicated adapters with known field structures:

| Adapter | Notes |
|---|---|
| `greenhouse` | Standard fields by `id`/`name`; custom questions read from the posting's question list (the job board API returns them with `?questions=true`); file upload via input. |
| `lever` | Standard fields by `name`; custom cards; "Additional information" text area. |
| `ashby` | React form; fields located by label; file upload via input. |

Adapters use Playwright locators by role and label (`getByLabel`, `getByRole`), not brittle CSS paths, and each has recorded HTML fixtures for tests.

### Generic forms

For other sites (company forms, Workable, SmartRecruiters):

1. Collect visible form fields: label text, input type, options, required flag.
2. Deterministic matching first (label contains "email" → `person.email`, etc.).
3. The Form mapper layer handles the rest, choosing only from profile paths and standard answers, or `unknown`.
4. Low-confidence and unknown fields are left blank and listed for the user.
5. Multi-page forms: jobowl fills the current page and stops. The user clicks Next; jobowl offers to fill the next page.

Sites that need an account (Workday and similar): jobowl opens the page, and the user logs in or creates the account themselves. Filling starts once a form is visible. Workday is draft-only in v1: jobowl prepares the values and the user pastes them.

## Email drafts

Used when a posting says to apply by email, or the user chooses email.

### Contact address

From `jobs.contact_email` (extracted from the posting text in an application context). If none was found, the user types one. jobowl never guesses addresses (no `firstname@company.com` patterns).

### Writing

- The Writer drafts a short email: subject line (`Application: <Role> – <Full name>`), 3–5 sentence body, sign-off with name, phone and links from the profile.
- Same checking as resume lines: claims cite profile items, no banned phrases, ≤ 150 words.
- Shown in jobowl for editing and approval.

### Hand-off to the mail app

On approval jobowl writes an RFC 5322 `.eml` file with:

- `To`, `Subject`, plain-text body (and a simple HTML alternative)
- The resume PDF as an attachment
- `X-Unsent: 1`, which makes Outlook (classic) and several other clients open it as an unsent draft ready to send

Then opens it with `shell.openPath`. The user reviews and sends from their own mail client and account. jobowl never sends mail and never holds mail credentials.

Fallback when the default mail app doesn't respect `X-Unsent` (for example new Outlook or a webmail-only user): jobowl offers **Copy email** (body to clipboard), **Show attachment in Explorer**, and a `mailto:` link with the address, subject and body prefilled. The user attaches the file by drag and drop.

Once the user confirms they sent it, the application becomes `applied` with an `email_drafted` and `submitted` event.

## Recording what was sent

Every submission through jobowl ends in a **sent record** (see [DATA_MODEL.md](DATA_MODEL.md#sent_records)), written in one transaction with the status change to `applied`:

- **Form:** written when the confirmation page is detected, or when the user presses **I submitted it** after closing the window. The payload is the fill plan as actually filled, plus any field the user changed in the browser after filling (re-read from the page just before the confirmation navigation where possible; otherwise marked "may have been edited in the browser"). Screenshots before and after.
- **Email:** written when the user confirms **I sent it**. The payload is the subject, body and recipients of the approved draft, and the `.eml` file is kept.
- **Manual "Mark as applied"** on a jobowl-prepared application still creates a sent record with the prepared resume and values, flagged `confirmed_by: user`.

The record is read-only in the UI. If something was wrong, the user adds a note; the record itself stays as sent.

### Duplicate guard

Before **Open and fill** or **Draft email**, jobowl checks sent records for the same company (normalised name or same ATS board) in the last 90 days. If found, it shows the earlier application (role, date, status) and asks the user to confirm before continuing.

### Follow-ups

Applications with no status change after N days (default 14, setting) show **No reply yet** in the tracker. **Draft follow-up** uses the Writer (≤ 80 words, references the role and the date applied, no new claims) and the same `.eml` hand-off. Confirming it was sent adds a `follow_up` sent record. jobowl suggests at most one follow-up per application.

## External and manual applications

For jobs with no fillable form and no email (or sources jobowl doesn't fetch), the queue item gives **Open posting**, the resume files, and copy buttons for each standard answer. **Mark as applied** records it.
