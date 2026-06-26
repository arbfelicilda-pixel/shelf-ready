/**
 * VIEWS-DISCOVER.JS
 * ─────────────────────────────────────────────────────────────
 * The conversational Discover flow. This is the screen pattern
 * the entire rest of the app will repeat:
 *
 *   Question → Answer → Editorial Review → Compare with Author → Continue
 *
 * One question per screen. No step counters. Ambient progress
 * only. Review fires on Continue, not on every keystroke — a
 * person should get to finish a thought before being graded.
 */

const DISCOVER_STEPS = ['workingTitle', 'concept', 'reader', 'promise', 'positioning'];

const DISCOVER_CONTENT = {
  workingTitle: {
    eyebrow: "Let's start with your book.",
    question: "What's the working title? (It can change later.)",
    placeholder: 'e.g. The Invisible Mind',
    type: 'text'
  },
  concept: {
    eyebrow: 'Tell me what it\u2019s about.',
    question: 'Describe your book in one sentence.',
    placeholder: 'Helps overlooked employees stop apologizing for asking to be seen.',
    type: 'textarea'
  },
  reader: {
    eyebrow: "Who is this for?",
    question: 'Who do you want this book to help? Be as specific as you can.',
    placeholder: 'e.g. Mid-career professionals who feel invisible after being passed over for promotion',
    type: 'textarea'
  },
  promise: {
    eyebrow: 'What changes for them?',
    question: "By the end of this book, what will your reader know, feel, or be able to do that they couldn't before?",
    placeholder: 'e.g. Speak up in meetings without rehearsing it for three days first',
    type: 'textarea'
  },
  positioning: {
    eyebrow: 'Where would this sit on a shelf?',
    question: 'If your book were on a real shelf, which two or three books would be its neighbors?',
    type: 'positioning'
  }
};

function runReviewFor(step, project) {
  switch (step) {
    case 'concept':
      return DiscoverReview.reviewConcept(project.discover.concept);
    case 'reader':
      return DiscoverReview.reviewReader(project.discover.reader);
    case 'promise':
      return DiscoverReview.reviewPromise(project.discover.promise);
    case 'positioning':
      return DiscoverReview.reviewPositioning(project.discover.positioning, project.discover.positioningComps);
    default:
      return null; // workingTitle has no review, by design
  }
}

function evidencePathFor(step) {
  const map = {
    concept: 'evidence.book01.discover.concept',
    reader: 'evidence.book01.discover.reader',
    promise: 'evidence.book01.discover.promise',
    positioning: 'evidence.book01.discover.positioning'
  };
  return map[step] || null;
}

function confidenceKeyFor(step) {
  const map = {
    concept: 'conceptClarity',
    reader: 'readerClarity',
    promise: 'promiseClarity',
    positioning: 'positioningClarity'
  };
  return map[step];
}

function renderAmbientProgress(currentIndex) {
  return `
    <div class="ambient-progress" aria-hidden="true">
      ${DISCOVER_STEPS.map((_, i) => `<div class="ambient-progress-segment ${i <= currentIndex ? 'filled' : ''}"></div>`).join('')}
    </div>
  `;
}

