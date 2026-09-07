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
