Local Overview adds a local Ollama-powered summary to Google Search. Its dedicated Local AI Overview panel leaves Google's original AI Overview and results available and unchanged.

### Included

- Streamed answers from dynamically discovered local Ollama models, with Stop, Retry, Regenerate, and Copy controls.
- Optional grounding in visible search-result titles, links, and snippets. Clickable citations are restricted to supplied sources.
- Popup and full settings page, automatic/manual generation, model switching, light/dark themes, reduced motion, and reported token/timing statistics.
- Manifest V3, TypeScript, original icons, MIT license, contributor documentation, and automated CI.
- Loopback-only networking, cloud-model exclusion, no telemetry, no remote AI API, and no custom proxy or backend.

### Install

1. Install [Ollama](https://ollama.com/download), start it, and download a local chat model, for example `ollama pull llama3.2:3b`.
2. Download **local-overview-0.1.0.zip** below and extract it to a permanent folder.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. Open Local Overview's settings, choose an installed model, and open a supported Google Search page. Use **Generate overview** if automatic generation is disabled.

Allow the extension's exact `chrome-extension://` origin in `OLLAMA_ORIGINS` if Ollama returns HTTP 403, then restart Ollama. Use `OLLAMA_NO_CLOUD=1` for a local-only server. See the [setup guide](https://github.com/CTR495/local-overview/blob/main/docs/OLLAMA.md). Public GitHub hosting does not automatically install the extension into Chrome.

### Validation and limits

The release source includes unit tests, real Chromium extension tests with search fixtures and a loopback Ollama mock, build verification, and a dependency audit. A genuine local Ollama model also streamed successfully through the unpacked extension on a search fixture. The maintainer reported a successful manual live test of the initial build. The final local-only interface is covered separately by the automated release checks; see the [validation report](https://github.com/CTR495/local-overview/blob/main/docs/VALIDATION.md).

Supported initially: desktop Chrome 120+ and regular/Web search on `google.com` and `google.com.au`. Google layout changes can affect placement and source collection. Cold model loading can exceed Chrome's initial-response window; preload the model with `ollama run MODEL_NAME` or try a smaller model.

Grounding is off by default. Generating an answer sends your search query, and enabled grounding sends selected visible search content, to your configured local Ollama endpoint. Google still receives searches; this extension does not make Google Search private or offline. Model answers can be wrong.

Local Overview is independent and unofficial, and is not affiliated with Google or Ollama.
