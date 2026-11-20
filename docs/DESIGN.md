# Design

jobowl wears the **rekasa7000** brand: the same palette, type and print-shop character as [rekasa7000.vercel.app](https://rekasa7000.vercel.app), adapted from a portfolio to a tool you use every day. Where the portfolio performs (orbits, marquees, 3D), jobowl works: denser, calmer, faster.

Read [ANTI_SLOP.md](ANTI_SLOP.md) alongside this. It lists what the design must never become.

## Brand in one paragraph

Deep teal, cream and orange, straight off the colour wheel (orange sits opposite teal). Heavy condensed capitals for headlines, a small italic serif for asides, wide-tracked caps for labels. Solid 1.5px ink borders with **hard offset shadows**, like a printed ticket or a letterpress card, not soft floating glass. Dark is the signature look: teal ground, cream type, orange for the one thing that matters. Light inverts it: cream paper, teal ink.

## Principles for the app

1. **Orange means "this one".** One orange element per view region: the primary action, the top score, the active item. If two things are orange, one of them is wrong.
2. **Ink, not haze.** Borders and hard shadows define surfaces. No blur shadows, no glass, no gradients on surfaces.
3. **Display type is for landmarks.** Anton appears in screen titles, big numbers (scores, counts) and empty-state headlines. Never in body text, buttons or tables.
4. **Dense where you scan, roomy where you decide.** The feed and tracker are compact lists. The tailoring review and the approval panel get space.
5. **Every state is designed.** Loading, empty, error, partial, offline: each has its own copy and layout. See [Screens](#screens).
6. **Motion confirms, it doesn't decorate.** Short, mechanical movement (a press, a slide) tied to a user action or a state change.

## Colour tokens

Taken from the brand, with two adjustments for an app full of small text: in light mode, tertiary text and orange-as-text are darkened to pass WCAG AA (4.5:1). Contrast ratios below are measured against `--bg-primary`.

```css
/* src/renderer/styles/tokens.css */
:root {
  /* brand constants */
  --brand-teal: #013230;
  --brand-cream: #f3ebdd;
  --brand-orange: #ff6a1f;

  /* light: cream paper, teal ink */
  --bg-primary: #f3ebdd;
  --bg-secondary: #fbf6ec;        /* raised surfaces: cards, panels, inputs */
  --bg-sunken: #ebe1cf;           /* wells: code, diffs, sidebar */
  --bg-hover: rgba(1, 50, 48, 0.05);
  --text-primary: #013230;        /* 11.8:1 */
  --text-secondary: #2f5552;      /*  7.0:1 */
  --text-tertiary: #4f6a65;       /*  4.95:1 (brand #6f8a85 is 3.1:1, too low for small text) */
  --border-color: #dccfb9;
  --border-strong: #013230;
  --accent: #ff6a1f;              /* fills only in light mode; text on it is teal */
  --accent-text: #b0400c;         /*  4.95:1, for orange words on cream */
  --accent-soft: rgba(255, 106, 31, 0.12);
  --accent-2: #0d5c57;            /*  6.6:1 */
  --accent-3: #f0a431;            /* amber, fills only */
  --signal: #1a6b4a;              /*  5.5:1, success / offer */
  --danger: #b3261e;              /*  5.5:1 */
  --on-accent: #013230;           /* teal on orange: 4.9:1 */
  --shadow-hard: #013230;
  --stripe: rgba(1, 50, 48, 0.035);
}

.dark {
  /* teal ground, cream type: the signature look and the default */
  --bg-primary: #013230;
  --bg-secondary: #06403d;
  --bg-sunken: #012826;
  --bg-hover: rgba(243, 235, 221, 0.06);
  --text-primary: #f3ebdd;        /* 11.8:1 */
  --text-secondary: #b9c7bb;      /*  8.0:1 */
  --text-tertiary: #8fa9a3;       /*  5.6:1 on primary, 4.6:1 on secondary */
  --border-color: #0f4d49;
  --border-strong: #3d7a74;
  --accent: #ff6a1f;              /*  4.9:1 as text on primary */
  --accent-text: #ff6a1f;
  --accent-soft: rgba(255, 106, 31, 0.16);
  --accent-2: #f3ebdd;
  --accent-3: #ffb347;            /*  7.9:1 */
  --signal: #9be0b5;              /*  9.2:1 */
  --danger: #ff8a7a;              /*  6.1:1 */
  --on-accent: #013230;
  --shadow-hard: rgba(255, 106, 31, 0.35);
  --stripe: rgba(243, 235, 221, 0.028);
}
```

Rules:

- Components use semantic tokens (`--text-secondary`), never brand constants or hex values.
- Orange text on cream uses `--accent-text`, never `--accent`.
- Text on orange fills is always `--on-accent` (teal). The portfolio's white-on-orange button is 3.5:1 and fails AA at button size, so jobowl doesn't use it.
- Theme setting: Dark (default), Light, or System.

### Status colours

Application statuses and match verdicts use the palette, not a generic traffic-light set.

| Status | Treatment |
|---|---|
| Interview | Orange fill, teal text: the "this one" colour, because it needs action |
| Offer | `--signal` outline and text, solid dot |
| Applied | `--accent-2` outline and text |
| Draft | `--accent-3` dashed outline, text in `--text-primary` |
| Rejected | `--text-tertiary`, no fill, struck dot |
| Withdrawn | `--text-tertiary`, dashed outline |

| Match verdict | Treatment |
|---|---|
| strong (≥ 75) | Score in Anton, `--accent-text` |
| possible (50–74) | Score in Anton, `--text-primary` |
| weak (25–49) | Score in Anton, `--text-tertiary` |
| no (< 25) | Hidden from the feed by default |

Colour is never the only signal: every status also has a label, and verdicts have the number.

## Typography

The UI's fonts are bundled into the renderer from the `@fontsource` packages (SIL Open Font License). No runtime font downloads.

| Role | Family | Use |
|---|---|---|
| Display | **Anton**, uppercase, tracking 0.005em, line-height 0.95 | Screen titles, big numbers, empty-state headlines |
| Sans | **Space Grotesk** | Everything else: body, UI, tables, buttons |
| Accent | **Fraunces** italic, 400 | Short asides beside display type ("— 12 new since this morning"), at most one per screen |
| Mono | **Space Mono** | Readouts: timestamps, token counts, costs, IDs, the run log |

Type scale (rem, 16px base):

| Token | Size / line-height | Use |
|---|---|---|
| `display-xl` | 3.5 / 0.95 | Screen title |
| `display-lg` | 2.5 / 0.95 | Score on the job detail |
| `display-md` | 1.75 / 1 | Score in feed rows, counts |
| `title` | 1.125 / 1.4, 600 | Card and panel titles |
| `body` | 0.9375 / 1.55 | Default |
| `small` | 0.8125 / 1.5 | Secondary info, table cells |
| `label` | 0.6875 / 1, 600, uppercase, tracking 0.22em | `meta-label`: section indices, field labels, dates |
| `mono` | 0.8125 / 1.5 | Readouts |

UI text is sentence case. Only `display` and `label` styles are uppercase, and they're uppercased by CSS, never typed in caps.

## Space, shape, depth

- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64 px. Lists use 8/12; panels use 24; screens use 32.
- **Radii:** 999px for buttons and chips (pill), 10px for panels and cards, 14px for the ticket, 4px for inputs and list-row hover. Nothing else.
- **Borders:** 1.5px `--border-strong` on primary surfaces (panels, ticket, buttons); 1px `--border-color` on secondary (chips, inputs, dividers); dashed for "pending" or "draft" things.
- **Shadows:** hard offset only. `4px 4px 0` for buttons, `6px 6px 0` for panels, `8px 8px 0` for the ticket and modals. Colour `--shadow-hard`. No blur radius, ever.
- **Background texture:** the brand's 16px vertical stripe (`--stripe`) on the app background only. No noise or CRT overlay: they cost legibility in a tool.

## Components

Names match the portfolio's classes where the component is the same thing.

### Buttons

| Component | Look | Use |
|---|---|---|
| `btn-ink` (primary) | Pill, orange fill, teal text, 1.5px ink border, 4px hard shadow; hover lifts (−2px, shadow 6px); press sinks (+2px, shadow 1px) | One per region: **Approve**, **Open and fill**, **Run now** |
| `btn-ghost` (secondary) | Pill, `--bg-secondary`, ink border; hover lifts with an `--accent-2` shadow | Everything else that matters |
| `btn-quiet` | Text only, underline on hover (`link-underline`) | Tertiary actions in dense rows |
| `btn-danger` | Ghost with `--danger` border and text; confirmation required | Delete, discard |
| `icon-btn` | 36px circle, 1px border; hover: orange icon, 2px hard shadow | Toolbar actions; always has a tooltip and `aria-label` |

Buttons say what they do: **Shortlist**, **Draft email**, **Approve resume**. Never **OK**, **Submit** (jobowl doesn't submit) or **Continue** without an object.

### Chips

`chip` (pill, 1px border): filters and tags. Active chip: orange fill, teal text. `skill-chip`: skill names on profile and resume screens; matched skills get an `--accent-3` hard shadow.

### Panels and cards

- `panel`: `--bg-secondary`, 1.5px border, 10px radius, 6px hard shadow. Holds a screen's main content blocks.
- `readout`: the brand's telemetry panel. Used for the run status (sources, counts, cost so far, elapsed) with mono values and dashed row dividers.
- `ticket`: the brand's ticket with a dashed stub and punched notches. **Used for the application card in the approval queue**: the top holds the job, the stub holds the action. The only other place it appears is the read-only **What I sent** receipt in the tracker.

### Lists

- `row-hover`: the brand's list row with a 3px orange bar that scales in on hover and stays on the selected row. Used in the feed, tracker and sources.
- Row height: 56px comfortable, 44px compact (setting).
- Keyboard: `↑`/`↓` move, `Enter` opens, `S` shortlist, `D` dismiss, `/` focuses search.

### Section heading

`section-rule`: `session-tag` (orange pill with an index like `01`), title in `title` style, a dotted orange rule filling the line, and a mono readout at the end (`12 NEW · 3 SHORTLISTED`).

### Forms

- Inputs: `--bg-secondary`, 1px `--border-color`, 4px radius, 40px tall; focus ring 2px `--accent` with 3px offset (same as the portfolio's `:focus-visible`).
- Labels above inputs in `label` style. Help text below in `small` `--text-tertiary`. Errors below in `--danger` with an icon, saying how to fix it.
- Tag inputs (titles, keywords) use chips with a remove button.

### Diff and source chips (tailoring review)

- Reworded text: removed words struck through in `--text-tertiary`, added words underlined 2px `--accent`.
- Source chip after each line: mono, `--bg-sunken`, 4px radius, e.g. `KLOUDTRACK · B3`. Hover shows the original bullet in a popover.
- Flagged lines: 3px `--danger` left bar, reason in `small` below.

### Feedback

- **Toasts** (in-app): bottom-right, `panel` style, auto-dismiss 5s, pause on hover; errors don't auto-dismiss.
- **Windows notifications**: only for new strong matches after a background run and for a run that failed. Never for routine events.
- **Progress**: determinate when possible (`Fetching 7 of 12 sources`). Indeterminate spinners always have a text label of what's happening.
- **Skeletons**: plain `--bg-sunken` blocks in the shape of the content. No shimmer.

## Layout

Desktop window, minimum 1100 × 700, designed at 1440 × 900.

```
┌──────────┬───────────────────────────────────────────────────────────────┐
│ [owl]    │  FEED  — 12 new since this morning          [Run now]  ◐  ⚙   │  ← top bar: title, aside, primary action, theme, settings
│ jobowl   ├───────────────────────────────────────────────────────────────┤
│          │                                                               │
│ 01 Feed  │   list (≈ 45%)                │  detail (≈ 55%)               │
│ 02 Queue │                               │                               │
│ 03 Apps  │                               │                               │
│ 04 Prof. │                               │                               │
│ 05 Search│                               │                               │
│ 06 Source│                               │                               │
│          │                               │                               │
│ ● run    │                               │                               │
│ 2h ago   │                               │                               │
└──────────┴───────────────────────────────┴───────────────────────────────┘
```

- **Left rail** (220px, collapsible to 64px): owl mark, wordmark, numbered nav (`01 Feed` in `label` style with a mono index), and at the bottom a mini readout of the last run with a blinking `--signal` dot while running.
- **Top bar**: screen title in `display-xl`, one Fraunces aside, the screen's primary action.
- **List/detail split** for Feed, Queue and Applications. The split is resizable; the selection is kept per screen.

## Screens

Each screen lists its content and its empty, loading and error states.

### Onboarding (first run)

Four steps, one per screen, progress shown as `01 / 04` in mono.

1. **Welcome**: "Your job search, on your own PC." Three plain sentences on what jobowl does and that data stays local. **Get started**.
2. **AI**: Detects Ollama (shows installed models) and offers cloud providers with key fields. **Skip for now** is a real option.
3. **Resume**: Drop zone → parsing progress with the step named → review (see Profile). 
4. **First search and sources**: titles, location, remote mode; pick sources. **Start first run**.

### Feed

- List row: score (`display-md`), title, company · location · remote mode, posted age in mono, source chip. New-since-last-run rows have a small orange dot.
- Detail: score (`display-lg`) with verdict, the one-sentence summary, matched requirements (each with the profile evidence), gaps, dealbreakers, then the posting itself as Markdown. Actions: **Shortlist** (primary), **Dismiss**, **Open posting**.
- Empty (no jobs yet): "No jobs yet." / "Add a source or run a search to fill this list." with **Add a source**.
- Empty (filtered out): "Nothing matches these filters." with **Clear filters**.
- During a run: rows appear as they're scored; the readout shows progress.
- Error: sources that failed are listed in the readout with the reason and **Retry**.

### Tailor (job → resume)

Opened from a shortlisted job. Two columns as described in [RESUME_ENGINE.md](RESUME_ENGINE.md#review-screen). Primary action **Approve resume**. While generating: the right column shows the template skeleton and a line naming the step (`Selecting bullets`, `Checking 14 lines`).

### Queue

Tickets, one per draft application, newest first. Ticket top: company, role, score, how to apply. Stub: the next action as the primary button (**Open and fill**, **Draft email**, or **Open posting**), plus the files. Empty: "Nothing waiting." / "Approve a tailored resume and it lands here."

### Applications (tracker)

The v0.1 tracker, rebuilt: search, status filter chips, list sorted by status priority, detail with status selector, notes, files, and the activity timeline (mono timestamps, one line per event). **Add application** for manual entries.

- **Stats readout** above the list (the brand `readout` panel): `SENT 7D`, `SENT 30D`, `RESPONSE RATE`, `INTERVIEW RATE`, `MEDIAN DAYS TO REPLY`, values in mono with big numbers in `display-md`. Clicking a stat filters the list.
- **Tabs:** All · Sent with jobowl · Manual. "Sent with jobowl" rows show the channel icon (form / email), sent date, and a **No reply yet** chip (amber dashed) when it applies.
- **What I sent** panel in the detail, for applications with a sent record: a read-only receipt in the `ticket` style, the one other place the ticket appears, because it's the stub of something that went out. It shows destination, date and channel; the resume file (open / show in folder); every field and value (or the email); before/after screenshots; the posting snapshot. A small lock icon and the label `SENT RECORD · READ-ONLY`.
- Empty (sent tab): "Nothing sent yet." / "Applications you send from the queue are recorded here automatically."

### Profile

Sections as panels: Person, Summary, Experience, Projects, Education, Certifications, Skills, Standard answers, Writing samples. Each item is editable in place. Version badge (`v4 · saved 2 days ago`) and **History** to compare versions. **Import resume** at the top.

### Searches and Sources

Lists with an enable toggle per item. Source rows show the last status (`ok`, `blocked`, `error`) with the reason. **Add source** accepts a careers URL and detects the type.

### Settings

Left sub-navigation: AI providers, Models per layer, Spending, Runs and startup, Templates, Data and privacy (export, delete, network activity, data-disclosure table), About.

## Motion

| What | Duration | Easing |
|---|---|---|
| Button press/lift | 150ms | ease |
| Row hover bar, underline | 250–300ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Panel/detail change | 200ms fade + 8px slide | same |
| Modal | 200ms fade, ticket drops 12px | same |
| New row arriving during a run | 300ms fade-in, no movement of other rows | same |

`prefers-reduced-motion: reduce` disables all transitions and the blinking run dot (same rule as the portfolio). Nothing loops while idle.

## Accessibility

- WCAG 2.1 AA: text contrast ≥ 4.5:1 (the tokens above are measured), UI component contrast ≥ 3:1.
- Full keyboard operation; visible focus ring everywhere; logical tab order; skip link to main content.
- Radix primitives for dialogs, menus, popovers, tooltips (focus trap, Escape, ARIA).
- Live regions announce run progress and results politely; errors assertively.
- Text scales with the Windows text-size setting; layouts tested at 150% and 200%.
- Hit targets ≥ 32px (36px for icon buttons).

## App icon and wordmark

- **Mark:** the owl from v0.1, redrawn in brand colours: rounded-square teal tile (22% radius, like the portfolio's `brand-logo`), owl eyes and brow in cream line work, the magnifier lens ring in orange. One eye *is* the magnifying glass: jobowl looks closely.
- In the app, the mark gets the brand's 2px orange hard shadow on light, a 1px `--border-strong` ring on dark.
- **Wordmark:** `jobowl`, always lowercase, set in Anton with no uppercase transform (the one exception to the display style's caps rule). Under it, in `label` style: `JOB SEARCH, LOCALLY`.
- Icon files: SVG source in `resources/icons/jobowl.svg`, exported to ICO (16–256px) for Windows; the 16px and 24px sizes are hand-simplified (eyes and lens only).

## Voice

The app talks like a capable friend who respects your time:

- Plain words, short sentences. "Couldn't reach Lever. Retrying in 5 minutes." not "Oops! Something went wrong."
- Say what happened and what to do next.
- No exclamation marks, no emoji, no "AI-powered", no cheerleading ("Great job!"). See [ANTI_SLOP.md](ANTI_SLOP.md#a3-copy).
- Numbers are exact and in mono: `$0.42 this month`, `3 of 12 sources`.
