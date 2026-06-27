# Shelf Ready — Master Content Matrix
## Phase 5: PACKAGE

Same governing rule as every prior phase: code never invents a question
or review that isn't a row here.

Package reuses the existing Commercial Review logic from Refine
(INSP-013) as its underlying engine — title/subtitle specificity and
memorability checks already exist and are tested. What Package adds is
the *generative* side: helping a writer produce title candidates and a
cover brief, not just judging ones already written. Per the locked
"rules over AI" architecture, "generative" here means structured
fill-in-the-blank templates and scored candidates, not free text
generation — consistent with how Discover and Design work.

---

### Row PK-1 — Title Candidates

| Field | Value |
|---|---|
| User Sees | "Let's find a title people will remember." |
| Question | "List 3-5 possible titles. Don't filter yet — just get them down." |
| Input Type | dynamic list, add/remove, short-text per entry |
| Review Logic | Runs the existing Commercial Review title-half logic (from INSP-013) against EACH candidate independently, scores them relative to each other rather than against an absolute bar. The candidate with the strongest score (fewest flags) is highlighted, not auto-selected — the writer chooses. |
| Why It Matters | "Comparing several real options side by side is more useful than judging one title in isolation — you can see the trade-offs." |
| Decision Field Path | `decision.package.titleCandidates` |
| Milestone Message | "✓ You have real options to choose from." |

### Row PK-2 — Subtitle Builder

| Field | Value |
|---|---|
| User Sees | "Now let's make the promise specific." |
| Question | "Finish this: [Outcome] for [reader], without [common objection]." Three short fields, combined into a draft subtitle. |
| Input Type | three short-text fields + live-assembled preview |
| Review Logic | Runs existing Commercial Review subtitle-half logic (INSP-013's abstract-word check) against the assembled subtitle. |
| Why It Matters | "A subtitle that names a real objection does more selling work than one that only names a benefit — readers are already skeptical, and naming the skepticism directly builds trust." |
| Decision Field Path | `decision.package.subtitleBuilder` |
| Milestone Message | "✓ Your subtitle does real selling work." |

### Row PK-3 — Cover Brief (not a cover maker)

| Field | Value |
|---|---|
| User Sees | "You don't need to design a cover. You need a brief for whoever does." |
| Question | Four short fields: "What category is this book in?" / "Name two real comparable book covers" / "One mood word" / "One thing the cover must NOT look like" |
| Input Type | four short-text fields |
| Review Logic | None graded — this is a structured handoff document, not a judged answer, same pattern as Design's chapter-map builder (DS-3). |
| Why It Matters | "Most authors don't need Canva. They need direction — this becomes the brief you hand to a designer, an AI image tool, or use yourself in Canva." |
| Decision Field Path | none (structural output, not a judged answer) |
| Output | Assembles into a one-page printable/exportable brief in the final Book Build Kit. |

### Row PK-4 — Package Review (derived, automatic)

| Field | Value |
|---|---|
| User Sees | "Here's how your package holds together." |
| Question | None — automatic review run against the chosen title (from PK-1), subtitle (from PK-2), and the original Discover-phase promise/positioning, once all three exist. |
| Review Logic | RULE PK4-a: reuses INSP-001's Book Promise Alignment logic — checks whether the CHOSEN title/subtitle's significant words appear anywhere in the Discover-phase promise/positioning answers, catching a title that's drifted from the book's own stated promise. RULE PK4-b: reuses Commercial Review (INSP-013) on the final chosen pair, one last time, since PK-1/PK-2 scored candidates individually — this is the combined check on the actual final choice. |
| Why It Matters | "It's possible to pick a title that tests well on its own but no longer matches what you said this book is about back in Discover. This is the same check that runs on a finished manuscript, applied here before anything's printed." |
| Decision Field Path | `decision.package.packageReview` |
| Milestone Message | "✓ Package is complete. Ready to prepare for publishing." |

---

## Decision Library Status (Package)

| Row | Status |
|---|---|
| PK-1 | PENDING — needs a real "I had 5 title options and chose wrong/right because..." story |
| PK-2 | PENDING — needs a real subtitle-naming-the-objection story |
| PK-4 | PENDING — strong candidate for reuse: likely the SAME Decision already needed for Refine's Book Promise Alignment (INSP-001) and Discover's Promise/Positioning, since this is the same underlying judgment applied a third time |

No Decision slot for PK-3 (a pure structured-output builder, nothing to
judge — same as Design's DS-3).
