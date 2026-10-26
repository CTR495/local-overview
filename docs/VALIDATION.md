# Version 0.1.1 local validation

Version **0.1.1 is local and unpublished**. The new work changes the answer layout, streaming reveal and emphasis, direct-answer prompting, and version-aware packaging. It does not change the local-only endpoint policy or Google's native content.

## Local revision checks

Validation recorded **26 October 2026**. These results apply to the local 0.1.1 revision; the published 0.1.0 baseline is recorded separately below.

| Check                                                                               | Result                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Static checks, unit tests, build, and expected-file verification (`npm run verify`) | Passed; **112 unit tests across 10 files**.                                                                                                     |
| Built-extension Chromium integration tests                                          | **6 passed**, including 320px/390px layouts, keyboard access, reduced motion, streaming/emphasis behavior, and unchanged native Google content. |
| Local package                                                                       | Built `artifacts/local-overview-0.1.1.zip` with matching 0.1.1 package and manifest metadata.                                                   |
| Documentation captures                                                              | All four screenshots refreshed from the actual unpacked extension using real Chrome APIs and a loopback HTTP Ollama mock.                       |

The new browser checks exercise the open answer area, removed duplicate answer/status headings, stable streamed text, blue emphasis, and motion preferences. Search pages and mock model responses are controlled fixtures; these checks do not establish compatibility with every live Google layout.

### Genuine local-model check

A separate end-to-end check used the actual 0.1.1 extension in Chromium, a supported-URL search fixture for **“youtube,”** and the already installed **`llama3.2:latest`** model. It passed: the model answered the topic directly without query/JSON narration, “YouTube” appeared as an emphasized phrase, the answer area had a zero-width border and no shadow, and the duplicate heading was absent.

This check used an isolated temporary Ollama server configured for the test extension's exact origin with `OLLAMA_NO_CLOUD=1`. The existing main Ollama server returned HTTP 403 for that test origin and was not reconfigured. The temporary server was cleaned up afterward, leaving the original service unchanged. This is a genuine local-model result on a search fixture, not a real-model result on a live Google page.

Three additional prompt-only real-model smoke cases exercised direct-answer behavior and hostile source text. Those checks met their direct-answer and source-handling expectations, but one grounded response omitted the requested inline citation markers. Prompt compliance remains imperfect. The renderer restricts clickable citations to supplied source IDs; it cannot guarantee that the model cites every relevant claim or that an answer is factually supported or current.

### Publication boundary

Version 0.1.1 remains only on the local `work/v0.1.1` branch and has not been pushed or released. Public `main` and the published `v0.1.0` tag remain at commit `518b6be`.

## Published version 0.1.0 baseline

Validation recorded **26 October 2026**, on Windows with Chromium **156.0.8078.4**. These results distinguish the built extension's tested behavior from the live services it integrates with.

### Automated checks

| Check                                                     | Result                                                                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript (`npm run check`)                       | Passed.                                                                                                                                                                                |
| Unit tests (`npm test`)                                   | **99 passed** for the local-only release revision, covering mocked API/NDJSON behavior, cancellation, input and endpoint validation, settings, and representative Google DOM behavior. |
| Production build and expected extension-file verification | Passed; complete Manifest V3 output generated in `dist/`.                                                                                                                              |
| Browser integration (`npm run test:browser`)              | **5 passed**, using the built extension in a disposable Chromium profile.                                                                                                              |
| Dependency audit (`npm audit`)                            | **0 reported vulnerabilities** at validation time. This is a dependency advisory check, not a security certification.                                                                  |

The browser suite loads the actual unpacked extension, including its service worker and content script. It uses real Chrome APIs and HTTP requests to a loopback Ollama mock. Search pages are representative fixtures served at supported test URLs, and model responses are controlled. It verifies streaming UTF-8 text, model switching, source-link restrictions, unchanged native Google content and controls, delayed/missing native panels, dark appearance, duplicate prevention, disable, cancellation, navigation, offline/empty/error/interrupted recovery, and extension-page settings behavior.

All four [screenshots](screenshots/README.md) come from the actual unpacked extension with real Chrome APIs and controlled loopback HTTP model discovery and responses.

### Live Google attempt

A clean Chromium session attempted a real `google.com.au` search during the initial build. Google returned an automated-traffic challenge, so that automated session did not evaluate an ordinary live results page. No challenge bypass was attempted.

The maintainer reported successful manual tests of both the initial build and the final local-only revision. That is user-reported live validation, distinct from the automated fixture results. The release revision removes the provider selector and displays only the local panel while leaving Google's native overview untouched. Google layouts remain region/language dependent; one reported working setup does not establish every layout. Use [the manual checklist](TESTING.md) for additional coverage.

### Local Ollama checks

The existing local Ollama service responded to installed-model discovery with two local entries. Its chat endpoint rejected the extension's origin with HTTP 403. This confirms that an online model list alone does not establish permission to generate; configure the exact extension origin in `OLLAMA_ORIGINS` and restart Ollama.

An isolated temporary Ollama instance was then configured with that exact extension origin and `OLLAMA_NO_CLOUD=1`, using an already installed `llama3.2:latest` model. The first cold-model generation exceeded the extension's 25-second initial-response deadline. The extension surfaced a timeout. A separate warmup request reported roughly 42 seconds of total work, including about 18.7 seconds loading and 21.4 seconds evaluating the prompt. This confirms that cold loading can exceed the browser request deadline on this computer.

**The warm-model retry passed through the actual unpacked extension in Chromium.** It used a supported-URL Google fixture and the genuine local Ollama model, with no HTTP model mock. An explanatory answer streamed into the panel without an error. The first visible text arrived in approximately **1.03 seconds**, and completion occurred around **2.04 seconds**, measured by the browser after warmup. These are observations from one local test, not general speed claims or fabricated Ollama token statistics.

The temporary server and model runner were cleaned up after the test; the pre-existing Ollama service remained intact. This establishes real local-model generation through the extension against the test search fixture. It does **not** establish real-model generation on a live Google results page, which remained blocked by Google's challenge.

No personal queries, browser-profile files, server logs, local machine paths, or temporary endpoint details are included in this report.

### Timeouts and remaining checks

Generation uses a 25-second initial-response deadline, a 120-second incoming-data idle deadline, and a 10-minute overall limit. Model discovery has a 10-second overall deadline. Chrome may independently terminate workers or slow fetches. Preload the chosen model with `ollama run MODEL_NAME`, try a smaller model when necessary, and retry from the extension.

Remaining manual validation includes an accessible live Google page with and without a native AI Overview, additional region/language/account layouts, real-model generation on a live results page, and Chrome unpacked installation by a fresh user. This report must be updated when those checks are actually completed.
