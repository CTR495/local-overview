# Screenshots

The working source is local version **0.1.1**, which has not been pushed or published. All four captures have been refreshed for this revision. The search captures show the open answer layout, blue emphasis, and compact controls without the repeated answer heading or connection-status line. Streaming reveal and reduced-motion behavior are verified separately by the browser tests; a static image does not demonstrate animation.

The `google-local.png`, `google-dark.png`, `popup.png`, and `options.png` files are Chromium captures of the **built Manifest V3 extension** loaded into a disposable browser profile. They use a representative Google Search DOM fixture and a loopback HTTP server that mocks Ollama. Chrome storage, content-script injection, the extension service worker, HTTP requests, and extension messaging are real; search content, model discovery, and generated answer/statistic values are controlled fixture data. These images demonstrate the actual local-only extension interface and transport in that environment, not live Google compatibility or real-model inference.

No live Google screenshot is included by this document. Automated captures, when present, show the actual extension UI running with controlled fixture data and are evidence of that test environment only.

Additional release captures should show the built extension and clearly label whether each uses a representative Google fixture/mocked Ollama response or a live Google page/real model. Remove personal queries, account names, location, and unrelated browser content before committing.

See [validation](../VALIDATION.md) for automated results and separately recorded live-test limits.
