/**
 * VIEWS-DESIGN.JS
 * ─────────────────────────────────────────────────────────────
 * Part A: Spine Statement (DS-1) + Stress Test (DS-2) — follows
 * the same conversational pattern as Discover, since these are
 * genuine one-at-a-time judged questions.
 *
 * Part B: Chapter Map (DS-3) + Chapter-Spine Check (DS-4) — a
 * builder screen (add/reorder/remove chapters) followed by an
 * automatic review, same "Scan Mode" pattern as Refine, since
 * DS-4 is a derived check, not a question someone answers.
 */

// ---- Part A: Spine Statement -------------------------------------------

function ViewDesignSpine(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const spine = project.design.spine;

  const reviewShown = spine.protagonist && spine.problem && spine.action && spine.stakes;
  let reviewHtml = '';
  if (reviewShown) {
    const review = DesignReview.reviewSpineStatement(spine);
    reviewHtml = renderDesignReviewCard(review) + renderDesignCompareCard('design.spineStatement');
  }

  const html = `
    <p class="screen-eyebrow">Does this book actually work? Let's build the backbone first.</p>
    <h1 class="screen-question">Finish the sentence.</h1>
    <p style="color:var(--color-ink-faint); margin-bottom: var(--space-3);">
      When [your reader] faces [their problem], they must [do what] — or else [what happens]?
    </p>

    <div class="field-hint" style="margin-bottom:0.3rem;">Your reader, and the situation they're in</div>
    <textarea class="field" id="spine-protagonist" rows="2" placeholder="e.g. A mid-career manager who keeps getting passed over for promotion">${escapeHtml(spine.protagonist)}</textarea>

    <div class="field-hint" style="margin: var(--space-2) 0 0.3rem;">The problem that's actually holding them back</div>
    <textarea class="field" id="spine-problem" rows="2" placeholder="e.g. She assumes her work will speak for itself">${escapeHtml(spine.problem)}</textarea>

    <div class="field-hint" style="margin: var(--space-2) 0 0.3rem;">The specific action they must take</div>
    <textarea class="field" id="spine-action" rows="2" placeholder="e.g. Speak up directly about her contributions in front of leadership">${escapeHtml(spine.action)}</textarea>

    <div class="field-hint" style="margin: var(--space-2) 0 0.3rem;">What happens if they don't</div>
    <textarea class="field" id="spine-stakes" rows="2" placeholder="e.g. A less qualified, louder colleague gets the role instead">${escapeHtml(spine.stakes)}</textarea>

    <div id="review-zone">${reviewHtml}</div>

    <div class="actions-row">
      <button class="btn" id="continue-btn">Continue</button>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.getElementById('continue-btn').addEventListener('click', () => {
    const updated = {
      protagonist: document.getElementById('spine-protagonist').value,
      problem: document.getElementById('spine-problem').value,
      action: document.getElementById('spine-action').value,
      stakes: document.getElementById('spine-stakes').value
    };
    Store.updateField('design.spine', updated);

    const review = DesignReview.reviewSpineStatement(updated);
    const alreadyShowingReview = document.getElementById('review-zone').innerHTML.trim().length > 0;

    if (review.headline !== 'Spine incomplete' && !alreadyShowingReview) {
      document.getElementById('review-zone').innerHTML =
        renderDesignReviewCard(review) + renderDesignCompareCard('design.spineStatement');
      return;
    }
    if (review.headline === 'Spine incomplete') return; // don't advance on incomplete input

    Router.navigate(`/project/${projectId}/design/stress-test`);
  });
}

// ---- Part A: Stress Test --------------------------------------------------

const STRESS_TEST_ITEMS = [
  { key: 'stakesRemoved', label: 'Remove the stakes. Does the story still make sense?' },
  { key: 'protagonistSwapped', label: 'Swap your reader for someone generic. Does it still basically work?' },
  { key: 'problemSwapped', label: 'Swap the problem for an unrelated one. Does it still hold together?' }
];

function ViewDesignStressTest(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const stressTest = project.design.stressTest;
  const spine = project.design.spine;

  if (!spine.protagonist) return Router.navigate(`/project/${projectId}/design/spine`);

  const allAnswered = STRESS_TEST_ITEMS.every((item) => stressTest[item.key] !== null);
  let reviewHtml = '';
  if (allAnswered) {
    const review = DesignReview.reviewStressTest(stressTest);
    if (review) reviewHtml = renderDesignReviewCard(review) + renderDesignCompareCard('design.spineStressTest');
  }

  const html = `
    <p class="screen-eyebrow">Now let's see if it holds.</p>
    <h1 class="screen-question">Does your spine survive these swaps?</h1>

    ${STRESS_TEST_ITEMS.map((item) => `
      <div style="margin-bottom: var(--space-3);">
        <p style="margin-bottom: 0.5rem;">${item.label}</p>
        <div style="display:flex; gap:0.6rem;">
          <button class="btn-quiet stress-toggle" data-key="${item.key}" data-value="true" style="border-radius:var(--radius); padding:0.5rem 1rem; ${stressTest[item.key] === true ? 'border-color:var(--color-accent); color:var(--color-ink);' : ''}">Still makes sense</button>
          <button class="btn-quiet stress-toggle" data-key="${item.key}" data-value="false" style="border-radius:var(--radius); padding:0.5rem 1rem; ${stressTest[item.key] === false ? 'border-color:var(--color-accent); color:var(--color-ink);' : ''}">Falls apart</button>
        </div>
      </div>
    `).join('')}

    <div id="review-zone">${reviewHtml}</div>

    <div class="actions-row">
      <button class="btn" id="continue-btn">Continue</button>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.querySelectorAll('.stress-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const value = btn.dataset.value === 'true';
      const updated = Object.assign({}, Store.getActiveProject().design.stressTest);
      updated[key] = value;
      Store.updateField('design.stressTest', updated);
      ViewDesignStressTest(projectId); // re-render to show selection + possibly the review
    });
  });

  document.getElementById('continue-btn').addEventListener('click', () => {
    const fresh = Store.getActiveProject().design.stressTest;
    const stillAllAnswered = STRESS_TEST_ITEMS.every((item) => fresh[item.key] !== null);
    if (!stillAllAnswered) return;
    Router.navigate(`/project/${projectId}/design/chapters`);
  });
}

