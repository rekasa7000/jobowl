# Anti-slop rules

"Slop" is output that looks produced rather than made: generic UI, filler copy, résumé clichés, AI-sounding prose, and code that's long without doing more. JobOwl is especially exposed. It's an AI app, often built with AI help, and it writes things that a hiring manager reads in 30 seconds and judges a person by.

These rules are binding. Reviews (human or AI) check against them. Part B is also enforced in code by the slop linter.

---

## A. Interface

### A1. Visual

Never:

- Purple-to-blue (or any) gradients on buttons, headers or backgrounds.
- Glassmorphism: frosted blur panels, translucent cards over blurred backgrounds.
- Soft, blurry drop shadows. JobOwl's shadows are hard offsets ([DESIGN.md](DESIGN.md#space-shape-depth)).
- "Card soup": every piece of content in its own rounded-2xl card with the same shadow. Use lists, rules and whitespace; panels group, they don't decorate.
- Sparkle icons (✨) or "magic wand" icons to mean AI. AI features are labelled by what they do: **Tailor**, **Score**, **Draft email**.
- Emoji as icons or in UI copy.
- Centred hero layouts with a big gradient headline inside the app. This is a tool, not a landing page.
- Gray text on gray backgrounds; light-gray placeholder text used as a label.
- Generic illustrations (3D blobs, people with laptops, abstract waves) for empty states. Empty states use type and one clear action.
- Animated gradients, shimmer skeletons, confetti, bouncing elements, parallax.
- Icons without labels for anything but universally understood toolbar actions, and those have tooltips.
- Tailwind default palette colours (`blue-500`, `slate-*`, `indigo-*`). Only the tokens.
- Default component-library looks left unstyled (stock shadcn/Material/Bootstrap). Primitives yes, their default skin no.
- Dark mode that's just inverted light mode. Dark is designed first.

### A2. Layout and behaviour

Never:

- A spinner with no text. Say what's happening.
- Fake progress bars that don't measure anything.
- Placeholder or lorem ipsum content in a shipped screen, including sample "Google / Microsoft / Apple" jobs like v0.1 seeded.
- Modals for things that can be inline. Modals are for confirmation and focused tasks only.
- Confirmation dialogs for reversible actions (dismissing a job is undoable; offer **Undo** in a toast instead).
- Disabled buttons with no explanation. If an action is unavailable, say why nearby.
- Silent failure. Every error is visible, specific and actionable.
- Infinite scroll in lists the user needs to act on. Show counts; paginate or virtualise with a visible total.

### A3. Copy

Never:

- "Oops!", "Uh-oh", "Whoops", "Something went wrong" without what and why.
- Exclamation marks in UI copy.
- "AI-powered", "smart", "intelligent", "magic", "seamless", "effortless", "supercharge", "unlock", "elevate", "revolutionise", "game-changer".
- "Let's…", "Let me…", "I've gone ahead and…": the app is not a chatbot.
- Cheerleading: "Great job!", "You're all set!", "Awesome!".
- Title Case On Every Button. Sentence case.
- Vague buttons: "OK", "Continue", "Submit", "Go". Name the action and its object.
- Hedging filler: "Please note that", "It's important to", "Simply".

Always:

- Say what happened, then what to do. "Couldn't read this PDF. It looks like a scanned image. Upload a DOCX or paste the text instead."
- Use the user's terms (job, resume, application), not internal ones (match entity, artifact, pipeline).
- Exact numbers: "3 of 12 sources failed", not "Some sources failed".

---

## B. Generated writing

Applies to everything the AI writes that the user or an employer will read: resume lines, summaries, emails, form answers, score summaries. Rules B1–B3 go into the Tailor and Writer prompts. B4–B6 are also checked by the slop linter (`src/main/ai/slop-lint.ts`), which flags matches for the Checker; the word list lives in `resources/slop-list.json` and is editable in Settings.

### B1. Truth first

