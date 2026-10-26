Local Overview 0.1.1 makes local answers feel more natural in Google Search and improves how Ollama responds to short topics and questions. Google's own overview and search results remain untouched.

### Changed

- Open, unboxed answer layout with no repeated “Local AI Overview” heading or visible connection-status line in the answer area.
- Gentle fade-in for streamed text and restrained blue emphasis for important phrases, with system and extension reduced-motion support.
- Direct-answer instructions that discourage query narration, source-list summaries, and discussion of the supplied JSON format.
- Refreshed screenshots, stronger rendering and responsive-layout coverage, and version-aware ZIP packaging.

### Install or update

1. Download **local-overview-0.1.1.zip** below and extract it to a permanent folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. For a first installation, choose **Load unpacked** and select the extracted folder containing `manifest.json`. For an update, replace the files in the existing unpacked extension folder and click **Reload** on its extension card.
4. Reload existing Google Search tabs. Select an installed local model in Local Overview's settings if needed.

Ollama must be running locally with a downloaded chat model. If it returns HTTP 403, allow the extension's exact `chrome-extension://` origin in `OLLAMA_ORIGINS` and restart Ollama. Use `OLLAMA_NO_CLOUD=1` for a local-only server. See the [setup guide](https://github.com/CTR495/local-overview/blob/v0.1.1/docs/OLLAMA.md).

### Validation and limits

Passed **112 unit tests**, **six Chromium extension tests**, static checks, production build, and expected-file verification. Browser tests run the actual extension with real Chrome APIs against search fixtures and a loopback Ollama mock. A separate genuine local Ollama check answered “youtube” directly through the built extension and verified the new presentation. The maintainer reported successful manual testing before authorizing this release. See the [validation report](https://github.com/CTR495/local-overview/blob/v0.1.1/docs/VALIDATION.md).

Supported initially: desktop Chrome 120+ and regular/Web searches on `google.com` and `google.com.au`. Google layouts can change; the automated live Google attempt during the original build encountered a traffic challenge. Model accuracy, instruction following, phrase emphasis, and citation completeness vary by model. The renderer only links citations to supplied sources.

Generation sends the query and, when grounding is enabled, selected visible search-result content to the configured local Ollama server. Google still receives searches. Local Overview is independent and unofficial, and is not affiliated with Google or Ollama.
