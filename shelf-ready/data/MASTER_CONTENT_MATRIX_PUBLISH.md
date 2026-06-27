# Shelf Ready — Master Content Matrix
## Phase 6: PUBLISH

This is the final phase per the original product spec's "Book Build
Kit" concept — collecting everything built across all five prior phases
into one exportable deliverable, plus a launch-readiness checklist.

Per the locked architecture: no AI, no network calls. The PDF export
uses jsPDF + html2canvas entirely client-side, exactly as specified in
the original technical brief at the start of this project.

---

### Row PB-1 — Launch Checklist

| Field | Value |
|---|---|
| User Sees | "A few things worth checking before you publish." |
| Question | None — a checklist derived automatically from the state of all prior phases. |
| Review Logic | Pulls flags from existing phase-completion state: Discover complete? Design complete? Refine run, with no unresolved Critical findings? Package complete? Each becomes a checklist line, linking back to the relevant phase if unchecked. No new review logic — a status rollup, not a judgment. |
| Why It Matters | "A launch checklist isn't about perfection — it's about knowing what you skipped on purpose versus what you forgot." |
| Decision Field Path | none (status rollup) |

### Row PB-2 — Author Bio & Book Description

| Field | Value |
|---|---|
| User Sees | "Two pieces of copy every listing needs." |
| Question | "Write 2-3 sentences about you, as the author of THIS book specifically." / "Write the book description as it would appear on a sales page." |
| Input Type | two textareas |
| Review Logic | RULE PB2-a: reuses Filter Word Density (INSP-007) and Absolute Language (INSP-011) on the book description. RULE PB2-b: flags if the author bio is longer than the book description — a common new-author mistake. |
| Why It Matters | "A sales page describes the book's promise to a stranger in ten seconds. The same clarity rules that apply to your title apply here." |
| Decision Field Path | `decision.publish.descriptionCopy` |

### Row PB-3 — Book Build Kit (export)

| Field | Value |
|---|---|
| User Sees | "Generate your Book Build Kit." |
| Logic | Assembles a PDF (jsPDF + html2canvas) containing: edited manuscript sample (Refine), spine + chapter map (Design), title/subtitle/cover brief (Package), description + bio (PB-2), launch checklist (PB-1). |
| Why It Matters | "Everything you've built, in one document you can hand to a designer or formatter, or keep as your own record." |
| Decision Field Path | none (export action) |

---

## Decision Library Status (Publish)

| Row | Status |
|---|---|
| PB-2 | PENDING — needs a real packaging-discipline story (e.g. bio longer than description) |

No Decision slots for PB-1 or PB-3.

---

## Full phase list, now complete:

Discover → Design → Refine → Package → Publish

(Write has no dedicated module, per the original spec — drafting
happens between Design and Refine, outside the app.) Every Decision
slot across all phases is now visible in one place, which is the whole
point of finishing the skeleton before writing Decisions.