- Every claim comes from the profile. No invented numbers, tools, scope, team sizes, outcomes. (Enforced by the Checker; see [AI_PIPELINE.md](AI_PIPELINE.md#checker).)
- Don't upgrade verbs: "helped build" stays "helped build", not "led".
- No unprovable self-description: "passionate", "detail-oriented", "team player", "fast learner", "hard-working". Show it with a fact or leave it out.

### B2. Resume lines

- Pattern: **what you did + what it was + what came of it**, using only what the profile says. If the profile has no result, end at what you did; don't make one up.
- Start with a concrete verb (built, migrated, cut, wrote, shipped, designed, fixed, ran), not "Responsible for" or "Worked on".
- One idea per line. At most 2 lines at template width.
- Prefer specific nouns over categories: "Postgres" over "databases", "12 field technicians" over "stakeholders", when the profile says so.
- Mirror the job's terminology only where the profile describes the same thing.

### B3. Emails and answers

- Short: emails ≤ 150 words, answers ≤ the form limit (default 120 words).
- First sentence says why you're writing: "I'm applying for the Frontend Engineer role (posted on your careers page)."
- One or two specific connections between the job and the profile. Then stop.
- Sign off with name and contact details. No "I look forward to hearing from you at your earliest convenience".
- Match the user's writing samples: sentence length, formality, contractions.

### B4. Banned phrases

The slop linter blocks these (case-insensitive, with simple inflections). This is the starting list; it grows when reviewers find new tics.

**Résumé clichés:** results-driven, results-oriented, detail-oriented, self-starter, go-getter, team player, hard-working, hardworking, passionate about, proven track record, track record of success, dynamic, synergy, synergies, think outside the box, go above and beyond, wear many hats, hit the ground running, responsible for, duties included, worked on various, spearheaded, orchestrated, championed, cutting-edge, state-of-the-art, best-in-class, world-class, rockstar, ninja, guru, thought leader.

**AI tics:** delve, delves, delving, tapestry, testament to, a testament, in today's fast-paced, fast-paced environment, ever-evolving, ever-changing landscape, landscape of, realm of, navigate the complexities, leverage (as a verb, unless the profile uses it), utilize, utilise, harness the power, unlock, elevate, empower, foster, seamless, seamlessly, robust (unless describing a system property the profile names), holistic, pivotal, paramount, meticulous, meticulously, embark, journey (for a career), multifaceted, nuanced understanding, deep understanding, a wide range of, a myriad of, plethora, moreover, furthermore, additionally (as a sentence opener), in conclusion, it's worth noting, it is important to note.

**Email openers and closers:** I am writing to express my interest, I am excited to apply, I was thrilled to see, I am confident that, I believe I would be a great fit, perfect fit, ideal candidate, I look forward to the opportunity, thank you for your time and consideration, at your earliest convenience.

### B5. Patterns

Flagged even without banned words:

- **Rule of three:** lists of exactly three adjectives or abstract nouns ("innovative, scalable, and efficient").
- **"Not only X, but also Y"** and **"It's not just X, it's Y"** constructions.
- **Em-dash habit:** more than one em dash per paragraph, or em dashes in resume lines. Use commas, colons or full stops.
- **Colon-heavy fragments:** "The result: faster builds."
- **Rhetorical questions** in emails.
- **Uniform rhythm:** three or more consecutive sentences of near-identical length and structure.
- **Hollow intensifiers:** very, truly, incredibly, highly, extremely, significantly (without a number).
- **Self-referential AI text:** "As an AI", "I hope this helps", "Here is your tailored resume".

### B6. Formatting

- No bold, emoji or decorative symbols inside resume lines or emails.
- Bullets don't end with full stops, or all do. Consistent within a document.
- Dates, numbers and units in one consistent format (`Jan 2023 – Present`, `40%`, `PHP 120,000`).

### When the linter fires

The line is flagged, not silently rewritten. The Tailor gets one retry with the specific rule named; if it still fails, the line reverts to the profile's wording, which the user wrote and approved, and which is therefore exempt from B4/B5 (it's their voice).

---

## C. Code

For humans and AI agents contributing code.

- **No narrating comments.** `// increment counter` above `count++` is noise. Comments explain why, constraints, or links to the doc that decided it.
- **No speculative abstraction.** No interface with one implementation unless it's a seam the docs name (`LlmProvider`, `SourceConnector`, form adapters). No factories for one product. No config options nobody asked for.
- **No pass-through layers.** A function that only calls another function with the same arguments gets deleted.
- **No defensive noise.** Don't `try/catch` just to log and rethrow; don't null-check values the types guarantee; don't wrap SDK retries in more retries.
- **No dead code** or commented-out code. Git remembers.
- **No god files** (`utils.ts`, `helpers.ts`, `constants.ts` dumping grounds). Put things where they belong.
- **No placeholder implementations** (`// TODO: implement`) merged into main. Unfinished work stays on a branch or behind a clearly named disabled feature flag with an issue link.
- **No generated boilerplate left in.** Remove scaffold READMEs, example components, unused config.
- **Tests that test behaviour,** not that a mock was called with what you just told it.
- **Names from the domain** ([glossary](README.md#glossary)): `Match`, `TailoredResume`, `Source`, not `DataItem`, `ResultObject`, `Manager`.
- **Errors carry context:** what failed, with which input (minus personal data), and what the caller can do.
- **Diffs stay small and on-topic.** No drive-by reformatting or renaming in a feature PR.
