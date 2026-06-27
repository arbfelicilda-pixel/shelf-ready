/**
 * VIEWS-SETTINGS.JS
 * ─────────────────────────────────────────────────────────────
 * Accessibility toggles + Export/Import. Kept on its own screen,
 * away from the conversational flow, since these are utility
 * actions, not part of the book-building conversation.
 */

function ViewSettings() {
  const settings = Store.getState().settings;
  const activeProject = Store.getActiveProject();

  const html = `
    <p class="screen-eyebrow">Settings</p>
    <h1 class="screen-question">Make this yours.</h1>

    <div style="margin-bottom: var(--space-4);">
      <label style="display:flex; align-items:center; gap:0.6rem; margin-bottom:var(--space-2); cursor:pointer;">
        <input type="checkbox" id="high-contrast-toggle" ${settings.highContrast ? 'checked' : ''} />
        High contrast mode
      </label>
      <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
        <input type="checkbox" id="tts-toggle" ${settings.ttsEnabled ? 'checked' : ''} />
        Enable read-aloud for dialogue tools
      </label>
    </div>

    <h2>Back up your work</h2>
    <p style="color:var(--color-ink-faint); font-size:var(--scale-small);">
      Export saves a file to your computer. Import loads one back in —
      useful for switching devices or keeping a backup.
    </p>
    <div class="actions-row" style="margin-top:var(--space-2);">
      <button class="btn-quiet" id="export-project-btn" style="border-radius:var(--radius); padding:0.6rem 1rem; font-size:var(--scale-small);" ${activeProject ? '' : 'disabled'}>
        Export this book
      </button>
      <button class="btn-quiet" id="export-workspace-btn" style="border-radius:var(--radius); padding:0.6rem 1rem; font-size:var(--scale-small);">
        Export everything
      </button>
      <label class="btn-quiet" style="border-radius:var(--radius); padding:0.6rem 1rem; font-size:var(--scale-small); cursor:pointer;">
        Import a file
        <input type="file" id="import-input" accept="application/json" style="display:none;" />
      </label>
    </div>
    <div id="import-status" style="margin-top:var(--space-2); font-size:var(--scale-small);"></div>

    <div class="actions-row">
      <a href="#/dashboard" class="btn" style="text-decoration:none;">Done</a>
    </div>
  `;

  document.getElementById('app-root').innerHTML = renderShell(html);
  mountShellChrome();

  document.getElementById('high-contrast-toggle').addEventListener('change', (e) => {
    Store.updateSettings({ highContrast: e.target.checked });
    document.documentElement.classList.toggle('high-contrast', e.target.checked);
  });

  document.getElementById('tts-toggle').addEventListener('change', (e) => {
    Store.updateSettings({ ttsEnabled: e.target.checked });
  });

  document.getElementById('export-project-btn').addEventListener('click', () => {
    downloadJSON(Store.exportData('project'), sanitizeFilename((activeProject?.name || 'book')) + '.shelfready.json');
  });

  document.getElementById('export-workspace-btn').addEventListener('click', () => {
    downloadJSON(Store.exportData('workspace'), 'shelf-ready-workspace-backup.json');
  });

  document.getElementById('import-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const result = Store.importData(payload);
        const statusEl = document.getElementById('import-status');
        if (result.ok) {
          statusEl.textContent = 'Imported successfully.';
          statusEl.style.color = 'var(--color-pass)';
          setTimeout(() => Router.navigate('/dashboard'), 800);
        } else {
          statusEl.textContent = "That file didn't look right: " + result.error;
          statusEl.style.color = 'var(--color-accent)';
        }
      } catch (err) {
        document.getElementById('import-status').textContent = "Couldn't read that file. Make sure it's a Shelf Ready export.";
        document.getElementById('import-status').style.color = 'var(--color-accent)';
      }
    };
    reader.readAsText(file);
  });
}

function downloadJSON(data, filename) {
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
  return (name || 'export').replace(/[^a-z0-9\-_]+/gi, '-').toLowerCase();
}
