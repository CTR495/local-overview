# Testing guide

## Automated checks

Run:

```sh
npm ci
npm run verify
npx playwright install chromium
npm run test:browser
```

`verify` runs strict TypeScript and formatting checks, unit tests, the production build, and expected extension-file checks. Unit tests use mocked Ollama responses and representative Google DOM fixtures. Browser tests exercise the built extension in a disposable browser context, with controlled search and API fixtures where configured.

Keep the exact final command results in the release/PR report. A passing build is not proof of a successful live Google or real Ollama interaction. No live coverage is implied by this checklist.

## Manual release validation

Use a separate Chrome profile with the unpacked `dist/` extension. Record Chrome version, operating system, Ollama version, local model name, Google hostname/language, and whether grounding was on. Use non-sensitive queries. Keep original source content and Google controls usable throughout.

| Scenario                                   | Expected behavior                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google page with a native AI Overview      | One local panel appears; Google's original overview and controls remain visible and usable.                                                               |
| Google page without a native overview      | The same local panel works independently of Google's overview availability.                                                                               |
| Automatic generation                       | Opening a supported search follows automatic-generation and interaction settings.                                                                         |
| Manual generation                          | Generate/Regenerate starts an answer when automation is off or interaction is required.                                                                   |
| Ollama online                              | Installed local models load dynamically; selected chat model produces an answer.                                                                          |
| Ollama offline                             | Helpful offline message appears with retry; no endless loading.                                                                                           |
| Multiple local models                      | Selection changes generation model without reinstall/reload; unavailable explicit selection is explained.                                                 |
| No installed models                        | Download instructions appear; controls do not imply successful generation.                                                                                |
| Streaming                                  | Answer begins before completion; non-ASCII UTF-8 text remains intact.                                                                                     |
| Open answer layout                         | The answer has no enclosing border/background card or repeated “Local AI Overview”/connection-status heading.                                             |
| Direct topic queries                       | A search such as “youtube” gets a direct topic explanation rather than a query/source-list preamble. The model does not ask what to do with request JSON. |
| Blue emphasis and reveal                   | Short important phrases are emphasized safely; new text fades into view while already-rendered text stays stable.                                         |
| Partial emphasis across chunks             | Split `**phrase**` markers produce readable emphasis when completed and never create HTML or arbitrary links.                                             |
| Non-streaming preference                   | One complete response appears; Stop and timeout still work.                                                                                               |
| Stop during generation                     | HTTP work is aborted; partial text remains identifiable; no new tokens arrive afterward.                                                                  |
| Rapid query changes                        | Earlier-query text never appears under the latest query.                                                                                                  |
| Repeated navigation without reload         | Exactly one interface remains, query updates, and old generation is cancelled.                                                                            |
| Delayed/native overview DOM changes        | Safe placement updates without duplicate panels, native visibility changes, or recursive observer loops.                                                  |
| Light, dark, auto themes                   | Text and controls remain readable; automatic theme follows the search page where supported.                                                               |
| Narrow window / zoom / keyboard            | Model select, answer actions, enable control, and settings remain reachable and readable.                                                                 |
| Reduced motion                             | Reveal/blur/shimmer/sparkle/loading effects are suppressed or reduced without hiding readable emphasis or progress controls.                              |
| Disable using popup                        | Local UI is removed, active generation stops, and native Google content remains untouched. Re-enable recovers.                                            |
| Model error / timeout                      | Failure is visible and retry works; no fabricated completion or statistics.                                                                               |
| Network interrupted mid-stream             | Partial response is preserved, interruption is reported, and Retry starts a fresh request.                                                                |
| Grounding enabled                          | Only limited visible results are sent; supplied source links appear; invented references are not clickable.                                               |
| Grounding disabled / no results            | No result context is sent; answer clearly says it lacks current search grounding.                                                                         |
| Statistics enabled                         | Counts/timings match Ollama final-event fields; absent values stay unavailable.                                                                           |
| Popup and options changes                  | Settings persist and update open search interfaces; changing models needs no reinstall.                                                                   |
| Extension/browser reload during generation | The page reports interruption or recovers after refresh; no silent continuation claim.                                                                    |
| Native content preservation                | Native content retains its original nodes, attributes, inline styles, and event handlers throughout use.                                                  |

Also repeat on `google.com.au`, searches with rich results, Google consent/account variants, and a page using another display language. Report placement or source-collection gaps with a minimal redacted fixture.

## Security and privacy checks

- Reject remote endpoints, credentials, paths, fragments, queries, alternate numeric hostname spellings, and redirects.
- Reject messages from unexpected senders or unsupported pages; never expose a generic fetch endpoint.
- Exclude cloud-backed models and configure the test Ollama server with `OLLAMA_NO_CLOUD=1`.
- Render malicious snippet/model strings as inert text. Unknown citation IDs must never create new destinations.
- Verify default grounding is off and no background scraping or telemetry requests occur.
- Do not paste private queries, account details, or browser-profile files into issue reports.

## Screenshots

Capture real extension UI from a disposable test profile. Label fixtures and mocked responses clearly. Do not use an AI-generated image or handcrafted design mockup as evidence that live Google/Ollama testing passed. See [screenshots](screenshots/README.md).
