/**
 * DESIGN-REVIEW.JS
 * ─────────────────────────────────────────────────────────────
 * Review logic for the Design phase (narrative spine + chapter
 * map). Per the Matrix, DS-4's chapter-to-spine check deliberately
 * REUSES the significant-word/stem-matching and Jaccard-overlap
 * approach already built and tested in inspections.js, rather
 * than reinventing similar logic — same proxy, same honesty
 * boundaries, just applied to short chapter-summary lines instead
 * of full manuscript text.
 */

const DesignReview = (function () {

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
      const stem = word.slice(0, 4);
      return new RegExp('\\b' + stem, 'i').test(text);
    }
    return false;
  }

  function jaccardOverlap(wordsA, wordsB) {
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    if (setA.size === 0 || setB.size === 0) return 0;
    let shared = 0;
    setA.forEach((w) => { if (setB.has(w)) shared++; });
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : shared / union;
  }

  // ---- DS-1: Spine Statement review ------------------------------------

  const GENERIC_STAKES = [
    'things get worse', 'they fail', 'nothing changes', 'it gets bad',
    'bad things happen', 'they lose', 'everything falls apart'
  ];

  const ACTION_VERBS = [
    'stop', 'start', 'build', 'break', 'face', 'confront', 'overcome',
    'change', 'learn', 'speak', 'leave', 'choose', 'fight', 'accept',
    'rebuild', 'reclaim', 'admit', 'ask', 'say', 'decide', 'risk', 'trust'
  ];

  function reviewSpineStatement(spine) {
    const { protagonist, problem, action, stakes } = spine;

    if (!protagonist || !problem || !action || !stakes) {
      return { verdict: 'flag', headline: 'Spine incomplete', explanation: '', suggestions: [], confidenceLevel: 'weak' };
    }

    const stakesLower = stakes.toLowerCase().trim();
    const stakesIsGeneric = GENERIC_STAKES.some((g) => stakesLower.includes(g)) || significantWords(stakes).length < 2;

    if (stakesIsGeneric) {
      return {
        verdict: 'flag',
        headline: 'No real stakes yet',
        explanation: "A spine with no real stakes doesn't give your structure anything to hold onto. If removing the stakes doesn't change anything, the spine isn't load-bearing yet.",
        suggestions: ['Name a specific, concrete consequence — not "things get worse," but what actually gets worse, for this specific reader.'],
        confidenceLevel: 'weak'
      };
    }

    const actionHasVerb = ACTION_VERBS.some((v) => textContainsStem(action.toLowerCase(), v));
    if (!actionHasVerb) {
      return {
        verdict: 'flag',
        headline: 'Not a specific enough action',
        explanation: 'A spine needs a concrete action your reader takes — not a restatement of the problem.',
        suggestions: ['Lead with a verb: stop, build, face, choose, leave — what does your reader actually have to DO?'],
        confidenceLevel: 'developing'
      };
    }

    return {
      verdict: 'pass',
      headline: 'Your spine has real weight',
      explanation: 'Specific stakes and a clear required action give your structure something to hold onto.',
      suggestions: [],
      confidenceLevel: 'clear'
    };
  }

  // ---- DS-2: Spine Stress Test interpretation ----------------------------

  function reviewStressTest(stressTest) {
    const { stakesRemoved, protagonistSwapped, problemSwapped } = stressTest;
    if (stakesRemoved === null || protagonistSwapped === null || problemSwapped === null) {
      return null; // not all three answered yet
    }

    const flags = [];
    if (stakesRemoved === true) {
      flags.push('You said the story still makes sense without the stakes — that usually means the stakes aren\'t load-bearing yet.');
    }
    if (protagonistSwapped === true) {
      flags.push('You said the story still works with a generic protagonist — worth asking what makes your reader\'s situation specific to them.');
    }
    if (problemSwapped === true) {
      flags.push('You said the story still works with an unrelated problem swapped in — the spine may be more about a feeling than a specific situation.');
    }

    if (flags.length === 0) {
      return {
        verdict: 'pass',
        headline: 'Your spine held up',
        explanation: 'The story fell apart on all three removals — that\'s a strong sign the spine is genuinely load-bearing, not just a description that could fit several different books.',
        suggestions: [],
        confidenceLevel: 'clear'
      };
    }

    return {
      verdict: 'flag',
      headline: flags.length > 1 ? 'Spine may need more weight in a few places' : 'One part of the spine may not be load-bearing',
      explanation: 'A strong spine collapses without its real parts. If removing a piece and the sentence still basically works, that piece isn\'t doing much yet.',
      suggestions: flags,
      confidenceLevel: flags.length > 1 ? 'weak' : 'developing'
    };
  }

  // ---- DS-4: Chapter-to-Spine Check ---------------------------------------

  function checkChapterSpine(chapters, spine) {
    const findings = [];
    if (chapters.length < 3) return findings;

    const spineTerms = significantWords(
      [spine.problem, spine.action, spine.stakes].filter(Boolean).join(' ')
    );

    // RULE DS4-a: chapters with near-zero overlap to the spine's core terms
    if (spineTerms.length > 0) {
      chapters.forEach((ch, idx) => {
        const chapterTerms = significantWords(ch.text);
        const hasAnyOverlap = chapterTerms.some((word) =>
          spineTerms.some((term) => textContainsStem(word, term) || textContainsStem(term, word))
        );
        if (!hasAnyOverlap && chapterTerms.length > 0) {
          findings.push({
            inspectionId: 'DS4-a',
            category: 'Structure',
            severity: 'minor',
            headline: `"${ch.text}" may not connect to the spine`,
            whatWeFound: `This chapter doesn't share any obvious language with your spine's problem, action, or stakes.`,
            whyItMatters: "A chapter that doesn't connect to the spine isn't necessarily wrong — but it's worth knowing about before you write thousands of words for it. This is the same check Refine runs on a finished manuscript, just earlier, when it's cheap to fix.",
            recommendation: 'Worth checking whether this chapter connects to the spine, or whether the spine needs to expand to cover it.',
            evidenceFieldPath: 'evidence.book01.design.chapterSpineCheck',
            fixRoute: { phase: 'Structure', field: 'Chapter Map', path: 'design/chapters' }
          });
        }
      });
    }

    // RULE DS4-b: chapters with high mutual overlap (reuses Refine's
    // Chapter Overlap proxy directly, applied to short summary lines).
    const chapterWordSets = chapters.map((c) => significantWords(c.text));
    let worstPair = null;
    for (let i = 0; i < chapters.length; i++) {
      for (let j = i + 1; j < chapters.length; j++) {
        const overlap = jaccardOverlap(chapterWordSets[i], chapterWordSets[j]);
        if (overlap >= 0.5 && (!worstPair || overlap > worstPair.overlap)) {
          worstPair = { overlap, i, j };
        }
      }
    }
    if (worstPair) {
      findings.push({
        inspectionId: 'DS4-b',
        category: 'Structure',
        severity: 'minor',
        headline: `Possible overlap: "${chapters[worstPair.i].text}" and "${chapters[worstPair.j].text}"`,
        whatWeFound: `These two chapter summaries share ${Math.round(worstPair.overlap * 100)}% of their significant words.`,
        whyItMatters: 'Two chapters covering very similar ground at the outline stage often means one of them needs a sharper, more distinct job before you start writing.',
        recommendation: 'Check whether each chapter has a job the other doesn\'t already do.',
        evidenceFieldPath: 'evidence.book01.design.chapterSpineCheck',
        fixRoute: { phase: 'Structure', field: 'Chapter Map', path: 'design/chapters' }
      });
    }

    return findings;
  }

  return { reviewSpineStatement, reviewStressTest, checkChapterSpine };
})();
