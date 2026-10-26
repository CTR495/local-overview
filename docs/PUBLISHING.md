# Publishing and releases

The canonical public repository is [CTR495/local-overview](https://github.com/CTR495/local-overview). Repository creation, pushes, and release publication are maintainer actions; build and test commands do not publish anything. The following instructions describe the release workflow; inspect existing remotes and releases before using them.

The current release is [v0.1.1](https://github.com/CTR495/local-overview/releases/tag/v0.1.1), authorized by the maintainer on **27 October 2026** after manual testing. The existing [v0.1.0 release](https://github.com/CTR495/local-overview/releases/tag/v0.1.0) and asset are preserved. Future releases require their own maintainer authorization.

Before publishing, run `npm run verify` and `npm run test:browser`, review `git status`, and confirm that dependencies, build outputs, browser profiles, local paths, credentials, and personal search fixtures are excluded. Keep honest validation notes in the release description.

## GitHub CLI

From the intended project directory:

```sh
gh auth status
git status
git remote -v
```

This repository already has an `origin` remote and public history. Inspect remote state before publishing a new revision:

```sh
git fetch origin
git log --oneline --decorate -5
gh repo view CTR495/local-overview --json url,visibility,defaultBranchRef
gh release list --repo CTR495/local-overview
```

Commit only the intended project changes. Advance `main` with a fast-forward only after reviewing any remote changes. Do not reinitialize, replace an existing remote, or overwrite unrelated work. Never force-push to resolve a collision.

For an authorized release, push the reviewed commit to `main` and wait for its GitHub Actions checks to pass before creating a tag or release:

```sh
git push origin HEAD:main
gh run list --repo CTR495/local-overview --branch main
```

## Without GitHub CLI

Use GitHub's website to inspect the existing repository and its releases, then upload the reviewed ZIP to a new release at the intended commit. Verify the repository URL in a signed-out browser and confirm its visibility is Public. Public hosting makes the source downloadable; it does not install the extension into Chrome or submit it to the Chrome Web Store.

## Release package

Run `npm run package` to produce a ZIP in `artifacts/`. Inspect its file list and load an extracted copy in a disposable Chrome profile. The ZIP contains the built extension, license, and privacy policy; the source repository remains the canonical contribution surface.

The following commands record the 0.1.1 release workflow. They are not repeatable against an existing release; inspect the tag and release first, and use the appropriate new version for future updates. Pin `--target` to the reviewed full commit SHA when creating a new tag:

```sh
gh release create v0.1.1 artifacts/local-overview-0.1.1.zip --repo CTR495/local-overview --target REVIEWED_COMMIT_SHA --title "Local Overview v0.1.1" --notes-file docs/RELEASE-v0.1.1.md
gh release view v0.1.1 --repo CTR495/local-overview --json url,isDraft,assets
```

Check the public repository and release URLs without authentication. Download the attached ZIP and verify it matches the local reviewed artifact. Do not replace an existing release asset or move a tag without reviewing the existing publication.
