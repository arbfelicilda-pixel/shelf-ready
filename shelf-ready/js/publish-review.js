/**
 * PUBLISH-REVIEW.JS
 * ─────────────────────────────────────────────────────────────
 * PB-2 reuses Inspections.runFilterWordDensity and
 * Inspections.runAbsoluteLanguage directly against the book
 * description, treating it as a tiny one-chapter "manuscript" —
 * same functions, same thresholds, no new logic needed for that
 * half of the check.
 */

const PublishReview = (function () {

  function wordCount(text) {
    return (text.trim().match(/\S+/g) || []).length;
  }

  function reviewDescriptionCopy(authorBio, bookDescription) {
    if (!authorBio || !bookDescription) return null;

    const findings = [];

    // Reuse existing manuscript-level checks by treating the description
    // as a single-chapter manuscript.
    const fakeManuscript = {
      chapters: [{ title: 'Description', paragraphs: [bookDescription] }],
      rawWordCount: wordCount(bookDescription)
    };
    const filterResult = Inspections.runFilterWordDensity(fakeManuscript);
    const absoluteResult = Inspections.runAbsoluteLanguage(fakeManuscript);
    if (filterResult) findings.push(filterResult);
    if (absoluteResult) findings.push(absoluteResult);

    // Bio-longer-than-description check (PB2-b) — new, simple heuristic.
    const bioWords = wordCount(authorBio);
    const descWords = wordCount(bookDescription);
    if (bioWords > descWords) {
      findings.push({
        inspectionId: 'PB2-b',
        category: 'Commercial',
        severity: 'minor',
        headline: 'Your bio is longer than your book description',
        whatWeFound: `Author bio: ${bioWords} words. Book description: ${descWords} words.`,
        whyItMatters: 'A sales page should sell the book first. When the bio is the longest thing on the page, the book can end up feeling like a secondary detail.',
        recommendation: 'Trim the bio to 2-3 sentences and let the book description do more of the work.',
        evidenceFieldPath: 'evidence.book01.publish.descriptionCopy'
      });
    }

    return findings;
  }

  return { reviewDescriptionCopy };
})();
