# Shelf Ready — Inspection Matrix (Starter Set)
## Refine Phase: Manuscript Review Engine

This is the inspection catalog for uploaded-manuscript review. Same governing
rule as the Master Content Matrix: code never invents a check that isn't a
row here. Ten inspections, two per category, proven in working code before
the catalog scales. Compare with Author is Premium Evidence — omitted
entirely wherever no real evidence exists, never a placeholder.

---

### INSP-001 — Book Promise Alignment
*(Renamed from "Title Promise Alignment" — the real question is whether
the book delivers what the cover promises. Title/subtitle keywords are
the evidence used to check this, not the thing being judged.)*
| Field | Value |
|---|---|
| Category | Concept |
| Tier | Mechanical → Heuristic |
| Inputs | Title, subtitle, full manuscript text (chapter-segmented) |
| Evidence Logic | Extract significant keywords from title+subtitle (strip stopwords). For each keyword/synonym cluster, count chapters where it appears at least once. Compute `coveragePercent = chaptersWithTerm / totalChapters`. |
| Severity Rule | **Critical** if `coveragePercent < 30%` for the primary title term. **Important** if `30–60%`. **Minor/Informational** if `>60%` (healthy, shown collapsed). |
| What We Found (template) | "Your title/subtitle emphasize: {terms}. Across your manuscript, {term} appears in {n} of {total} chapters ({pct}%)." |
| Why It Matters | "Readers expect a title's core promise to run through the book, not live in one or two chapters. A low match usually means the title overstates what the book delivers, or the manuscript hasn't fully built out its own premise yet." |
| Recommendation Logic | If coverage low: "Either expand the manuscript's treatment of {term}, or revise the title to better match what's actually here." |
| Compare Example Path | `evidence.book01.refine.titlePromiseAlignment` |
| Render Rule | Full 4-part card for Critical/Important. Collapsed one-liner for Minor/Informational. |

---

### INSP-002 — Subtitle Specificity
| Field | Value |
|---|---|
| Category | Concept |
| Tier | Heuristic |
| Inputs | Subtitle text only |
| Evidence Logic | Word count of subtitle. Check against abstract-word list (vague nouns: "success," "happiness," "potential," "growth" used without qualifier). Check for presence of a concrete outcome verb/phrase. |
| Severity Rule | **Important** if subtitle >16 words AND contains 2+ abstract words with no concrete qualifier. **Minor** if one issue present. **Informational/pass** otherwise. |
| What We Found (template) | "Your subtitle is {n} words. {abstractWords} appear without a concrete qualifier." |
| Why It Matters | "Subtitles do the selling work a title can't fit. Vague subtitles ('unlock your potential') read as interchangeable with hundreds of other books in the category." |
| Recommendation Logic | "Pair each abstract word with a concrete outcome — not 'build confidence' but 'speak up in meetings without rehearsing for three days.'" |
| Compare Example Path | `evidence.book01.refine.subtitleSpecificity` |
| Render Rule | Full card if Important; collapsed if Minor. |

---

### INSP-003 — Chapter Vocabulary Overlap (Repetition)
| Field | Value |
|---|---|
| Category | Structure |
| Tier | Mechanical (proxy) |
| Inputs | Full manuscript, chapter-segmented |
| Evidence Logic | For each pair of non-adjacent chapters, compute significant-word vocabulary overlap (Jaccard-style: shared significant words / union of significant words). Flag pairs above threshold. |
| Severity Rule | **Important** if any non-adjacent chapter pair has overlap `>45%`. **Minor** if `30–45%`. No flag below 30%. |
| What We Found (template) | "Chapter {A} and Chapter {B} share {pct}% vocabulary overlap — higher than most chapter pairs in this manuscript." |
| Why It Matters | "High vocabulary overlap between non-adjacent chapters often means the same idea is being explained twice. This isn't always wrong — but it's worth checking whether one chapter adds something the other doesn't." |
| Recommendation Logic | "Read both chapters back to back. If one doesn't add new ground, consider merging or cutting." |
| Compare Example Path | `evidence.book01.refine.chapterOverlap` |
| Render Rule | Full card if Important; collapsed if Minor. Always phrased as a question, never an assertion (per locked honesty principle — overlap is a proxy, not proof). |

