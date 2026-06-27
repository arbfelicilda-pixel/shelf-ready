/**
 * VIEWS-SHELL.JS
 * ─────────────────────────────────────────────────────────────
 * Welcome screen, Dashboard ("My Books"), entry-point selector.
 * These are the screens a brand-new, non-technical user sees
 * first — per the locked "conversation, not dashboard" decision,
 * even the dashboard itself stays minimal: book name, a progress
 * cue with no numbers, one Continue button.
 */

function renderShell(innerHTML) {
  const activeProject = Store.getActiveProject();
  const projectLabel = activeProject
    ? `<span class="app-current-book">${escapeHtml(activeProject.name)}</span>`
    : '';
  return `
    <div id="app">
      <header class="app-header">
        <a href="#/dashboard" class="app-brand">Shelf Ready ${projectLabel}</a>
        <div class="app-header-actions">
          <button class="icon-btn" id="settings-btn" aria-label="Settings">Settings</button>
        </div>
      </header>
      <main class="app-main">
        <div class="screen">${innerHTML}</div>
      </main>
    </div>
  `;
}

function mountShellChrome() {
  const btn = document.getElementById('settings-btn');
  if (btn) btn.addEventListener('click', () => Router.navigate('/settings'));
}

// ---- Welcome --------------------------------------------------------------

function ViewWelcome() {
  const html = `
    <h1 class="screen-question">Hi, I'm Arnie.</h1>
    <p style="font-size:1.15rem; margin-bottom: var(--space-4);">
      Let's build your next book together. You don't need to know publishing —
      I'll guide you one decision at a time, the same way I worked through it
      for my own books.
    </p>
    <div class="actions-row">
      <button class="btn" id="start-btn">Start</button>
      <a href="#/dashboard" class="btn-quiet" style="text-decoration:none; padding:0.75rem 1.2rem; border-radius:var(--radius); font-size:var(--scale-small);">
        I've used Shelf Ready before
      </a>
    </div>
  `;
  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();
  document.getElementById('start-btn').addEventListener('click', () => {
    Router.navigate('/entry-point');
  });
}

// ---- Entry point selector (returning-flow shortcut) ------------------------

function ViewEntryPoint() {
  const options = [
    { key: 'idea', label: "I have an idea.", route: 'discover' },
    { key: 'writing', label: "I'm writing.", route: 'design' },
    { key: 'editing', label: "I already have a manuscript.", route: 'refine-upload' },
    { key: 'publishing', label: "I'm almost ready to publish.", route: 'package' }
  ];

  const html = `
    <p class="screen-eyebrow">First, a quick question</p>
    <h1 class="screen-question">What would you like help with?</h1>
    <div style="display:flex; flex-direction:column; gap: var(--space-2);">
      ${options
        .map(
          (o) => `
        <button class="btn-quiet entry-option" data-route="${o.route}"
          style="text-align:left; padding: var(--space-2) var(--space-3); border-radius: var(--radius); font-size: var(--scale-body);">
          ${o.label}
        </button>`
        )
        .join('')}
    </div>
  `;
  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.querySelectorAll('.entry-option').forEach((el) => {
    el.addEventListener('click', () => {
      const project = Store.createProject('Untitled Book');
      if (el.dataset.route === 'discover') {
        Router.navigate(`/project/${project.id}/discover/workingTitle`);
      } else if (el.dataset.route === 'refine-upload') {
        Router.navigate(`/project/${project.id}/refine/upload`);
      } else if (el.dataset.route === 'design') {
        Router.navigate(`/project/${project.id}/design/spine`);
      } else if (el.dataset.route === 'package') {
        Router.navigate(`/project/${project.id}/package/titles`);
      } else {
        Router.navigate(`/dashboard`);
      }
    });
  });
}

// ---- Dashboard --------------------------------------------------------------

function phaseProgressLabel(project) {
  const order = ['discover', 'design', 'write', 'refine', 'package', 'publish'];
  const doneCount = order.filter((p) => project.flags[p + 'Complete']).length;
  if (doneCount === 0) return 'Just getting started';
  if (doneCount === order.length) return 'Ready to publish';
  return `${doneCount} of ${order.length} stages complete`;
}

function resumeRoute(project) {
  if (project.flags.packageComplete && !project.flags.publishComplete) {
    return `/project/${project.id}/publish/checklist`;
  }
  if (project.refine && project.refine.manuscript && !project.flags.packageComplete) {
    return project.refine.findings && project.refine.findings.length
      ? `/project/${project.id}/refine/report`
      : `/project/${project.id}/refine/preview`;
  }
  if (project.design && project.design.spine && project.design.spine.protagonist) {
    if (!project.flags.designComplete) {
      const stressDone = ['stakesRemoved', 'protagonistSwapped', 'problemSwapped']
        .every((k) => project.design.stressTest[k] !== null);
      if (!stressDone) return `/project/${project.id}/design/stress-test`;
      return `/project/${project.id}/design/chapters`;
    }
  }
  if (!project.flags.discoverComplete) {
    const fields = ['workingTitle', 'concept', 'reader', 'promise', 'positioning'];
    const firstUnfilled = fields.find((f) => !project.discover[f] || project.discover[f] === '');
    return `/project/${project.id}/discover/${firstUnfilled || 'workingTitle'}`;
  }
  // Future phases land here once built; for now, return to discover summary.
  return `/project/${project.id}/discover/done`;
}

function ViewDashboard() {
  const projects = Store.listProjects();

  const bookCards = projects.length
    ? projects
        .map(
          (p) => `
        <div class="book-card">
          <div style="flex:1;">
            <input class="book-card-title-input" data-id="${p.id}" value="${escapeHtml(p.name)}" aria-label="Book title" />
            <div class="book-card-progress">${phaseProgressLabel(p)}</div>
          </div>
          <button class="btn resume-btn" data-id="${p.id}">Continue →</button>
        </div>`
        )
        .join('')
    : `<p style="color:var(--color-ink-faint);">No books yet. Start your first one below.</p>`;

  const html = `
    <p class="screen-eyebrow">My Books</p>
    <h1 class="screen-question">Welcome back.</h1>
    <div style="margin-bottom: var(--space-4);">${bookCards}</div>
    <button class="btn-quiet" id="new-book-btn" style="border-radius:var(--radius); padding:0.75rem 1.4rem;">
      + Start a new book
    </button>
  `;
  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.getElementById('new-book-btn').addEventListener('click', () => Router.navigate('/entry-point'));

  document.querySelectorAll('.book-card-title-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      Store.renameProject(e.target.dataset.id, e.target.value);
    });
    // Pressing Enter should commit the rename and move focus away,
    // rather than leave the user wondering whether it saved.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
  });

  document.querySelectorAll('.resume-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const project = Store.getState().projects[btn.dataset.id];
      Store.setActiveProject(btn.dataset.id);
      Router.navigate(resumeRoute(project));
    });
  });
}

// ---- tiny shared util --------------------------------------------------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Renders a "Fix in: [Phase] → [Field]" link for a finding's fixRoute,
 * if one exists. Per the locked decision: only findings with a REAL,
 * defensible destination get a link — roughly a third of all findings,
 * since most are manuscript-wide patterns with no single field to
 * route back to. No fixRoute means no link, never a fake one.
 */
function renderFixRouteLink(projectId, fixRoute) {
  if (!fixRoute) return '';
  return `
    <a href="#/project/${projectId}/${fixRoute.path}" class="fix-route-link">
      Fix in: ${escapeHtml(fixRoute.phase)} → ${escapeHtml(fixRoute.field)}
    </a>
  `;
}
