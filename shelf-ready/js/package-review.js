/**
 * PACKAGE-REVIEW.JS
 * ─────────────────────────────────────────────────────────────
 * Reuses Inspections.scoreTitleCandidate and Inspections.runCommercialReview
 * directly rather than duplicating word lists — per the Matrix's
 * explicit reuse plan. Also reuses the stem-matching helper pattern
 * already proven in design-review.js for the final promise-consistency
 * check (PK-4).
 */

const PackageReview = (function () {

  const STOPWORDS = new Set([
    'the','a','an','and','or','but','of','to','in','on','for','with','is','are',
    'was','were','be','been','being','this','that','these','those','it','its',
    'as','at','by','from','into','about','your','you','i','we','they','he','she',
    'will','would','can','could','should','not','no','do','does','did','have',
    'has','had','my','our','their','his','her'
  ]);

  function significantWords(text) {
    return (text.toLowerCase().match(/[a-z']+/g) || []).filter(
      (w) => w.length > 2 && !STOPWORDS.has(w)
    );
  }

  function textContainsStem(text, word) {
    if (text.includes(word)) return true;
    if (word.length >= 5) {
      return new RegExp('\\b' + word.slice(0, 4), 'i').test(text);
    }
    return false;
  }

  // ---- PK-1: rank title candidates ----------------------------------

  function rankTitleCandidates(titles) {
    const scored = titles
      .filter((t) => t && t.trim())
      .map((t) => Inspections.scoreTitleCandidate(t));
    scored.sort((a, b) => a.flagCount - b.flagCount);
    return scored;
  }

  // ---- PK-2: subtitle builder review ---------------------------------

  function reviewSubtitleAssembly(parts) {
    const { outcome, reader, objection } = parts;
    if (!outcome || !reader) {
      return { verdict: 'flag', headline: 'Subtitle incomplete', explanation: '', suggestions: [], confidenceLevel: 'weak' };
    }

    const assembled = `${outcome} for ${reader}${objection ? ', without ' + objection : ''}`;
    const commercialResult = Inspections.runCommercialReview('', assembled);

    if (!objection || !objection.trim()) {
      return {
        verdict: 'flag',
        headline: 'No objection named',
        explanation: 'A subtitle that only names a benefit does less selling work than one that also names what your reader is skeptical about.',
        suggestions: ['Name the specific doubt your reader has before they\'ll believe the outcome is possible for them.'],
        confidenceLevel: 'developing',
        assembled
      };
    }

    if (commercialResult) {
      return {
        verdict: 'flag',
        headline: 'Could be more specific',
        explanation: commercialResult.whatWeFound,
        suggestions: [commercialResult.recommendation],
        confidenceLevel: 'developing',
        assembled
      };
    }

    return {
      verdict: 'pass',
      headline: 'Your subtitle does real selling work',
      explanation: 'Naming both the outcome and the objection builds trust with a skeptical reader.',
      suggestions: [],
      confidenceLevel: 'clear',
      assembled
    };
  }

  // ---- PK-4: Package Review (title/subtitle vs. Discover promise) ----

  function reviewPackageConsistency(finalTitle, finalSubtitle, discoverPromise, discoverPositioning) {
    if (!finalTitle || !discoverPromise) return null;

    const packageWords = significantWords(finalTitle + ' ' + (finalSubtitle || ''));
    const promiseText = (discoverPromise + ' ' + (discoverPositioning || '')).toLowerCase();

    const matchedWords = packageWords.filter((w) => textContainsStem(promiseText, w));
    const matchRatio = packageWords.length > 0 ? matchedWords.length / packageWords.length : 0;

    if (matchRatio >= 0.2) return null; // reasonable overlap, healthy

    return {
      inspectionId: 'PK-4',
      category: 'Commercial',
      severity: 'important',
      headline: 'Title may have drifted from your original promise',
      whatWeFound: `Your chosen title and subtitle share little language with what you said this book is about back in Discover.`,
      whyItMatters: 'A title can test well on its own but no longer match what you said this book is about. This is worth a second look before anything\'s printed.',
      recommendation: 'Re-read your Discover answers for Promise and Positioning, then check whether your title still represents that book.',
      evidenceFieldPath: 'evidence.book01.package.packageReview',
      fixRoute: { phase: 'Discover', field: 'Promise', path: 'discover/promise' }
    };
  }

  return { rankTitleCandidates, reviewSubtitleAssembly, reviewPackageConsistency };
})();