// ---- Part B: Chapter Map ---------------------------------------------------

function ViewDesignChapters(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  const chapters = project.design.chapters;

  const chapterRows = chapters.map((ch, i) => `
    <div class="chapter-row" data-idx="${i}">
      <span class="chapter-row-num">${i + 1}</span>
      <input class="chapter-row-title" data-idx="${i}" value="${escapeHtml(ch.text)}" placeholder="What happens in this chapter?" />
      <button class="icon-btn remove-chapter-btn" data-idx="${i}" aria-label="Remove" style="padding:0.3rem 0.6rem;">×</button>
    </div>
  `).join('');

  const html = `
    <p class="screen-eyebrow">Now let's map the chapters.</p>
    <h1 class="screen-question">Add your chapters, in order.</h1>
    <p style="color:var(--color-ink-faint); margin-bottom: var(--space-3);">One line each — just the core idea of what happens.</p>

    <div class="chapter-list" id="chapter-list">${chapterRows}</div>
    <button class="btn-quiet" id="add-chapter-btn" style="border-radius:var(--radius); padding:0.6rem 1.2rem;">+ Add a chapter</button>

    <div id="review-zone"></div>

    <div class="actions-row">
      <button class="btn" id="check-spine-btn">Check against my spine</button>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  function persistChapters() {
    const inputs = document.querySelectorAll('.chapter-row-title');
    const updated = Array.from(inputs).map((input, i) => ({ id: i, text: input.value }));
    Store.updateField('design.chapters', updated);
  }

  document.getElementById('add-chapter-btn').addEventListener('click', () => {
    persistChapters();
    const updated = Store.getActiveProject().design.chapters.concat([{ id: Date.now(), text: '' }]);
    Store.updateField('design.chapters', updated);
    ViewDesignChapters(projectId);
  });

  document.querySelectorAll('.remove-chapter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      persistChapters();
      const idx = parseInt(btn.dataset.idx, 10);
      const updated = Store.getActiveProject().design.chapters.filter((_, i) => i !== idx);
      Store.updateField('design.chapters', updated);
      ViewDesignChapters(projectId);
    });
  });

  document.querySelectorAll('.chapter-row-title').forEach((input) => {
    input.addEventListener('blur', persistChapters);
  });

  document.getElementById('check-spine-btn').addEventListener('click', () => {
    persistChapters();
    const fresh = Store.getActiveProject();
    const findings = DesignReview.checkChapterSpine(fresh.design.chapters, fresh.design.spine);
    Store.updateField('design.chapterFindings', findings);

    if (findings.length === 0) {
      document.getElementById('review-zone').innerHTML =
        '<div class="no-issues-banner">Every chapter connects to your spine. Good shape.</div>';
    } else {
      document.getElementById('review-zone').innerHTML = findings.map((f) => `
        <div class="review-card">
          <div class="review-eyebrow">Worth a look</div>
          <div class="review-headline">${escapeHtml(f.headline)}</div>
          <div class="review-explanation">${escapeHtml(f.whatWeFound)} ${escapeHtml(f.whyItMatters)}</div>
        </div>
      `).join('') + renderDesignCompareCard('design.chapterSpineCheck');
      // Note: DS4 findings carry a fixRoute (Structure → Chapter Map),
      // but it's intentionally NOT rendered here — it would link back
      // to this exact screen, providing no real navigation value. The
      // field stays on the finding object for cases where the SAME
      // finding might be surfaced elsewhere later (e.g. a future
      // cross-phase summary), where the link would be meaningful.
    }

    Store.completePhase('design');
  });
}

// ---- shared render helpers --------------------------------------------

function renderDesignReviewCard(review) {
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

function renderDesignCompareCard(evidencePath) {
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
