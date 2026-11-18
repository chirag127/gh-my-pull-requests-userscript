# GitHub: My Pull Requests Button

Adds a **My pull requests** button to GitHub's global header. It opens `https://github.com/pulls`, GitHub's own page for every pull request involving your account.

## Install

Install `gh-my-pull-requests-userscript.user.js` with ScriptCat, Tampermonkey or Violentmonkey. The script needs no permissions (`@grant none`), makes no external requests and runs on `https://github.com/*`.

## Behaviour

- One link in the top navigation on every GitHub page.
- Re-attaches after GitHub's client-side navigation.
- No settings, no data collection.

## Update

`@updateURL` and `@downloadURL` point at raw `main`, so ScriptCat picks up new versions automatically.

## License

MIT
