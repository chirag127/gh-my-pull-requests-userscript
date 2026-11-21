// ==UserScript==
// @name         GitHub: My Pull Requests Button
// @namespace    https://github.com/chirag127
// @version      1.0.4
// @description  Adds a "My pull requests" button to GitHub's header that opens all pull requests involving your account.
// @author       chirag127
// @match        https://github.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/chirag127/gh-my-pull-requests-userscript/main/gh-my-pull-requests-userscript.user.js
// @downloadURL  https://raw.githubusercontent.com/chirag127/gh-my-pull-requests-userscript/main/gh-my-pull-requests-userscript.user.js
// ==/UserScript==

(() => {
  'use strict';

  const ID = 'chirag-my-pull-requests-link';
  const HREF = 'https://github.com/pulls';
  const LABEL = 'My pull requests';

  function mount() {
    // The common case: a healthy mounted link needs no document-wide work.
    if (document.getElementById(ID)) return;

    // Reconcile only nodes carrying this script's marker. A marked link that
    // lost its id is restored; a marked wrapper without a marked link is ours
    // to remove. Foreign nodes and the other script's markers are untouched.
    for (const owned of document.querySelectorAll('[data-chirag-nav-id="' + ID + '"]')) {
      if (!owned.parentNode) continue;
      if (owned.tagName === 'A') {
        if (!owned.getAttribute('href')) owned.remove();
        else if (owned.id !== ID) owned.id = ID;
        continue;
      }
      const ownedLink = Array.from(owned.querySelectorAll('a[href]'))
        .find(a => a.getAttribute('href') === HREF);
      if (!ownedLink || !ownedLink.getAttribute('href')) owned.remove();
      else if (ownedLink.id !== ID) ownedLink.id = ID;
    }
    if (document.getElementById(ID)) return;

    const nav =
      document.querySelector('.AppHeader-nav') ||
      document.querySelector('nav[aria-label="Global"]') ||
      document.querySelector('header nav');
    if (!nav) return;

    let host = nav;
    if (!nav.matches('ul, ol')) {
      host = Array.from(nav.querySelectorAll('ul, ol'))
        .find(list => !list.closest('.chirag-gh-nav-button')) || nav;
    }
    const templateLink = host.querySelector('a[href]:not(.chirag-gh-nav-button):not(.chirag-gh-nav-button a)');
    const list = host.matches('ul, ol');
    const templateItem = templateLink?.closest('li');
    // Clone the already-filtered native anchor; never reselect from a cloned
    // item, which could pick an excluded foreign anchor sharing that item.
    const link = templateLink ? templateLink.cloneNode(false) : document.createElement('a');
    const item = list
      ? templateItem?.parentElement === host ? templateItem.cloneNode(false) : document.createElement('li')
      : link;

    // A cloned breadcrumb can contain menu buttons, counters and duplicate ids.
    if (item !== link) item.replaceChildren(link);
    for (const element of new Set([item, link])) {
      for (const { name } of [...element.attributes]) {
        if (name !== 'class') element.removeAttribute(name);
      }
      element.classList.remove('active', 'selected');
    }

    item.removeAttribute('id');
    item.classList.add('chirag-gh-nav-button');
    item.setAttribute('data-chirag-nav-id', ID);
    link.id = ID;
    link.href = HREF;
    link.textContent = LABEL;
    link.title = LABEL;
    link.removeAttribute('data-hotkey');
    link.removeAttribute('aria-current');
    link.removeAttribute('data-selected-links');
    link.removeAttribute('data-ga-click');
    if (item !== link && link.parentNode !== item) item.appendChild(link);
    host.appendChild(item);
  }

  mount();
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
})();
