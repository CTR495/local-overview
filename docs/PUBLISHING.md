# Publishing and releases

The intended canonical repository is `CTR495/local-overview`; public repository and release publication are pending. Repository creation, pushes, and release publication are maintainer actions; build and test commands do not publish anything. The maintainer authorized the first public repository and `v0.1.0` release after reviewing the local build.

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

## Release package

Run `npm run package` to produce a ZIP in `artifacts/`. Inspect its file list and load an extracted copy in a disposable Chrome profile. The ZIP contains the built extension, license, and privacy policy; the source repository remains the canonical contribution surface.

For the approved first release, confirm that the reviewed commit is on `main`, the remote is the intended public repository, and the tag/release does not already exist. Then run:

```sh
gh release create v0.1.0 artifacts/local-overview-0.1.0.zip --repo CTR495/local-overview --target main --title "Local Overview v0.1.0" --notes-file docs/RELEASE-v0.1.0.md
gh release view v0.1.0 --repo CTR495/local-overview --json url,isDraft,assets
```

Check the public repository and release URLs without authentication. Download the attached ZIP and verify it matches the local reviewed artifact. Do not replace an existing release asset or move a tag without reviewing the existing publication.
