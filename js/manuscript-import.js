/**
 * MANUSCRIPT-IMPORT.JS
 * ─────────────────────────────────────────────────────────────
 * Parses an uploaded .docx/.txt file into structured chapters.
 * Built and tuned against a deliberately messy test file (mixed
 * heading styles — see /tmp/test-manuscript.docx during dev) so
 * the fallback path isn't theoretical.
 *
 * Detection strategy, in priority order:
 *   1. Real heading styles (h1/h2 from mammoth) — high confidence.
 *   2. Fallback pattern match on bold/large paragraph text that
 *      looks like a chapter title ("Chapter N", "Chapter One",
 *      ALL CAPS short line) — medium confidence, flagged for review.
 *   3. Anything left unsegmented — low confidence, flagged.
 *
 * This module NEVER claims certainty it doesn't have. Every
 * chapter gets a confidence level the Book Preview screen uses
 * to decide whether to show "we're not completely sure."
 */

const ManuscriptImport = (function () {

  const NUMBER_WORDS = 'one|two|three|four|five|six|seven|eight|nine|ten|' +
    'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';

  // Two separate tiers, matching how Kindle/real books actually nest
  // structure: PART groups CHAPTERS, and a chapter's number marker
  // ("CHAPTER ONE") is very often its own line, with the chapter's
  // real title ("The First Thing We Trust") as a SEPARATE line right
  // after it — not one combined line. The original version only
  // matched a single combined line and only matched digit numbers for
  // Part ("Part 1", never "PART ONE"), which a real test manuscript
  // with spelled-out numbers and a two-line chapter header exposed.
  const PART_PATTERNS = [
    /^part\s+\d+/i,
    new RegExp('^part\\s+(' + NUMBER_WORDS + ')\\b', 'i'),
    /^book\s+\d+/i,
    new RegExp('^book\\s+(' + NUMBER_WORDS + ')\\b', 'i'),
  ];

  const CHAPTER_MARKER_PATTERNS = [
    /^chapter\s+\d+/i,
    new RegExp('^chapter\\s+(' + NUMBER_WORDS + ')\\b', 'i'),
    /^\d+\.\s*$/, // a bare "1." on its own line
    /^\d+\.\s+\S/, // "1. Some Title" combined on one line
  ];

  const FRONT_MATTER_HEADINGS = /^(introduction|preface|foreword|prologue)$/i;
  const BACK_MATTER_HEADINGS = /^(conclusion|afterword|epilogue|references|bibliography|appendix|acknowledgments|about the author)/i;

  function isPartMarker(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 40) return false;
    return PART_PATTERNS.some((re) => re.test(trimmed));
  }

  /**
   * A "bare chapter marker" is a short line that's JUST the chapter
   * number ("CHAPTER ONE", "Chapter 3", "7.") with no title attached
   * on the same line. This is distinct from a combined heading like
   * "Chapter 3: The Reckoning" — bare markers need to look at the
   * NEXT line for the real title, which the original version never
   * did at all.
   */
  function isBareChapterMarker(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 30) return false;
    if (/^\d+\.\s+\S/.test(trimmed)) return false; // "1. Title" is combined, not bare
    return CHAPTER_MARKER_PATTERNS.some((re) => re.test(trimmed)) &&
      !/[a-z]{4,}/.test(trimmed.replace(/^chapter\s+\w+/i, '').trim()); // nothing but the marker itself
  }

  function looksLikeChapterHeading(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 80) return false; // headings are short
    if (CHAPTER_MARKER_PATTERNS.some((re) => re.test(trimmed))) return true;
    if (FRONT_MATTER_HEADINGS.test(trimmed) || BACK_MATTER_HEADINGS.test(trimmed)) return true;
    // ALL CAPS short line, no terminal punctuation — looks like a heading
    if (trimmed === trimmed.toUpperCase() && trimmed.length < 60 && !/[.!?]$/.test(trimmed)) return true;
    return false;
  }

  /**
   * Parses mammoth's HTML output into a flat list of "blocks":
   * { type: 'part'|'heading'|'paragraph', text, level, confidence }
   *
   * Two real fixes over the original version, both driven by a real
   * test manuscript that exposed them:
   *   1. "PART ONE" (spelled-out number) is now its own block type,
   *      separate from chapters — it groups chapters, it isn't one.
   *   2. A bare chapter marker line ("CHAPTER ONE" with nothing else
   *      on that line) is merged with whatever text comes immediately
   *      after it into ONE heading ("Chapter One: The First Thing We
   *      Trust") — the original only ever looked at one line at a
   *      time and had no way to attach a marker to its title.
   */
  function parseBlocks(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    const rawBlocks = [];

    container.childNodes.forEach((node) => {
      if (node.nodeType !== 1) return; // skip text nodes
      const tag = node.tagName.toLowerCase();
      const text = node.textContent.trim();
      if (!text) return;

      if (tag === 'h1' || tag === 'h2') {
        rawBlocks.push({ type: 'heading', text, level: tag, confidence: 'high' });
        return;
      }

      if (tag === 'p') {
        const onlyChild = node.children.length === 1 ? node.children[0] : null;
        const isFullyBold =
          onlyChild &&
          onlyChild.tagName.toLowerCase() === 'strong' &&
          onlyChild.textContent.trim() === text;
        const isEmphasized = isFullyBold || (onlyChild && onlyChild.tagName.toLowerCase() === 'em');

        if (isPartMarker(text)) {
          rawBlocks.push({ type: 'part', text, level: 'fallback', confidence: 'medium' });
          return;
        }

        if (isEmphasized && isBareChapterMarker(text)) {
          rawBlocks.push({ type: 'bare-chapter-marker', text, level: 'fallback', confidence: 'medium' });
          return;
        }
        if (isBareChapterMarker(text)) {
          rawBlocks.push({ type: 'bare-chapter-marker', text, level: 'fallback', confidence: 'low' });
          return;
        }

        if (isEmphasized && looksLikeChapterHeading(text)) {
          rawBlocks.push({ type: 'heading', text, level: 'fallback', confidence: 'medium' });
          return;
        }

        if (looksLikeChapterHeading(text)) {
          rawBlocks.push({ type: 'heading', text, level: 'fallback', confidence: 'low' });
          return;
        }

        rawBlocks.push({ type: 'paragraph', text, confidence: 'high' });
        return;
      }
    });

    // Second pass: merge any "bare-chapter-marker" with the very next
    // block's text (assumed to be the chapter's real title) into a
    // single combined heading. If a bare marker is immediately followed
    // by ANOTHER heading/part/marker (no title line in between), it's
    // left standing on its own rather than merged with unrelated content.
    const blocks = [];
    for (let i = 0; i < rawBlocks.length; i++) {
      const block = rawBlocks[i];
      if (block.type === 'bare-chapter-marker') {
        const next = rawBlocks[i + 1];
        const nextIsPlainTitleLine = next && next.type === 'paragraph' && next.text.length < 100;
        if (nextIsPlainTitleLine) {
          blocks.push({
            type: 'heading',
            text: block.text + ': ' + next.text,
            level: block.level,
            confidence: block.confidence
          });
          i++; // consume the title line too, it's now part of this heading
          continue;
        }
        // No title line follows — keep the bare marker as its own heading
        // rather than silently dropping it.
        blocks.push({ type: 'heading', text: block.text, level: block.level, confidence: block.confidence });
        continue;
      }
      blocks.push(block);
    }

    return blocks;
  }

  /**
   * Groups blocks into chapters. The first block(s) before any
   * detected heading become a synthetic "Front Matter" bucket
   * (title page, epigraph, etc.) rather than silently discarded.
   * Part markers ("PART ONE") are NOT chapter boundaries — they're
   * tracked separately and attached to each chapter that falls under
   * them, so a chapter's title can be shown alongside its part.
   */
  function groupIntoChapters(blocks) {
    const chapters = [];
    let current = null;
    let currentPart = null;
    let seenHighConfidenceHeading = false;

    // Gate opens (stops treating things as front matter) once we've
    // seen EITHER a real heading OR a Part marker — testing showed
    // gating on "first heading" alone still swallowed a real chapter
    // section ("LOOK AT IT") because it happened to be the first
    // heading-TYPE block, even though a Part marker had already
    // appeared before it and should have already signaled "real
    // structure has started here."
    let structureHasStarted = false;

    blocks.forEach((block) => {
      if (block.type === 'part') {
        currentPart = block.text;
        structureHasStarted = true;
        return; // a Part marker never starts/ends a chapter on its own
      }

      if (block.type === 'heading') {
        const isLikelyTitlePageLine = block.confidence !== 'high' && !structureHasStarted && !seenHighConfidenceHeading;
        structureHasStarted = true;

        if (isLikelyTitlePageLine) {
          if (!current) {
            current = { title: 'Front Matter', confidence: 'high', paragraphs: [], wordCount: 0, isFrontMatter: true };
          }
          current.paragraphs.push(block.text);
          current.wordCount += (block.text.match(/\S+/g) || []).length;
          return;
        }

        if (block.confidence === 'high') seenHighConfidenceHeading = true;
        if (current) chapters.push(current);
        current = {
          title: block.text,
          part: currentPart,
          confidence: block.confidence,
          paragraphs: [],
          wordCount: 0
        };
      } else {
        if (!current) {
          current = { title: 'Front Matter', confidence: 'high', paragraphs: [], wordCount: 0, isFrontMatter: true };
        }
        current.paragraphs.push(block.text);
        current.wordCount += (block.text.match(/\S+/g) || []).length;
      }
    });
    if (current) chapters.push(current);

    return chapters;
  }

  /**
   * Overall import confidence: if any chapter was detected via a
   * fallback (medium/low) pattern rather than a real heading style,
   * the whole import is flagged as "not completely sure" — this
   * drives the Book Preview screen's disclosure banner.
   */
  function computeOverallConfidence(chapters) {
    const nonFrontMatter = chapters.filter((c) => !c.isFrontMatter);
    const hasLowConfidence = nonFrontMatter.some((c) => c.confidence === 'low');
    const hasMediumConfidence = nonFrontMatter.some((c) => c.confidence === 'medium');
    if (hasLowConfidence) return 'low';
    if (hasMediumConfidence) return 'medium';
    return 'high';
  }

  /**
   * Public entry point. Takes a File object (from an <input type="file">
   * or drag-drop event), returns a Promise resolving to:
   * { chapters: [...], overallConfidence, rawWordCount, title, subtitle }
   */
  async function importDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const blocks = parseBlocks(result.value);
    const chapters = groupIntoChapters(blocks);
    const overallConfidence = computeOverallConfidence(chapters);

    // Title/subtitle heuristic: first two non-empty lines of front matter,
    // if front matter exists and looks like a title block (short lines).
    let title = '';
    let subtitle = '';
    const front = chapters.find((c) => c.isFrontMatter);
    if (front && front.paragraphs.length) {
      if (front.paragraphs[0] && front.paragraphs[0].length < 100) title = front.paragraphs[0];
      if (front.paragraphs[1] && front.paragraphs[1].length < 150) subtitle = front.paragraphs[1];
    }

    const rawWordCount = chapters.reduce((sum, c) => sum + c.wordCount, 0);

    return {
      chapters: chapters.filter((c) => !c.isFrontMatter),
      frontMatter: front || null,
      overallConfidence,
      rawWordCount,
      title,
      subtitle,
      mammothWarnings: result.messages
    };
  }

  return { importDocx, parseBlocks, groupIntoChapters }; // expose internals for testing
})();
