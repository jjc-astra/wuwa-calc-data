// Builds character_results/index.json from default-build results: only what Rankings
// search, filters and sort read. Results link to rotations by hash (as in hashRotationInputs).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// Optional: another data dir (e.g. the WIP mirror).
const dataDir = process.argv[2] || join(__dirname, '..', 'data');
const rankingsDir = join(dataDir, 'character_results');
const resultsDir = join(rankingsDir, 'results');
const rotationsDir = join(rankingsDir, 'rotations');
const indexPath = join(rankingsDir, 'index.json');

// Sync with RANKING_DMG_CATEGORIES.
const DMG_CATEGORIES = ['Basic', 'Heavy', 'Skill', 'Liberation', 'Echo'];

const hashRotationInputs = ({ rotation, team, settings, enemy }) =>
  createHash('sha256').update(JSON.stringify({ rotation, team, settings, enemy })).digest('hex').slice(0, 16);

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

// This repo's db_characters.json, with the data dir's merged on top.
const characterDB = { ...readJson(join(__dirname, '..', 'data', 'db_characters.json')), ...(existsSync(join(dataDir, 'db_characters.json')) ? readJson(join(dataDir, 'db_characters.json')) : {}) };

const largest = totals => Object.entries(totals).reduce((best, [key, dmg]) => (dmg > (best?.[1] ?? 0) ? [key, dmg] : best), null)?.[0] ?? null;

// Dominant element and DMG Type category over 2 minutes.
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

// Rotation file name by hash; first wins.
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
      rotationFile,
      hash: results.hash,
      rotationType: results.rotationType ?? null,
      characters: results.team.map(slot => slot.character || ''),
      sequences: results.team.map(slot => Number(slot.sequence) || 0),
      dpsStats: results.results.dpsStats,
      majority: majorityOf(results.results.contribution.twoMin, results.team)
    });
  }

  // One entry per line for readable diffs.
  writeFileSync(indexPath, index.length ? `[\n${index.map(entry => JSON.stringify(entry)).join(',\n')}\n]\n` : '[]\n');
  return index;
}

const index = generateRankingsIndex();
console.log(`[rankings-index] Wrote ${index.length} entries to ${indexPath}`);
