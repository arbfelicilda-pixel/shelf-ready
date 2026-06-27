# Shelf Ready — Master Content Matrix
## Phase 2: DESIGN

Same governing rule as Discover and Refine: code never invents a
question, review, or copy line that isn't a row here.

Design has two parts, matching the original product spec:
**Part A — Narrative Spine** (the book's one-sentence backbone)
**Part B — Chapter Map** (the outline, stress-tested against the spine)

This phase reuses the Discover flow's conversational pattern (one
question, one box, review, Decision, Continue) for Part A, and a
drag-and-drop board for Part B — closer to the original "Spine
Constructor" and "Chapter-to-Spine Checker" tools from the founding
spec than to Refine's upload-and-scan pattern, since there's no
manuscript to scan yet at this stage — the writer is building structure
before drafting, or revisiting structure after Refine flagged a problem.

---

## PART A — Narrative Spine

### Row DS-1 — Spine Statement

| Field | Value |
|---|---|
| User Sees | "Let's build your book's backbone." |
| Question | "Finish this sentence: When [your reader] faces [their problem], they must [do what] or else [what happens] — but [what makes it hard]?" |
| Input Type | four short-text fields (protagonist/situation, problem, required action, stakes) combined into one structured sentence, not a single freeform box — the formula only works if each part is actually filled in separately |
| Review Logic | RULE DS1-a: if "stakes" field is empty or generic (matches list: "things get worse," "they fail," "nothing changes") → flag "No real stakes yet" — a spine without consequence doesn't hold weight. RULE DS1-b: if "required action" restates the problem instead of naming a specific action (heuristic: action field contains no verb from a pre-written action-verb list) → flag "Not a specific enough action." PASS: all four parts filled, stakes are specific, action is a verb-led phrase. |
| Why It Matters | "A spine with no real stakes doesn't give your structure anything to hold onto. If removing the stakes doesn't change anything, the spine isn't load-bearing yet." |
| Decision Field Path | `decision.design.spineStatement` |
| Milestone Message | "✓ Your book has a backbone." |
| Confidence Effect | Spine Clarity: Weak/Developing/Clear |

### Row DS-2 — Spine Stress Test

| Field | Value |
|---|---|
| User Sees | "Now let's see if it holds." |
| Question | Not a new question — a derived check run automatically on the DS-1 answer. Shows three simulated removals: spine with stakes removed, spine with protagonist swapped to someone generic, spine with problem swapped to something unrelated. Asks: "Does the story still make sense after each swap?" |
| Input Type | three yes/no toggles, one per simulated removal |
| Review Logic | RULE DS2-a: if the writer answers "yes, still makes sense" to the stakes-removed version → flag "Stakes may not be load-bearing" (a real stress test should fail when stakes are removed — if it doesn't, the stakes weren't doing real work). RULE DS2-b: if "yes" to protagonist-swapped → flag "This spine could describe almost any book in the category — what makes your reader's situation specific?" PASS: writer reports the story falls apart on all three removals — that's a strong sign the spine is genuinely load-bearing. |
| Why It Matters | "A strong spine collapses without its real parts. If you can swap out the stakes, the protagonist, or the problem and the sentence still basically works, the spine isn't doing much yet — it could be the backbone of a different book entirely." |
| Decision Field Path | `decision.design.spineStressTest` |
| Milestone Message | "✓ Your spine held up." |

---

## PART B — Chapter Map

### Row DS-3 — Chapter Map Builder

| Field | Value |
|---|---|
| User Sees | "Now let's map the chapters." |
| Question | "Add your chapters, in order. One line each — just the core idea of what happens." |
| Input Type | drag-and-drop ordered list, add/remove/reorder, each item a short text field |
| Review Logic | None at entry — this is a builder, not a graded question. Review happens in DS-4 once the list has 3+ entries. |
| Decision Field Path | none (this is structural input, not a judged answer) |

### Row DS-4 — Chapter-to-Spine Check

| Field | Value |
|---|---|
| User Sees | "Does every chapter earn its place?" |
| Question | Automatic check run against the DS-3 chapter list and the DS-1 spine. No new question — a derived review, same pattern as DS-2 and as Refine's automatic scan. |
| Review Logic | RULE DS4-a (mechanical): keyword overlap between each chapter line and the spine's problem/action/stakes terms (same significant-word + stem-matching approach already built for Refine's INSP-001 and INSP-009/010). Flag any chapter with near-zero overlap to the spine's core terms — **Minor**, framed as a question ("Worth checking whether this chapter connects to the spine, or whether the spine needs to expand to cover it"), never a verdict, per the locked rule-engine-honesty principle. RULE DS4-b (mechanical): flag if 2+ chapters have high mutual overlap (reuses Refine's INSP-003 Chapter Overlap logic directly — same proxy, same severity scale, now run on chapter *summaries* instead of full chapter text). |
| Why It Matters | "A chapter that doesn't connect to the spine isn't necessarily wrong — but it's worth knowing about before you write 4,000 words for it. This is the same check Refine runs on a finished manuscript, just earlier, when it's cheap to fix." |
| Decision Field Path | `decision.design.chapterSpineCheck` |
| Milestone Message | "✓ Design is complete. Next, drafting." |
| Confidence Effect | Structure Clarity: Weak/Developing/Clear; triggers Design phase completion flag |

---

## Decision Library Status (Design, both parts)

| Row | Status |
|---|---|
| DS-1 | PENDING — needs a real spine-building Decision (e.g., a spine that initially had no real stakes, and what changed) |
| DS-2 | PENDING — needs a real stress-test story (a spine that didn't survive a swap, and what that revealed) |
| DS-4 | PENDING — can likely reuse a Decision already written for Refine's Chapter Overlap, since the underlying check is the same logic applied earlier in the process — this is exactly the kind of reuse the Decision Library was built for. |

No Decision slot planned for DS-3 (a pure builder step, nothing to judge).

The app must render gracefully with all Decisions PENDING, same as
every other phase — "Why I made this decision" panel either shows the
honest empty state (Discover-style) or is omitted entirely (Refine-style,
for DS-4 since it's a derived review like Refine's findings).
