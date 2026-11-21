// ==UserScript==
// @name         GitHub: My Pull Requests Button
// @namespace    https://github.com/chirag127
// @version      1.0.2
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
    // A partial removal can leave one of our wrappers with no link inside it.
    // Drop those before deciding whether a live link is already mounted.
    // Skip anchors: a foreign script's direct anchor may carry our class.
    for (const wrapper of document.querySelectorAll('.chirag-gh-nav-button')) {
      if (wrapper.tagName !== 'A' && !wrapper.querySelector('a[href]')) wrapper.remove();
    }
    if (document.getElementById(ID)) return;

    const nav =
      document.querySelector('.AppHeader-nav') ||
      document.querySelector('nav[aria-label="Global"]') ||
      document.querySelector('header nav');
    if (!nav) return;

    const host = nav.matches('ul, ol') ? nav : nav.querySelector('ul, ol') || nav;
    const templateLink = host.querySelector('a[href]:not(.chirag-gh-nav-button):not(.chirag-gh-nav-button a)');
    const list = host.matches('ul, ol');
    const templateItem = templateLink?.closest('li');
    const item = list
      ? templateItem?.parentElement === host ? templateItem.cloneNode(true) : document.createElement('li')
      : templateLink ? templateLink.cloneNode(false) : document.createElement('a');
    const link = item.tagName === 'A' ? item : item.querySelector('a[href]') || document.createElement('a');

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
