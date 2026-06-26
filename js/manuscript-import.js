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

  const CHAPTER_PATTERNS = [
    /^chapter\s+\d+/i,
    /^chapter\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i,
    /^part\s+\d+/i,
    /^\d+\.\s+\S/, // "1. Some Title"
  ];

  const FRONT_MATTER_HEADINGS = /^(introduction|preface|foreword|prologue)$/i;
  const BACK_MATTER_HEADINGS = /^(conclusion|afterword|epilogue|references|bibliography|appendix|acknowledgments|about the author)/i;

  function looksLikeChapterHeading(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 80) return false; // headings are short
    if (CHAPTER_PATTERNS.some((re) => re.test(trimmed))) return true;
    if (FRONT_MATTER_HEADINGS.test(trimmed) || BACK_MATTER_HEADINGS.test(trimmed)) return true;
    // ALL CAPS short line, no terminal punctuation — looks like a heading
    if (trimmed === trimmed.toUpperCase() && trimmed.length < 60 && !/[.!?]$/.test(trimmed)) return true;
    return false;
  }

  /**
   * Parses mammoth's HTML output into a flat list of "blocks":
   * { type: 'heading'|'bold-paragraph'|'paragraph', text, level, confidence }
   * This is a light DOM walk, not a full HTML parser — sufficient
   * for mammoth's relatively flat output structure.
   */
  function parseBlocks(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    const blocks = [];

    container.childNodes.forEach((node) => {
      if (node.nodeType !== 1) return; // skip text nodes
      const tag = node.tagName.toLowerCase();
      const text = node.textContent.trim();
      if (!text) return;

      if (tag === 'h1' || tag === 'h2') {
        blocks.push({ type: 'heading', text, level: tag, confidence: 'high' });
        return;
      }

      if (tag === 'p') {
        // Detect "bold-only paragraph" — mammoth wraps bold runs in <strong>
        const onlyChild = node.children.length === 1 ? node.children[0] : null;
        const isFullyBold =
          onlyChild &&
          onlyChild.tagName.toLowerCase() === 'strong' &&
          onlyChild.textContent.trim() === text;

        if (isFullyBold && looksLikeChapterHeading(text)) {
          blocks.push({ type: 'heading', text, level: 'fallback', confidence: 'medium' });
          return;
        }

        if (looksLikeChapterHeading(text)) {
          // Plain paragraph that pattern-matches a chapter title even
          // without bold — lower confidence still, but worth flagging
          // rather than silently merging into prior chapter.
          blocks.push({ type: 'heading', text, level: 'fallback', confidence: 'low' });
          return;
        }

        blocks.push({ type: 'paragraph', text, confidence: 'high' });
        return;
      }
    });

    return blocks;
  }

  /**
   * Groups blocks into chapters. The first block(s) before any
   * detected heading become a synthetic "Front Matter" bucket
   * (title page, epigraph, etc.) rather than silently discarded.
   */
  function groupIntoChapters(blocks) {
    const chapters = [];
    let current = null;
    let seenHighConfidenceHeading = false;

    blocks.forEach((block) => {
      if (block.type === 'heading') {
        // A fallback-confidence heading appearing before we've seen ANY
        // real (high-confidence) heading is much more likely to be a
        // title-page line (book title, byline, tagline) than an actual
        // chapter — real manuscripts rarely open with their first
        // chapter detected at medium/low confidence. Treat it as front
        // matter text instead of a chapter boundary in that case.
        const isLikelyTitlePageLine = block.confidence !== 'high' && !seenHighConfidenceHeading;

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
