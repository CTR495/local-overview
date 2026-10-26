# Screenshots

The `google-local.png` and `google-dark.png` files are Chromium captures of the **built Manifest V3 extension** loaded into a disposable browser profile. They use a representative Google Search DOM fixture and a loopback HTTP server that mocks Ollama. Chrome storage, content-script injection, the extension service worker, HTTP requests, and extension messaging are real; search content and generated answer/statistic values are controlled fixture data. These images demonstrate the actual extension interface and transport in that environment, not live Google compatibility or real-model inference.

The `popup.png` and `options.png` files are real Chromium browser captures of the extension’s popup and options page code, rendered with mocked Chrome storage and model discovery. The names `qwen3:4b` and `llama3.2:3b` are controlled test data. These captures verify the UI in that environment; they do not establish a live Ollama connection or live Google compatibility.

No live Google screenshot is included by this document. Automated captures, when present, show the actual extension UI running with controlled fixture data and are evidence of that test environment only.

Additional release captures should show the built extension and clearly label whether each uses a representative Google fixture/mocked Ollama response or a live Google page/real model. Remove personal queries, account names, location, and unrelated browser content before committing.

See [validation](../VALIDATION.md) for automated results and separately recorded live-test limits.
