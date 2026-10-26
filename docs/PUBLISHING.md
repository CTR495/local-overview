# Publish after maintainer approval

This project is prepared locally. Repository creation and pushes require the maintainer's explicit approval. Build and test commands do not publish anything.

Before publishing, run `npm run verify` and `npm run test:browser`, review `git status`, and confirm that dependencies, build outputs, browser profiles, local paths, credentials, and personal search fixtures are excluded. Keep honest validation notes in the release description.

## GitHub CLI

After approval, from the intended project directory:

```sh
gh auth status
git status
git remote -v
```

If this directory has no Git repository yet:

```sh
git init -b main
git add .
git commit -m "Release Local Overview 0.1.0"
```

If it is already initialized, inspect the existing history and commit only the intended project changes. Do not reinitialize, replace an existing remote, or overwrite unrelated work.

With a clean, reviewed local commit and no existing `origin`, create a new public repository under the authenticated account:

```sh
gh repo create local-overview --public --source=. --remote=origin --push --description "Google Search overviews powered by local Ollama models"
gh repo view --json url,visibility
```

If the name already exists, inspect it and choose a new name or obtain approval to use the existing repository. Never force-push to resolve a collision.

## Without GitHub CLI

Create an **empty public** repository named `local-overview` through GitHub's website after approval. Do not initialize it with a README or license, since this project already includes them. Replace `YOUR_GITHUB_USERNAME` below:

```sh
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/local-overview.git
git push -u origin main
```

Verify the repository URL in a signed-out browser and confirm its visibility is Public. Public hosting makes the source downloadable; it does not install the extension into Chrome or submit it to the Chrome Web Store.

## Optional release package

Run `npm run package` to produce a ZIP in `artifacts/`. Inspect its file list and load an extracted copy in a disposable Chrome profile. Attach it to a GitHub release only after separately approving the release. The ZIP contains the built extension, while the source repository remains the canonical contribution surface.
