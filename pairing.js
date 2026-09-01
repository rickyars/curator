// Shared pairing/Elo logic used by both local.html and index.html — local
// and shared mode must always pick pairs and score results the same way,
// so this file is the single source of truth. Edit here, not in either HTML.
var K_HIGH = 32;
var K_LOW = 16;
var K_THRESHOLD = 10;
var LOW_GAME_CAP = 15;
var PROGRESS_THRESHOLD = 5;

function expectedScore(scoreA, scoreB) {
  return 1 / (1 + Math.pow(10, (scoreB - scoreA) / 400));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function weightedRandom(items) {
  const total = items.reduce((sum, x) => sum + x.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.name;
  }
  return items[items.length - 1].name;
}

// Candidates closest in Elo to `anchorName`, preferring low-game images,
// shuffled before sorting so tied scores (e.g. everyone starting at 1000)
// don't always resolve in the same insertion/alphabetical order.
function pickClosestElo(images, candidateNames, anchorName) {
  let pool = candidateNames.filter(n => images[n].games < LOW_GAME_CAP);
  if (pool.length === 0) pool = candidateNames;
  shuffle(pool).sort((a, b) =>
    Math.abs(images[a].score - images[anchorName].score) -
    Math.abs(images[b].score - images[anchorName].score)
  );
  return pool;
}

function pickOneNear(images, candidateNames, anchorName) {
  const candidates = pickClosestElo(images, candidateNames, anchorName);
  const topN = candidates.slice(0, Math.min(3, candidates.length));
  return topN[Math.floor(Math.random() * topN.length)];
}

function selectNextPair(images, lastPair) {
  const allNames = Object.keys(images);

  // Never reoffer either image from the immediately previous pair — a hard
  // exclusion, not just a bias — whenever the pool is big enough to allow it.
  const excludeSet = lastPair ? new Set(lastPair) : new Set();
  const available = allNames.filter(n => !excludeSet.has(n));
  const names = available.length >= 2 ? available : allNames;

  // Player A: weighted by 1/(games+1) — zero-game images have highest priority
  const weights = names.map(n => ({ name: n, weight: 1 / (images[n].games + 1) }));
  const playerA = weightedRandom(weights);

  const playerB = pickOneNear(images, names.filter(n => n !== playerA), playerA);

  return [playerA, playerB];
}