function renderReviewCard(review) {
  if (!review || !review.headline) return '';
  const passClass = review.verdict === 'pass' ? 'pass' : '';
  const eyebrow = review.verdict === 'pass' ? 'Looks good' : 'Worth a second look';
  return `
    <div class="review-card ${passClass}">
      <div class="review-eyebrow">${eyebrow}</div>
      <div class="review-headline">${escapeHtml(review.headline)}</div>
      ${review.explanation ? `<div class="review-explanation">${escapeHtml(review.explanation)}</div>` : ''}
      ${
        review.suggestions && review.suggestions.length
          ? `<ul class="review-suggestions">${review.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
          : ''
      }
    </div>
  `;
}

function renderCompareCard(evidencePath) {
  if (!evidencePath) return '';
  const ev = getEvidence(evidencePath);
  if (ev.status !== 'complete') {
    return `
      <div class="compare-card">
        <div class="compare-byline">
          <div class="compare-avatar">A</div>
          <div class="compare-label">Why I made this decision</div>
        </div>
        <div class="compare-pending">No decision written for this yet. Check back soon.</div>
      </div>
    `;
  }
  return `
    <div class="compare-card">
      <div class="compare-byline">
        <div class="compare-avatar">A</div>
        <div class="compare-label">Why I made this decision</div>
      </div>
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
 * Renders one Discover step. `reviewShown` indicates whether the
 * user has pressed Continue at least once on this screen already
 * (review + compare only appear after a first attempt, never
 * before the person has had a chance to answer).
 */
function ViewDiscoverStep(projectId, step) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  if (!project) return Router.navigate('/dashboard');

  const content = DISCOVER_CONTENT[step];
  if (!content) return Router.navigate(`/project/${projectId}/discover/workingTitle`);

  const stepIndex = DISCOVER_STEPS.indexOf(step);
  const currentValue = project.discover[step] || '';
  let reviewHtml = '';
  let compareHtml = '';

  // If the field already has a value (returning to a completed step),
  // show the review immediately rather than make them re-press Continue.
  const hasExistingValue = step === 'positioning'
    ? project.discover.positioningComps.some((c) => c && c.trim())
    : currentValue.trim().length > 0;

  if (hasExistingValue && step !== 'workingTitle') {
    const review = runReviewFor(step, project);
    reviewHtml = renderReviewCard(review);
    compareHtml = renderCompareCard(evidencePathFor(step));
  }

  let fieldHtml = '';
  if (content.type === 'text') {
    fieldHtml = `<input class="field" id="discover-input" type="text" placeholder="${content.placeholder}" value="${escapeHtml(currentValue)}" />`;
  } else if (content.type === 'textarea') {
    fieldHtml = `<textarea class="field" id="discover-input" rows="3" placeholder="${content.placeholder}">${escapeHtml(currentValue)}</textarea>`;
  } else if (content.type === 'positioning') {
    const comps = project.discover.positioningComps;
    fieldHtml = `
      <input class="field" id="comp-1" type="text" placeholder="First comparable book" value="${escapeHtml(comps[0] || '')}" style="margin-bottom:0.6rem;" />
      <input class="field" id="comp-2" type="text" placeholder="Second comparable book" value="${escapeHtml(comps[1] || '')}" />
    `;
  }

  const html = `
    ${renderAmbientProgress(stepIndex)}
    <p class="screen-eyebrow">${content.eyebrow}</p>
    <h1 class="screen-question">${content.question}</h1>
    ${fieldHtml}
    ${step !== 'positioning' && content.type !== 'text' ? `<div class="field-hint" id="field-hint"></div>` : ''}
    <div id="review-zone">${reviewHtml}${compareHtml}</div>
    <div class="actions-row">
      <button class="btn" id="continue-btn">Continue</button>
      ${stepIndex > 0 ? `<button class="btn-quiet" id="back-btn" style="border-radius:var(--radius); padding:0.75rem 1.2rem;">Back</button>` : ''}
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Router.navigate(`/project/${projectId}/discover/${DISCOVER_STEPS[stepIndex - 1]}`);
    });
  }

  document.getElementById('continue-btn').addEventListener('click', () => {
    // Save current input(s) into state.
    if (content.type === 'positioning') {
      const c1 = document.getElementById('comp-1').value;
      const c2 = document.getElementById('comp-2').value;
      Store.updateField('discover.positioningComps', [c1, c2]);
      Store.updateField('discover.positioning', [c1, c2].filter(Boolean).join(', '));
    } else {
      const val = document.getElementById('discover-input').value;
      Store.updateField(`discover.${step}`, val);
    }

    const refreshedProject = Store.getActiveProject();
    const review = runReviewFor(step, refreshedProject);

    if (review) {
      Store.setConfidence(confidenceKeyFor(step), review.confidenceLevel);
    }

    const alreadyShowingReview = document.getElementById('review-zone').innerHTML.trim().length > 0;

    if (review && !alreadyShowingReview && step !== 'workingTitle') {
      // First Continue press on this screen: show the review + compare,
      // let the person read it, don't auto-advance.
      document.getElementById('review-zone').innerHTML =
        renderReviewCard(review) + renderCompareCard(evidencePathFor(step));
      return;
    }

    // Either no review needed (workingTitle) or review already shown —
    // advance to next step or finish the phase.
    advanceFromStep(projectId, stepIndex);
  });
}

function advanceFromStep(projectId, stepIndex) {
  if (stepIndex < DISCOVER_STEPS.length - 1) {
    Router.navigate(`/project/${projectId}/discover/${DISCOVER_STEPS[stepIndex + 1]}`);
  } else {
    Store.completePhase('discover');
    Router.navigate(`/project/${projectId}/discover/done`);
  }
}

// ---- Discover milestone summary --------------------------------------------

function confidenceDots(level) {
  const levels = { unset: 0, weak: 1, developing: 3, clear: 5 };
  const lit = levels[level] || 0;
  const cls = level === 'clear' ? 'lit-pass' : 'lit';
  let dots = '';
  for (let i = 0; i < 5; i++) {
    dots += `<span class="confidence-dot ${i < lit ? cls : ''}"></span>`;
  }
  return `<div class="confidence-dots">${dots}</div>`;
}

function ViewDiscoverDone(projectId) {
  Store.setActiveProject(projectId);
  const project = Store.getActiveProject();
  if (!project) return Router.navigate('/dashboard');

  const c = project.confidence;
  const html = `
    <div class="milestone"><span class="check">✓</span> Discover is complete.</div>
    <h1 class="screen-question">Here's where ${escapeHtml(project.name)} stands.</h1>

    <div style="background:var(--color-bg-raised); border:1px solid var(--color-rule); border-radius:var(--radius); padding: var(--space-3); margin-bottom: var(--space-4);">
      <div class="confidence-row"><span>Concept clarity</span>${confidenceDots(c.conceptClarity)}</div>
      <div class="confidence-row"><span>Reader clarity</span>${confidenceDots(c.readerClarity)}</div>
      <div class="confidence-row"><span>Promise clarity</span>${confidenceDots(c.promiseClarity)}</div>
      <div class="confidence-row"><span>Positioning</span>${confidenceDots(c.positioningClarity)}</div>
    </div>

    <p>Next, we shape the structure — the narrative spine and chapter map that
    everything else gets built on. That part of Shelf Ready is coming soon.</p>

    <div class="actions-row">
      <button class="btn-quiet" id="review-discover-btn" style="border-radius:var(--radius); padding:0.75rem 1.2rem;">
        Review my answers
      </button>
      <a href="#/dashboard" class="btn" style="text-decoration:none;">Back to My Books</a>
    </div>
  `;
  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.getElementById('review-discover-btn').addEventListener('click', () => {
    Router.navigate(`/project/${projectId}/discover/workingTitle`);
  });
}
