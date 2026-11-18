// ==UserScript==
// @name         GitHub: My Pull Requests Button
// @namespace    https://github.com/chirag127
// @version      1.0.0
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
    if (document.getElementById(ID)) return;

    const nav =
      document.querySelector('.AppHeader-nav') ||
      document.querySelector('nav[aria-label="Global"]') ||
      document.querySelector('header nav');
    if (!nav) return;

    const templateLink = nav.querySelector('a[href]');
    const template = templateLink ? templateLink.closest('li') || templateLink : null;
    const item = template ? template.cloneNode(true) : document.createElement('li');
    const link = item.tagName.toLowerCase() === 'a' ? item : item.querySelector('a[href]') || document.createElement('a');

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
    if (!link.parentNode || link.parentNode !== item) item.appendChild(link);

    const host = nav.tagName.toLowerCase() === 'ul' ? nav : nav.querySelector('ul') || nav;
    host.appendChild(item);
  }

  mount();
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
})();