---

### INSP-004 — Chapter Length Balance
| Field | Value |
|---|---|
| Category | Structure |
| Tier | Mechanical |
| Inputs | Word count per chapter |
| Evidence Logic | Compute mean chapter word count and each chapter's ratio to the mean. |
| Severity Rule | **Minor** if any chapter is `>2.5x` or `<0.4x` the manuscript's mean chapter length. **Informational** otherwise. |
| What We Found (template) | "Chapter {n} is {ratio}x your average chapter length ({words} words vs. an average of {avg})." |
| Why It Matters | "Large imbalances can signal a chapter that's trying to do two jobs, or one that's underdeveloped relative to its place in the book." |
| Recommendation Logic | "Consider whether this chapter should be split, or whether it needs more development to match the book's rhythm." |
| Compare Example Path | none planned (low-value for author comparison) |
| Render Rule | Collapsed one-liner always — this is a Minor-tier check by design. |

---

### INSP-005 — Title Memorability
| Field | Value |
|---|---|
| Category | Commercial |
| Tier | Heuristic |
| Inputs | Title text only |
| Evidence Logic | Word count of title. Check against generic single-word list ("Invisible," "Success," "Growth" with no qualifying phrase). Check for presence of emotional-trigger or contrast-pattern words (pre-written list, not generated). |
| Severity Rule | **Important** if title is 1-2 generic words with no qualifier AND no emotional-trigger word present. **Minor** if one condition met. **Pass** if title is specific and concrete. |
| What We Found (template) | "Your title is {n} words. {findings}." |
| Why It Matters | "Short, abstract titles are easy to forget and hard to search for, because they don't compete on a specific feeling or outcome." |
| Recommendation Logic | "Consider adding a concrete outcome or contrast: not just '{title}' but '{title}: [specific promise].'" |
| Compare Example Path | `evidence.book01.refine.titleMemorability` |
| Render Rule | Full card if Important; collapsed if Minor. |

---

### INSP-006 — Reader-Focus Consistency
| Field | Value |
|---|---|
| Category | Commercial / Reader Experience (cross-listed) |
| Tier | Mechanical |
| Inputs | Full manuscript text |
| Evidence Logic | Count occurrences of direct-address pronoun patterns and named-audience nouns ("you," "we," "entrepreneurs," "managers," "parents," etc.) per chapter. Flag if 3+ distinct audience nouns each appear with meaningful frequency (not just passing mention). |
| Severity Rule | **Important** if 3+ distinct named audiences detected at meaningful frequency. **Minor** if 2. **Pass** if 1 consistent address pattern. |
| What We Found (template) | "Your manuscript addresses {audienceList} at different points." |
| Why It Matters | "Readers decide quickly whether a book is 'for them.' Switching who the book is talking to can make every reader feel like a secondary audience some of the time." |
| Recommendation Logic | "Choose the one reader who matters most, and rewrite passing references to other groups as examples *within* their story, not as a parallel address." |
| Compare Example Path | `evidence.book01.refine.readerFocus` |
| Render Rule | Full card if Important; collapsed if Minor. |

---

### INSP-007 — Filter Word Density
| Field | Value |
|---|---|
| Category | Writing |
| Tier | Mechanical |
| Inputs | Full manuscript text |
| Evidence Logic | Count instances of filter-word list ("I felt," "I noticed," "I realized," "I saw," "I thought," "I heard," "it seemed") per 1,000 words. |
| Severity Rule | **Minor** if density `>3 per 1,000 words`. **Informational** otherwise. |
| What We Found (template) | "Filter words appear {density} times per 1,000 words ({total} instances total)." |
| Why It Matters | "Filter words put a narrator between the reader and the experience. 'I felt my chest tighten' is one layer removed from 'My chest tightened.'" |
| Recommendation Logic | "Try cutting the filter phrase directly — most sentences read stronger without it." |
| Compare Example Path | `evidence.book01.refine.filterWords` |
| Render Rule | Collapsed one-liner always — Minor tier by design, but always shown since it's cheap to compute and genuinely useful as a standing metric. |

