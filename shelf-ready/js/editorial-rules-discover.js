/**
 * EDITORIAL-RULES/DISCOVER.JS
 * ─────────────────────────────────────────────────────────────
 * This file IS the product. Not a form. Not a wrapper around an
 * API. A deterministic editorial engine encoding judgment calls
 * about nonfiction concept/reader/promise/positioning — the kind
 * of feedback an editor gives, expressed as rules instead of prose.
 *
 * Every function here takes the user's raw input and returns:
 *   {
 *     verdict: 'pass' | 'flag',
 *     headline: string,        // the one-line review headline
 *     explanation: string,     // why it matters (editorial voice)
 *     suggestions: string[],   // concrete next move(s), pre-written
 *     confidenceLevel: 'weak' | 'developing' | 'clear'
 *   }
 *
 * No network calls. No LLM calls. Runs instantly, offline, free,
 * forever, on every customer's machine. That's the point.
 */

const DiscoverReview = (function () {

  // ---- shared helpers --------------------------------------------------

  const CHANGE_VERBS = [
    'learn', 'stop', 'build', 'become', 'overcome', 'understand',
    'fix', 'change', 'discover', 'master', 'escape', 'break', 'reclaim',
    'rebuild', 'transform', 'finally', 'without', 'instead of'
  ];

  const BROAD_AUDIENCE_TERMS = [
    'entrepreneurs', 'women', 'men', 'people', 'everyone', 'anyone',
    'readers', 'professionals', 'leaders', 'parents', 'students', 'writers'
  ];

  const VAGUE_PROMISE_PHRASES = [
    'learn confidence', 'be happier', 'understand themselves better',
    'improve their life', 'feel better', 'be more successful',
    'grow as a person', 'become better', 'find happiness'
  ];

  function wordCount(text) {
    return (text.trim().match(/\S+/g) || []).length;
  }

  function sentenceCount(text) {
    const matches = text.trim().match(/[.!?]+(\s|$)/g);
    return matches ? matches.length : (text.trim().length ? 1 : 0);
  }

  function containsAny(text, list) {
    const lower = text.toLowerCase();
    return list.some((term) => lower.includes(term));
  }

  // narrower-reader bank, keyed by detected broad term —
  // pre-written, not generated. This is "your framework", not AI.
  const NARROWING_BANK = {
    entrepreneurs: ['First-time founders', 'Solo consultants', 'Agency owners with 2–10 staff'],
    women: ['Women returning to work after a career break', 'First-generation professionals', 'Women leading teams for the first time'],
    men: ['Men navigating a career change after 40', 'New fathers balancing ambition and presence', 'Men leaving a long corporate career'],
    people: ['People in their first leadership role', 'People rebuilding confidence after a layoff', 'People who keep starting over'],
    everyone: ['Pick one room this book happens in: a workplace, a relationship, a specific life stage'],
    anyone: ['Pick one situation this book is for, not a feeling everyone has sometimes'],
    readers: ['Name the situation your reader is in, not just that they read books'],
    professionals: ['Mid-career professionals feeling stuck', 'New managers who were promoted without training'],
    leaders: ['First-time managers', 'Founders leading a team for the first time'],
    parents: ['Parents of teenagers navigating screen time', 'New parents returning to demanding jobs'],
    students: ['Graduate students facing their first major decision point', 'First-generation college students'],
    writers: ['Writers who have started three books and finished none', 'Nonfiction writers with an outline but no manuscript']
  };

  function findNarrowingExamples(text) {
    const lower = text.toLowerCase();
    for (const term of BROAD_AUDIENCE_TERMS) {
      if (lower.includes(term)) return { term, examples: NARROWING_BANK[term] };
    }
    return null;
  }

  // ---- D2: Concept -------------------------------------------------------

  function reviewConcept(text) {
    text = (text || '').trim();
    if (!text) {
      return { verdict: 'flag', headline: 'Nothing here yet', explanation: '', suggestions: [], confidenceLevel: 'weak' };
    }

    const words = wordCount(text);
    const hasChangeVerb = containsAny(text, CHANGE_VERBS);

    // Originally flagged anything over one sentence as "trying to do too
    // much" — but the question itself was changed to explicitly ask for
    // 50-100 words, which is naturally several sentences. Keeping the old
    // rule would have punished anyone who correctly followed the new
    // instructions. Word-count range is now the real target, matching
    // what the question actually asks for.
    if (words > 130) {
      return {
        verdict: 'flag',
        headline: 'Running long',
        explanation: "This is well past the 50-100 word target. A concept this long usually means several ideas are competing for the same book — readers decide whether to keep reading in far less time than this.",
        suggestions: ['Try cutting this down toward 100 words. Everything else can live in the chapters.'],
        confidenceLevel: 'developing'
      };
    }

    if (words < 25) {
      return {
        verdict: 'flag',
        headline: 'Too thin to test yet',
        explanation: 'Right now this is closer to a single sentence than the 50-100 word concept we\'re looking for. A concept needs enough in it to test against — who it changes, and how.',
        suggestions: ['Add who this is for and what changes for them — aim for 50-100 words total.'],
        confidenceLevel: 'weak'
      };
    }

    if (!hasChangeVerb) {
      return {
        verdict: 'flag',
        headline: 'No transformation yet',
        explanation: "This describes a topic, not a book. Readers don't buy topics — they buy a specific change they're hoping happens to them.",
        suggestions: ['Add a verb of change: stop, build, overcome, finally, without, instead of.'],
        confidenceLevel: 'developing'
      };
    }

    return {
      verdict: 'pass',
      headline: 'Clear starting concept',
      explanation: 'This gives us something to test against in every later decision — title, structure, even the cover.',
      suggestions: [],
      confidenceLevel: 'clear'
    };
  }

  // ---- D3: Reader ---------------------------------------------------------

  function reviewReader(text) {
    text = (text || '').trim();
    if (!text) {
      return { verdict: 'flag', headline: 'Nothing here yet', explanation: '', suggestions: [], confidenceLevel: 'weak' };
    }

    const narrowing = findNarrowingExamples(text);
    const words = wordCount(text);
    const hasQualifier = words > 4;

    if (narrowing && !hasQualifier) {
      return {
        verdict: 'flag',
        headline: 'Too broad',
        explanation: 'Broad audiences usually produce generic books, because the advice has to stay general enough to apply to everyone. A narrow reader lets every chapter get specific — which is what makes advice feel earned instead of obvious.',
        suggestions: [`Try narrowing to one of these, or your own version of one:`, ...narrowing.examples],
        confidenceLevel: 'weak'
      };
    }

    return {
      verdict: 'pass',
      headline: 'This reader will recognize themselves',
      explanation: 'A specific reader makes every later decision easier — title, tone, even which stories you choose to tell.',
      suggestions: [],
      confidenceLevel: 'clear'
    };
  }

  // ---- D4: Promise ---------------------------------------------------------

  function reviewPromise(text) {
    text = (text || '').trim();
    if (!text) {
      return { verdict: 'flag', headline: 'Nothing here yet', explanation: '', suggestions: [], confidenceLevel: 'weak' };
    }

    const lower = text.toLowerCase();
    const isVague = VAGUE_PROMISE_PHRASES.some((p) => lower.includes(p)) || wordCount(text) < 6;

    if (isVague) {
      return {
        verdict: 'flag',
        headline: 'Too vague to test',
        explanation: "A vague promise can't be designed against. A specific promise tells you exactly what every chapter has to earn. \u201CLearn confidence\u201D doesn't tell you what to write. \u201CStop apologizing for taking up space in meetings\u201D does.",
        suggestions: [
          'Weak: ' + (text || 'Learn confidence') + ' — too abstract to write toward.',
          'Better: Name one specific behavior that changes.',
          'Commercial: Name the behavior, who notices it changed, and how fast.'
        ],
        confidenceLevel: 'weak'
      };
    }

    return {
      verdict: 'pass',
      headline: 'This promise can be held to',
      explanation: 'Good — this is specific enough that a reader could tell, afterward, whether the book delivered.',
      suggestions: [],
      confidenceLevel: 'clear'
    };
  }

  // ---- D5: Positioning ------------------------------------------------------

  function reviewPositioning(category, comps) {
    const filledComps = (comps || []).filter((c) => c && c.trim());

    if (!category) {
      return { verdict: 'flag', headline: 'Pick a category first', explanation: '', suggestions: [], confidenceLevel: 'weak' };
    }

    if (filledComps.length < 2) {
      return {
        verdict: 'flag',
        headline: 'Name your real competition',
        explanation: "We can't check that your book stands out next to its actual shelf neighbors until we know who they are.",
        suggestions: ['Name two real, specific books — not the whole genre.'],
        confidenceLevel: 'developing'
      };
    }

    return {
      verdict: 'pass',
      headline: 'Good — now we know your shelf',
      explanation: "Knowing your real shelf neighbors means we can check, later, that your title and cover don't blend in next to them.",
      suggestions: [],
      confidenceLevel: 'developing'
    };
  }

  return { reviewConcept, reviewReader, reviewPromise, reviewPositioning };
})();
