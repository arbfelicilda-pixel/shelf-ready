/**
 * VIEWS-REFINE.JS
 * ─────────────────────────────────────────────────────────────
 * The manuscript review loop: Upload → Book Preview → Editorial
 * Review → Issue Detail → (fix elsewhere) → Re-run.
 *
 * This is "Scan Mode" from the locked architecture — no questions
 * asked up front. The software reads the file and reports what
 * it found. The conversational one-question-at-a-time pattern
 * from Discover is NOT reused here; this flow is upload-and-read,
 * by design.
 */

// ---- Upload ------------------------------------------------------------

function ViewRefineUpload(projectId) {
  Store.setActiveProject(projectId);

  const html = `
    <p class="screen-eyebrow">Does the manuscript say what I think it says? Manuscript Review.</p>
    <h1 class="screen-question">Drop your manuscript. I'll take it from here.</h1>
    <p class="upload-intro" style="color:var(--color-ink-faint);">
      No need to copy and paste. Upload the file as it is — messy formatting and all.
    </p>

    <div class="upload-formats-card">
      <div class="upload-formats-card-label">What Shelf Ready recognizes</div>
      <ul class="upload-formats-list">
        <li>Chapter 1, CHAPTER ONE, or similar</li>
        <li>Part I, Part One, or similar</li>
        <li>Introduction, Prologue, Conclusion, Epilogue</li>
      </ul>
      <p class="upload-formats-note">If your manuscript uses unusual chapter names, you'll get to review and fix what was detected before anything is analyzed.</p>
    </div>

    <label class="dropzone" id="dropzone" tabindex="0">
      <div class="dropzone-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 3.5C7 2.67157 7.67157 2 8.5 2H14.5L19 6.5V20.5C19 21.3284 18.3284 22 17.5 22H8.5C7.67157 22 7 21.3284 7 20.5V3.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M14 2V6.5H19" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M10 13.5L12 11.5L14 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 17.5V11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="dropzone-cta">Click to choose a file, or drag it here</div>
      <div class="dropzone-subcta">Your manuscript stays on this device — nothing is uploaded anywhere</div>
      <div class="dropzone-formats">Supported: .docx, .txt &nbsp;&middot;&nbsp; PDF coming later</div>
      <input type="file" id="file-input" accept=".docx,.txt" />
    </label>

    <div id="import-status"></div>

    <div class="actions-row">
      <a href="#/dashboard" class="btn-quiet" style="text-decoration:none; padding:0.75rem 1.2rem; border-radius:var(--radius);">
        Back to My Books
      </a>
    </div>
  `;
  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0], projectId);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0], projectId);
  });
}

async function handleFile(file, projectId) {
  const statusEl = document.getElementById('import-status');
  const isDocx = file.name.toLowerCase().endsWith('.docx');
  const isTxt = file.name.toLowerCase().endsWith('.txt');

  if (!isDocx && !isTxt) {
    statusEl.innerHTML = '<p style="color:var(--color-accent); margin-top:var(--space-2);">That file type isn\'t supported yet. Please upload a .docx or .txt file.</p>';
    return;
  }

  const steps = ['Reading document', 'Detecting chapters', 'Finding title page', 'Measuring structure'];
  statusEl.innerHTML =
    '<div class="import-progress">' +
    steps.map((s, i) => '<div class="import-progress-line" id="step-' + i + '"><span class="checkmark"></span>' + s + '</div>').join('') +
    '</div>';

  const advance = (i) => {
    const el = document.getElementById('step-' + i);
    if (el) { el.classList.add('done'); el.querySelector('.checkmark').textContent = '✓'; }
  };

  try {
    advance(0);
    let imported;
    if (isDocx) {
      imported = await ManuscriptImport.importDocx(file);
    } else {
      const text = await file.text();
      imported = importPlainText(text);
    }
    advance(1);
    advance(2);
    advance(3);

    Store.updateField('refine.manuscript', {
      title: imported.title,
      subtitle: imported.subtitle,
      chapters: imported.chapters.map((c) => ({
        title: c.title,
        confidence: c.confidence,
        wordCount: c.wordCount,
        paragraphs: c.paragraphs,
        isBackMatter: !!c.isBackMatter,
        part: c.part || null
      })),
      overallConfidence: imported.overallConfidence,
      rawWordCount: imported.rawWordCount,
      importedAt: new Date().toISOString()
    });

    // Sync the project's name from the detected manuscript title, but
    // only while it's still the default placeholder — confirmed bug:
    // every project was created as "Untitled Book" with nothing ever
    // updating it, so the Dashboard and every screen header showed
    // "Untitled Book" even after a real manuscript with a real title
    // had been uploaded. Never overwrite a name the user already set.
    const activeProject = Store.getActiveProject();
    if (activeProject && activeProject.name === 'Untitled Book' && imported.title) {
      Store.updateField('name', imported.title);
    }

    setTimeout(() => Router.navigate('/project/' + projectId + '/refine/preview'), 400);
  } catch (err) {
    console.error(err);
    statusEl.innerHTML = '<p style="color:var(--color-accent); margin-top:var(--space-2);">Something went wrong reading that file. Please check it isn\'t password-protected or corrupted, and try again.</p>';
  }
}

