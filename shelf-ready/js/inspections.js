/**
 * INSPECTIONS.JS
 * ─────────────────────────────────────────────────────────────
 * Implements inspections from data/INSPECTION_MATRIX.md as real
 * code. Each function takes parsed manuscript data + title/
 * subtitle, returns a finding object or null (null = passed,
 * nothing worth surfacing).
 *
 * This file implements 3 of 10 catalog rows, per the locked
 * "prove the loop before scaling the catalog" decision:
 *   INSP-007 — Filter Word Density       (pure mechanical)
 *   INSP-001 — Book Promise Alignment    (heuristic)
 *   INSP-003 — Chapter Vocabulary Overlap (evidenced proxy)
 *
 * Finding shape:
 * {
 *   inspectionId, category, severity: 'critical'|'important'|'minor'|'informational',
 *   headline, whatWeFound, whyItMatters, recommendation,
 *   evidenceFieldPath (or null if no Compare-with-Author exists)
 * }
 */

const Inspections = (function () {

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

  function wordCount(text) {
    return (text.match(/\S+/g) || []).length;
  }

  // ---- INSP-007: Filter Word Density (Mechanical) ---------------------

  const FILTER_PHRASES = [
    'i felt', 'i noticed', 'i realized', 'i saw', 'i thought', 'i heard',
    'it seemed', 'i could see', 'i could feel', 'i knew'
  ];

  function runFilterWordDensity(manuscript) {
    const fullText = manuscript.chapters.map((c) => c.paragraphs.join(' ')).join(' ').toLowerCase();
    const totalWords = manuscript.rawWordCount || wordCount(fullText);
    if (totalWords === 0) return null;

    let count = 0;
    FILTER_PHRASES.forEach((phrase) => {
      const re = new RegExp(phrase.replace(/'/g, "['\u2019]"), 'g');
      const matches = fullText.match(re);
      if (matches) count += matches.length;
    });

    const density = (count / totalWords) * 1000;

    if (density <= 3) {
      return null; // healthy, nothing to surface
    }

    return {
      inspectionId: 'INSP-007',
      category: 'Writing',
      severity: 'minor',
      headline: 'Filter words run a little high',
      whatWeFound: `Filter words appear about ${density.toFixed(1)} times per 1,000 words (${count} instances total).`,
      whyItMatters: 'Filter words put a narrator between the reader and the experience. "I felt my chest tighten" is one layer removed from "My chest tightened."',
      recommendation: 'Try cutting the filter phrase directly — most sentences read stronger without it.',
      evidenceFieldPath: 'evidence.book01.refine.filterWords'
    };
  }

  // ---- INSP-001: Book Promise Alignment (Heuristic) ---------------------
  // Renamed from "Title Promise Alignment" — the real question is whether
  // the BOOK delivers what the cover promises. Title/subtitle keywords
  // are the evidence used to check this, not the thing being checked.

  function runTitlePromiseAlignment(manuscript, title, subtitle) {
    // Title words and subtitle words are weighted separately. Nonfiction
    // titles conventionally lean metaphorical ("The Invisible Trap"),
    // while subtitles are written to be literal and descriptive ("How to
    // Stop Comparing Yourself..."). Testing against a real example
    // confirmed that treating all words equally lets metaphor-only title
    // words (which never recur literally, by design) drag a healthy
    // subtitle-driven theme down into a false "critical" reading.
    // Subtitle words are the more reliable literal-coverage signal, so
    // they're weighted 2x in the average.
    const titleWords = significantWords(title || '');
    const subtitleWords = significantWords(subtitle || '');
    const allWords = [...new Set([...titleWords, ...subtitleWords])];
    if (allWords.length === 0 || manuscript.chapters.length === 0) return null;

    const totalChapters = manuscript.chapters.length;

    const coverageByWord = allWords.map((word) => {
      const chaptersWithTerm = manuscript.chapters.filter((c) =>
        c.paragraphs.join(' ').toLowerCase().includes(word)
      ).length;
      const coveragePercent = Math.round((chaptersWithTerm / totalChapters) * 100);
      const weight = subtitleWords.includes(word) ? 2 : 1;
      return { word, chaptersWithTerm, coveragePercent, weight };
    });

    const weightedSum = coverageByWord.reduce((sum, w) => sum + w.coveragePercent * w.weight, 0);
    const totalWeight = coverageByWord.reduce((sum, w) => sum + w.weight, 0);
    const avgCoverage = weightedSum / totalWeight;

    const weakest = [...coverageByWord].sort((a, b) => a.coveragePercent - b.coveragePercent)[0];

    let severity;
    if (avgCoverage < 30) severity = 'critical';
    else if (avgCoverage <= 60) severity = 'important';
    else return null;

    return {
      inspectionId: 'INSP-001',
      category: 'Concept',
      severity,
      headline: `Book promise undersupported`,
      whatWeFound: `Your title/subtitle's core promise words average ${Math.round(avgCoverage)}% chapter coverage (subtitle terms weighted more heavily, since titles often use metaphor). "${weakest.word}" is weakest, appearing in ${weakest.chaptersWithTerm} of ${totalChapters} chapters.`,
      whyItMatters: "Readers expect a title's core promise to run through the book, not live in one or two chapters. A low match usually means the title overstates what the book delivers, or the manuscript hasn't fully built out its own premise yet.",
      recommendation: `Either expand the manuscript's treatment of your title's core promise, or revise the title to better match what's actually here.`,
      evidenceFieldPath: 'evidence.book01.refine.bookPromiseAlignment',
      fixRoute: { phase: 'Discover', field: 'Promise', path: 'discover/promise' }
    };
  }

  // ---- INSP-003: Chapter Vocabulary Overlap (Evidenced Proxy) ----------

  function jaccardOverlap(wordsA, wordsB) {
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    if (setA.size === 0 || setB.size === 0) return 0;
    let shared = 0;
    setA.forEach((w) => { if (setB.has(w)) shared++; });
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : shared / union;
  }

  function runChapterOverlap(manuscript) {
    const chapters = manuscript.chapters;
    if (chapters.length < 2) return null;

    const chapterWords = chapters.map((c) => significantWords(c.paragraphs.join(' ')));
    let worst = null;

    // Originally restricted to non-adjacent pairs (i+2 onward) on the
    // assumption that adjacent chapters naturally share transitional
    // vocabulary. Tested against a manuscript with deliberate, genuine
    // repetition between two CONSECUTIVE chapters — the adjacency
    // exclusion silently missed it. The overlap threshold below already
    // filters out normal transitional similarity; an extra adjacency
    // rule on top of it only creates a blind spot. Checking all pairs.
    for (let i = 0; i < chapters.length; i++) {
      for (let j = i + 1; j < chapters.length; j++) {
        const overlap = jaccardOverlap(chapterWords[i], chapterWords[j]);
        if (!worst || overlap > worst.overlap) {
          worst = { overlap, i, j };
        }
      }
    }

    if (!worst || worst.overlap < 0.30) return null;

    const pct = Math.round(worst.overlap * 100);
    const severity = worst.overlap > 0.45 ? 'important' : 'minor';
    const chA = chapters[worst.i].title;
    const chB = chapters[worst.j].title;

    return {
      inspectionId: 'INSP-003',
      category: 'Structure',
      severity,
      headline: `Possible overlap: "${chA}" and "${chB}"`,
      whatWeFound: `"${chA}" and "${chB}" share ${pct}% vocabulary overlap — higher than most chapter pairs in this manuscript.`,
      whyItMatters: "High vocabulary overlap between chapters often means the same idea is being explained twice. This isn't always wrong — but it's worth checking whether one chapter adds something the other doesn't.",
      recommendation: 'Read both chapters back to back. If one doesn\'t add new ground, consider merging or cutting.',
      evidenceFieldPath: 'evidence.book01.refine.chapterOverlap'
    };
  }

  // ---- INSP-011: Absolute Language (Mechanical) -----------------------
  // The honest, buildable version of "Human Reality" — measures a real,
  // countable proxy (frequency of absolute words) and lets the reader
  // draw their own conclusion about nuance, rather than claiming the
  // software can judge whether an idea "feels true to life."

  const ABSOLUTE_WORDS = [
    'always', 'never', 'every', 'everyone', 'everybody', 'all', 'none',
    'nobody', 'must', 'should', 'completely', 'totally', 'absolutely',
    'impossible', 'guaranteed'
  ];

  function runAbsoluteLanguage(manuscript) {
    const fullText = manuscript.chapters.map((c) => c.paragraphs.join(' ')).join(' ').toLowerCase();
    const totalWords = manuscript.rawWordCount || wordCount(fullText);
    if (totalWords === 0) return null;

    let count = 0;
    ABSOLUTE_WORDS.forEach((word) => {
      const re = new RegExp('\\b' + word + '\\b', 'g');
      const matches = fullText.match(re);
      if (matches) count += matches.length;
    });

    const density = (count / totalWords) * 1000;
    if (density <= 4) return null; // healthy, nothing to surface

    return {
      inspectionId: 'INSP-011',
      category: 'Writing',
      severity: 'minor',
      headline: 'Absolute language runs a little high',
      whatWeFound: `Words like "always," "never," and "every" appear about ${density.toFixed(1)} times per 1,000 words (${count} instances total).`,
      whyItMatters: "Readers often resist advice that doesn't leave room for exceptions. Frequent absolutes can make otherwise true observations feel less believable than ones that acknowledge nuance.",
      recommendation: 'Look for a few of these to soften — "often" or "usually" instead of "always" — especially in claims about how people behave.',
      evidenceFieldPath: 'evidence.book01.refine.absoluteLanguage'
    };
  }

  // ---- INSP-012: Pacing Variance (Mechanical Proxy) --------------------
  // Proxy for "where might a reader disengage" — a chapter that's a sharp
  // outlier in sentence/paragraph length from its neighbors is a real,
  // measurable signal, even though "disengagement" itself can't be
  // measured directly. Framed as a question, not a verdict, same as
  // Chapter Overlap.

  function avgSentenceLength(text) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    const totalWords = sentences.reduce((sum, s) => sum + wordCount(s), 0);
    return totalWords / sentences.length;
  }

  function runPacingVariance(manuscript) {
    const chapters = manuscript.chapters;
    if (chapters.length < 3) return null; // need neighbors to compare against

    const metrics = chapters.map((c) => {
      const text = c.paragraphs.join(' ');
      return { avgSentence: avgSentenceLength(text), title: c.title };
    });

    const overallAvg = metrics.reduce((s, m) => s + m.avgSentence, 0) / metrics.length;
    if (overallAvg === 0) return null;

    let worst = null;
    metrics.forEach((m, i) => {
      const ratio = m.avgSentence / overallAvg;
      if (ratio > 1.5 || ratio < 0.6) {
        if (!worst || Math.abs(ratio - 1) > Math.abs(worst.ratio - 1)) {
          worst = { ratio, index: i, title: m.title, avgSentence: m.avgSentence };
        }
      }
    });

    if (!worst) return null;

    const direction = worst.ratio > 1 ? 'longer' : 'shorter';
    const severity = Math.abs(worst.ratio - 1) > 0.8 ? 'minor' : 'informational';

    return {
      inspectionId: 'INSP-012',
      category: 'Writing',
      severity,
      headline: `Pacing shift in "${worst.title}"`,
      whatWeFound: `Sentences in "${worst.title}" average ${worst.avgSentence.toFixed(0)} words — noticeably ${direction} than the rest of the manuscript (overall average: ${overallAvg.toFixed(0)} words).`,
      whyItMatters: "A sharp pacing shift isn't necessarily wrong — but it's one of the places readers most often slow down, skim, or set the book aside, especially if the shift isn't intentional.",
      recommendation: `Read "${worst.title}" back to back with the chapters around it and check whether the pacing change feels deliberate.`,
      evidenceFieldPath: 'evidence.book01.refine.pacingVariance'
    };
  }

  // ---- INSP-013: Commercial Review (merge of subtitle + title checks) --
  // Combines what were separately-specified INSP-002 (Subtitle
  // Specificity) and INSP-005 (Title Memorability) into one review,
  // per the locked decision to package shelf-appeal checks together
  // under a buyer-facing label rather than two separate technical checks.

  const ABSTRACT_SUBTITLE_WORDS = ['success', 'happiness', 'potential', 'growth', 'fulfillment', 'greatness'];
  const GENERIC_TITLE_WORDS = ['invisible', 'success', 'growth', 'potential', 'unstoppable', 'limitless'];
  const EMOTIONAL_TRIGGER_WORDS = ['stop', 'finally', 'without', 'never', 'secret', 'truth', 'real'];

  function runCommercialReview(title, subtitle) {
    if (!title && !subtitle) return null;

    const issues = [];

    // Subtitle specificity check
    if (subtitle) {
      const subWords = wordCount(subtitle);
      const abstractFound = ABSTRACT_SUBTITLE_WORDS.filter((w) => subtitle.toLowerCase().includes(w));
      if (subWords > 16 && abstractFound.length >= 1) {
        issues.push(`Your subtitle is ${subWords} words and includes abstract terms (${abstractFound.join(', ')}) without a concrete qualifier.`);
      }
    }

    // Title memorability check
    if (title) {
      const titleWordCount = wordCount(title);
      const lowerTitle = title.toLowerCase();
      const isGeneric = titleWordCount <= 2 && GENERIC_TITLE_WORDS.some((w) => lowerTitle.includes(w));
      const hasTrigger = EMOTIONAL_TRIGGER_WORDS.some((w) => lowerTitle.includes(w));
      if (isGeneric && !hasTrigger) {
        issues.push(`Your title is short and abstract, with no concrete outcome or emotional trigger word.`);
      }
    }

    if (issues.length === 0) return null;

    return {
      inspectionId: 'INSP-013',
      category: 'Commercial',
      severity: issues.length > 1 ? 'important' : 'minor',
      headline: 'Title/subtitle could be more specific',
      whatWeFound: issues.join(' '),
      whyItMatters: "Readers decide whether a book is 'for them' in seconds. Specific, concrete language is easier to recognize, remember, and search for than abstract phrasing — a real factor in whether a book gets picked up.",
      recommendation: 'Pair abstract words with a concrete outcome — not "build confidence" but "speak up in meetings without rehearsing for three days."',
      evidenceFieldPath: 'evidence.book01.refine.commercialReview',
      fixRoute: { phase: 'Package', field: 'Subtitle', path: 'package/subtitle' }
    };
  }

  /**
   * Scores a SINGLE title candidate (0-3 flags) for relative comparison
   * across multiple candidates — used by Package's Title Candidates
   * screen (PK-1), where the goal is "which of these 5 is strongest"
   * rather than a pass/fail verdict on one title in isolation. Reuses
   * the same word lists as runCommercialReview without duplicating them.
   */
  function scoreTitleCandidate(title) {
    if (!title || !title.trim()) return { title, flagCount: 0, flags: [] };
    const flags = [];
    const titleWordCount = wordCount(title);
    const lowerTitle = title.toLowerCase();
    const isGeneric = titleWordCount <= 2 && GENERIC_TITLE_WORDS.some((w) => lowerTitle.includes(w));
    const hasTrigger = EMOTIONAL_TRIGGER_WORDS.some((w) => lowerTitle.includes(w));
    if (isGeneric && !hasTrigger) flags.push('Short and abstract, no concrete outcome or emotional trigger word.');
    if (titleWordCount > 8) flags.push('Longer than most memorable nonfiction titles — consider trimming.');
    return { title, flagCount: flags.length, flags };
  }

  // ---- INSP-004: Chapter Length Balance (Mechanical) -------------------

  function runChapterLengthBalance(manuscript) {
    const chapters = manuscript.chapters;
    if (chapters.length < 2) return null;

    const mean = chapters.reduce((s, c) => s + c.wordCount, 0) / chapters.length;
    if (mean === 0) return null;

    let worst = null;
    chapters.forEach((c) => {
      const ratio = c.wordCount / mean;
      if (ratio > 2.5 || ratio < 0.4) {
        if (!worst || Math.abs(ratio - 1) > Math.abs(worst.ratio - 1)) {
          worst = { ratio, title: c.title, words: c.wordCount };
        }
      }
    });

    if (!worst) return null;

    return {
      inspectionId: 'INSP-004',
      category: 'Structure',
      severity: 'minor',
      headline: `Chapter length imbalance: "${worst.title}"`,
      whatWeFound: `"${worst.title}" is ${worst.ratio.toFixed(1)}x your average chapter length (${worst.words} words vs. an average of ${Math.round(mean)}).`,
      whyItMatters: "Large imbalances can signal a chapter that's trying to do two jobs, or one that's underdeveloped relative to its place in the book.",
      recommendation: 'Consider whether this chapter should be split, or whether it needs more development to match the book\'s rhythm.',
      evidenceFieldPath: null // no Compare-with-Author planned for this check, per Matrix
    };
  }

  // ---- INSP-006: Reader-Focus Consistency (Mechanical) ------------------

  const AUDIENCE_NOUNS = [
    'entrepreneurs', 'managers', 'parents', 'students', 'professionals',
    'leaders', 'founders', 'consultants', 'employees', 'teachers',
    'writers', 'women', 'men', 'executives', 'freelancers'
  ];

  function runReaderFocusConsistency(manuscript) {
    const fullText = manuscript.chapters.map((c) => c.paragraphs.join(' ')).join(' ').toLowerCase();
    const totalWords = manuscript.rawWordCount || wordCount(fullText);
    if (totalWords === 0) return null;

    // "Meaningful frequency" threshold: appears at least 3 times per 10,000
    // words, to filter out a single passing mention from a real recurring
    // address pattern.
    const detected = AUDIENCE_NOUNS.filter((noun) => {
      const re = new RegExp('\\b' + noun + '\\b', 'g');
      const matches = fullText.match(re);
      const count = matches ? matches.length : 0;
      return (count / totalWords) * 10000 >= 3;
    });

    if (detected.length < 2) return null; // 0 or 1 named audience is healthy

    const severity = detected.length >= 3 ? 'important' : 'minor';

    return {
      inspectionId: 'INSP-006',
      category: 'Reader Experience',
      severity,
      headline: 'Reader focus shifts between audiences',
      whatWeFound: `Your manuscript addresses ${detected.join(', ')} at different points, each with meaningful frequency.`,
      whyItMatters: "Readers decide quickly whether a book is 'for them.' Switching who the book is talking to can make every reader feel like a secondary audience some of the time.",
      recommendation: 'Choose the one reader who matters most, and rewrite passing references to other groups as examples within their story, not as a parallel address.',
      evidenceFieldPath: 'evidence.book01.refine.readerFocus',
      fixRoute: { phase: 'Discover', field: 'Reader', path: 'discover/reader' }
    };
  }

  // ---- INSP-008: Sentence & Paragraph Rhythm (Mechanical) ----------------
  // Distinct from Pacing Variance (INSP-012): this checks the manuscript's
  // OVERALL average against a fixed external readability standard, while
  // Pacing Variance checks each chapter against the BOOK'S OWN average.
  // A manuscript can pass one and fail the other — both signals are real.

  function runSentenceParagraphRhythm(manuscript) {
    const fullText = manuscript.chapters.map((c) => c.paragraphs.join(' ')).join(' ');
    if (!fullText.trim()) return null;

    const avgSentence = avgSentenceLength(fullText);

    const allParagraphs = manuscript.chapters.flatMap((c) => c.paragraphs);
    const avgParagraph = allParagraphs.length
      ? allParagraphs.reduce((s, p) => s + wordCount(p), 0) / allParagraphs.length
      : 0;

    if (avgSentence <= 24 && avgParagraph <= 150) return null;

    return {
      inspectionId: 'INSP-008',
      category: 'Writing',
      severity: 'minor',
      headline: 'Sentences or paragraphs run long',
      whatWeFound: `Average sentence length: ${avgSentence.toFixed(0)} words. Average paragraph length: ${avgParagraph.toFixed(0)} words.`,
      whyItMatters: 'Long unbroken sentences and paragraphs increase reading effort, especially in nonfiction where readers often skim for the point.',
      recommendation: 'Look for sentences over 30 words first — these are usually the easiest to split without losing meaning.',
      evidenceFieldPath: null // no Compare-with-Author planned, per Matrix
    };
  }

  // ---- INSP-009: Introduction Promise-Setting (Heuristic) ----------------

  function runIntroductionPromiseSetting(manuscript, title, subtitle) {
    const intro = manuscript.chapters.find((c) =>
      /^(introduction|preface|foreword|prologue)/i.test(c.title.trim())
    );
    if (!intro) return null; // no introduction detected, nothing to check

    const promiseWords = significantWords((title || '') + ' ' + (subtitle || ''));
    if (promiseWords.length === 0) return null;

    const introText = intro.paragraphs.join(' ').toLowerCase();
    const introWords = wordCount(introText);
    if (introWords === 0) return null;

    const foundWords = promiseWords.filter((w) => textContainsStem(introText, w));

    if (foundWords.length === 0) {
      return {
        inspectionId: 'INSP-009',
        category: 'Reader Experience',
        severity: 'important',
        headline: 'Introduction doesn\'t state the promise',
        whatWeFound: `Your introduction is ${introWords} words. None of your title/subtitle's core promise terms appear within it.`,
        whyItMatters: 'Readers use the introduction to decide whether the book delivers what the cover promised. If the promise doesn\'t show up early, readers may put the book down before reaching the part that does.',
        recommendation: 'Move an explicit statement of the book\'s promise into the first few paragraphs of the introduction.',
        evidenceFieldPath: 'evidence.book01.refine.introPromise',
        fixRoute: { phase: 'Discover', field: 'Promise', path: 'discover/promise' }
      };
    }

    // Check whether the promise appears early (first third) or only late.
    const firstThirdEnd = Math.floor(introText.length / 3);
    const introFirstThird = introText.slice(0, firstThirdEnd);
    const appearsEarly = foundWords.some((w) => introFirstThird.includes(w));

    if (!appearsEarly) {
      return {
        inspectionId: 'INSP-009',
        category: 'Reader Experience',
        severity: 'minor',
        headline: 'Promise appears late in the introduction',
        whatWeFound: `Your introduction is ${introWords} words. Your title's promise terms appear, but only in the later part of the introduction.`,
        whyItMatters: 'Readers use the introduction to decide whether the book delivers what the cover promised. If the promise doesn\'t show up early, readers may put the book down before reaching the part that does.',
        recommendation: 'Consider moving the promise statement earlier in the introduction.',
        evidenceFieldPath: 'evidence.book01.refine.introPromise',
        fixRoute: { phase: 'Discover', field: 'Promise', path: 'discover/promise' }
      };
    }

    return null; // promise present and early — healthy
  }

  // ---- INSP-010: Conclusion Promise-Fulfillment (Heuristic) --------------

  /** Crude stem check: for words 5+ characters, match on a 4-character
   * prefix instead of the exact string, so "building"/"built" or
   * "confidence"/"confident" register as the same underlying concept.
   * Tested and added after a real false-positive: literal substring
   * matching alone flagged a manuscript that clearly reinforced its
   * promise, because "built" didn't literally contain "building." */
  function textContainsStem(text, word) {
    if (text.includes(word)) return true;
    if (word.length >= 5) {
      const stem = word.slice(0, 4);
      const re = new RegExp('\\b' + stem, 'i');
      return re.test(text);
    }
    return false;
  }

  /**
   * Originally also tried to detect "introduces new ideas instead of
   * reinforcing the promise" via word-novelty heuristics (vocabulary
   * absent elsewhere in the manuscript). Four rounds of testing against
   * real conclusions showed this consistently failed in one direction
   * or the other: too strict and it missed a genuine new framework
   * (each term named once); loosened, and it false-flagged ordinary
   * one-off words ("never," "fearless") as fabricated "new ideas."
   *
   * This is the same boundary as the rejected "Human Reality" review:
   * distinguishing a deliberately introduced new concept from ordinary
   * vocabulary variation requires understanding what the words MEAN,
   * not just whether they're statistically novel to this chapter. Per
   * the locked principle — never claim more than the software can
   * honestly demonstrate — this check now ONLY reports promise-term
   * presence, which tested reliably across every case. The new-ideas
   * detection is left out rather than shipped unreliable; it's a
   * candidate for an optional AI-assisted review in a future version,
   * not a rules-engine feature.
   */
  function runConclusionPromiseFulfillment(manuscript, title, subtitle) {
    const conclusion = manuscript.chapters.find((c) =>
      /^(conclusion|afterword|epilogue)/i.test(c.title.trim())
    );
    if (!conclusion) return null;

    const promiseWords = significantWords((title || '') + ' ' + (subtitle || ''));
    const conclusionText = conclusion.paragraphs.join(' ').toLowerCase();
    if (promiseWords.length === 0 || wordCount(conclusionText) === 0) return null;

    const promiseWordsPresent = promiseWords.filter((w) => textContainsStem(conclusionText, w));
    if (promiseWordsPresent.length > 0) return null; // promise present, even partially — healthy

    return {
      inspectionId: 'INSP-010',
      category: 'Reader Experience',
      severity: 'minor',
      headline: 'Conclusion underdelivers on the promise',
      whatWeFound: `None of your title/subtitle's core promise terms appear in your conclusion, even accounting for word variations.`,
      whyItMatters: "A conclusion's job is usually to land the promise the book already built. If the promise doesn't show up here, readers may finish without feeling the payoff they were reading toward.",
      recommendation: 'Make sure your conclusion explicitly returns to the language of your title and subtitle, even if just in the closing paragraph.',
      evidenceFieldPath: 'evidence.book01.refine.conclusionFulfillment',
      fixRoute: { phase: 'Discover', field: 'Promise', path: 'discover/promise' }
    };
  }

  // ---- INSP-014: Passive Voice Density (Mechanical) ---------------------
  // From the Voice Audit research: "was/were" frequency as a countable
  // proxy for passive-voice-heavy, static prose. Genuinely mechanical —
  // a literal word count, no comprehension required.

  function runPassiveVoiceDensity(manuscript) {
    const fullText = manuscript.chapters.map((c) => c.paragraphs.join(' ')).join(' ').toLowerCase();
    const totalWords = manuscript.rawWordCount || wordCount(fullText);
    if (totalWords === 0) return null;

    const wasWereMatches = fullText.match(/\b(was|were)\b/g) || [];
    const density = (wasWereMatches.length / totalWords) * 1000;

    if (density <= 12) return null; // healthy

    const severity = density > 20 ? 'important' : 'minor';

    return {
      inspectionId: 'INSP-014',
      category: 'Writing',
      severity,
      headline: 'Passive voice runs high',
      whatWeFound: `"Was" and "were" appear about ${density.toFixed(1)} times per 1,000 words (${wasWereMatches.length} instances total).`,
      whyItMatters: 'A high rate of "was/were" often signals passive, state-of-being constructions rather than active ones — "the door was opened by her" instead of "she opened the door." Worth a pass to see how many are intentional.',
      recommendation: 'Search for "was [verb]ed" and "were [verb]ed" patterns and rewrite the ones that read more naturally as a direct action.',
      evidenceFieldPath: 'evidence.book01.refine.passiveVoiceDensity'
    };
  }

  // ---- INSP-015: Sentence Opener Repetition (Mechanical) -----------------
  // From the Sentence-Level Stress Test research: if one word starts a
  // large share of sentences, the rhythm reads as monotonous. Counts the
  // first word of every sentence — fully mechanical.

  function runSentenceOpenerRepetition(manuscript) {
    const fullText = manuscript.chapters.map((c) => c.paragraphs.join(' ')).join(' ');
    const sentences = fullText.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (sentences.length < 20) return null; // too small a sample to mean much

    const firstWords = sentences.map((s) => {
      const match = s.match(/^[a-zA-Z']+/);
      return match ? match[0].toLowerCase() : null;
    }).filter(Boolean);

    const counts = {};
    firstWords.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });

    const topWord = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const topShare = counts[topWord] / firstWords.length;

    if (topShare < 0.18) return null; // healthy variety

    const severity = topShare > 0.30 ? 'important' : 'minor';

    return {
      inspectionId: 'INSP-015',
      category: 'Writing',
      severity,
      headline: 'One word opens too many sentences',
      whatWeFound: `"${topWord.charAt(0).toUpperCase() + topWord.slice(1)}" starts about ${Math.round(topShare * 100)}% of sentences in the manuscript.`,
      whyItMatters: 'When one word opens a large share of sentences, the rhythm can start to feel monotonous even if each individual sentence reads fine.',
      recommendation: 'Skim a chapter and try rewriting a few openings — leading with a different part of the sentence breaks the pattern.',
      evidenceFieldPath: 'evidence.book01.refine.sentenceOpenerRepetition'
    };
  }

  // ---- INSP-016: Transition Word Overuse (Mechanical) --------------------
  // From the Sentence-Level Stress Test research: a single transition
  // word (However, Meanwhile, etc.) used repeatedly on the same page
  // reads as a tic. Counts paragraph-starting transition words.

  const TRANSITION_WORDS = ['however', 'meanwhile', 'therefore', 'furthermore', 'moreover', 'consequently', 'nonetheless'];

  function runTransitionOveruse(manuscript) {
    const allParagraphs = manuscript.chapters.flatMap((c) => c.paragraphs);
    if (allParagraphs.length < 10) return null;

    const counts = {};
    allParagraphs.forEach((p) => {
      const firstWord = (p.trim().match(/^[a-zA-Z]+/) || [''])[0].toLowerCase();
      if (TRANSITION_WORDS.includes(firstWord)) {
        counts[firstWord] = (counts[firstWord] || 0) + 1;
      }
    });

    const topWord = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (!topWord) return null;

    const perThousandParagraphs = (counts[topWord] / allParagraphs.length) * 100;
    if (perThousandParagraphs < 3) return null; // rare enough to be fine

    return {
      inspectionId: 'INSP-016',
      category: 'Writing',
      severity: 'minor',
      headline: `"${topWord.charAt(0).toUpperCase() + topWord.slice(1)}" used as a paragraph opener often`,
      whatWeFound: `"${topWord.charAt(0).toUpperCase() + topWord.slice(1)}" opens ${counts[topWord]} paragraphs across the manuscript.`,
      whyItMatters: 'A transition word used often as a paragraph-opener can start to read as a verbal tic, especially formal ones like "however" or "furthermore" in otherwise conversational prose.',
      recommendation: 'Vary the opening — sometimes the connection between paragraphs is clear without naming it.',
      evidenceFieldPath: 'evidence.book01.refine.transitionOveruse'
    };
  }

  // ---- INSP-017: Dialogue Tag Ratio (Mechanical, dialogue only) ----------
  // From the Dialogue Stress Test research: "said" should dominate tags;
  // heavy use of alternatives ("exclaimed," "murmured") reads as
  // distracting. Only fires if dialogue is actually present.

  const SAID_ALTERNATIVES = ['exclaimed', 'murmured', 'whispered', 'shouted', 'snapped', 'retorted', 'declared', 'announced'];

  function runDialogueTagRatio(manuscript) {
    const fullText = manuscript.chapters.map((c) => c.paragraphs.join(' ')).join(' ');
    const saidCount = (fullText.match(/\bsaid\b/gi) || []).length;
    let altCount = 0;
    SAID_ALTERNATIVES.forEach((alt) => {
      altCount += (fullText.match(new RegExp('\\b' + alt + '\\b', 'gi')) || []).length;
    });

    const totalTags = saidCount + altCount;
    if (totalTags < 10) return null; // not enough dialogue to judge meaningfully

    const saidShare = saidCount / totalTags;
    if (saidShare >= 0.70) return null; // healthy, matches the research's stated target

    return {
      inspectionId: 'INSP-017',
      category: 'Writing',
      severity: 'minor',
      headline: '"Said" is a small share of dialogue tags',
      whatWeFound: `"Said" makes up about ${Math.round(saidShare * 100)}% of dialogue tags found (${saidCount} of ${totalTags}).`,
      whyItMatters: 'Readers tend to skip over "said" without noticing it. A high rate of alternatives ("exclaimed," "murmured") can become distracting precisely because each one draws attention to itself.',
      recommendation: 'Consider letting "said" carry more of the dialogue, and reserve distinctive tags for moments that truly need the emphasis.',
      evidenceFieldPath: 'evidence.book01.refine.dialogueTagRatio'
    };
  }

  // ---- INSP-018: Backward Reference Density (Mechanical proxy) ----------
  // From the Spine Stress Test research ("if I delete this chapter, does
  // the next one still make sense"): reframed as a countable proxy — a
  // chapter that frequently references something from earlier ("as we
  // saw," "remember," "earlier in this book") is more likely load-bearing
  // than one that never does. This does NOT judge whether a chapter is
  // filler — it only surfaces which chapters read as self-contained,
  // for the writer to judge.

  const BACKWARD_REFERENCE_PHRASES = ['as we saw', 'as discussed', 'remember', 'earlier in this book', 'as mentioned', 'recall that', 'as we explored'];

  function runBackwardReferenceDensity(manuscript) {
    const chapters = manuscript.chapters;
    if (chapters.length < 4) return null;

    const isolated = [];
    chapters.forEach((c, idx) => {
      if (idx === 0) return; // first chapter has nothing earlier to reference
      const text = c.paragraphs.join(' ').toLowerCase();
      const hasReference = BACKWARD_REFERENCE_PHRASES.some((p) => text.includes(p));
      if (!hasReference) isolated.push(c.title);
    });

    // Only worth surfacing if MOST chapters read as fully self-contained —
    // a book that occasionally has a self-contained chapter is normal;
    // one where almost none connect back is worth a second look.
    const isolatedShare = isolated.length / (chapters.length - 1);
    if (isolatedShare < 0.85) return null;

    return {
      inspectionId: 'INSP-018',
      category: 'Structure',
      severity: 'informational',
      headline: 'Chapters read as largely self-contained',
      whatWeFound: `${isolated.length} of ${chapters.length - 1} chapters (after the first) don't reference anything from earlier in the book.`,
      whyItMatters: "This isn't necessarily a problem — some structures are intentionally modular. But it's worth checking whether each chapter is meant to stand alone, or whether the book is meant to build chapter to chapter.",
      recommendation: 'If the book is meant to build progressively, look for a few natural places to callback to an earlier chapter.',
      evidenceFieldPath: 'evidence.book01.refine.backwardReferenceDensity'
    };
  }

  /**
   * Runs all implemented inspections, returns findings sorted by
   * severity (critical first), filtering out passes (nulls).
   */
  function runAll(manuscript, title, subtitle) {
    const severityRank = { critical: 0, important: 1, minor: 2, informational: 3 };

    // Back matter (Epilogue, About the Author, Acknowledgments, etc.) is
    // excluded from generic content checks — chapter-length balance,
    // overlap, and promise-coverage counting all assume every entry is
    // a real content chapter, and judging a 37-word author bio against
    // the book's average chapter length produces a nonsensical flag.
    // runConclusionPromiseFulfillment specifically searches BY NAME for
    // an Epilogue/Afterword and needs it present, so it still receives
    // the FULL manuscript, not the filtered one.
    const contentOnlyManuscript = Object.assign({}, manuscript, {
      chapters: manuscript.chapters.filter((c) => !c.isBackMatter)
    });

    const findings = [
      runTitlePromiseAlignment(contentOnlyManuscript, title, subtitle),
      runChapterOverlap(contentOnlyManuscript),
      runFilterWordDensity(manuscript),
      runAbsoluteLanguage(manuscript),
      runPacingVariance(contentOnlyManuscript),
      runCommercialReview(title, subtitle),
      runChapterLengthBalance(contentOnlyManuscript),
      runReaderFocusConsistency(manuscript),
      runSentenceParagraphRhythm(manuscript),
      runIntroductionPromiseSetting(contentOnlyManuscript, title, subtitle),
      runConclusionPromiseFulfillment(manuscript, title, subtitle), // needs full list — searches for Epilogue by name
      runPassiveVoiceDensity(manuscript),
      runSentenceOpenerRepetition(manuscript),
      runTransitionOveruse(manuscript),
      runDialogueTagRatio(manuscript),
      runBackwardReferenceDensity(contentOnlyManuscript)
    ].filter(Boolean);

    findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
    return findings;
  }

  return {
    runAll,
    runTitlePromiseAlignment,
    runChapterOverlap,
    runFilterWordDensity,
    runAbsoluteLanguage,
    runPacingVariance,
    runCommercialReview,
    scoreTitleCandidate,
    runChapterLengthBalance,
    runReaderFocusConsistency,
    runSentenceParagraphRhythm,
    runIntroductionPromiseSetting,
    runConclusionPromiseFulfillment,
    runPassiveVoiceDensity,
    runSentenceOpenerRepetition,
    runTransitionOveruse,
    runDialogueTagRatio,
    runBackwardReferenceDensity
  };
})();
