# AGENTS.md

One userscript per repo. Root file: `gh-my-pull-requests-userscript.user.js`.

- Plain JavaScript, `@grant none`, no build step, no dependencies.
- Runs on `https://github.com/*` only.
- Keep the injected element id `chirag-my-pull-requests-link` so re-mounts never duplicate it.
- Clone GitHub's existing header link so the button matches the native navigation.
- Verify with `node --check`, then load on GitHub and check the button opens `https://github.com/pulls`.
- Bump `@version` in the script when behaviour changes; raw `main` is the update URL.
- Documentation lives once in `c:\ws\docs\okf\`; do not copy it into this repo.