---

### INSP-008 — Sentence & Paragraph Rhythm
| Field | Value |
|---|---|
| Category | Writing |
| Tier | Mechanical |
| Inputs | Full manuscript text |
| Evidence Logic | Compute average sentence length (words) and average paragraph length (words) across manuscript. |
| Severity Rule | **Minor** if average sentence length `>24 words` or average paragraph length `>150 words`. **Informational** otherwise. |
| What We Found (template) | "Average sentence length: {n} words. Average paragraph length: {n} words." |
| Why It Matters | "Long unbroken sentences and paragraphs increase reading effort, especially in nonfiction where readers often skim for the point." |
| Recommendation Logic | "Look for sentences over 30 words first — these are usually the easiest to split without losing meaning." |
| Compare Example Path | none planned (too generic a metric for author-comparison to add value) |
| Render Rule | Collapsed one-liner always. |

---

### INSP-009 — Introduction Promise-Setting
| Field | Value |
|---|---|
| Category | Reader Experience |
| Tier | Heuristic |
| Inputs | Introduction/first chapter text, title, subtitle |
| Evidence Logic | Check whether title/subtitle keyword cluster (from INSP-001) appears within the introduction's text at all, and within what proportion of the introduction's word count (early presence vs. late/absent). |
| Severity Rule | **Important** if the title's core promise terms do not appear at all within the introduction. **Minor** if they appear only in the final third of the introduction. **Pass** if present early. |
| What We Found (template) | "Your introduction is {words} words. The core promise terms from your title ({terms}) {appearOrNot} within it." |
| Why It Matters | "Readers use the introduction to decide whether the book delivers what the cover promised. If the promise doesn't show up early, readers may put the book down before reaching the part that does." |
| Recommendation Logic | "Move an explicit statement of the book's promise into the first few paragraphs of the introduction." |
| Compare Example Path | `evidence.book01.refine.introPromise` |
| Render Rule | Full card if Important; collapsed if Minor. |

---

### INSP-010 — Conclusion Promise-Fulfillment
| Field | Value |
|---|---|
| Category | Reader Experience |
| Tier | Heuristic |
| Inputs | Conclusion/final chapter text, title, subtitle |
| Evidence Logic | Check whether title/subtitle keyword cluster appears in the conclusion, and check whether conclusion introduces NEW significant terms not present elsewhere in the manuscript (proxy for "introduces new ideas instead of reinforcing the promise"). |
| Severity Rule | **Important** if conclusion introduces 2+ significant terms absent from the rest of the manuscript AND core promise terms are weakly present. **Minor** if one condition. **Pass** otherwise. |
| What We Found (template) | "Your conclusion introduces {n} ideas not discussed elsewhere in the manuscript: {terms}." |
| Why It Matters | "A conclusion's job is usually to land the promise the book already built, not open new threads. New ideas this late can leave readers without the payoff they were reading toward." |
| Recommendation Logic | "Consider moving new ideas earlier in the manuscript, or cutting them, so the conclusion can focus on delivering what the title promised." |
| Compare Example Path | `evidence.book01.refine.conclusionFulfillment` |
| Render Rule | Full card if Important; collapsed if Minor. |

---

## Build Status — v1 Review Engine Complete

All 11 originally-implemented reviews (INSP-001, 003, 004, 006, 007, 008,
009, 010, 011, 012, 013) plus five additions (INSP-014 through INSP-018,
added after testing against a real, externally beta-read manuscript)
are coded, tested, and verified.

**Five additions (INSP-014 to INSP-018), sourced from external research
on voice/cadence/structural stress-testing:**
- INSP-014 Passive Voice Density (was/were frequency)
- INSP-015 Sentence Opener Repetition (first-word-of-sentence dominance)
- INSP-016 Transition Word Overuse (paragraph-opening transition words)
- INSP-017 Dialogue Tag Ratio ("said" vs. alternatives, dialogue only)
- INSP-018 Backward Reference Density (proxy for chapter interdependence)

