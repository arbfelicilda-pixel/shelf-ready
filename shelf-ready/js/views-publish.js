/**
 * VIEWS-PUBLISH.JS
 * ─────────────────────────────────────────────────────────────
 * PB-1 Launch Checklist (status rollup, no judgment) → PB-2
 * Description Copy (reuses Refine's filter-word/absolute-language
 * checks directly). PB-3 (Book Build Kit / PDF export) is
 * explicitly NOT built in this pass.
 */

function ViewPublishChecklist(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();

  const refineHasCritical = (project.refine.findings || []).some((f) => f.severity === 'critical');


  const items = [
    { label: 'Discover: book idea, reader, and promise defined', done: project.flags.discoverComplete, route: 'discover/workingTitle' },
    { label: 'Structure: narrative spine and chapter map built', done: project.flags.designComplete, route: 'design/spine' },
    { label: 'Refine: manuscript reviewed', done: !!project.refine.manuscript, route: 'refine/upload' },
    { label: 'Refine: no unresolved Critical findings', done: !!project.refine.manuscript && !refineHasCritical, route: 'refine/report' },
    { label: 'Package: title, subtitle, and cover brief complete', done: project.flags.packageComplete, route: 'package/titles' }
  ];

  const rows = items.map((item) => `
    <div class="confidence-row">
      <span>${item.done ? '✓' : '○'} ${escapeHtml(item.label)}</span>
      ${!item.done ? `<a href="#/project/${projectId}/${item.route}" class="btn-quiet" style="text-decoration:none; padding:0.3rem 0.8rem; border-radius:var(--radius); font-size:var(--scale-small);">Go</a>` : ''}
    </div>
  `).join('');

  const html = `
    <p class="screen-eyebrow">Is anything important still missing? A few things worth checking.</p>
    <h1 class="screen-question">Launch checklist</h1>
    <p style="color:var(--color-ink-faint); margin-bottom:var(--space-3);">
      This isn't about perfection — it's about knowing what you skipped on purpose versus what you forgot.
    </p>

    <div style="background:var(--color-bg-raised); border:1px solid var(--color-rule); border-radius:var(--radius); padding: var(--space-3); margin-bottom: var(--space-4);">
      ${rows}
    </div>

    <div class="actions-row">
      <a href="#/project/${projectId}/publish/description" class="btn" style="text-decoration:none;">Continue to sales copy</a>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();
}

function ViewPublishDescription(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const { authorBio, bookDescription } = project.publish;

  const reviewShown = authorBio && bookDescription;
  let reviewHtml = '';
  if (reviewShown) {
    const findings = PublishReview.reviewDescriptionCopy(authorBio, bookDescription);
    reviewHtml = renderPublishFindings(findings) + renderPublishCompareCard('publish.descriptionCopy');
  }

  const html = `
    <p class="screen-eyebrow">Two pieces of copy every listing needs.</p>
    <h1 class="screen-question">Write your sales copy.</h1>

    <div class="field-hint" style="margin-bottom:0.3rem;">About you, as the author of THIS book specifically</div>
    <textarea class="field" id="author-bio" rows="3" placeholder="2-3 sentences — not your whole life story">${escapeHtml(authorBio)}</textarea>

    <div class="field-hint" style="margin: var(--space-2) 0 0.3rem;">Book description, as it would appear on a sales page</div>
    <textarea class="field" id="book-description" rows="5" placeholder="The pitch a stranger reads in ten seconds">${escapeHtml(bookDescription)}</textarea>

    <div id="review-zone">${reviewHtml}</div>

    <div class="actions-row">
      <button class="btn" id="continue-btn">Save</button>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.getElementById('continue-btn').addEventListener('click', () => {
    const bio = document.getElementById('author-bio').value;
    const desc = document.getElementById('book-description').value;
    Store.updateField('publish.authorBio', bio);
    Store.updateField('publish.bookDescription', desc);

    const alreadyShown = document.getElementById('review-zone').innerHTML.trim().length > 0;
    if (bio && desc && !alreadyShown) {
      const findings = PublishReview.reviewDescriptionCopy(bio, desc);
      Store.updateField('publish.descriptionFindings', findings);
      document.getElementById('review-zone').innerHTML = renderPublishFindings(findings) + renderPublishCompareCard('publish.descriptionCopy');
      return;
    }

    Store.completePhase('publish');
    Router.navigate(`/project/${projectId}/publish/report`);
  });
}

function renderPublishFindings(findings) {
  return findings.length
    ? findings.map((f) => `
        <div class="review-card">
          <div class="review-eyebrow">Worth a second look</div>
          <div class="review-headline">${escapeHtml(f.headline)}</div>
          <div class="review-explanation">${escapeHtml(f.whatWeFound)} ${escapeHtml(f.whyItMatters)}</div>
        </div>
      `).join('')
    : `<div class="no-issues-banner">Your sales copy reads clean. Good shape.</div>`;
}

