/**
 * APP.JS — bootstrap
 * ─────────────────────────────────────────────────────────────
 * Wires hash routes to view functions. Nothing else lives here —
 * each view file owns its own rendering and event binding.
 */

(function () {
  const settings = Store.getState().settings;
  if (settings.highContrast) {
    document.documentElement.classList.add('high-contrast');
  }

  Router.add('#/', () => ViewWelcome());
  Router.add('#/entry-point', () => ViewEntryPoint());
  Router.add('#/dashboard', () => ViewDashboard());
  Router.add('#/settings', () => ViewSettings());
  Router.add('#/project/:id/discover/done', (p) => ViewDiscoverDone(p.id));
  Router.add('#/project/:id/discover/:step', (p) => ViewDiscoverStep(p.id, p.step));
  Router.add('#/project/:id/refine/upload', (p) => ViewRefineUpload(p.id));
  Router.add('#/project/:id/refine/preview', (p) => ViewRefinePreview(p.id));
  Router.add('#/project/:id/refine/report', (p) => ViewRefineReport(p.id));
  Router.add('#/project/:id/refine/issue/:idx', (p) => ViewRefineIssueDetail(p.id, p.idx));
  Router.add('#/project/:id/design/spine', (p) => ViewDesignSpine(p.id));
  Router.add('#/project/:id/design/stress-test', (p) => ViewDesignStressTest(p.id));
  Router.add('#/project/:id/design/chapters', (p) => ViewDesignChapters(p.id));
  Router.add('#/project/:id/package/titles', (p) => ViewPackageTitles(p.id));
  Router.add('#/project/:id/package/subtitle', (p) => ViewPackageSubtitle(p.id));
  Router.add('#/project/:id/package/cover-brief', (p) => ViewPackageCoverBrief(p.id));
  Router.add('#/project/:id/package/review', (p) => ViewPackageReview(p.id));
  Router.add('#/project/:id/publish/checklist', (p) => ViewPublishChecklist(p.id));
  Router.add('#/project/:id/publish/description', (p) => ViewPublishDescription(p.id));

  Router.start();
})();
