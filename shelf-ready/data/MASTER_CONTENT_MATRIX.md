# Shelf Ready — Master Content Matrix
## Phase 1: DISCOVER (v1 build slice)

This document is the blueprint. Every screen, data field, review rule, and
evidence hook in the app derives from a row here. Code should never invent
copy or logic that isn't traceable to this file. When the Matrix changes,
the app changes — not the other way around.

Internal phases (never shown to user): Discover → Design → Write → Refine → Package → Publish
User-facing frame: one question at a time, answered in a single sitting or returned to anytime.

---

### Row D1 — Working Title

| Field | Value |
|---|---|
| Internal Phase | Discover |
| State Path | `project.discover.workingTitle` |
| User Sees | "Let's start with your book." |
| Question | "What's the working title? (It can change later.)" |
| Input Type | short text |
| Editorial Review Logic | None — this is a placeholder field, no review. First touch should feel easy, not graded. |
| Why This Matters | Not shown (no review fires) |
| Evidence Field Path | none |
| Recommendation | none |
| Milestone Message | none (first screen, no prior milestone to report) |
| Confidence Meter Effect | none |
| Next Question | D2 |

---

### Row D2 — One-Sentence Concept

| Field | Value |
|---|---|
| Internal Phase | Discover |
| State Path | `project.discover.concept` |
| User Sees | "Tell me what it's about." |
| Question | "Describe your book in one sentence." |
| Input Type | long text (single paragraph, soft cap ~280 chars with a gentle counter, not a hard block) |
| Editorial Review Logic | RULE D2-a: if sentence count detected > 1 (via terminal punctuation heuristic) → flag "Trying to do too much" RULE D2-b: if no concrete outcome/verb-of-change detected (keyword list: "learn, stop, build, become, overcome, understand, fix, change, discover, master" etc.) → flag "No transformation yet — what changes for the reader?" RULE D2-c: if word count < 8 → flag "Too thin to test yet" PASS condition: one sentence, contains a change-verb, length 8–40 words → "Clear starting concept." |
| Why This Matters | "A concept that takes more than one sentence to explain usually means the book hasn't found its center yet. Readers decide whether to keep reading in about the same amount of time." |
| Evidence Field Path | `evidence.book01.discover.concept` |
| Recommendation | Templated by which rule fired (see Editorial_Rules/discover.js) |
| Milestone Message | "✓ Your concept is taking shape." |
| Confidence Meter Effect | Concept Clarity: sets initial value (Weak/Developing/Clear) |
| Next Question | D3 |

---

### Row D3 — Reader

| Field | Value |
|---|---|
| Internal Phase | Discover |
| State Path | `project.discover.reader` |
| User Sees | "Who is this for?" |
| Question | "Who do you want this book to help? Be as specific as you can." |
| Input Type | long text |
| Editorial Review Logic | RULE D3-a: if matches broad-category list ("entrepreneurs", "women", "people", "everyone", "readers", "anyone who...") with no qualifying clause after it → flag "Too broad" and surface 2–3 narrower example splits drawn from a static pattern bank (e.g. "first-time founders," "solo consultants," "agency owners with 2–10 staff") — NOT generated live, pre-written per common category. RULE D3-b: if contains a specific situational qualifier (e.g. "who just started," "who feel," "who struggle with X specifically") → PASS, "This reader will recognize themselves immediately." |
| Why This Matters | "Broad audiences usually produce generic books, because the advice has to stay general enough to apply to everyone. A narrow reader lets every chapter get specific — which is what makes advice feel earned instead of obvious." |
| Evidence Field Path | `evidence.book01.discover.reader` |
| Recommendation | If D3-a fired: "Try narrowing to one of these, or your own version of one:" + bank list. If pass: none needed. |
| Milestone Message | "✓ You know who this is for." |
| Confidence Meter Effect | Reader Clarity: Weak/Developing/Clear |
| Next Question | D4 |

---

### Row D4 — The Promise

| Field | Value |
|---|---|
| Internal Phase | Discover |
| State Path | `project.discover.promise` |
| User Sees | "What changes for them?" |
| Question | "By the end of this book, what will your reader know, feel, or be able to do that they couldn't before?" |
| Input Type | long text |
| Editorial Review Logic | RULE D4-a: if promise is vague/abstract (matches list: "learn confidence", "be happier", "understand X better", "improve their life" — i.e. no measurable or observable change-state) → flag "Too vague to test" and generate templated 3-tier example (Weak → Better → Commercial) using the user's own words substituted into a fixed template structure (not freeform AI generation — substitution into pre-written templates keyed by detected topic category). RULE D4-b: if promise names a specific before/after state → PASS, "This promise can be tested against — good." |
| Why This Matters | "A vague promise can't be designed against. A specific promise tells you exactly what every chapter has to earn. 'Learn confidence' doesn't tell you what to write. 'Stop apologizing for taking up space in meetings' does." |
| Evidence Field Path | `evidence.book01.discover.promise` |
| Recommendation | Weak → Better → Commercial ladder, shown only if D4-a fires |
| Milestone Message | "✓ Your promise is something readers can hold you to." |
| Confidence Meter Effect | Promise Clarity: Weak/Developing/Clear |
| Next Question | D5 |

---

### Row D5 — Positioning

| Field | Value |
|---|---|
| Internal Phase | Discover |
| State Path | `project.discover.positioning` |
| User Sees | "Where would this sit on a shelf?" |
| Question | "If your book were on a real shelf, which section is it in, and which two or three books would be its neighbors?" |
| Input Type | category select (fixed list, nonfiction subgenres) + free-text comp titles (2–3 fields) |
| Editorial Review Logic | RULE D5-a: if category selected but comp titles left blank → flag "Name your real competition" (cannot determine differentiation without it). RULE D5-b: if comp titles entered → no live lookup (offline constraint) — but flag "Good. Knowing your shelf neighbors means we can check that you don't blend in." |
| Why This Matters | "Every category has its own expectations. A business book and a psychology book earn trust differently. Naming your real shelf neighbors now means we can check, later, that your title and cover don't disappear next to them." |
| Evidence Field Path | `evidence.book01.discover.positioning` |
| Recommendation | none generated yet (positioning is revisited fully in Package phase) — this is a lightweight first pass |
| Milestone Message | "✓ Discover is complete. Next, we shape the structure." |
| Confidence Meter Effect | Positioning Clarity: Weak/Developing/Clear; also triggers Discover phase completion flag |
| Next Question | → transitions to Design phase (D5 is last Discover row in this build slice) |

---

## Confidence Meter — Discover Summary (shown at phase-end milestone screen)

```
Discover Complete

Reader Clarity        ●●●○○
Promise Clarity        ●●●●○
Concept Clarity         ●●●●●
Positioning             ●●○○○

Overall: Developing

You're ready to move to Design.
```

Stars/dots are deterministic, computed from which rules fired (PASS = full,
flag-with-resolution = partial, flag-unresolved = low). Never an LLM judgment
call — always traceable to a specific rule ID.

## Evidence Library Status (Discover, Book 1 only — v1 scope)

| Row | Status |
|---|---|
| D1 | N/A (no evidence needed) |
| D2 | PENDING — needs Arnie's real Book 1 concept sentence + reasoning |
| D3 | PENDING |
| D4 | PENDING |
| D5 | PENDING |

The app must render gracefully with all evidence PENDING. Empty state copy:
"Evidence for this question is being added. Check back soon." — never a
broken lookup, never a blank box that looks like an error.
