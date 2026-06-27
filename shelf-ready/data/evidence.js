/**
 * EVIDENCE.JS — The Decision Library
 * ─────────────────────────────────────────────────────────────
 * Read-only. Never written to by the app at runtime. Looked up
 * live by Evidence Field Path (see Master Content Matrix /
 * Inspection Matrix).
 *
 * NAMING (locked, third pass): these are Decisions, not "lessons"
 * and not "case studies." The product's entire premise is that
 * every review asks "would an experienced publisher make the
 * same decision?" — so the evidence backing each review should
 * be framed as a decision, not a story or a takeaway. The UI
 * surfaces each one as "Related publishing decision."
 *
 * NOTE ON NAMING CHURN: this is the third name for the same
 * five-field structure (Case Study → Lesson → Decision) across
 * three consecutive rounds, with zero change to the underlying
 * shape each time. Flagging this plainly: if there's a fourth
 * rename request, the right move is to pause and ask whether
 * we're refining or circling, rather than rename again on
 * momentum. This round's rename is adopted because the reasoning
 * is genuinely sound — "decision" matches the situation→fork→
 * choice→result shape better than "lesson" did, and it ties
 * directly to the product's already-locked review philosophy.
 *
 * One Decision can map to many places in the product — Discover
 * questions, Refine findings, and eventually Design/Package/
 * Publish — without duplicating the underlying story. IDs are
 * sequential (decision-001, decision-002...) rather than
 * numbered by feature, since a decision written for one purpose
 * often turns out to apply somewhere unexpected later.
 *
 * SCHEMA — Decision (5 parts, UNCHANGED across all three naming
 * rounds — only the container name and labels have ever changed):
 *   {
 *     id: 'decision-001',
 *     book: 'The Invisible Trap',
 *     situation:  "What the book originally looked like.",
 *     discovery:  "How you realized something was wrong.",
 *     change:     "Exactly what you changed.",
 *     outcome:    "What improved afterward.",
 *     principle:  "The one memorable, reusable lesson."
 *   }
 *
 * A decision is "fully written" only when all five fields are
 * non-empty.
 */

function emptyDecision(id) {
  return {
    id,
    status: 'pending',
    book: '',
    situation: '',
    discovery: '',
    change: '',
    outcome: '',
    principle: ''
  };
}

/**
 * The library itself. Target: 20-30 decisions over time, built up
 * as real stories get written — not pre-allocated slots to fill.
 */
const DecisionLibrary = {
  'decision-001': emptyDecision('decision-001'),
  'decision-002': emptyDecision('decision-002'),
  'decision-003': emptyDecision('decision-003')
  // Add decision-004+ as real stories get written.
};

/**
 * The mapping: which decision (if any) is relevant to each
 * Discover question and each Refine review. Multiple mapping
 * entries can point to the SAME decision id — that's the whole
 * point. A decision written for one purpose can be mapped to a
 * newly-discovered relevant spot later without rewriting anything.
 */
const decisionMap = {
  discover: {
    concept: null,
    reader: null,
    promise: null,
    positioning: null
  },
  design: {
    spineStatement: null,
    spineStressTest: null,
    chapterSpineCheck: null
  },
  package: {
    titleCandidates: null,
    subtitleBuilder: null,
    packageReview: null
  },
  publish: {
    descriptionCopy: null
  },
  refine: {
    bookPromiseAlignment: null,
    chapterOverlap: null,
    chapterLengthBalance: null, // no Decision slot by design, per Inspection Matrix
    readerFocus: null,
    filterWords: null,
    sentenceParagraphRhythm: null, // no Decision slot by design, per Inspection Matrix
    introPromise: null,
    conclusionFulfillment: null,
    absoluteLanguage: null,
    pacingVariance: null,
    commercialReview: null
  }
};

/**
 * Safe lookup. fieldPath looks like "evidence.book01.discover.reader"
 * (the "book01" segment is retained for now since the rest of the
 * app's field-path strings already use it; the library itself is
 * not per-book yet, since Book 1 is the only book being documented
 * per the locked one-book-first decision).
 *
 * Returns a normalized empty shape if no decision is mapped, or if
 * the mapped decision isn't fully written yet.
 */
function getEvidence(fieldPath) {
  const parts = fieldPath.replace(/^evidence\.book01\./, '').split('.');
  const [phase, field] = parts;

  const mappedId = decisionMap[phase] && decisionMap[phase][field];
  if (!mappedId) return emptyDecision(null);

  const decision = DecisionLibrary[mappedId];
  const isFullyWritten =
    decision &&
    decision.book && decision.situation && decision.discovery &&
    decision.change && decision.outcome && decision.principle;

  return isFullyWritten ? decision : emptyDecision(mappedId);
}
