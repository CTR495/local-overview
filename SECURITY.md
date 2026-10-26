# Security policy

## Supported version

Security fixes target the latest published `0.1.x` release. This is an early release; Google layout compatibility and local model quality vary.

## Reporting a vulnerability

Do not post working exploits, sensitive search content, local paths, browser profiles, or tokens in a public issue.

If the published GitHub repository offers **Security → Report a vulnerability**, use that private reporting channel. Until a private reporting channel exists, open a minimal issue asking the maintainer to arrange one, without exploit details or sensitive information. This source tree has no dedicated monitored security email address and makes no response-time commitment.

Include affected versions, relevant code paths, prerequisites, expected security property, actual impact, and the smallest safe reproduction. Use synthetic search results and mocked responses where possible. Do not test against other users, expose an Ollama server publicly, or run destructive proof-of-concept commands.

## Security boundaries

- Only a configured HTTP/HTTPS loopback endpoint on `localhost` or `127.0.0.1` is allowed. Remote hosts and redirects are rejected.
- Background requests must originate from this extension's own pages or validated supported top-level Google Search content scripts.
- Google page text and model output are untrusted data. They cannot choose network destinations, invoke tools, install code, or supply executable markup.
- Grounding is optional and bounded. Its prompt instructs the model to treat sources as evidence rather than instructions. Prompting cannot guarantee that a language model ignores every malicious snippet; output is still rendered as inert text with controlled citation links.
- Cloud-backed models are excluded. Operators should also disable Ollama cloud features. A hostile or modified local server is outside the extension's trust boundary.
- In-flight cancellation, request identities, and navigation checks must prevent previous-query output from appearing in a new query's panel.
- Native Google content must be restored on mode change, disable, or teardown.

## Review priorities

Review changes to endpoint parsing, sender validation, stream size limits, timeouts, source URL validation, model locality checks, DOM rendering, native content visibility, and new extension permissions carefully. Any new remote destination or persistent content storage requires an explicit product decision and privacy-policy update.

False or unsupported model answers are expected model limitations. Report bugs where the extension invents clickable citation destinations, executes output, sends data outside its documented flow, or fails to respect cancellation as security-relevant behavior.

## Local deployment guidance

Keep Ollama bound to loopback. Set `OLLAMA_ORIGINS` to the specific extension origin, use `OLLAMA_NO_CLOUD=1`, keep Chrome and Ollama updated, and avoid untrusted local proxies or browser extensions. See [docs/OLLAMA.md](docs/OLLAMA.md). This guidance does not turn Google Search into a private/offline service.