/** Plain-text fallback: split on blank-line-separated blocks, apply the
 * same chapter-heading heuristics as the docx path where possible. */
function importPlainText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const chapters = [];
  let current = null;

  lines.forEach((line) => {
    const looksLikeHeading =
      /^chapter\s+\d+/i.test(line) ||
      /^chapter\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(line) ||
      (line === line.toUpperCase() && line.length < 60 && !/[.!?]$/.test(line));

    if (looksLikeHeading && line.length < 80) {
      if (current) chapters.push(current);
      current = { title: line, confidence: 'medium', paragraphs: [], wordCount: 0 };
    } else {
      if (!current) current = { title: 'Front Matter', confidence: 'high', paragraphs: [], wordCount: 0, isFrontMatter: true };
      current.paragraphs.push(line);
      current.wordCount += (line.match(/\S+/g) || []).length;
    }
  });
  if (current) chapters.push(current);

  const front = chapters.find((c) => c.isFrontMatter);
  const realChapters = chapters.filter((c) => !c.isFrontMatter);
  const hasMedium = realChapters.some((c) => c.confidence === 'medium');

  return {
    chapters: realChapters,
    frontMatter: front || null,
    overallConfidence: hasMedium ? 'medium' : 'high',
    rawWordCount: chapters.reduce((s, c) => s + c.wordCount, 0),
    title: front && front.paragraphs[0] ? front.paragraphs[0] : '',
    subtitle: front && front.paragraphs[1] ? front.paragraphs[1] : ''
  };
}

// ---- Book Preview --------------------------------------------------------

