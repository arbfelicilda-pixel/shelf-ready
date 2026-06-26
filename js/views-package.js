/**
 * VIEWS-PACKAGE.JS
 * ─────────────────────────────────────────────────────────────
 * PK-1 Title Candidates → PK-2 Subtitle Builder → PK-3 Cover Brief
 * (unjudged builder) → PK-4 Package Review (automatic, derived).
 */

// ---- PK-1: Title Candidates ------------------------------------------

function ViewPackageTitles(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const candidates = project.package.titleCandidates;

  const rows = candidates.map((c, i) => `
    <div class="chapter-row">
      <span class="chapter-row-num">${i + 1}</span>
      <input class="chapter-row-title" data-idx="${i}" value="${escapeHtml(c.text)}" placeholder="A possible title" />
      <button class="icon-btn remove-title-btn" data-idx="${i}" aria-label="Remove" style="padding:0.3rem 0.6rem;">×</button>
    </div>
  `).join('');

  const html = `
    <p class="screen-eyebrow">Let's find a title people will remember.</p>
    <h1 class="screen-question">List 3-5 possible titles.</h1>
    <p style="color:var(--color-ink-faint); margin-bottom: var(--space-3);">Don't filter yet — just get them down.</p>

    <div class="chapter-list" id="title-list">${rows}</div>
    <button class="btn-quiet" id="add-title-btn" style="border-radius:var(--radius); padding:0.6rem 1.2rem;">+ Add a title</button>

    <div id="review-zone"></div>

    <div class="actions-row">
      <button class="btn" id="compare-btn">Compare these</button>
      <a href="#/project/${projectId}/package/subtitle" class="btn-quiet" style="text-decoration:none; padding:0.75rem 1.2rem; border-radius:var(--radius);">Continue →</a>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  function persist() {
    const inputs = document.querySelectorAll('.chapter-row-title');
    const updated = Array.from(inputs).map((input, i) => ({ id: i, text: input.value }));
    Store.updateField('package.titleCandidates', updated);
  }

  document.getElementById('add-title-btn').addEventListener('click', () => {
    persist();
    const updated = Store.getActiveProject().package.titleCandidates.concat([{ id: Date.now(), text: '' }]);
    Store.updateField('package.titleCandidates', updated);
    ViewPackageTitles(projectId);
  });

  document.querySelectorAll('.remove-title-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      persist();
      const idx = parseInt(btn.dataset.idx, 10);
      const updated = Store.getActiveProject().package.titleCandidates.filter((_, i) => i !== idx);
      Store.updateField('package.titleCandidates', updated);
      ViewPackageTitles(projectId);
    });
  });

  document.querySelectorAll('.chapter-row-title').forEach((input) => {
    input.addEventListener('blur', persist);
  });

  document.getElementById('compare-btn').addEventListener('click', () => {
    persist();
    const fresh = Store.getActiveProject().package.titleCandidates;
    const ranked = PackageReview.rankTitleCandidates(fresh.map((c) => c.text));

    if (ranked.length === 0) return;

    document.getElementById('review-zone').innerHTML = `
      <div class="review-card pass">
        <div class="review-eyebrow">Compared</div>
        <div class="review-headline">Here's how they stack up</div>
        <ul class="review-suggestions">
          ${ranked.map((r) => `<li><strong>${escapeHtml(r.title)}</strong>${r.flagCount === 0 ? ' — no flags' : ' — ' + r.flags.join(' ')}</li>`).join('')}
        </ul>
      </div>
    ` + renderPackageCompareCard('package.titleCandidates');
  });
}

// ---- PK-2: Subtitle Builder --------------------------------------------

function ViewPackageSubtitle(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const sub = project.package.subtitle;
  const candidates = project.package.titleCandidates.filter((c) => c.text && c.text.trim());

  const titleOptionsHtml = candidates.length
    ? `<div class="field-hint" style="margin-bottom:0.3rem;">Pick the title you're packaging this subtitle with</div>
       <select class="field" id="title-select" style="margin-bottom:var(--space-3);">
         ${candidates.map((c) => `<option value="${escapeHtml(c.text)}" ${project.package.finalTitle === c.text ? 'selected' : ''}>${escapeHtml(c.text)}</option>`).join('')}
       </select>`
    : '';

  let reviewHtml = '';
  const allFilled = sub.outcome && sub.reader;
  if (allFilled) {
    const review = PackageReview.reviewSubtitleAssembly(sub);
    reviewHtml = renderPackageReviewCard(review) + renderPackageCompareCard('package.subtitleBuilder');
  }

  const html = `
    <p class="screen-eyebrow">Now let's make the promise specific.</p>
    <h1 class="screen-question">Finish the subtitle.</h1>

    ${titleOptionsHtml}

    <div class="field-hint" style="margin-bottom:0.3rem;">The outcome</div>
    <input class="field" id="sub-outcome" value="${escapeHtml(sub.outcome)}" placeholder="e.g. Speak up in meetings" style="margin-bottom:var(--space-2);" />

    <div class="field-hint" style="margin-bottom:0.3rem;">For [your reader]</div>
    <input class="field" id="sub-reader" value="${escapeHtml(sub.reader)}" placeholder="e.g. mid-career professionals" style="margin-bottom:var(--space-2);" />

    <div class="field-hint" style="margin-bottom:0.3rem;">Without [the common objection]</div>
    <input class="field" id="sub-objection" value="${escapeHtml(sub.objection)}" placeholder="e.g. sounding like you're bragging" />

    <div id="review-zone">${reviewHtml}</div>

    <div class="actions-row">
      <button class="btn" id="continue-btn">Continue</button>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.getElementById('continue-btn').addEventListener('click', () => {
    const updated = {
      outcome: document.getElementById('sub-outcome').value,
      reader: document.getElementById('sub-reader').value,
      objection: document.getElementById('sub-objection').value
    };
    Store.updateField('package.subtitle', updated);
    if (candidates.length) {
      Store.updateField('package.finalTitle', document.getElementById('title-select').value);
    }

    const review = PackageReview.reviewSubtitleAssembly(updated);
    const alreadyShown = document.getElementById('review-zone').innerHTML.trim().length > 0;
    if (review.headline !== 'Subtitle incomplete' && !alreadyShown) {
      Store.updateField('package.finalSubtitle', review.assembled);
      document.getElementById('review-zone').innerHTML = renderPackageReviewCard(review) + renderPackageCompareCard('package.subtitleBuilder');
      return;
    }
    if (review.headline === 'Subtitle incomplete') return;

    Router.navigate(`/project/${projectId}/package/cover-brief`);
  });
}