All five are genuinely mechanical — literal word/pattern counts, same
honesty tier as the original eleven. The source research also proposed
checks for "does the spine hold," "does the metaphor sustain," "does the
ending resonate" — these were evaluated and explicitly NOT built. They
require reading and understanding prose meaning, the same wall already
hit with "Human Reality" and "new ideas in conclusion." No amount of
additional pattern-matching closes that gap; it would need an LLM call,
which reopens the offline/cost tradeoff deliberately closed earlier.
Documented here so the gap stays visible rather than quietly papered
over with a check that sounds more capable than it is.

**A note on real-manuscript testing:** this session's fixes were driven
by an actual externally beta-read manuscript (9.2 reader score), used
specifically to stress-test detection against a GOOD book rather than
an obviously broken one. It surfaced four real, confirmed bugs in
manuscript-import.js: (1) a printed Table of Contents being misread as
duplicate chapter headings, (2) Roman-numeral Part markers ("PART I")
never matching the digit/spelled-out-only pattern, (3) Part subtitles
("THE CAVE" following "PART I") being counted as standalone chapters,
and (4) a repeated title-page line incorrectly absorbing the copyright
notice and dedication into one false chapter. All four are fixed and
verified against the real file (45 falsely-detected chapters → 16
correct chapters + Epilogue + About the Author, properly tagged).

---

## Evidence Status (Book 1, all 13 specified inspections)

All PENDING. Per locked decision, Compare with Author sections are **omitted
entirely** from rendering wherever status !== 'complete' — no placeholder,
no "being added" message. The full 4-part card simply ends after
Recommendation until real evidence exists.

---

### INSP-011 — Absolute Language
| Field | Value |
|---|---|
| Category | Writing |
| Tier | Mechanical |
| Inputs | Full manuscript text |
| Evidence Logic | Count instances of absolute-language word list ("always," "never," "every," "all," "must," "completely," etc.) per 1,000 words. |
| Severity Rule | **Minor** if density `>4 per 1,000 words`. **Informational** otherwise. |
| Why It Matters | "Readers often resist advice that doesn't leave room for exceptions. Frequent absolutes can make otherwise true observations feel less believable than ones that acknowledge nuance." |
| Note | This is the deliberately scoped-down, honest version of the "Human Reality" concept discussed and explicitly rejected for v1 — it measures a real countable proxy and lets the reader draw the conclusion, rather than claiming the software can judge whether an idea "feels true to life." |
| Compare Example Path | `evidence.book01.refine.absoluteLanguage` |

---

### INSP-012 — Pacing Variance
| Field | Value |
|---|---|
| Category | Writing |
| Tier | Mechanical (proxy) |
| Inputs | Full manuscript, chapter-segmented |
| Evidence Logic | Compute average sentence length per chapter; compare each chapter's average against the manuscript-wide average. |
| Severity Rule | **Minor** if any chapter's ratio to overall average exceeds 1.8x or falls below 0.2x. **Informational** for smaller deviations (1.5–1.8x or 0.2–0.6x). |
| Why It Matters | "A sharp pacing shift isn't necessarily wrong — but it's one of the places readers most often slow down, skim, or set the book aside, especially if the shift isn't intentional." |
| Compare Example Path | `evidence.book01.refine.pacingVariance` |

---

### INSP-013 — Commercial Review (merged)
| Field | Value |
|---|---|
| Category | Commercial |
| Tier | Heuristic |
| Inputs | Title, subtitle |
| Evidence Logic | Merges former INSP-002 (Subtitle Specificity) and INSP-005 (Title Memorability) into a single review, per locked decision to package shelf-appeal checks under one buyer-facing label. |
| Severity Rule | **Important** if both title and subtitle issues detected. **Minor** if only one. |
| Why It Matters | "Readers decide whether a book is 'for them' in seconds. Specific, concrete language is easier to recognize, remember, and search for than abstract phrasing." |
| Compare Example Path | `evidence.book01.refine.commercialReview` |

## Severity Aggregation (for Book Preview / report header)

No numeric score. Report header shows counts only:
`{n} Critical · {n} Important · {n} Minor · {n} Informational`
Critical and Important issues list individually, expanded by default.
Minor/Informational collapse under a single "Smaller things worth a glance"
disclosure, collapsed by default.