function ViewRefinePreview(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const manuscript = project && project.refine.manuscript;

  if (!manuscript) return Router.navigate('/project/' + projectId + '/refine/upload');

  // Hard stop: zero detected chapters means every downstream review has
  // nothing to analyze, and a clean "good shape" report on a manuscript
  // the parser never actually read is worse than no report at all. This
  // screen must never let the user proceed past zero chapters with a
  // button that implies the data is fine.
  if (manuscript.chapters.length === 0) {
    const html = `
      <p class="screen-eyebrow">Book Preview</p>
      <h1 class="screen-question">We couldn't detect your chapters.</h1>
      <div class="review-card">
        <div class="review-eyebrow">Worth a second look</div>
        <div class="review-headline">Shelf Ready reviews books chapter by chapter</div>
        <div class="review-explanation">
          Your manuscript imported successfully (${manuscript.rawWordCount.toLocaleString()} words), but we
          couldn't find chapter headings to split it on. This usually happens when:
        </div>
        <ul class="review-suggestions">
          <li>chapters aren't labeled with a heading</li>
          <li>headings use unusual or inconsistent formatting</li>
          <li>the file's export process removed heading styles</li>
        </ul>
      </div>
      <div class="actions-row">
        <a href="#/project/${projectId}/refine/upload" class="btn" style="text-decoration:none;">
          Try a different file
        </a>
      </div>
    `;
    document.getElementById('app-root').innerHTML = renderShell(html);
    mountShellChrome();
    return;
  }

  const confidenceBanner = manuscript.overallConfidence !== 'high'
    ? '<div class="confidence-banner">We found ' + manuscript.chapters.length +
      ' chapters, but we\'re not completely sure we split every one correctly — please review the list below before continuing.</div>'
    : '';

  // Group chapters by their detected Part, preserving original sequence
  // numbers. Confirmed real gap: every chapter has carried a real `part`
  // field since the manuscript-import fixes built earlier in this
  // build, but no screen ever read it — chapters rendered as one flat
  // list regardless of whether the manuscript had real Part structure.
  // Manuscripts with no Parts at all (confirmed real, not every book
  // uses them) fall back to the original flat list, unchanged.
  //
  // Back matter (isBackMatter) gets a distinct visual section label
  // here too, separating it from real content chapters the same way
  // it's already excluded from content-based review checks. Front
  // matter is NOT addressed in this screen — it's discarded after
  // title/subtitle extraction during upload and never reaches stored
  // state, so there's no real data here to show. Noting that limit
  // honestly rather than fabricating a front-matter section with no
  // real content behind it.
  function renderChapterRow(c, i, isLast) {
    return '<div class="chapter-row' + (c.isBackMatter ? ' chapter-row-backmatter' : '') + '">' +
      '<span class="chapter-row-num">' + (i + 1) + '</span>' +
      '<input class="chapter-row-title" data-idx="' + i + '" value="' + escapeHtml(c.title) + '" />' +
      (c.isBackMatter ? '<span class="confidence-flag" style="background:rgba(168,158,140,0.15); color:var(--color-ink-faint);">back matter</span>' : '') +
      (c.confidence !== 'high' ? '<span class="confidence-flag ' + c.confidence + '">not sure</span>' : '<span class="confidence-flag" style="background:rgba(107,143,113,0.15); color:var(--color-pass);">✓ detected</span>') +
      (!isLast ? '<button class="icon-btn merge-next-btn" data-idx="' + i + '" title="Merge into the next chapter" style="padding:0.3rem 0.6rem; font-size:var(--scale-micro);">Merge ↓</button>' : '') +
    '</div>';
  }

  const anyPartsDetected = manuscript.chapters.some((c) => c.part);
  let chapterRows;

  if (anyPartsDetected) {
    const groups = [];
    let currentGroup = null;
    manuscript.chapters.forEach((c, i) => {
      const partKey = c.part || null;
      if (!currentGroup || currentGroup.part !== partKey) {
        currentGroup = { part: partKey, chapters: [] };
        groups.push(currentGroup);
      }
      currentGroup.chapters.push({ chapter: c, index: i });
    });

    chapterRows = groups.map((group) => {
      const rowsHtml = group.chapters.map(({ chapter, index }) =>
        renderChapterRow(chapter, index, index === manuscript.chapters.length - 1)
      ).join('');
      const partHeader = group.part
        ? `<div class="part-group-header">${escapeHtml(group.part)}</div>`
        : `<div class="part-group-header part-group-header-none">No Part detected</div>`;
      return `<div class="part-group">${partHeader}${rowsHtml}</div>`;
    }).join('');
  } else {
    chapterRows = manuscript.chapters.map((c, i) =>
      renderChapterRow(c, i, i === manuscript.chapters.length - 1)
    ).join('');
  }

  const html = `
    <p class="screen-eyebrow">Book Preview</p>
    <h1 class="screen-question">Please review the detected structure.</h1>

    ${confidenceBanner}

    <div class="preview-field-row">
      <span class="preview-field-label">Title</span>
      <span class="preview-field-value">${escapeHtml(manuscript.title || '—')}</span>
    </div>
    <div class="preview-field-row">
      <span class="preview-field-label">Subtitle</span>
      <span class="preview-field-value">${escapeHtml(manuscript.subtitle || '—')}</span>
    </div>
    <div class="preview-field-row">
      <span class="preview-field-label">Word count</span>
      <span class="preview-field-value">${manuscript.rawWordCount.toLocaleString()}</span>
    </div>

    <h2 style="margin-top: var(--space-4);">${manuscript.chapters.length} Chapters Detected</h2>
    <div class="chapter-list">${chapterRows}</div>

    <div class="actions-row">
      <button class="btn" id="continue-btn">This is correct, run the review</button>
      <a href="#/project/${projectId}/refine/upload" class="btn-quiet" style="text-decoration:none; padding:0.75rem 1.2rem; border-radius:var(--radius);">
        Upload a different file
      </a>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.querySelectorAll('.chapter-row-title').forEach((input) => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const updated = Object.assign({}, manuscript);
      updated.chapters = manuscript.chapters.slice();
      updated.chapters[idx] = Object.assign({}, updated.chapters[idx], { title: e.target.value });
      Store.updateField('refine.manuscript', updated);
    });
  });

  document.querySelectorAll('.merge-next-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const fresh = Store.getActiveProject().refine.manuscript;
      const chapters = fresh.chapters.slice();
      const current = chapters[idx];
      const next = chapters[idx + 1];
      if (!next) return;

      // Fold the current chapter's title (kept as a leading line, since
      // it may have been real content like a section label, not noise)
      // and paragraphs into the next chapter, then remove this row.
      // This is the fix for a real case found in testing: a section
      // label ("THE SKIN") gets detected as if it were its own chapter
      // — merging it into the chapter that follows recovers the lost
      // structure without silently deleting the writer's words.
      const merged = Object.assign({}, next, {
        paragraphs: [current.title].concat(current.paragraphs, next.paragraphs),
        wordCount: current.wordCount + next.wordCount + (current.title.match(/\S+/g) || []).length
      });
      chapters.splice(idx, 2, merged);

      const updated = Object.assign({}, fresh, { chapters });
      Store.updateField('refine.manuscript', updated);
      ViewRefinePreview(projectId); // re-render with the merged list
    });
  });

  document.getElementById('continue-btn').addEventListener('click', () => {
    const fresh = Store.getActiveProject().refine.manuscript;
    const findings = Inspections.runAll(fresh, fresh.title, fresh.subtitle);
    Store.updateField('refine.findings', findings);
    Router.navigate('/project/' + projectId + '/refine/report');
  });
}

// ---- Editorial Review (report) -------------------------------------------

const SEVERITY_LABEL = { critical: 'Critical', important: 'Important', minor: 'Minor', informational: 'Info', good: 'Working well' };

function ViewRefineReport(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const findings = (project && project.refine.findings) || [];

  if (!project || !project.refine.manuscript) return Router.navigate('/project/' + projectId + '/refine/upload');

  const counts = { critical: 0, important: 0, minor: 0, informational: 0, good: 0 };
  findings.forEach((f) => { counts[f.severity] = (counts[f.severity] || 0) + 1; });

  // Group findings by chapter. A finding with chapterIndex === null is a
  // manuscript-wide pattern (Title Promise, Reader Focus, Chapter
  // Overlap's positive case, etc.) and gets its own section rather than
  // being forced into a chapter it doesn't actually belong to.
  const manuscriptWide = findings.filter((f) => f.chapterIndex === null || f.chapterIndex === undefined);
  const chapterGrouped = {};
  findings.forEach((f) => {
    if (f.chapterIndex === null || f.chapterIndex === undefined) return;
    if (!chapterGrouped[f.chapterIndex]) chapterGrouped[f.chapterIndex] = [];
    chapterGrouped[f.chapterIndex].push(f);
    // A cross-chapter finding (like Chapter Overlap) also names a
    // second chapter — file it there too, so both sides of the
    // relationship are visible from either chapter's own findings.
    if (f.secondChapterIndex !== undefined && f.secondChapterIndex !== null) {
      if (!chapterGrouped[f.secondChapterIndex]) chapterGrouped[f.secondChapterIndex] = [];
      chapterGrouped[f.secondChapterIndex].push(f);
    }
  });

  function issueRow(f) {
    const realIdx = findings.indexOf(f);
    return '<button class="issue-row" data-idx="' + realIdx + '">' +
      '<span class="severity-badge ' + f.severity + '">' + SEVERITY_LABEL[f.severity] + '</span>' +
      '<span class="issue-row-headline">' + escapeHtml(f.headline) + '</span>' +
      '<span style="color:var(--color-ink-faint);">→</span>' +
    '</button>';
  }

  function chapterStatusLabel(chapterFindings) {
    const hasCritical = chapterFindings.some((f) => f.severity === 'critical');
    const hasImportant = chapterFindings.some((f) => f.severity === 'important');
    const hasMinor = chapterFindings.some((f) => f.severity === 'minor');
    if (hasCritical) return { label: 'Needs another look', color: 'var(--color-accent)' };
    if (hasImportant) return { label: 'Worth a look', color: 'var(--color-accent)' };
    if (hasMinor) return { label: 'A few small things', color: 'var(--color-ink-faint)' };
    return { label: 'Good shape', color: 'var(--color-pass)' };
  }

  const manuscript = project.refine.manuscript;
  const chapterSections = manuscript.chapters.map((chapter, idx) => {
    const chapterFindings = chapterGrouped[idx] || [];
    if (chapterFindings.length === 0) return ''; // chapter had no checks fire at all (e.g. too short to judge)

    const status = chapterStatusLabel(chapterFindings);
    const majorRows = chapterFindings.filter((f) => f.severity === 'critical' || f.severity === 'important').map(issueRow).join('');
    const minorRows = chapterFindings.filter((f) => f.severity === 'minor' || f.severity === 'informational').map(issueRow).join('');
    const goodRows = chapterFindings.filter((f) => f.severity === 'good').map(issueRow).join('');

    return `
      <details class="chapter-findings-group">
        <summary>
          <span>${escapeHtml(chapter.title)}</span>
          <span style="color:${status.color}; font-size:var(--scale-small);">${status.label}</span>
        </summary>
        ${majorRows}
        ${minorRows}
        ${goodRows}
      </details>
    `;
  }).join('');

  const manuscriptWideHtml = manuscriptWide.length
    ? `<h2 style="margin-top:var(--space-4);">Across the whole manuscript</h2>` + manuscriptWide.map(issueRow).join('')
    : '';

  const html = `
    <p class="screen-eyebrow">Editorial Review</p>
    <h1 class="screen-question">${escapeHtml(project.refine.manuscript.title || project.name)}</h1>

    <div class="report-summary-row">
      <div class="report-summary-item"><strong>${counts.critical}</strong> Critical</div>
      <div class="report-summary-item"><strong>${counts.important}</strong> Important</div>
      <div class="report-summary-item"><strong>${counts.minor}</strong> Minor</div>
      <div class="report-summary-item" style="color:var(--color-pass);"><strong>${counts.good}</strong> Working well</div>
    </div>

    <h2 style="margin-top:var(--space-4);">By chapter</h2>
    ${chapterSections}

    ${manuscriptWideHtml}

    <div class="actions-row">
      <a href="#/dashboard" class="btn" style="text-decoration:none;">Back to My Books</a>
      <a href="#/project/${projectId}/refine/upload" class="btn-quiet" style="text-decoration:none; padding:0.75rem 1.2rem; border-radius:var(--radius);">
        Re-upload after edits
      </a>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.querySelectorAll('.issue-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      Router.navigate('/project/' + projectId + '/refine/issue/' + btn.dataset.idx);
    });
  });
}

