# Version 0.1.0 validation

Validation recorded **26 October 2026**, on Windows with Chromium **156.0.8078.4**. These results distinguish the built extension's tested behavior from the live services it integrates with.

## Automated checks

| Check                                                     | Result                                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Strict TypeScript (`npm run check`)                       | Passed.                                                                                                                                                                        |
| Unit tests (`npm test`)                                   | **111 passed** at the latest recorded run, covering mocked API/NDJSON behavior, cancellation, input and endpoint validation, settings, and representative Google DOM behavior. |
| Production build and expected extension-file verification | Passed; complete Manifest V3 output generated in `dist/`.                                                                                                                      |
| Browser integration (`npm run test:browser`)              | **5 passed**, using the built extension in a disposable Chromium profile.                                                                                                      |
| Dependency audit (`npm audit`)                            | **0 reported vulnerabilities** at validation time. This is a dependency advisory check, not a security certification.                                                          |

The browser suite loads the actual unpacked extension, including its service worker and content script. It uses real Chrome APIs and HTTP requests to a loopback Ollama mock. Search pages are representative fixtures served at supported test URLs, and model responses are controlled. It verifies streaming UTF-8 text, model switching, source-link restrictions, native visibility and controls restoration, delayed/missing native panels, dark appearance, duplicate prevention, disable, cancellation, navigation, offline/empty/error/interrupted recovery, and extension-page settings behavior.

The light and dark search screenshots in [screenshots](screenshots/README.md) come from this built-extension browser run. Popup/options screenshots use their own page-level mocks as documented there.

## Live Google attempt

A clean Chromium session attempted a real `google.com.au` search. Google returned an automated-traffic challenge, so the extension could not be evaluated against an ordinary live results page in that session. **Live Google Search compatibility has not passed validation.** No challenge bypass was attempted.

Native Google AI Overview layouts are dynamic and region/language dependent. Fixture success demonstrates the tested integration behavior; it does not guarantee detection on every current Google layout. Use [the manual checklist](TESTING.md) before publishing a compatibility claim.

## Local Ollama checks

The existing local Ollama service responded to installed-model discovery with two local entries. Its chat endpoint rejected the extension's origin with HTTP 403. This confirms that an online model list alone does not establish permission to generate; configure the exact extension origin in `OLLAMA_ORIGINS` and restart Ollama.

An isolated temporary Ollama instance was then configured with that exact extension origin and `OLLAMA_NO_CLOUD=1`, using an already installed `llama3.2:latest` model. The first cold-model generation exceeded the extension's 25-second initial-response deadline. The extension surfaced a timeout. A separate warmup request reported roughly 42 seconds of total work, including about 18.7 seconds loading and 21.4 seconds evaluating the prompt. This confirms that cold loading can exceed the browser request deadline on this computer.

**The warm-model retry passed through the actual unpacked extension in Chromium.** It used a supported-URL Google fixture and the genuine local Ollama model, with no HTTP model mock. An explanatory answer streamed into the panel without an error. The first visible text arrived in approximately **1.03 seconds**, and completion occurred around **2.04 seconds**, measured by the browser after warmup. These are observations from one local test, not general speed claims or fabricated Ollama token statistics.

The temporary server and model runner were cleaned up after the test; the pre-existing Ollama service remained intact. This establishes real local-model generation through the extension against the test search fixture. It does **not** establish real-model generation on a live Google results page, which remained blocked by Google's challenge.

No personal queries, browser-profile files, server logs, local machine paths, or temporary endpoint details are included in this report.

## Timeouts and remaining checks

Generation uses a 25-second initial-response deadline, a 120-second incoming-data idle deadline, and a 10-minute overall limit. Model discovery has a 10-second overall deadline. Chrome may independently terminate workers or slow fetches. Preload the chosen model with `ollama run MODEL_NAME`, try a smaller model when necessary, and retry from the extension.

Remaining manual validation includes an accessible live Google page with and without a native AI Overview, additional region/language/account layouts, real-model generation on a live results page, and Chrome unpacked installation by a fresh user. This report must be updated when those checks are actually completed.
