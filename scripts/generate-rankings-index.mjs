// scripts/generate-rankings-index.mjs
// Builds data/character_results/index.json from the default-build results files in
// character_results/results/. It holds only what the site's Rankings search, filters and sort read
// -- characters, sequences, rotation type, DPS and the 2-minute majority element/category. Rows
// load the rest (team details, author, contribution) from their results file, page by page.
//
// Each results file carries the hash of the rotation it was calculated from, and that hash is the
// only link: every rotation file's hash is recomputed here (sha256 of JSON.stringify({ rotation,
// team, settings, enemy }), first 16 hex chars -- same as the site's hashRotationInputs), so file
// names can change freely. A results file no rotation file matches is left out, with a warning.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// Optional argument: another data directory, e.g. the site's local WIP mirror (site/public/wip-data/data).
const dataDir = process.argv[2] || join(__dirname, '..', 'data');
const rankingsDir = join(dataDir, 'character_results');
const resultsDir = join(rankingsDir, 'results');
const rotationsDir = join(rankingsDir, 'rotations');
const indexPath = join(rankingsDir, 'index.json');

// The DMG Type filter's categories -- keep in sync with the site's RANKING_DMG_CATEGORIES.
const DMG_CATEGORIES = ['Basic', 'Heavy', 'Skill', 'Liberation', 'Echo'];

const hashRotationInputs = ({ rotation, team, settings, enemy }) =>
  createHash('sha256').update(JSON.stringify({ rotation, team, settings, enemy })).digest('hex').slice(0, 16);

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

// Character elements: this repo's db_characters.json, with the data directory's own on top (the
// WIP mirror's holds only what it overrides, as the site merges them).
const characterDB = { ...readJson(join(__dirname, '..', 'data', 'db_characters.json')), ...(existsSync(join(dataDir, 'db_characters.json')) ? readJson(join(dataDir, 'db_characters.json')) : {}) };

// The key with the largest total, or null.
const largest = totals => Object.entries(totals).reduce((best, [key, dmg]) => (dmg > (best?.[1] ?? 0) ? [key, dmg] : best), null)?.[0] ?? null;

// The element the team's members dealt the most damage as (by each member's element) and the DMG
// Type category they dealt the most of, over the 2-minute window -- what the Element / DMG Type
// filters match. The other windows wouldn't realistically differ.
const majorityOf = ({ team: split = [], units = {} } = {}, team) => {
  const members = new Set(team.map(slot => slot.character).filter(Boolean));
  const elements = {};
  for (const { label, dmg } of split) {
    const element = members.has(label) ? characterDB[label]?.element : undefined;
    if (element) elements[element] = (elements[element] || 0) + dmg;
  }
  const categories = {};
  for (const [unit, slices] of Object.entries(units)) {
    if (!members.has(unit)) continue;
    for (const { castType, dmg } of slices) if (DMG_CATEGORIES.includes(castType)) categories[castType] = (categories[castType] || 0) + dmg;
  }
  return { element: largest(elements), category: largest(categories) };
};

const jsonFiles = dir => (existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.json')).sort() : []);

// Rotation file name by content hash; identical copies share a hash, and the first name wins.
function rotationsByHash() {
  const byHash = new Map();
  for (const name of jsonFiles(rotationsDir)) {
    const hash = hashRotationInputs(readJson(join(rotationsDir, name)));
    if (!byHash.has(hash)) byHash.set(hash, name);
  }
  return byHash;
}

export function generateRankingsIndex() {
  const files = jsonFiles(resultsDir);
  const rotations = rotationsByHash();
  const index = [];

  for (const id of files) {
    const results = readJson(join(resultsDir, id));
    if (results.build !== 'default') continue;

    const rotationFile = rotations.get(results.hash);
    if (!rotationFile) {
      console.warn(`[rankings-index] Skipping ${id}: no rotation file matches its hash (${results.hash}); its rotation was changed or removed.`);
      continue;
    }

    index.push({
      id,
      // Resolved by hash; the site loads the rotation from here.
      rotationFile,
      hash: results.hash,
      rotationType: results.rotationType ?? null,
      characters: results.team.map(slot => slot.character || ''),
      sequences: results.team.map(slot => Number(slot.sequence) || 0),
      dpsStats: results.results.dpsStats,
      majority: majorityOf(results.results.contribution.twoMin, results.team)
    });
  }

  // One entry per line, so a diff shows which builds changed.
  writeFileSync(indexPath, index.length ? `[\n${index.map(entry => JSON.stringify(entry)).join(',\n')}\n]\n` : '[]\n');
  return index;
}

const index = generateRankingsIndex();
console.log(`[rankings-index] Wrote ${index.length} entries to ${indexPath}`);
