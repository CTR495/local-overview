# Contributing

Thank you for helping improve Local Overview. Keep changes focused, preserve normal Google Search behavior, and document any new data flow or permission.

## Set up

Use Node.js 20.19+ and npm:

```sh
npm ci
npm run verify
npx playwright install chromium
npm run test:browser
```

Load `dist/` using **Developer mode → Load unpacked** at `chrome://extensions`. Run `npm run dev` while editing, then reload the extension and search tab. Use a separate browser test profile. Real-model testing needs your own local Ollama installation and model; automated tests mock that API.

## Design boundaries

- Make native Google visibility changes reversible. Do not delete native overview nodes or hide broad search containers.
- Keep all Ollama networking in the background service worker. Validate senders, message shape, endpoint, model, and limits again at that trust boundary.
- Keep generation endpoints loopback-only and reject redirects. Do not add remote inference, telemetry, proxy services, or remote code.
- Treat search snippets, queries, model output, model names, and API errors as untrusted text. Never interpolate them into `innerHTML`.
- A source citation may link only to a validated source collected for that generation. Do not turn arbitrary model URLs into clickable links.
- Bound mutation work and ignore the extension's own DOM. Preserve cancellation and stale-response protections during navigation.
- Respect keyboard use, readable contrast, reduced motion, and both themes.
- Do not add large UI frameworks or runtime dependencies for work that browser APIs can perform clearly.

## Pull requests

Explain the problem, resulting behavior, and checks performed. Add meaningful tests for changed parsing, messaging, cancellation, visibility, grounding, or settings behavior. Run `npm run verify` before submitting and run the browser tests when UI or navigation behavior changes.

Google markup changes frequently. For detection issues, include a small representative fixture with the relevant semantic structure. Remove names, account identifiers, query history, tracking tokens, sensitive text, and unrelated page content. Never commit a full personal Google page dump, browser profile, downloaded model, secret, or machine-specific path.

State explicitly whether you tested against mocked fixtures, a real browser with fixtures, live Google Search, and/or a real Ollama model. Do not label fixture success as live compatibility. Use [docs/TESTING.md](docs/TESTING.md) for manual coverage.

Keep generated bundles, `node_modules/`, browser profiles, build caches, test videos, and temporary artifacts out of commits. Changes to supported Google hosts must update shared validation, manifest matches, fixtures, and documentation together.

## Issues and conduct

Report reproducible issues with Chrome/Ollama versions, supported hostname, a non-sensitive sample query, expected/actual behavior, and relevant redacted errors. Be respectful and constructive. Follow [SECURITY.md](SECURITY.md) for vulnerability reports instead of posting sensitive details publicly.

By contributing, you agree that your contribution may be distributed under the project's [MIT License](LICENSE).
