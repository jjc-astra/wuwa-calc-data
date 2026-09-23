# wuwa-calc-data

Character/weapon/echo mechanics and image assets for [wuwa-calc](https://github.com/jred1/wuwa-calc)
(the site repo). Kept separate so publishing new data doesn't require rebuilding or redeploying
the site.

The deployed site fetches straight from this repo's raw content
(`raw.githubusercontent.com/<owner>/wuwa-calc-data/main/...`), so this repo needs to stay
**public** and needs no build step of its own.

`data/manifest.json` is a relPath -> content-hash map the site uses to detect when cached data is
stale. It's regenerated automatically by `.github/workflows/manifest.yml` on every push that
touches a `data/**.json` file -- if you're editing data locally and want it up to date before
pushing, run `npm run gen:manifest`.

## Rotation Rankings (`data/character_results/`)

The site's Export Rotation dialog downloads two files per submission:

- `rotations/<name>.json` -- the rotation, the roster and target (`enemy`) as submitted, and its
  settings, plus a short `hash` of those.
- `results/<name>.json` -- one calculation of that rotation: `rotationFile` names the rotation file,
  `hash` repeats its hash, `team` and `enemy` are the exact team and target calculated, `results`
  holds DPS + contribution. `build` is `"default"` (recommended echo layout, main stats and
  substats, with set, main echo and weapon as submitted; default target) or `"custom"` (the
  submitted echoes and target). Set `rotationType` to `"linear"` or
  `"quickswap"` by hand to classify it.

Only `"default"` results are ranked. `index.json` is generated from them by
`scripts/generate-rankings-index.mjs` (run by the same workflow, or `npm run gen`), which skips any
results file whose rotation file is missing or no longer matches its hash. Don't edit it by hand.
