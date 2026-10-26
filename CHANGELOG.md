# Changelog

## 0.1.1 — 2026-10-27

- Replaced the bordered answer card with an open layout that blends into Google Search while retaining Local Overview branding.
- Removed the repeated “Local AI Overview” label and visible connection-status line from the search-page answer area.
- Added a gentle streaming text reveal and blue emphasis for short important phrases, with reduced-motion support.
- Revised model instructions to answer the search topic directly rather than narrating the query, source list, or request format.
- Refreshed all four screenshots from the built extension and expanded rendering, accessibility, and browser coverage.
- Derived ZIP names and build version checks from project metadata so local packages use the correct version.

Validated with 112 unit tests, six Chromium extension tests, and a genuine local Ollama model against a search fixture. See the [release notes](docs/RELEASE-v0.1.1.md) and [validation report](docs/VALIDATION.md).

## 0.1.0 — 2026-10-26

First public release.

- Added a Local AI Overview panel with safe fallback placement alongside Google's original overview and results.
- Added local Ollama model discovery, streamed generation, cancellation, retry, and reported performance statistics.
- Added optional visible-result grounding with controlled source links.
- Added popup and options pages, persistent settings, themes, and motion preferences.
- Added loopback and message validation, bounded requests, and safe text rendering.
- Added automated mocked API/DOM tests, browser test support, build verification, CI, and publication documentation.

See [docs/TESTING.md](docs/TESTING.md) for the distinction between automated fixture coverage and live Google/Ollama validation.
