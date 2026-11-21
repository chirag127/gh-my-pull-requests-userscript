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
