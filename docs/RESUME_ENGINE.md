# Resume engine

Covers: importing a resume, building the profile, tailoring for a job, verifying the result, and rendering PDF/DOCX.

The governing rule is [ADR 0004](adr/0004-profile-is-source-of-truth.md): **the profile is the only source of facts.** The uploaded file is kept for reference but never edited, and the AI never writes a fact that isn't in the profile.

## Import

```
resume.pdf / resume.docx / pasted text
   │  copy original to files/imports/ (sha256 recorded, never modified)
   ▼
text extraction (utilityProcess)
   PDF  → unpdf (text with line breaks; reading order heuristics for two-column layouts)
   DOCX → mammoth → HTML → structured text (keeps headings and bullets)
   │
   ▼
Parser layer → Profile draft with per-item confidence
   │
   ▼
Review screen: every item editable, low-confidence items highlighted,
"Original" pane shows the extracted text side by side
   │
   ▼
Save → metrics extracted from bullets → profile_versions v(n+1)
```

- Scanned PDFs with no text layer: JobOwl says so and asks for a DOCX or pasted text. OCR is out of scope for v1.
- Re-importing a newer resume runs the Parser again and shows a diff against the current profile (added/changed/removed items) so the user merges instead of starting over. Unchanged items keep their IDs.
- The user can skip import and type the profile in.

## Tailoring

Input: one job, the current profile, the target template's constraints (sections, page limit), optional writing samples. The Tailor is a selector and editor, not an author.

What it may do:

- **Select** which experiences, projects and bullets to include, and how many bullets per role.
- **Order** bullets within a role by relevance, and order sections (Experience before Projects, or the reverse for early-career profiles).
- **Rephrase** a bullet: shorten it, lead with the part relevant to this job, use the job's term for something the bullet already describes ("CI pipelines" → "CI/CD" when the bullet describes CI/CD). One output line can combine two bullets from the same role.
- **Choose** which skills to list and in what order, from the profile's skills only.
- **Write a summary** (≤ 3 lines) from the profile summary and selected items, or omit it. If the user wrote a summary, the Tailor may only shorten or reorder it.

What it may not do:

- Add an employer, title, date, school, degree, certification, number, tool, technology or responsibility that isn't in the cited items.
- Turn "contributed to" into "led", "helped" into "owned", or otherwise raise the seniority of a claim.
- Change dates, merge roles, hide employment gaps by stretching dates.
- Insert keywords that aren't backed by a cited item, visibly or invisibly.
- Use phrases from the banned list ([ANTI_SLOP.md](ANTI_SLOP.md#b4-banned-phrases)).

When the job wants something the profile doesn't have, the Tailor leaves it out and reports it as a gap. The UI shows gaps so the user can decide whether their profile is missing something true (and add it to the profile) or whether this job isn't a fit.

### The tailored resume

```ts
type TailoredResume = {
  jobId: string;
  profileVersion: number;
  summary?: Line;
  sections: Section[];          // in display order
  skills: { skillIds: string[]; grouping?: { label: string; skillIds: string[] }[] };
  gaps: string[];               // job requirements not covered by the profile
  notes: string;                // Tailor's one-paragraph rationale, shown to the user only
};

type Section =
  | { kind: 'experience'; items: { experienceId: string; lines: Line[] }[] }
  | { kind: 'projects'; items: { projectId: string; lines: Line[] }[] }
  | { kind: 'education'; educationIds: string[] }
  | { kind: 'certifications'; certificationIds: string[] };

type Line = {
  text: string;
  sources: string[];            // bullet/summary ids; at least one
  change: 'verbatim' | 'trimmed' | 'reworded' | 'combined';
};
```

Headers (employer, title, dates, school) are never written by the AI. Templates render them from the profile using the IDs, so they can't drift.

### Checking

Every tailored resume goes through the Checker before the user sees it as ready. Details in [AI_PIPELINE.md](AI_PIPELINE.md#checker). Summary:

1. Deterministic: IDs exist, numbers ⊆ metrics of cited bullets, skills ⊆ profile skills, no banned phrases, length limits.
2. AI: each line versus only its cited source text → `supported | unsupported | overstated`.
3. Failures revert to the source bullet's original text and are flagged.

```ts
type CheckReport = {
  passed: boolean;
  lines: { path: string; verdict: 'supported' | 'unsupported' | 'overstated' | 'reverted';
           reason?: string; offendingText?: string }[];
  deterministic: { rule: string; ok: boolean; detail?: string }[];
};
```

### Review screen

- Left: the job's requirements, each marked as covered (with which line) or a gap.
- Right: the resume as it will render. Each line has a small source chip ("Kloudtrack · bullet 3"); hover shows the original text. Reworded lines show a word-level diff against the source.
- Flagged lines are marked with the Checker's reason.
- Actions: edit a line (the edited line is re-checked), swap in another bullet from the same role, remove a line, regenerate, change template, **Approve**.
- The page-count indicator updates live; overflow is shown, not silently cut.

## Templates

Two template kinds. Both render from the same `TailoredResume` + profile, so the content is identical whatever the format.

### HTML templates → PDF

- Handlebars templates (logic-less, no code execution) with a CSS file, in `templates/<id>/`. Defaults are copied to the user's data folder on first run so the user can edit them.
- Rendered in a hidden, sandboxed `BrowserWindow` with no network access, then `printToPDF` (A4 or Letter, user setting).
- Fonts are embedded from `resources/fonts` or the template folder; no web fonts.

### DOCX

- **Generated:** the `docx` library builds a clean document from the same data. Single column, real headings, real bullets.
- **User's own template:** the user can register a DOCX of their own resume with placeholders (`{summary}`, `{#experience}…{/experience}`); docxtemplater fills it. This keeps the user's exact layout.

### Built-in templates

| Template | Purpose |
|---|---|
| `plain` | Maximum ATS compatibility: one column, standard section names (Experience, Education, Skills), no tables, icons or images, system-safe font. The default. |
| `brand` | The user's look: same structure as `plain`, brand fonts and an accent rule. For emailing a human. |

### ATS rules for every template

- Real text, never text in images or SVG.
- One column; no tables, text boxes, headers/footers holding content.
- Standard section titles.
- Dates in a consistent format (`Jan 2023 – Present`).
- Contact details in the body, not the page header.
- File name `Firstname-Lastname-Resume-<Company>.pdf`.
- PDF text layer verified after render: extract the text back out and compare with the source; mismatch fails the export.

## Output files

Saved to `files/resumes/` and linked to the tailored resume and the application. Regenerating creates new files; old ones remain until the application is deleted.
