# Wiki Staging Folder

This folder holds the content of the project's
[GitHub Wiki](https://github.com/brunoanhaia/planning-poker/wiki). The wiki itself is a
separate git repository with no pull requests or CI, so the pages are authored here — where
they can be reviewed — and pushed to the wiki remote.

## Publishing

```bash
git clone https://github.com/brunoanhaia/planning-poker.wiki.git /tmp/opencode/wiki-checkout
cp wiki/*.md /tmp/opencode/wiki-checkout/
git -C /tmp/opencode/wiki-checkout commit -am "docs: update wiki"
git -C /tmp/opencode/wiki-checkout push
```

File names are page titles: `Roles and Permissions.md` becomes the page "Roles and
Permissions", linked as `[[Roles and Permissions]]`. Reserved names are `Home.md`,
`_Sidebar.md` and `_Footer.md`. Enable the wiki in _Settings → Features_ first.

## Editorial rules

1. **The wiki is the source of truth for behavior.** Pages are written from the code, not
   from the README. Every page carries a `Last verified: <date> against commit <hash>` stamp;
   when the code moves, the stamp moves with it.
2. **Numbers come from `packages/shared`.** Limits, durations and close codes are constants
   there; quote them, and re-verify on any change to that package.
3. **What must match the code exactly stays in the repository** — commands (`TOOLS.md`), agent
   rules (`AGENTS.md`), contribution process (`CONTRIBUTING.md`), requirements and the
   changelog. Wiki pages link there; they never copy.
4. **English only**, like every other artifact in the repository.
5. **Sharp edges are documented, not hidden.** A wiki that omits the quirks is a wiki nobody
   trusts when it matters.
6. **No security-sensitive calibration on public pages.** Describe the control, not its exact
   thresholds; the detailed review lives in `docs/security-review.md` in the repository.
