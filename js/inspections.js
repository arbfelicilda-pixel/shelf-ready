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

  /**
   * Finds every literal occurrence of a phrase within a chapter's
   * paragraphs, returning the exact paragraph index and the sentence
   * that contains it — not just a count. This is the located-instance
   * shape every per-chapter check now uses, confirmed needed: a
   * finding that only says "filter words run high" with no chapter,
   * no paragraph, no actual sentence gives a writer nothing to act on.
   */
  function findPhraseInstances(paragraphs, phrases) {
    const instances = [];
    paragraphs.forEach((para, paraIdx) => {
      const sentences = para.split(/(?<=[.!?])\s+/);
      sentences.forEach((sentence) => {
        const lower = sentence.toLowerCase();
        // Confirmed bug, fixed: a sentence containing TWO trigger words
        // ("everyone always does this") was being logged as two separate
        // instances of the identical sentence, one per matched phrase —
        // inflating both the displayed instance count and the density
        // number. Now collects all matched phrases for a sentence first,
        // then logs ONE instance per sentence, regardless of how many
        // phrases matched within it.
        const matchedPhrases = phrases.filter((phrase) => {
          const re = new RegExp(phrase.replace(/'/g, "['\u2019]"));
          return re.test(lower);
        });
        if (matchedPhrases.length > 0) {
          instances.push({ paragraphIndex: paraIdx, sentence: sentence.trim(), matchedPhrases });
        }
      });
    });
    return instances;
  }

  /**
   * Runs Filter Word Density PER CHAPTER, not on the whole manuscript
   * flattened into one blob. Returns one entry per chapter: either a
   * located problem finding (with the exact instances) or a genuine
   * positive finding when the chapter is clean — per the locked
   * decision that silence isn't acknowledgment. A writer needs to be
   * told a clean chapter is clean, not left to guess that "nothing
   * appeared in the report" meant "this part was good."
   */
  function runFilterWordDensity(manuscript) {
    return manuscript.chapters.map((chapter, chapterIdx) => {
      const chapterWords = wordCount(chapter.paragraphs.join(' '));
      if (chapterWords === 0) return null;

      const instances = findPhraseInstances(chapter.paragraphs, FILTER_PHRASES);
      const density = (instances.length / chapterWords) * 1000;

      if (density <= 3) {
        // Genuine positive: low filter-word density is real, checkable
        // evidence the prose stays close to the experience rather than
        // narrated at a remove — not nothing, worth saying explicitly.
        return {
          inspectionId: 'INSP-007',
          category: 'Writing',
          severity: 'good',
          chapterIndex: chapterIdx,
          chapterTitle: chapter.title,
          headline: 'Stays close to the experience',
          whatWeFound: `Filter words ("I felt," "I noticed," etc.) are rare in this chapter — about ${density.toFixed(1)} per 1,000 words.`,
          whyItMatters: 'The prose puts the reader directly in the moment instead of narrating it at a remove. This is worth protecting in any future revision.',
          recommendation: null,
          evidenceFieldPath: 'evidence.book01.refine.filterWords'
        };
      }

      return {
        inspectionId: 'INSP-007',
        category: 'Writing',
        severity: 'minor',
        chapterIndex: chapterIdx,
        chapterTitle: chapter.title,
        headline: 'Filter words run a little high',
        whatWeFound: `Filter words appear about ${density.toFixed(1)} times per 1,000 words in this chapter (${instances.length} instances).`,
        whyItMatters: 'Filter words put a narrator between the reader and the experience. "I felt my chest tighten" is one layer removed from "My chest tightened."',
        recommendation: 'Try cutting the filter phrase directly — most sentences read stronger without it.',
        instances: instances.slice(0, 5), // cap displayed examples, don't overwhelm the screen
        evidenceFieldPath: 'evidence.book01.refine.filterWords'
      };
    }).filter(Boolean);
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
    const flaggedPairs = [];
    let maxOverlap = 0;

    // Checks ALL pairs (not just adjacent ones — see note from the
    // original adjacency-exclusion bug). Now reports EVERY pair above
    // threshold, not just the single worst one — a manuscript can have
    // more than one real overlap problem, and silently dropping all
    // but the worst pair hid that from the writer.
    for (let i = 0; i < chapters.length; i++) {
      for (let j = i + 1; j < chapters.length; j++) {
        const overlap = jaccardOverlap(chapterWords[i], chapterWords[j]);
        if (overlap > maxOverlap) maxOverlap = overlap;
        if (overlap >= 0.30) {
          flaggedPairs.push({ overlap, i, j });
        }
      }
    }

    if (flaggedPairs.length === 0) {
      // Genuine positive: every chapter pair stayed well below the
      // overlap threshold — real, checkable evidence that the chapters
      // are each doing distinct work rather than restating each other.
      return {
        inspectionId: 'INSP-003',
        category: 'Structure',
        severity: 'good',
        chapterIndex: null, // applies to the whole manuscript's structure, not one chapter
        chapterTitle: null,
        headline: 'Chapters stay well-differentiated',
        whatWeFound: `The highest vocabulary overlap between any two chapters is ${Math.round(maxOverlap * 100)}% — well within the range expected for chapters covering genuinely different ground.`,
        whyItMatters: "This is real evidence each chapter is pulling its own weight rather than restating an earlier one. Worth protecting if you revise.",
        recommendation: null,
        evidenceFieldPath: 'evidence.book01.refine.chapterOverlap'
      };
    }

    return flaggedPairs.map(({ overlap, i, j }) => {
      const pct = Math.round(overlap * 100);
      const severity = overlap > 0.45 ? 'important' : 'minor';
      const chA = chapters[i].title;
      const chB = chapters[j].title;
      return {
        inspectionId: 'INSP-003',
        category: 'Structure',
        severity,
        // This is a relationship between TWO chapters, not one — both
        // indices are recorded honestly rather than arbitrarily
        // attributing the finding to just one of them.
        chapterIndex: i,
        secondChapterIndex: j,
        chapterTitle: chA,
        secondChapterTitle: chB,
        headline: `Possible overlap: "${chA}" and "${chB}"`,
        whatWeFound: `"${chA}" and "${chB}" share ${pct}% vocabulary overlap — higher than most chapter pairs in this manuscript.`,
        whyItMatters: "High vocabulary overlap between chapters often means the same idea is being explained twice. This isn't always wrong — but it's worth checking whether one chapter adds something the other doesn't.",
        recommendation: 'Read both chapters back to back. If one doesn\'t add new ground, consider merging or cutting.',
        evidenceFieldPath: 'evidence.book01.refine.chapterOverlap'
      };
    });
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
    return manuscript.chapters.map((chapter, chapterIdx) => {
      const chapterWords = wordCount(chapter.paragraphs.join(' '));
      if (chapterWords === 0) return null;

      const instances = findPhraseInstances(
        chapter.paragraphs,
        ABSOLUTE_WORDS.map((w) => '\\b' + w + '\\b')
      );
      const density = (instances.length / chapterWords) * 1000;

      if (density <= 4) {
        return {
          inspectionId: 'INSP-011',
          category: 'Writing',
          severity: 'good',
          chapterIndex: chapterIdx,
          chapterTitle: chapter.title,
          headline: 'Leaves room for nuance',
          whatWeFound: `Absolute words ("always," "never," "every") are rare in this chapter — about ${density.toFixed(1)} per 1,000 words.`,
          whyItMatters: 'Claims that leave room for exceptions tend to land as more credible. Worth protecting in revision.',
          recommendation: null,
          evidenceFieldPath: 'evidence.book01.refine.absoluteLanguage'
        };
      }

      return {
        inspectionId: 'INSP-011',
        category: 'Writing',
        severity: 'minor',
        chapterIndex: chapterIdx,
        chapterTitle: chapter.title,
        headline: 'Absolute language runs a little high',
        whatWeFound: `Words like "always," "never," and "every" appear about ${density.toFixed(1)} times per 1,000 words in this chapter (${instances.length} instances).`,
        whyItMatters: "Readers often resist advice that doesn't leave room for exceptions. Frequent absolutes can make otherwise true observations feel less believable than ones that acknowledge nuance.",
        recommendation: 'Look for a few of these to soften — "often" or "usually" instead of "always" — especially in claims about how people behave.',
        instances: instances.slice(0, 5),
        evidenceFieldPath: 'evidence.book01.refine.absoluteLanguage'
      };
    }).filter(Boolean);
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

    const metrics = chapters.map((c, idx) => {
      const text = c.paragraphs.join(' ');
      return { avgSentence: avgSentenceLength(text), title: c.title, index: idx };
    });

    const overallAvg = metrics.reduce((s, m) => s + m.avgSentence, 0) / metrics.length;
    if (overallAvg === 0) return null;

    const outliers = metrics.filter((m) => {
      const ratio = m.avgSentence / overallAvg;
      return ratio > 1.5 || ratio < 0.6;
    });

    if (outliers.length === 0) {
      return {
        inspectionId: 'INSP-012',
        category: 'Writing',
        severity: 'good',
        chapterIndex: null,
        chapterTitle: null,
        headline: 'Pacing stays consistent',
        whatWeFound: `Sentence length across all chapters stays close to the manuscript's overall average (${overallAvg.toFixed(0)} words), with no sharp outliers.`,
        whyItMatters: 'Consistent pacing means a reader is less likely to hit an unexpected drag or rush. Worth protecting in revision.',
        recommendation: null,
        evidenceFieldPath: 'evidence.book01.refine.pacingVariance'
      };
    }

    return outliers.map((m) => {
      const ratio = m.avgSentence / overallAvg;
      const direction = ratio > 1 ? 'longer' : 'shorter';
      const severity = Math.abs(ratio - 1) > 0.8 ? 'minor' : 'informational';
      return {
        inspectionId: 'INSP-012',
        category: 'Writing',
        severity,
        chapterIndex: m.index,
        chapterTitle: m.title,
        headline: `Pacing shift in "${m.title}"`,
        whatWeFound: `Sentences in "${m.title}" average ${m.avgSentence.toFixed(0)} words — noticeably ${direction} than the rest of the manuscript (overall average: ${overallAvg.toFixed(0)} words).`,
        whyItMatters: "A sharp pacing shift isn't necessarily wrong — but it's one of the places readers most often slow down, skim, or set the book aside, especially if the shift isn't intentional.",
        recommendation: `Read "${m.title}" back to back with the chapters around it and check whether the pacing change feels deliberate.`,
        evidenceFieldPath: 'evidence.book01.refine.pacingVariance'
      };
    });
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

    const outliers = [];
    chapters.forEach((c, idx) => {
      const ratio = c.wordCount / mean;
      if (ratio > 2.5 || ratio < 0.4) {
        outliers.push({ ratio, title: c.title, words: c.wordCount, index: idx });
      }
    });

    if (outliers.length === 0) {
      return {
        inspectionId: 'INSP-004',
        category: 'Structure',
        severity: 'good',
        chapterIndex: null,
        chapterTitle: null,
        headline: 'Chapter lengths are balanced',
        whatWeFound: `Every chapter stays within a reasonable range of the manuscript's average length (${Math.round(mean)} words), with no sharp outliers.`,
        whyItMatters: 'Balanced chapter lengths usually mean each one is doing roughly the same amount of structural work. Worth protecting in revision.',
        recommendation: null,
        evidenceFieldPath: null
      };
    }

    return outliers.map((o) => ({
      inspectionId: 'INSP-004',
      category: 'Structure',
      severity: 'minor',
      chapterIndex: o.index,
      chapterTitle: o.title,
      headline: `Chapter length imbalance: "${o.title}"`,
      whatWeFound: `"${o.title}" is ${o.ratio.toFixed(1)}x your average chapter length (${o.words} words vs. an average of ${Math.round(mean)}).`,
      whyItMatters: "Large imbalances can signal a chapter that's trying to do two jobs, or one that's underdeveloped relative to its place in the book.",
      recommendation: 'Consider whether this chapter should be split, or whether it needs more development to match the book\'s rhythm.',
      evidenceFieldPath: null // no Compare-with-Author planned for this check, per Matrix
    }));
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

    // This verdict only makes sense as a whole-manuscript pattern (one
    // chapter mentioning "managers" once isn't a problem on its own),
    // but a writer still needs to know WHERE each detected audience
    // term actually shows up — not just the abstract claim. Adding a
    // per-chapter breakdown of which detected nouns appear in which
    // chapter, so the finding has real locations behind it.
    const byChapter = manuscript.chapters.map((c) => {
      const chapterText = c.paragraphs.join(' ').toLowerCase();
      const foundHere = detected.filter((noun) => new RegExp('\\b' + noun + '\\b').test(chapterText));
      return { chapterTitle: c.title, audiences: foundHere };
    }).filter((entry) => entry.audiences.length > 0);

    const severity = detected.length >= 3 ? 'important' : 'minor';

    return {
      inspectionId: 'INSP-006',
      category: 'Reader Experience',
      severity,
      chapterIndex: null, // a manuscript-wide pattern, not one chapter's fault
      chapterTitle: null,
      headline: 'Reader focus shifts between audiences',
      whatWeFound: `Your manuscript addresses ${detected.join(', ')} at different points, each with meaningful frequency.`,
      whyItMatters: "Readers decide quickly whether a book is 'for them.' Switching who the book is talking to can make every reader feel like a secondary audience some of the time.",
      recommendation: 'Choose the one reader who matters most, and rewrite passing references to other groups as examples within their story, not as a parallel address.',
      perChapterBreakdown: byChapter,
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
    return manuscript.chapters.map((chapter, chapterIdx) => {
      const chapterWords = wordCount(chapter.paragraphs.join(' '));
      if (chapterWords === 0) return null;

      const instances = findPhraseInstances(chapter.paragraphs, ['\\bwas\\b', '\\bwere\\b']);
      const density = (instances.length / chapterWords) * 1000;

      if (density <= 12) {
        return {
          inspectionId: 'INSP-014',
          category: 'Writing',
          severity: 'good',
          chapterIndex: chapterIdx,
          chapterTitle: chapter.title,
          headline: 'Mostly active voice',
          whatWeFound: `"Was" and "were" stay low in this chapter — about ${density.toFixed(1)} per 1,000 words.`,
          whyItMatters: 'Active constructions tend to read with more immediacy than passive ones. Worth protecting in revision.',
          recommendation: null,
          evidenceFieldPath: 'evidence.book01.refine.passiveVoiceDensity'
        };
      }

      const severity = density > 20 ? 'important' : 'minor';
      return {
        inspectionId: 'INSP-014',
        category: 'Writing',
        severity,
        chapterIndex: chapterIdx,
        chapterTitle: chapter.title,
        headline: 'Passive voice runs high',
        whatWeFound: `"Was" and "were" appear about ${density.toFixed(1)} times per 1,000 words in this chapter (${instances.length} instances).`,
        whyItMatters: 'A high rate of "was/were" often signals passive, state-of-being constructions rather than active ones — "the door was opened by her" instead of "she opened the door." Worth a pass to see how many are intentional.',
        recommendation: 'Search for "was [verb]ed" and "were [verb]ed" patterns and rewrite the ones that read more naturally as a direct action.',
        instances: instances.slice(0, 5),
        evidenceFieldPath: 'evidence.book01.refine.passiveVoiceDensity'
      };
    }).filter(Boolean);
  }

  // ---- INSP-015: Sentence Opener Repetition (Mechanical) -----------------
  // From the Sentence-Level Stress Test research: if one word starts a
  // large share of sentences, the rhythm reads as monotonous. Counts the
  // first word of every sentence — fully mechanical.

  function runSentenceOpenerRepetition(manuscript) {
    return manuscript.chapters.map((chapter, chapterIdx) => {
      const text = chapter.paragraphs.join(' ');
      const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
      if (sentences.length < 20) return null; // too small a sample to mean much

      const firstWords = sentences.map((s) => {
        const match = s.match(/^[a-zA-Z']+/);
        return match ? match[0].toLowerCase() : null;
      }).filter(Boolean);

      const counts = {};
      firstWords.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });

      const topWord = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      const topShare = counts[topWord] / firstWords.length;

      if (topShare < 0.18) {
        return {
          inspectionId: 'INSP-015',
          category: 'Writing',
          severity: 'good',
          chapterIndex: chapterIdx,
          chapterTitle: chapter.title,
          headline: 'Sentence openings stay varied',
          whatWeFound: `No single word dominates how sentences start in this chapter (most frequent: "${topWord}" at ${Math.round(topShare * 100)}%).`,
          whyItMatters: 'Varied sentence openings tend to keep rhythm from feeling monotonous. Worth protecting in revision.',
          recommendation: null,
          evidenceFieldPath: 'evidence.book01.refine.sentenceOpenerRepetition'
        };
      }

      const severity = topShare > 0.30 ? 'important' : 'minor';
      return {
        inspectionId: 'INSP-015',
        category: 'Writing',
        severity,
        chapterIndex: chapterIdx,
        chapterTitle: chapter.title,
        headline: 'One word opens too many sentences',
        whatWeFound: `"${topWord.charAt(0).toUpperCase() + topWord.slice(1)}" starts about ${Math.round(topShare * 100)}% of sentences in this chapter.`,
        whyItMatters: 'When one word opens a large share of sentences, the rhythm can start to feel monotonous even if each individual sentence reads fine.',
        recommendation: 'Try rewriting a few openings — leading with a different part of the sentence breaks the pattern.',
        evidenceFieldPath: 'evidence.book01.refine.sentenceOpenerRepetition'
      };
    }).filter(Boolean);
  }

  // ---- INSP-016: Transition Word Overuse (Mechanical) --------------------
  // From the Sentence-Level Stress Test research: a single transition
  // word (However, Meanwhile, etc.) used repeatedly on the same page
  // reads as a tic. Counts paragraph-starting transition words.

  const TRANSITION_WORDS = ['however', 'meanwhile', 'therefore', 'furthermore', 'moreover', 'consequently', 'nonetheless'];

  function runTransitionOveruse(manuscript) {
    return manuscript.chapters.map((chapter, chapterIdx) => {
      const paragraphs = chapter.paragraphs;
      if (paragraphs.length < 10) return null; // too few paragraphs to mean much

      const counts = {};
      paragraphs.forEach((p) => {
        const firstWord = (p.trim().match(/^[a-zA-Z]+/) || [''])[0].toLowerCase();
        if (TRANSITION_WORDS.includes(firstWord)) {
          counts[firstWord] = (counts[firstWord] || 0) + 1;
        }
      });

      const topWord = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      const perThousandParagraphs = topWord ? (counts[topWord] / paragraphs.length) * 100 : 0;

      if (!topWord || perThousandParagraphs < 3) {
        return {
          inspectionId: 'INSP-016',
          category: 'Writing',
          severity: 'good',
          chapterIndex: chapterIdx,
          chapterTitle: chapter.title,
          headline: 'Transitions stay varied',
          whatWeFound: 'No single transition word is overused as a paragraph opener in this chapter.',
          whyItMatters: 'Varied transitions tend to feel more natural than a repeated structural tic. Worth protecting in revision.',
          recommendation: null,
          evidenceFieldPath: 'evidence.book01.refine.transitionOveruse'
        };
      }

      return {
        inspectionId: 'INSP-016',
        category: 'Writing',
        severity: 'minor',
        chapterIndex: chapterIdx,
        chapterTitle: chapter.title,
        headline: `"${topWord.charAt(0).toUpperCase() + topWord.slice(1)}" used as a paragraph opener often`,
        whatWeFound: `"${topWord.charAt(0).toUpperCase() + topWord.slice(1)}" opens ${counts[topWord]} paragraphs in this chapter.`,
        whyItMatters: 'A transition word used often as a paragraph-opener can start to read as a verbal tic, especially formal ones like "however" or "furthermore" in otherwise conversational prose.',
        recommendation: 'Vary the opening — sometimes the connection between paragraphs is clear without naming it.',
        evidenceFieldPath: 'evidence.book01.refine.transitionOveruse'
      };
    }).filter(Boolean);
  }

  // ---- INSP-017: Dialogue Tag Ratio (Mechanical, dialogue only) ----------
  // From the Dialogue Stress Test research: "said" should dominate tags;
  // heavy use of alternatives ("exclaimed," "murmured") reads as
  // distracting. Only fires if dialogue is actually present.

  const SAID_ALTERNATIVES = ['exclaimed', 'murmured', 'whispered', 'shouted', 'snapped', 'retorted', 'declared', 'announced'];

  function runDialogueTagRatio(manuscript) {
    return manuscript.chapters.map((chapter, chapterIdx) => {
      const text = chapter.paragraphs.join(' ');
      const saidCount = (text.match(/\bsaid\b/gi) || []).length;
      let altCount = 0;
      SAID_ALTERNATIVES.forEach((alt) => {
        altCount += (text.match(new RegExp('\\b' + alt + '\\b', 'gi')) || []).length;
      });

      const totalTags = saidCount + altCount;
      // Not enough dialogue in THIS chapter to judge meaningfully — a
      // genuinely correct skip, not a missed problem. A chapter with 3
      // dialogue tags doesn't have enough data for a real ratio.
      if (totalTags < 10) return null;

      const saidShare = saidCount / totalTags;
      if (saidShare >= 0.70) {
        return {
          inspectionId: 'INSP-017',
          category: 'Writing',
          severity: 'good',
          chapterIndex: chapterIdx,
          chapterTitle: chapter.title,
          headline: '"Said" carries most of the dialogue',
          whatWeFound: `"Said" makes up about ${Math.round(saidShare * 100)}% of dialogue tags in this chapter.`,
          whyItMatters: 'Readers tend to skip over "said" without noticing it, letting the dialogue itself carry the scene. Worth protecting in revision.',
          recommendation: null,
          evidenceFieldPath: 'evidence.book01.refine.dialogueTagRatio'
        };
      }

      return {
        inspectionId: 'INSP-017',
        category: 'Writing',
        severity: 'minor',
        chapterIndex: chapterIdx,
        chapterTitle: chapter.title,
        headline: '"Said" is a small share of dialogue tags',
        whatWeFound: `"Said" makes up about ${Math.round(saidShare * 100)}% of dialogue tags in this chapter (${saidCount} of ${totalTags}).`,
        whyItMatters: 'Readers tend to skip over "said" without noticing it. A high rate of alternatives ("exclaimed," "murmured") can become distracting precisely because each one draws attention to itself.',
        recommendation: 'Consider letting "said" carry more of the dialogue, and reserve distinctive tags for moments that truly need the emphasis.',
        evidenceFieldPath: 'evidence.book01.refine.dialogueTagRatio'
      };
    }).filter(Boolean);
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
      if (!hasReference) isolated.push({ title: c.title, index: idx });
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
      chapterIndex: null, // an aggregate pattern across the manuscript, not one chapter
      chapterTitle: null,
      headline: 'Chapters read as largely self-contained',
      whatWeFound: `${isolated.length} of ${chapters.length - 1} chapters (after the first) don't reference anything from earlier in the book.`,
      whyItMatters: "This isn't necessarily a problem — some structures are intentionally modular. But it's worth checking whether each chapter is meant to stand alone, or whether the book is meant to build chapter to chapter.",
      recommendation: 'If the book is meant to build progressively, look for a few natural places to callback to an earlier chapter.',
      isolatedChapters: isolated, // the actual named chapters behind the aggregate count
      evidenceFieldPath: 'evidence.book01.refine.backwardReferenceDensity'
    };
  }

  /**
   * Runs all implemented inspections, returns findings sorted by
   * severity (critical first), filtering out passes (nulls).
   */
  function runAll(manuscript, title, subtitle) {
    // 'good' sorts after informational — positive findings are useful
    // to see, but a Critical/Important/Minor problem should never be
    // pushed below a "this works, keep it" note in the default view.
    const severityRank = { critical: 0, important: 1, minor: 2, informational: 3, good: 4 };

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

    const rawResults = [
      runTitlePromiseAlignment(contentOnlyManuscript, title, subtitle),
      runChapterOverlap(contentOnlyManuscript),
      runFilterWordDensity(contentOnlyManuscript),
      runAbsoluteLanguage(contentOnlyManuscript),
      runPacingVariance(contentOnlyManuscript),
      runCommercialReview(title, subtitle),
      runChapterLengthBalance(contentOnlyManuscript),
      runReaderFocusConsistency(contentOnlyManuscript),
      runSentenceParagraphRhythm(contentOnlyManuscript),
      runIntroductionPromiseSetting(contentOnlyManuscript, title, subtitle),
      runConclusionPromiseFulfillment(manuscript, title, subtitle), // needs full list — searches for Epilogue by name
      runPassiveVoiceDensity(contentOnlyManuscript),
      runSentenceOpenerRepetition(contentOnlyManuscript),
      runTransitionOveruse(contentOnlyManuscript),
      runDialogueTagRatio(contentOnlyManuscript),
      runBackwardReferenceDensity(contentOnlyManuscript)
    ];

    // Mid-conversion to per-chapter reporting: some checks now return
    // an ARRAY (one entry per chapter, like runFilterWordDensity),
    // others still return a single object or null. Flatten both shapes
    // into one flat findings list rather than require every check to
    // be converted in the same pass — lets each check be rebuilt and
    // tested individually instead of all at once.
    const findings = rawResults.reduce((acc, result) => {
      if (Array.isArray(result)) return acc.concat(result);
      if (result) acc.push(result);
      return acc;
    }, []);

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