function renderPublishCompareCard(evidencePath) {
  const ev = getEvidence('evidence.book01.' + evidencePath);
  if (ev.status !== 'complete') {
    return `
      <div class="compare-card">
        <div class="compare-byline"><div class="compare-avatar">A</div><div class="compare-label">Why I made this decision</div></div>
        <div class="compare-pending">No decision written for this yet. Check back soon.</div>
      </div>
    `;
  }
  return `
    <div class="compare-card">
      <div class="compare-byline"><div class="compare-avatar">A</div><div class="compare-label">Why I made this decision</div></div>
      <div class="compare-book">${escapeHtml(ev.book)}</div>
      <p class="decision-line"><strong>The situation:</strong> ${escapeHtml(ev.situation)}</p>
      <p class="decision-line"><strong>The discovery:</strong> ${escapeHtml(ev.discovery)}</p>
      <p class="decision-line"><strong>The change:</strong> ${escapeHtml(ev.change)}</p>
      <p class="decision-line"><strong>The outcome:</strong> ${escapeHtml(ev.outcome)}</p>
      <p class="decision-principle"><strong>Principle:</strong> ${escapeHtml(ev.principle)}</p>
    </div>
  `;
}

/**
 * VIEW: Shelf Ready Report — the final editorial summary, reachable
 * after Publish. Per the locked decision: no stars, no single score.
 * Every label below is derived from REAL stored data, never invented:
 *   - Foundation: from Discover's existing confidence fields
 *   - Structure: from Design's chapterFindings (0 = clean)
 *   - Manuscript: from Refine's findings severity counts
 *   - Package: from whether PK-4 (promise drift) fired
 *   - Publish: completion status only — this phase doesn't judge
 *     quality itself, so it gets a status, not a grade.
 */

function confidenceToLabel(conf) {
  // Aggregates Discover's four weak/developing/clear fields into one
  // editorial word, by simple majority — never inventing a number.
  const order = { unset: 0, weak: 0, developing: 1, clear: 2 };
  const values = Object.values(conf).map((v) => order[v] || 0);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  if (avg >= 1.5) return 'Strong';
  if (avg >= 0.75) return 'Developing';
  return 'Needs another look';
}

function severityCountsToLabel(findings) {
  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasImportant = findings.some((f) => f.severity === 'important');
  if (hasCritical) return 'Needs another look';
  if (hasImportant) return 'Good';
  return 'Strong';
}

function ViewPublishReport(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();

  const foundationLabel = project.flags.discoverComplete
    ? confidenceToLabel(project.confidence)
    : 'Not started';

  const structureLabel = !project.flags.designComplete
    ? 'Not started'
    : (project.design.chapterFindings || []).length > 0
      ? 'Good'
      : 'Strong';

  const manuscriptLabel = !project.refine.manuscript
    ? 'Not started'
    : severityCountsToLabel(project.refine.findings || []);

  const packageFinding = project.package.finalTitle
    ? PackageReview.reviewPackageConsistency(
        project.package.finalTitle, project.package.finalSubtitle,
        project.discover.promise, project.discover.positioning
      )
    : null;
  const packageLabel = !project.flags.packageComplete
    ? 'Not started'
    : packageFinding ? 'Good' : 'Strong';

  const publishLabel = project.flags.publishComplete ? 'Ready' : 'Not yet';

  const refineFindings = project.refine.findings || [];
  const counts = { critical: 0, important: 0, minor: 0, informational: 0 };
  refineFindings.forEach((f) => { counts[f.severity] = (counts[f.severity] || 0) + 1; });

  const rows = [
    { label: 'Foundation', value: foundationLabel },
    { label: 'Structure', value: structureLabel },
    { label: 'Manuscript', value: manuscriptLabel },
    { label: 'Package', value: packageLabel },
    { label: 'Publish', value: publishLabel }
  ];

  const html = `
    <p class="screen-eyebrow">Shelf Ready Report</p>
    <h1 class="screen-question">${escapeHtml(project.name)}</h1>

    <div style="background:var(--color-bg-raised); border:1px solid var(--color-rule); border-radius:var(--radius); padding: var(--space-3); margin-bottom: var(--space-4);">
      ${rows.map((r) => `
        <div class="confidence-row">
          <span>${escapeHtml(r.label)}</span>
          <span style="color:${r.value === 'Strong' || r.value === 'Ready' ? 'var(--color-pass)' : r.value === 'Not started' || r.value === 'Not yet' ? 'var(--color-ink-faint)' : 'var(--color-ink)'};">${escapeHtml(r.value)}</span>
        </div>
      `).join('')}
    </div>

    <div class="report-summary-row" style="margin-bottom: var(--space-4);">
      <div class="report-summary-item"><strong>${counts.critical}</strong> Critical</div>
      <div class="report-summary-item"><strong>${counts.important}</strong> Important</div>
      <div class="report-summary-item"><strong>${counts.minor}</strong> Minor</div>
    </div>

    <div class="actions-row">
      <button class="btn" id="export-pdf-btn">Export PDF</button>
      <a href="#/dashboard" class="btn-quiet" style="text-decoration:none; padding:0.75rem 1.2rem; border-radius:var(--radius);">
        Return later
      </a>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.getElementById('export-pdf-btn').addEventListener('click', () => {
    // PDF export (jsPDF + html2canvas) is specified but not yet built —
    // per the locked scope decision, this is flagged honestly rather
    // than faked with a silent no-op button.
    alert('PDF export is planned but not yet built. This button is a placeholder for that feature.');
  });
}
