const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SCRIPT = 'gh-my-pull-requests-userscript.user.js';
const ID = 'chirag-my-pull-requests-link';
const HREF = 'https://github.com/pulls';
const LABEL = 'My pull requests';
const OTHER_ID = 'chirag-my-issues-link';
const source = fs.readFileSync(path.join(__dirname, SCRIPT), 'utf8');

// A strict fixture for the selectors and DOM operations these two scripts use.
// Unknown selectors fail rather than silently behaving unlike the browser.
class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.parentNode = null; this.children = []; this.attrs = new Map(); this.text = ''; }
  get parentElement() { return this.parentNode; }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  removeAttribute(name) { this.attrs.delete(name); }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get href() { return this.getAttribute('href') || ''; }
  set href(v) { this.setAttribute('href', v); }
  set title(v) { this.setAttribute('title', v); }
  get classList() {
    const values = () => (this.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    return { contains: c => values().includes(c), add: (...cs) => this.setAttribute('class', [...new Set([...values(), ...cs])].join(' ')), remove: (...cs) => this.setAttribute('class', values().filter(c => !cs.includes(c)).join(' ')) };
  }
  appendChild(child) {
    for (let n = this; n; n = n.parentNode) if (n === child) throw new Error('HierarchyRequestError');
    child.remove(); child.parentNode = this; this.children.push(child); return child;
  }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; } }
  replaceChildren(...children) { for (const c of [...this.children]) c.remove(); children.forEach(c => this.appendChild(c)); this.text = ''; }
  set textContent(value) { this.replaceChildren(); this.text = String(value); }
  get textContent() { return this.text + this.children.map(c => c.textContent).join(''); }
  cloneNode(deep) { const copy = new Element(this.tagName); copy.attrs = new Map(this.attrs); copy.text = this.text; if (deep) this.children.forEach(c => copy.appendChild(c.cloneNode(true))); return copy; }
  matches(selector) {
    return selector.split(',').some(s => {
      const exclusions = [...s.matchAll(/:not\(([^)]+)\)/g)].map(m => m[1]);
      s = s.replace(/:not\([^)]+\)/g, '').trim();
      if (exclusions.some(x => this.matches(x))) return false;
      if (s === '.chirag-gh-nav-button a' || s === 'header nav') {
        const [ancestor, tag] = s.split(' ');
        if (this.tagName !== tag.toUpperCase()) return false;
        for (let p = this.parentNode; p; p = p.parentNode) if (p.matches(ancestor)) return true;
        return false;
      }
      if (/^\.[\w-]+$/.test(s)) return this.classList.contains(s.slice(1));
      const part = s.match(/^([a-z]+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/i);
      assert.ok(part && (part[1] || part[2]), 'unsupported fixture selector: ' + s);
      return (!part[1] || this.tagName === part[1].toUpperCase()) && (!part[2] || (this.attrs.has(part[2]) && (part[3] === undefined || this.getAttribute(part[2]) === part[3])));
    });
  }
  closest(selector) { for (let n = this; n; n = n.parentNode) if (n.matches(selector)) return n; return null; }
  querySelectorAll(selector) { return descendants(this).filter(n => n.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
function descendants(node) { return node.children.flatMap(c => [c, ...descendants(c)]); }
function harness() {
  const document = new Element('document'); document.documentElement = document.appendChild(new Element('html'));
  document.createElement = tag => new Element(tag);
  document.getElementById = id => descendants(document).find(n => n.id === id) || null;
  let notify; let observations = 0;
  const context = vm.createContext({ document, MutationObserver: class { constructor(fn) { notify = fn; } observe(target, opts) { assert.equal(target, document.documentElement); assert.equal(opts.childList, true); assert.equal(opts.subtree, true); observations++; } } });
  function nav(tag = 'nav', kind = 'app') {
    const header = document.documentElement.appendChild(new Element('header'));
    const n = header.appendChild(new Element(tag));
    if (kind === 'app') n.classList.add('AppHeader-nav');
    if (kind === 'global') n.setAttribute('aria-label', 'Global');
    return n;
  }
  function native(host) {
    const item = host.matches('ul, ol') ? host.appendChild(new Element('li')) : host;
    const link = item.appendChild(new Element('a')); link.href = '/dashboard'; link.textContent = 'Dashboard'; link.classList.add('native-link');
    return { item, link };
  }
  function verify(host) {
    const link = document.getElementById(ID); assert.ok(link); assert.equal(link.href, HREF); assert.equal(link.textContent, LABEL);
    assert.equal(link.getAttribute('title'), LABEL); assert.equal(descendants(document).filter(n => n.id === ID).length, 1);
    assert.equal(host.matches('ul, ol') ? link.parentNode.parentNode : link.parentNode, host);
    return link;
  }
  return { document, nav, native, verify, run: () => vm.runInContext(source, context), mutate: () => notify(), observations: () => observations };
}

test('anchor-only header clones native appearance without self-append', () => {
  const h = harness(); const nav = h.nav(); const original = h.native(nav).link; h.run(); const link = h.verify(nav);
  assert.equal(link.tagName, 'A'); assert.equal(link.classList.contains('native-link'), true); assert.equal(original.href, '/dashboard'); assert.equal(nav.children.length, 2);
});
for (const tag of ['ul', 'ol']) {
  test(tag + ' host receives exactly one li containing a link', () => {
    const h = harness(); const nav = h.nav(tag); h.native(nav); h.run(); const link = h.verify(nav);
    assert.equal(link.parentNode.tagName, 'LI'); assert.deepEqual(link.parentNode.children, [link]); assert.equal(nav.children.length, 2);
  });
  test('nested ' + tag + ' under nav receives the new list item', () => {
    const h = harness(); const nav = h.nav(); const list = nav.appendChild(new Element(tag)); h.native(list); h.run(); h.verify(list); assert.equal(nav.children.length, 1);
  });
}
test('missing nav is harmless; observer mounts when header arrives', () => {
  const h = harness(); h.run(); assert.equal(h.document.getElementById(ID), null); assert.equal(h.observations(), 1);
  const nav = h.nav(); h.mutate(); h.verify(nav);
});
for (const kind of ['global', 'fallback']) test(kind + ' navigation fallback mounts', () => { const h = harness(); const nav = h.nav('nav', kind); h.native(nav); h.run(); h.verify(nav); });
test('empty list mounts with a fresh anchor and no donor', () => { const h = harness(); const nav = h.nav('ol'); h.run(); h.verify(nav); assert.equal(nav.children.length, 1); });
test('mutation bursts and reinjection do not duplicate links', () => {
  const h = harness(); const nav = h.nav('ul'); h.native(nav); h.run(); for (let i = 0; i < 50; i++) h.mutate(); h.run(); h.verify(nav); assert.equal(nav.children.length, 2);
});
test('removed item and replaced header remount exactly once', () => {
  const h = harness(); let nav = h.nav('ul'); h.run(); h.verify(nav).parentNode.remove(); h.mutate(); h.verify(nav); assert.equal(nav.children.length, 1);
  nav.parentNode.remove(); nav = h.nav('ol'); h.mutate(); h.verify(nav); assert.equal(nav.children.length, 1);
});
test('removing only the injected anchor does not accumulate empty wrappers', () => {
  const h = harness(); const nav = h.nav('ul'); h.native(nav); h.run();
  for (let i = 0; i < 3; i++) { h.verify(nav).remove(); h.mutate(); }
  h.verify(nav); assert.equal(nav.children.length, 2);
});
test('cloned ids, roles, handlers, target, tracking and menu controls are discarded', () => {
  const h = harness(); const nav = h.nav('ul'); const { item, link } = h.native(nav);
  for (const n of [item, link]) {
    n.setAttribute('id', n === item ? 'native-item' : 'native-link'); n.classList.add('active', 'selected');
    for (const attr of ['role', 'onclick', 'data-action', 'data-hotkey', 'data-selected-links', 'data-ga-click', 'aria-current', 'aria-haspopup', 'aria-expanded', 'aria-controls', 'target', 'tabindex']) n.setAttribute(attr, 'original');
  }
  const menu = item.appendChild(new Element('button')); menu.id = 'menu-control'; const counter = link.appendChild(new Element('span')); counter.id = 'counter';
  h.run(); const injected = h.verify(nav); const wrapper = injected.parentNode;
  assert.deepEqual(wrapper.children, [injected]); assert.equal(injected.children.length, 0);
  for (const n of [wrapper, injected]) { assert.equal(n.classList.contains('active'), false); assert.equal(n.classList.contains('selected'), false); for (const { name } of n.attributes) assert.ok(['class', 'id', 'href', 'title', 'data-chirag-nav-id'].includes(name), name); }
  assert.equal(h.document.getElementById('native-item'), item); assert.equal(h.document.getElementById('native-link'), link); assert.equal(h.document.getElementById('menu-control'), menu); assert.equal(h.document.getElementById('counter'), counter);
});
test('other userscript direct anchors are not used as native templates', () => {
  const h = harness(); const nav = h.nav(); const foreign = h.native(nav).link; foreign.classList.add('chirag-gh-nav-button', 'foreign-style'); foreign.id = 'other-script';
  const native = h.native(nav).link; h.run(); const link = h.verify(nav);
  assert.equal(link.classList.contains('foreign-style'), false); assert.equal(link.classList.contains('native-link'), true); assert.equal(native.href, '/dashboard'); assert.equal(foreign.id, 'other-script');
});
test('stale cleanup removes only this script\'s own wrapper', () => {
  const otherId = OTHER_ID;
  const h = harness(); const nav = h.nav('ul'); h.native(nav);
  const stale = nav.appendChild(new Element('li'));
  stale.classList.add('chirag-gh-nav-button'); stale.setAttribute('data-chirag-nav-id', ID);
  const other = nav.appendChild(new Element('li'));
  other.classList.add('chirag-gh-nav-button'); other.setAttribute('data-chirag-nav-id', otherId);
  const foreign = nav.appendChild(new Element('div')); foreign.classList.add('chirag-gh-nav-button');
  h.run();
  assert.equal(stale.parentNode, null);
  assert.equal(other.parentNode, nav);
  assert.equal(foreign.parentNode, nav);
  assert.equal(h.document.getElementById(otherId), null);
  h.verify(nav);
  assert.equal(nav.querySelectorAll('[data-chirag-nav-id="' + otherId + '"]').length, 1);
});

for (const tag of ['nav', 'ul', 'ol']) {
  for (const loss of ['removed', 'changed']) test(tag + ' remount reconciles an owned link with ' + loss + ' id', () => {
    const h = harness(); const nav = h.nav(tag); const native = h.native(nav).link;
    const other = nav.appendChild(new Element(tag === 'nav' ? 'a' : 'li'));
    other.classList.add('chirag-gh-nav-button'); other.setAttribute('data-chirag-nav-id', OTHER_ID);
    const otherLink = other.tagName === 'A' ? other : other.appendChild(new Element('a'));
    otherLink.href = '/issues';
    const initialCount = nav.children.length;
    h.run();
    for (let i = 0; i < 3; i++) {
      const link = h.verify(nav);
      if (loss === 'removed') link.removeAttribute('id'); else link.id = 'stale-pulls-' + i;
      h.mutate();
      const restored = h.verify(nav);
      assert.equal(nav.children.length, initialCount + 1);
      assert.equal(h.document.querySelectorAll('[data-chirag-nav-id="' + ID + '"]').length, 1);
      assert.equal(h.document.querySelectorAll('a[href="' + HREF + '"]').length, 1);
      assert.equal(restored.classList.contains('native-link'), true);
      assert.equal(native.href, '/dashboard');
      assert.equal(other.parentNode, nav);
      assert.equal(other.getAttribute('data-chirag-nav-id'), OTHER_ID);
      assert.equal(otherLink.href, '/issues'); assert.equal(otherLink.id, '');
    }
  });
}

for (const excluded of ['anchor', 'wrapper']) test('list cloning uses the filtered native donor after a foreign ' + excluded, () => {
  const h = harness(); const nav = h.nav('ul'); const item = nav.appendChild(new Element('li'));
  item.classList.add('native-item');
  const foreignHost = excluded === 'anchor' ? item : item.appendChild(new Element('span'));
  const foreign = foreignHost.appendChild(new Element('a')); foreign.href = '/foreign'; foreign.id = 'foreign-link'; foreign.classList.add('foreign-style');
  const marked = excluded === 'anchor' ? foreign : foreignHost;
  marked.classList.add('chirag-gh-nav-button'); marked.setAttribute('data-chirag-nav-id', OTHER_ID);
  const native = h.native(item).link; native.id = 'native-donor'; native.setAttribute('data-action', 'native-menu');
  const originalChildren = [...item.children]; const foreignAttributes = foreign.attributes; const nativeAttributes = native.attributes;
  h.run(); const injected = h.verify(nav);
  assert.equal(injected.classList.contains('foreign-style'), false);
  assert.equal(injected.classList.contains('native-link'), true);
  assert.equal(injected.parentNode.classList.contains('native-item'), true);
  assert.deepEqual(injected.parentNode.children, [injected]);
  assert.equal(injected.getAttribute('data-action'), null);
  assert.equal(h.document.getElementById('foreign-link'), foreign);
  assert.equal(h.document.getElementById('native-donor'), native);
  assert.deepEqual(item.children, originalChildren);
  assert.deepEqual(foreign.attributes, foreignAttributes); assert.deepEqual(native.attributes, nativeAttributes);
  assert.equal(marked.getAttribute('data-chirag-nav-id'), OTHER_ID);
});

for (const tag of ['ul', 'ol']) test('nested donor in ' + tag + ' keeps native anchor classes in a fresh top-level item', () => {
  const h = harness(); const nav = h.nav(); const host = nav.appendChild(new Element(tag));
  const outerItem = host.appendChild(new Element('li')); const nested = outerItem.appendChild(new Element(tag));
  const { item, link: native } = h.native(nested); item.classList.add('nested-menu'); native.id = 'nested-native';
  h.run(); const injected = h.verify(host);
  assert.equal(injected.classList.contains('native-link'), true);
  assert.equal(injected.parentNode.tagName, 'LI'); assert.deepEqual(injected.parentNode.children, [injected]);
  assert.equal(injected.parentNode.classList.contains('nested-menu'), false);
  assert.equal(host.children.length, 2);
  assert.equal(h.document.getElementById('nested-native'), native); assert.equal(native.parentNode, item);
  assert.deepEqual(outerItem.children, [nested]); assert.deepEqual(nested.children, [item]);
});
test('restores identity on an owned link instead of appending a duplicate', () => {
  const h = harness(); const nav = h.nav('ul'); h.native(nav); h.run();
  h.verify(nav).removeAttribute('id');
  h.mutate(); h.verify(nav);
  assert.equal(nav.querySelectorAll('a[href="' + HREF + '"]').length, 1);
  assert.equal(nav.querySelectorAll('li[data-chirag-nav-id="' + ID + '"]').length, 1);
});
test('clones the filtered native anchor from a mixed foreign/native li', () => {
  const h = harness(); const nav = h.nav('ul'); const donor = nav.appendChild(new Element('li'));
  const foreign = donor.appendChild(new Element('a')); foreign.href = '/foreign'; foreign.id = 'other-script'; foreign.classList.add('chirag-gh-nav-button', 'foreign-style');
  const native = donor.appendChild(new Element('a')); native.href = '/dashboard'; native.classList.add('native-link');
  h.run(); const link = h.verify(nav);
  assert.equal(link.classList.contains('foreign-style'), false);
  assert.equal(link.classList.contains('native-link'), true);
  assert.equal(foreign.parentNode, donor);
  assert.equal(donor.querySelectorAll('a[href]').length, 2);
});
test('nested native template keeps its classes in the fresh-li fallback', () => {
  const h = harness(); const nav = h.nav(); const host = nav.appendChild(new Element('ul'));
  const mid = host.appendChild(new Element('li')); const inner = mid.appendChild(new Element('ul')); const deep = inner.appendChild(new Element('li'));
  const native = deep.appendChild(new Element('a')); native.href = '/dashboard'; native.classList.add('native-link');
  h.run(); const link = h.verify(host);
  assert.equal(link.classList.contains('native-link'), true);
  assert.equal(deep.querySelectorAll('a[href]').length, 1);
});
test('valid mounted link skips document-wide ownership queries', () => {
  const h = harness(); const nav = h.nav('ul'); h.native(nav); h.run(); h.verify(nav);
  const original = h.document.querySelectorAll; let calls = 0;
  h.document.querySelectorAll = selector => { if (selector === '[data-chirag-nav-id="' + ID + '"]') calls++; return original.call(h.document, selector); };
  for (let i = 0; i < 5; i++) h.mutate();
  assert.equal(calls, 0);
});
test('host selection skips a list inside a foreign wrapper', () => {
  const h = harness(); const nav = h.nav();
  const foreignList = nav.appendChild(new Element('ul'));
  foreignList.classList.add('chirag-gh-nav-button');
  const foreignLink = foreignList.appendChild(new Element('li')).appendChild(new Element('a'));
  foreignLink.href = '/foreign';
  const nativeList = nav.appendChild(new Element('ul')); h.native(nativeList);
  h.run(); const link = h.verify(nativeList);
  assert.equal(link.parentNode.parentNode, nativeList);
  assert.equal(foreignList.querySelectorAll('a[href]').length, 1);
});
test('restores a removed href on an owned mounted link in a list', () => {
  const h = harness(); const nav = h.nav('ul'); h.native(nav); h.run();
  h.verify(nav).removeAttribute('href');
  h.mutate();
  const restored = h.verify(nav);
  assert.equal(restored.getAttribute('href'), HREF);
});
test('restores a wrong href on an owned direct-anchor link', () => {
  const h = harness(); const nav = h.nav(); h.native(nav); h.run();
  h.verify(nav).setAttribute('href', '/wrong');
  h.mutate();
  const restored = h.verify(nav);
  assert.equal(restored.getAttribute('href'), HREF);
  assert.equal(restored.parentNode, nav);
});
test('rebuilds an owned link after simultaneous id and href loss', () => {
  const h = harness(); const nav = h.nav('ul'); h.native(nav); h.run();
  const link = h.verify(nav); link.removeAttribute('id'); link.removeAttribute('href');
  h.mutate();
  const restored = h.verify(nav);
  assert.equal(restored.getAttribute('href'), HREF);
  assert.equal(nav.querySelectorAll('a[href="' + HREF + '"]').length, 1);
});
test('does not modify an unowned element that shares the injected id', () => {
  const h = harness(); const nav = h.nav();
  const foreign = nav.appendChild(new Element('a')); foreign.id = ID; foreign.href = '/foreign';
  h.run(); h.mutate();
  assert.equal(foreign.getAttribute('href'), '/foreign');
  assert.equal(nav.querySelectorAll('a[href="' + HREF + '"]').length, 0);
});
for (const tag of ['nav', 'ul', 'ol']) test('preserves identical unmarked foreign anchor in ' + tag, () => {
  const h = harness(); const nav = h.nav(tag);
  const foreign = h.native(nav).link;
  foreign.id = ID; foreign.href = HREF; foreign.textContent = LABEL;
  const parent = foreign.parentNode; const attributes = foreign.attributes;
  h.run(); h.mutate(); h.run(); h.mutate();
  assert.equal(h.document.getElementById(ID), foreign);
  assert.equal(foreign.parentNode, parent);
  assert.deepEqual(foreign.attributes, attributes);
  assert.equal(foreign.textContent, LABEL);
  assert.equal(h.document.querySelectorAll('[data-chirag-nav-id="' + ID + '"]').length, 0);
});
for (const tag of ['ul', 'ol']) test('recognizes moved owned anchor across reinjection in ' + tag, () => {
  const h = harness(); const nav = h.nav(tag); h.native(nav); h.run();
  const moved = h.verify(nav); const oldWrapper = moved.parentNode;
  const foreignItem = nav.appendChild(new Element('li'));
  foreignItem.appendChild(moved);
  h.run(); h.mutate();
  const restored = h.verify(nav);
  assert.notEqual(restored, moved);
  assert.equal(oldWrapper.parentNode, null);
  assert.equal(moved.parentNode, null);
  assert.equal(foreignItem.parentNode, nav);
  assert.equal(nav.querySelectorAll('a[href="' + HREF + '"]').length, 1);
});
test('reclaims a direct anchor only when its destination still matches', () => {
  const h = harness(); const nav = h.nav(); h.native(nav); h.run();
  const link = h.verify(nav); link.removeAttribute('id'); link.setAttribute('href', '/dashboard');
  h.mutate();
  const restored = h.verify(nav);
  assert.equal(restored.getAttribute('href'), HREF);
  assert.equal(restored.parentNode, nav);
});
for (const tag of ['nav', 'ul', 'ol']) {
  for (const loseId of [false, true]) test('rebuilds misplaced owned item from ' + tag + ' with id loss=' + loseId, () => {
    const h = harness(); const nav = h.nav(tag); h.native(nav); h.run();
    const moved = h.verify(nav); const item = tag === 'nav' ? moved : moved.parentNode;
    const foreign = h.document.documentElement.appendChild(new Element('aside'));
    const sibling = foreign.appendChild(new Element('span')); sibling.textContent = 'Keep me';
    foreign.appendChild(item);
    if (loseId) moved.removeAttribute('id');
    h.mutate();
    const restored = h.verify(nav);
    assert.notEqual(restored, moved);
    assert.equal(item.parentNode, null);
    assert.equal(foreign.parentNode, h.document.documentElement);
    assert.deepEqual(foreign.children, [sibling]);
    assert.equal(sibling.textContent, 'Keep me');
    assert.equal(h.document.querySelectorAll('a[href="' + HREF + '"]').length, 1);
  });
}
test('reconciles an anchor moved out of its owned wrapper', () => {
  const h = harness(); const nav = h.nav('ul'); h.native(nav); h.run();
  nav.appendChild(h.verify(nav));
  h.mutate();
  const restored = h.verify(nav);
  assert.equal(restored.getAttribute('href'), HREF);
  assert.equal(nav.querySelectorAll('[data-chirag-nav-id="' + ID + '"]').length, 1);
  assert.equal(nav.querySelectorAll('a[href="' + HREF + '"]').length, 1);
});