// ---- Issue Detail ---------------------------------------------------------

function ViewRefineIssueDetail(projectId, idxStr) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const idx = parseInt(idxStr, 10);
  const finding = project && project.refine.findings && project.refine.findings[idx];

  if (!finding) return Router.navigate('/project/' + projectId + '/refine/report');

  const compareHtml = renderCompareCardOptional(finding.evidenceFieldPath);

  const locationLine = finding.chapterTitle
    ? `<p style="color:var(--color-ink-faint); margin-top:-0.5rem; margin-bottom:var(--space-3);">${escapeHtml(finding.chapterTitle)}${finding.secondChapterTitle ? ' &amp; ' + escapeHtml(finding.secondChapterTitle) : ''}</p>`
    : '';

  // The actual point of the per-chapter rebuild: show the literal
  // flagged sentence and where it sits, not just an abstract count.
  // "The flower" vs "the red roses given by my dad yesterday" — this
  // is the difference rendered on screen, not just present in the data.
  const instancesHtml = (finding.instances && finding.instances.length)
    ? `<div class="issue-detail-section">
        <div class="issue-detail-label">Where this shows up</div>
        ${finding.instances.map((i) => `
          <div class="located-instance">
            <span class="located-instance-location">Paragraph ${i.paragraphIndex + 1}</span>
            <p class="located-instance-sentence">"${escapeHtml(i.sentence)}"</p>
          </div>
        `).join('')}
      </div>`
    : '';

  const recommendationHtml = finding.recommendation
    ? `<div class="issue-detail-section">
        <div class="issue-detail-label">Recommendation</div>
        <div class="issue-detail-text">${escapeHtml(finding.recommendation)}</div>
        ${renderFixRouteLink(projectId, finding.fixRoute)}
      </div>`
    : ''; // good findings have no recommendation — nothing to fix, so nothing rendered here

  const html = `
    <p class="screen-eyebrow">${finding.category} &middot; <span class="severity-badge ${finding.severity}">${SEVERITY_LABEL[finding.severity]}</span></p>
    <h1 class="screen-question">${escapeHtml(finding.headline)}</h1>
    ${locationLine}

    <div class="issue-detail-section">
      <div class="issue-detail-label">What we found</div>
      <div class="issue-detail-text">${escapeHtml(finding.whatWeFound)}</div>
    </div>

    ${instancesHtml}

    <div class="issue-detail-section">
      <div class="issue-detail-label">Why it matters</div>
      <div class="issue-detail-text">${escapeHtml(finding.whyItMatters)}</div>
    </div>

    ${recommendationHtml}

    ${compareHtml}

    <div class="actions-row">
      <a href="#/project/${projectId}/refine/report" class="btn">Back to Review</a>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();
}

/**
 * Compare with Author, rendered as Premium Evidence: per locked
 * decision, the section is OMITTED ENTIRELY when no Decision is
 * mapped or written — no placeholder, no "pending" message. This
 * differs from the Discover flow's renderCompareCard, which still
 * shows a pending state, because Discover's decision coverage is
 * the one fully-planned book; Refine's manuscript-level decisions
 * are understood to be sparse for a long time, so a placeholder
 * on every single issue would be the dominant visual element of
 * the report — exactly what "premium evidence, not standard UI"
 * was meant to avoid.
 */
function renderCompareCardOptional(evidencePath) {
  if (!evidencePath) return '';
  const ev = getEvidence(evidencePath);
  if (ev.status !== 'complete') return '';

  return '<div class="compare-card">' +
    '<div class="compare-byline"><div class="compare-avatar">A</div>' +
    '<div class="compare-label">Why I made this decision</div></div>' +
    '<div class="compare-book">' + escapeHtml(ev.book) + '</div>' +
    '<p class="decision-line"><strong>The situation:</strong> ' + escapeHtml(ev.situation) + '</p>' +
    '<p class="decision-line"><strong>The discovery:</strong> ' + escapeHtml(ev.discovery) + '</p>' +
    '<p class="decision-line"><strong>The change:</strong> ' + escapeHtml(ev.change) + '</p>' +
    '<p class="decision-line"><strong>The outcome:</strong> ' + escapeHtml(ev.outcome) + '</p>' +
    '<p class="decision-principle"><strong>Principle:</strong> ' + escapeHtml(ev.principle) + '</p>' +
  '</div>';
}
