# Configure local Ollama access

Local Overview calls the local Ollama API directly from its Chrome extension service worker. It does not need a Python backend, proxy, API key, or network-exposed Ollama instance.

Install Ollama from [ollama.com/download](https://ollama.com/download), download a local chat model, and confirm it appears in `ollama list`. Keep the default loopback bind address. The default extension endpoint is `http://localhost:11434`.

## Allow this extension's origin

If connection checks return HTTP 403, configure `OLLAMA_ORIGINS` for this specific extension:

1. Load the built extension in Chrome.
2. Open `chrome://extensions`, enable Developer mode, and copy Local Overview's extension **ID**.
3. Replace `YOUR_EXTENSION_ID` below with that ID, using the origin `chrome-extension://YOUR_EXTENSION_ID`.
4. Restart Ollama after changing its environment.

The ID can change when loading an unpacked extension from a different directory. If you move the extension, check the allowed origin again. If you already have intentional allowed origins, preserve them as a comma-separated list.

Avoid `*` or `chrome-extension://*` as a convenience default: those permit more callers than this extension needs. Do not add `https://www.google.com` to allow the content script; the network requests originate from the extension service worker, not Google's page.

## Disable Ollama cloud features

Set `OLLAMA_NO_CLOUD=1` for the Ollama server and restart it. This provides a server-side safeguard in addition to Local Overview's checks that exclude cloud-backed models. Alternatively, Ollama supports `"disable_ollama_cloud": true` in its existing `~/.ollama/server.json` configuration; preserve any other fields when editing that file.

Local Overview does not change your Ollama environment or server settings automatically. A local endpoint that deliberately proxies requests elsewhere is outside its control.

## Windows application

Quit Ollama from the system tray. Search Windows Settings for **Edit environment variables for your account**, then add or edit these **user** variables:

| Name              | Value                                  |
| ----------------- | -------------------------------------- |
| `OLLAMA_ORIGINS`  | `chrome-extension://YOUR_EXTENSION_ID` |
| `OLLAMA_NO_CLOUD` | `1`                                    |

Apply the changes and start Ollama again from the Start menu.

For a manually managed terminal server instead, first quit the existing app, then run in PowerShell:

```powershell
$env:OLLAMA_ORIGINS = 'chrome-extension://YOUR_EXTENSION_ID'
$env:OLLAMA_NO_CLOUD = '1'
ollama serve
```

These terminal assignments apply only to that process and its children. Do not start a second server if one is already listening on port 11434.

## macOS application

Run in Terminal, then quit and reopen Ollama:

```sh
launchctl setenv OLLAMA_ORIGINS 'chrome-extension://YOUR_EXTENSION_ID'
launchctl setenv OLLAMA_NO_CLOUD '1'
```

For a manually managed terminal server, quit the app and run:

```sh
OLLAMA_ORIGINS='chrome-extension://YOUR_EXTENSION_ID' OLLAMA_NO_CLOUD=1 ollama serve
```

## Linux systemd service

Open a service override:

```sh
sudo systemctl edit ollama.service
```

Add:

```ini
[Service]
Environment="OLLAMA_ORIGINS=chrome-extension://YOUR_EXTENSION_ID"
Environment="OLLAMA_NO_CLOUD=1"
```

Save, then reload and restart:

```sh
sudo systemctl daemon-reload
sudo systemctl restart ollama.service
```

If you run Ollama manually rather than through systemd, use the terminal-server command shown above instead.

## Verify

Open Local Overview Settings and refresh the installed model list. A successful model list confirms extension-to-server access. Select a local chat model, open a supported Google Search page, and generate a response from the Local AI Overview panel.

If the list is empty, run `ollama list`, download a local chat model, and retry. Cloud-only entries are not available in this extension. Cold model loading can exceed the **25-second initial-response deadline**. Preload your selected model with `ollama run MODEL_NAME`, then retry in the extension while it remains loaded. A smaller model can reduce loading time and memory pressure.

The client also limits generation to **120 seconds without incoming data** and **10 minutes overall**. Model-list checks have a 10-second overall timeout. Chrome has its own worker/fetch lifetime rules, so heartbeats cannot guarantee that a slow request survives. A generation can fail when a listed model does not support chat, the hardware runs out of memory, or the browser interrupts the worker. Partial text is retained and a fresh Retry/Regenerate action is offered.

The extension supports another port on exactly `localhost` or `127.0.0.1`, using HTTP or HTTPS. HTTPS needs a certificate Chrome already trusts. IPv6 loopback, custom DNS names, remote machines, URL paths, credentials, and redirects are intentionally not accepted.

## Primary references

- [Ollama FAQ: server environment, origins, and local-only mode](https://docs.ollama.com/faq)
- [Ollama installed-model API](https://docs.ollama.com/api/tags)
- [Ollama chat API](https://docs.ollama.com/api/chat)

The extension sends neither model-pull nor server-configuration requests. Install models and configure Ollama yourself with its supported tools.
