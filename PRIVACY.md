# Privacy policy

**Local Overview 0.1.0 · Effective 26 October 2026**

Local Overview is an independent browser extension, unaffiliated with Google or Ollama. The extension has no operator-hosted backend, account system, telemetry, analytics, advertising, tracking pixels, API keys, or remote AI integration.

## Data flow

When you request a Local AI overview, the extension reads the query in the current supported Google Search URL and sends it to the loopback Ollama endpoint configured in Settings. Generation can also start automatically according to your chosen behavior settings.

Search-result grounding is disabled by default. When you enable it, the extension collects a bounded set of publicly visible result titles, destination URLs, and snippets from the current page and includes them in that same local request. It does not request the destination pages, scrape additional pages, collect cookies, or transmit browser history. The extension does not read password fields, account settings, or unrelated tabs as search context.

Ollama model discovery requests a list of installed models. Opening the popup, opening the local panel, or refreshing models checks the local connection. Automatic generation follows your behavior settings; disabling automatic generation or requiring interaction leaves answer generation to your explicit action.

The permitted destinations are HTTP/HTTPS endpoints on exactly `localhost` or `127.0.0.1`. Arbitrary remote hosts, URL credentials, paths, queries, fragments, and redirected requests are rejected. Cloud-backed models are excluded. Configure Ollama with `OLLAMA_NO_CLOUD=1` and use a genuine local server; a separately modified local server could forward or log its own requests, which is outside the extension's control.

## Storage and retention

The extension saves preferences, the selected model name, and local endpoint in `chrome.storage.local`, not Chrome Sync. It does not intentionally save queries, source context, answers, or generation statistics to persistent storage. Current-page answer text and source context exist in memory while the interface is open and are discarded on navigation or page teardown. Chrome and the operating system manage memory, caches, crash reports, and diagnostics independently.

The Copy action puts the visible response on your system clipboard only when you click it. Your operating system's clipboard history or synchronization settings may retain it. Opening a source link is a normal browser navigation to that website.

Ollama, model runtimes, a development test server, and your own local configuration may retain logs. Consult their policies and configuration separately. Search requests still go to Google, and Google retains its own normal functionality and data flow. Local Overview does not make Google Search offline or private.

## Permissions

- **Storage:** save preferences locally and update open extension interfaces.
- **Supported Google Search pages:** inject the local overview and inspect the current query and optional visible result context. Google's native overview and results remain untouched.
- **Loopback host access:** contact the locally configured Ollama API from the service worker. Ports are configurable; code validation restricts requests to the configured origin and fixed API routes.

There is no external messaging bridge or page-world `postMessage` interface to the local API. Ordinary websites cannot choose a request endpoint through extension messages. Network requests are made by extension code, with validated messages and sender contexts.

## Your controls

Disable the extension with its popup switch to stop its page integration and cancel current generation. This removes only the local panel. Disable grounding to stop sending result context on future generations. Change automation settings to require a deliberate Generate action. Restore defaults in Settings to reset preferences. Remove the extension in `chrome://extensions` to remove its Chrome-managed local storage.

## Changes and questions

Future changes to this data flow should update this policy and the changelog before release. For privacy questions, open an issue in the project's repository when it is available. Do not include sensitive queries, search results, local paths, or personal browser screenshots in public reports. For a suspected security issue, use the process in [SECURITY.md](SECURITY.md).
