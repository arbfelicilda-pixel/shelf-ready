/**
 * ROUTER.JS
 * ─────────────────────────────────────────────────────────────
 * Hash-based routing only. History API routing breaks under
 * file://, hash routing does not — that's the whole reason this
 * is a hash router and not something fancier.
 *
 * Routes (v1 build slice):
 *   #/                              → Welcome / entry point selector
 *   #/dashboard                     → My Books
 *   #/new-project                   → name a new book
 *   #/project/:id/discover/:step    → conversational Discover flow
 *   #/project/:id/discover/done     → Discover milestone summary
 *   #/project/:id/refine/upload     → manuscript upload
 *   #/project/:id/refine/preview    → Book Preview (editable confirmation)
 *   #/project/:id/refine/report     → Editorial Review (severity-tiered findings)
 *   #/project/:id/refine/issue/:idx → single issue, four-part detail view
 *   #/project/:id/design/spine      → narrative spine builder
 *   #/project/:id/design/stress-test → spine stress test
 *   #/project/:id/design/chapters   → chapter map + spine check
 *   #/project/:id/package/titles    → title candidates
 *   #/project/:id/package/subtitle  → subtitle builder
 *   #/project/:id/package/cover-brief → cover brief builder
 *   #/project/:id/package/review    → package consistency review
 *   #/project/:id/publish/checklist → launch checklist
 *   #/project/:id/publish/description → author bio + book description
 *   #/project/:id/publish/report   → final Shelf Ready Report
 *   #/settings                      → high contrast, TTS, reduced motion
 */

const Router = (function () {
  const routes = [];

  function add(pattern, handler) {
    const paramNames = [];
    const regexStr = pattern
      .replace(/^#/, '')
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          paramNames.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    const regex = new RegExp('^' + regexStr + '$');
    routes.push({ regex, paramNames, handler });
  }

  function resolve() {
    const hash = window.location.hash || '#/';
    const path = hash.replace(/^#/, '') || '/';

    for (const route of routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => (params[name] = match[i + 1]));
        route.handler(params);
        return;
      }
    }
    navigate('/');
  }

  function navigate(path) {
    window.location.hash = '#' + path;
  }

  function start() {
    window.addEventListener('hashchange', resolve);
    window.addEventListener('DOMContentLoaded', resolve);
    resolve();
  }

  return { add, navigate, start };
})();