// ---- PK-3: Cover Brief (unjudged builder) -------------------------------

function ViewPackageCoverBrief(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const brief = project.package.coverBrief;

  const html = `
    <p class="screen-eyebrow">You don't need to design a cover.</p>
    <h1 class="screen-question">You need a brief for whoever does.</h1>

    <div class="field-hint" style="margin-bottom:0.3rem;">What category is this book in?</div>
    <input class="field" id="brief-category" value="${escapeHtml(brief.category)}" placeholder="e.g. Career &amp; workplace nonfiction" style="margin-bottom:var(--space-2);" />

    <div class="field-hint" style="margin-bottom:0.3rem;">Name two real comparable book covers</div>
    <input class="field" id="brief-comp-1" value="${escapeHtml(brief.comps[0] || '')}" placeholder="First comparable cover" style="margin-bottom:0.6rem;" />
    <input class="field" id="brief-comp-2" value="${escapeHtml(brief.comps[1] || '')}" placeholder="Second comparable cover" style="margin-bottom:var(--space-2);" />

    <div class="field-hint" style="margin-bottom:0.3rem;">One mood word</div>
    <input class="field" id="brief-mood" value="${escapeHtml(brief.mood)}" placeholder="e.g. confident, warm, urgent" style="margin-bottom:var(--space-2);" />

    <div class="field-hint" style="margin-bottom:0.3rem;">One thing the cover must NOT look like</div>
    <input class="field" id="brief-avoid" value="${escapeHtml(brief.avoid)}" placeholder="e.g. a corporate stock photo" />

    <div class="actions-row">
      <button class="btn" id="continue-btn">Continue</button>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.getElementById('continue-btn').addEventListener('click', () => {
    Store.updateField('package.coverBrief', {
      category: document.getElementById('brief-category').value,
      comps: [document.getElementById('brief-comp-1').value, document.getElementById('brief-comp-2').value],
      mood: document.getElementById('brief-mood').value,
      avoid: document.getElementById('brief-avoid').value
    });
    Router.navigate(`/project/${projectId}/package/review`);
  });
}

// ---- PK-4: Package Review (automatic) -----------------------------------

function ViewPackageReview(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();

  const finding = PackageReview.reviewPackageConsistency(
    project.package.finalTitle,
    project.package.finalSubtitle,
    project.discover.promise,
    project.discover.positioning
  );

  Store.completePhase('package');

  const html = `
    <p class="screen-eyebrow">Here's how your package holds together.</p>
    <h1 class="screen-question">${escapeHtml(project.package.finalTitle || 'Your book')}</h1>
    <p style="color:var(--color-ink-faint); margin-bottom:var(--space-3);">${escapeHtml(project.package.finalSubtitle || '')}</p>

    ${finding
      ? `<div class="review-card">
          <div class="review-eyebrow">Worth a second look</div>
          <div class="review-headline">${escapeHtml(finding.headline)}</div>
          <div class="review-explanation">${escapeHtml(finding.whatWeFound)} ${escapeHtml(finding.whyItMatters)}</div>
        </div>` + renderPackageCompareCard('package.packageReview')
      : `<div class="no-issues-banner">Your title and subtitle still match what you said this book is about. Good shape.</div>`
    }

    <div class="actions-row">
      <a href="#/dashboard" class="btn" style="text-decoration:none;">Back to My Books</a>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();
}

// ---- shared render helpers ------------------------------------------------

function renderPackageReviewCard(review) {
  if (!review || !review.headline) return '';
  const passClass = review.verdict === 'pass' ? 'pass' : '';
  const eyebrow = review.verdict === 'pass' ? 'Looks good' : 'Worth a second look';
  return `
    <div class="review-card ${passClass}">
      <div class="review-eyebrow">${eyebrow}</div>
      <div class="review-headline">${escapeHtml(review.headline)}</div>
      ${review.explanation ? `<div class="review-explanation">${escapeHtml(review.explanation)}</div>` : ''}
      ${review.suggestions && review.suggestions.length ? `<ul class="review-suggestions">${review.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
    </div>
  `;
}

function renderPackageCompareCard(evidencePath) {
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
