# Architecture

Local Overview is a Manifest V3 extension built from TypeScript into local JavaScript bundles with esbuild. It has no runtime framework or backend.

## Components and trust boundaries

| Component          | Responsibility                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Content script     | Read supported search URL, maintain one overview interface, collect optional visible result context, coordinate generation, and cancel stale requests.             |
| Google integration | Find safe panel placement, observe relevant result-container changes, and collect bounded visible result context without changing native content.                  |
| Local UI           | Render original branding and an open answer layout in a Shadow DOM; expose accessible controls and display safe text, controlled citations, and actual statistics. |
| Service worker     | Validate extension message senders and inputs; read persisted settings; make loopback API requests; forward deltas, completion, errors, and cancellation.          |
| Ollama client      | Fixed API routes, model locality checks, bounded parsing, UTF-8 NDJSON decoding, timeout and abort handling.                                                       |
| Popup/options      | Inspect connection and installed models, update shared settings, and explain local data flow.                                                                      |
| Shared modules     | Typed settings, defaults, validated endpoint rules, supported Google hosts, protocol messages, and source/statistic types.                                         |

Google page scripts cannot select the endpoint or call the API through a public bridge. The content script runs in Chrome's isolated world. Network destinations come from validated extension settings, not page text or model output. Requests omit credentials and reject redirects.

## Search and visibility lifecycle

The content script detects a supported regular/Web query from the URL, mounts one local panel, and watches for navigation and delayed result content. Mutation work is debounced and extension-owned mutations are ignored. Fallback placement keeps the panel available when the expected results container has not loaded.

The enabled extension displays its local panel independently of Google's AI Overview. It never hides or replaces native overview nodes or results. Generation follows the user's automatic/manual behavior settings. Disable and teardown cancel requests and remove only extension-owned UI.

Query changes invalidate the active generation and its response identity before work for the new query starts. Completed output is not treated as a cache for a different query. Streaming rendering is batched rather than rebuilding the page for every token.

## Request and streaming lifecycle

1. The content script snapshots the query and optional bounded sources for one generation.
2. A named extension port sends a unique request identity. The service worker validates its sender and payload and reads current settings from storage.
3. The worker checks installed local models and posts a chat request using the configured model and options.
4. The API client decodes UTF-8 incrementally and parses newline-delimited JSON, forwarding answer text deltas. Model thinking content is not treated as the answer.
5. The final Ollama event supplies actual token/timing statistics. Missing statistics remain unavailable.
6. Cancellation aborts the HTTP request. Port disconnect, navigation, disable, generation-setting changes, and explicit Stop end the active operation. Events with a stale identity are discarded.

Port heartbeat traffic exists only during an active generation. Chrome's worker can still be terminated by the browser, extension reload, process shutdown, or a failed connection. The interface reports interruption and lets the user retry; it does not claim to resume tokens or silently replay a request. Settings are stored in `chrome.storage.local`, not worker globals.

This follows [Chrome's service-worker lifecycle guidance](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): active messages can reset idle timers, but workers must tolerate termination. Long model loading or buffering can still hit fetch or application timeouts.

## Grounding and rendering

Grounding uses a bounded set of currently visible organic results. It sends their titles, validated HTTP/HTTPS URLs, and snippets as untrusted source data. No linked pages or additional search pages are fetched. The system prompt distinguishes the question from evidence and instructs the model to cite only supplied numeric source IDs.

The model is instructed to answer the search topic directly, without narrating the query, evidence list, or message format. Evidence remains untrusted data and can never choose extension actions or network destinations. Prompt instructions improve behavior but cannot guarantee model compliance.

The UI does not render raw model HTML. It constructs text nodes, narrowly supported emphasis spans, and controlled citation anchors whose destinations come from the generation's validated source list. Unknown references remain non-clickable. Sources show what was supplied; their presence does not prove every generated sentence is supported. Ungrounded answers carry a model-knowledge notice.

The search-page answer area has no enclosing card or repeated answer/status heading. Its Local Overview branding remains distinct from Google's native overview. New streaming text uses a restrained opacity/blur reveal, and short model-emphasized phrases use a blue visual treatment. Existing text should stay stable as later chunks arrive. Reduced-motion preferences disable animation while retaining readable emphasis and generation controls.

## Settings

Typed defaults and normalization are shared by all surfaces. Separate storage keys allow a popup enable/model update without overwriting unrelated options. Chrome storage-change events keep open surfaces current. The model list comes from Ollama; there is no fixed hardcoded model selector. Obsolete provider-mode preferences from earlier development builds are ignored.

Automatic generation settings are distinct from appearance preferences. Users can generate when the panel opens, require an explicit Generate/Regenerate action, and decide whether a new search generates automatically. Appearance changes should not create duplicate UI or send unnecessary network requests.

## Limitations

- Google has no stable search-results DOM API. Panel placement and source collection may need updates for new layouts or languages. Native Google content stays untouched.
- Desktop Google regular/Web search is the initial target. AI Mode and specialized tabs are outside scope.
- Grounding sees snippets currently available in the DOM; it is not a crawler or full-document retrieval system. Sources may be stale, misleading, incomplete, or malicious.
- Models can hallucinate or disregard prompt instructions. Safe rendering prevents executable output but cannot establish factual correctness.
- Slow model loading may exceed Chrome's fetch lifetime or application limits. Retry with a smaller/preloaded model when needed.
- Streaming cancellation stops the extension request. The Ollama server/runtime controls how quickly device-side work is released.
- Supporting loopback HTTP does not secure a separately hostile local server. Operators control Ollama cloud settings, server logs, local proxies, and operating-system trust.
- Automated fixtures do not replace validation against live Google, multiple accounts/regions, or real model hardware.
