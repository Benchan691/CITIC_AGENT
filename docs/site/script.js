/* CITIC_AGENT docs site — optional progressive enhancement only.
   Everything here is optional: without JavaScript, all content, navigation,
   links, and the clickable inline SVG diagrams still work.
   Verified against commit 56c8dd21492a5c36cb9f3eaa3da01160aba40033 (2026-09-12). */
(function () {
  'use strict';

  /* ---------- 1. Site search (Ctrl/Cmd+K or the Search button) ---------- */
  function buildIndex() {
    var article = document.querySelector('article.page');
    if (!article) return [];
    var items = [];
    var sections = article.querySelectorAll('h2[id], h3[id]');
    sections.forEach(function (h) {
      var sectionText = [];
      var el = h.nextElementSibling;
      while (el && !/^H[23]$/.test(el.tagName)) {
        sectionText.push(el.textContent);
        el = el.nextElementSibling;
      }
      items.push({
        id: h.id,
        title: h.textContent.trim(),
        text: sectionText.join(' ').replace(/\s+/g, ' ').slice(0, 600),
        page: document.title.replace(' — CITIC SOC Agent documentation', '')
      });
    });
    return items;
  }

  function openSearch() {
    var overlay = document.getElementById('search-overlay');
    if (!overlay) return;
    overlay.hidden = false;
    var input = overlay.querySelector('input');
    input.value = '';
    renderResults(overlay, []);
    overlay.querySelector('.search-close').focus();
    input.focus();
  }

  function closeSearch() {
    var overlay = document.getElementById('search-overlay');
    if (overlay) overlay.hidden = true;
  }

  function renderResults(overlay, matches) {
    var list = overlay.querySelector('ul');
    list.innerHTML = '';
    if (!matches.length) {
      var li = document.createElement('li');
      li.className = 'search-empty';
      li.textContent = 'Type to search this page’s sections — titles and body text.';
      list.appendChild(li);
      return;
    }
    matches.forEach(function (m) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + m.id;
      a.innerHTML = '<strong>' + m.title + '</strong><span>' +
        m.snippet + '</span>';
      a.addEventListener('click', closeSearch);
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function snippetFor(text, query) {
    var idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text.slice(0, 90);
    var start = Math.max(0, idx - 25);
    return (start > 0 ? '…' : '') + text.slice(start, idx + query.length + 55) + '…';
  }

  function initSearch() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    var btn = document.createElement('button');
    btn.className = 'search-button';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Search this page (Ctrl+K)');
    btn.innerHTML = 'Search <kbd>Ctrl K</kbd>';
    btn.addEventListener('click', openSearch);
    nav.appendChild(btn);

    var overlay = document.createElement('div');
    overlay.id = 'search-overlay';
    overlay.hidden = true;
    overlay.innerHTML = '<div class="search-panel" role="dialog" aria-modal="true" aria-label="Search this page">' +
      '<div class="search-bar"><input type="search" placeholder="Search sections…" aria-label="Search sections">' +
      '<button type="button" class="search-close" aria-label="Close search">Esc ✕</button></div>' +
      '<ul class="search-results"></ul></div>';
    document.body.appendChild(overlay);

    var index = buildIndex();
    var input = overlay.querySelector('input');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      if (!q) { renderResults(overlay, []); return; }
      var matches = index
        .map(function (item) {
          var t = (item.title + ' ' + item.text).toLowerCase();
          var score = (item.title.toLowerCase().indexOf(q) !== -1 ? 2 : 0) +
                      (t.indexOf(q) !== -1 ? 1 : 0);
          return score ? { item: item, score: score,
            snippet: snippetFor(item.text, q) } : null;
        })
        .filter(Boolean)
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 8)
        .map(function (m) { return { id: m.item.id, title: m.item.title, snippet: m.snippet }; });
      renderResults(overlay, matches);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeSearch();
    });
    overlay.querySelector('.search-close').addEventListener('click', closeSearch);
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); openSearch();
      } else if (e.key === 'Escape') {
        closeSearch();
      }
    });
  }

  /* ---------- 2. Scrollspy: highlight the current ToC entry ---------- */
  function initScrollspy() {
    var tocLinks = document.querySelectorAll('aside.toc nav a[href^="#"]');
    if (!tocLinks.length || !('IntersectionObserver' in window)) return;
    var map = {};
    tocLinks.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      map[id] = a;
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = map[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          tocLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
          link.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '0px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) {
      var target = document.getElementById(id);
      if (target) observer.observe(target);
    });
  }

  /* ---------- 3. Diagram helper: expose node descriptions as focusable text ---------- */
  function initDiagrams() {
    document.querySelectorAll('.svg-inline svg a[data-node]').forEach(function (a) {
      var title = a.querySelector('title') ? '' : ' aria-label="' + (a.textContent || 'diagram node') + '"';
      a.setAttribute('tabindex', '0');
      if (title) a.setAttribute('aria-label', a.textContent.trim());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
  function boot() {
    try { initSearch(); } catch (e) { /* optional */ }
    try { initScrollspy(); } catch (e) { /* optional */ }
    try { initDiagrams(); } catch (e) { /* optional */ }
  }
})();
