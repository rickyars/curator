# Shared Firebase Elo Rater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing single-file Elo rater from localStorage + folder picker to Firebase Realtime Database + static image serving, so multiple users can rate the same images with scores shared in real time.

**Architecture:** `index.html` is rewritten in place — folder picker and localStorage are removed, Firebase v9 modular SDK is imported from CDN via `<script type="module">`, images are served from the `images/` folder and referenced by path. `generate-manifest.js` (Node.js) scans `images/` and writes `images.json`. All score reads/writes go through Firebase; `localScores` is an in-memory cache.

**Tech Stack:** Vanilla HTML/CSS/JS, Firebase Realtime Database v9 (CDN), Node.js `fs`/`path` for manifest generator.

---

### Task 1: generate-manifest.js + images/ placeholder

**Files:**
- Create: `generate-manifest.js`
- Create: `images/.gitkeep`

- [ ] **Step 1: Create `images/.gitkeep`**

```bash
mkdir -p images
touch images/.gitkeep
```

- [ ] **Step 2: Create `generate-manifest.js`**

```js
const fs   = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'images');
const OUT_FILE   = path.join(__dirname, 'images.json');
const ACCEPTED   = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

const files = fs.readdirSync(IMAGES_DIR)
  .filter(f => ACCEPTED.has(f.split('.').pop().toLowerCase()))
  .sort();

fs.writeFileSync(OUT_FILE, JSON.stringify(files, null, 2));
console.log(`Written ${files.length} entries to images.json`);
```

- [ ] **Step 3: Verify**

```bash
node generate-manifest.js
```

Expected output: `Written 0 entries to images.json` (no images yet — that's fine).
Check that `images.json` now contains `[]`.

- [ ] **Step 4: Commit**

```bash
git add generate-manifest.js images/.gitkeep images.json
git commit -m "feat: manifest generator and images placeholder"
```

---

### Task 2: Rewrite index.html — HTML structure + script skeleton

**Files:**
- Modify: `index.html`

This task removes all localStorage/folder-picker DOM elements and replaces the `<script>` block with a new `<script type="module">` containing Firebase imports, updated CONFIG, new globals, and placeholder section comments. The ELO and PAIRING sections are copied across unchanged.

- [ ] **Step 1: Remove `#storage-warning` and `<input folder-input>` from HTML body**

Find and delete these two elements from the HTML (lines ~246–249 in current file):
```html
<!-- Storage warning -->
<div id="storage-warning">⚠ Could not save scores (storage full). Click to dismiss.</div>

<!-- Hidden file input (no accept — webkitdirectory ignores it) -->
<input type="file" id="folder-input" webkitdirectory multiple style="display:none">
```

- [ ] **Step 2: Replace the loading view with a static spinner**

Change the empty `<div id="loading-view"></div>` to:
```html
<!-- Loading view -->
<div id="loading-view">
  <div style="text-align:center;color:#555;font-size:14px;">Connecting…</div>
</div>
```

- [ ] **Step 3: Replace the entire `<script>` block**

Delete everything from `<script>` to `</script>` and replace with:

```html
<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get, update, runTransaction, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// --- CONFIG ---
// REPLACE these placeholder values with your Firebase project config
// from console.firebase.google.com → Project settings → Your apps → SDK setup
const FIREBASE_CONFIG = {
  apiKey:            "REPLACE_ME",
  authDomain:        "REPLACE_ME.firebaseapp.com",
  databaseURL:       "https://REPLACE_ME-default-rtdb.firebaseio.com",
  projectId:         "REPLACE_ME",
  storageBucket:     "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId:             "REPLACE_ME"
};
const K_HIGH = 32;
const K_LOW  = 16;
const K_THRESHOLD = 10;
const LOW_GAME_CAP = 15;
const PROGRESS_THRESHOLD = 5;

// --- GLOBALS ---
const app = initializeApp(FIREBASE_CONFIG);
const db  = getDatabase(app);
let localScores       = {};   // in-memory cache of Firebase images data
let sessionComparisons = 0;
let lastPair          = null;
let totalComparisons  = 0;    // kept in sync by onValue listener
let resultsUnsubscribe = null; // detaches onValue when results view closes

// --- ELO ---
function expectedScore(scoreA, scoreB) {
  return 1 / (1 + Math.pow(10, (scoreB - scoreA) / 400));
}

// --- PAIRING ---
function weightedRandom(items) {
  const total = items.reduce((sum, x) => sum + x.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.name;
  }
  return items[items.length - 1].name;
}

function selectNextPair(images, lastPair) {
  const names = Object.keys(images);
  const weights = names.map(n => ({ name: n, weight: 1 / (images[n].games + 1) }));
  let playerA = weightedRandom(weights);

  const pickB = (excludeA) => {
    const others = names.filter(n => n !== excludeA);
    let pool = others.filter(n => images[n].games < LOW_GAME_CAP);
    if (pool.length === 0) pool = others;
    pool.sort((a, b) =>
      Math.abs(images[a].score - images[excludeA].score) -
      Math.abs(images[b].score - images[excludeA].score)
    );
    return pool;
  };

  let bCandidates = pickB(playerA);
  let playerB = bCandidates[0];

  if (lastPair && names.length > 2) {
    const [la, lb] = lastPair;
    const isRepeat = (playerA === la && playerB === lb) ||
                     (playerA === lb && playerB === la);
    if (isRepeat) {
      if (bCandidates.length > 1) {
        playerB = bCandidates[1];
      } else {
        const altWeights = weights.filter(w => w.name !== playerA);
        playerA = weightedRandom(altWeights);
        playerB = pickB(playerA)[0];
      }
    }
  }
  return [playerA, playerB];
}

// --- UI ---

// --- EVENTS ---

// --- INIT ---
</script>
```

- [ ] **Step 4: Verify in browser**

Open `index.html` in Chrome. You should see "Connecting…" centred on a black page. DevTools console will show a Firebase error (config not yet set) — that's expected. No JS parse errors.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: replace script block with firebase module imports and new globals"
```

---

### Task 3: Adapt UI functions

**Files:**
- Modify: `index.html` — UI section

Replace `// --- UI ---` with the complete UI section below. Key changes from the original:
- `showLoadingStatus(msg)` replaces `showLoadingView()` / `showLoadingError()`
- `showRatingView` uses `images/${name}` instead of blob URLs
- `showResultsView` uses `images/${name}` instead of blob URLs, and manages `resultsUnsubscribe`
- `updateStats` reads from globals `sessionComparisons` and `totalComparisons`
- `lowGameCount` has no `.url` guard (all `localScores` entries are real images)
- `exportCSV` filters `img.games > 0` (no `.url` filter)

- [ ] **Step 1: Replace `// --- UI ---` with:**

```js
// --- UI ---
function showLoadingStatus(msg) {
  document.getElementById('loading-view').innerHTML =
    `<div style="text-align:center;color:#555;font-size:14px;">${msg}</div>`;
}

function lowGameCount(images) {
  return Object.values(images).filter(img => img.games < PROGRESS_THRESHOLD).length;
}

function showRatingView(nameA, nameB) {
  document.getElementById('loading-view').style.display  = 'none';
  document.getElementById('results-view').style.display  = 'none';
  document.getElementById('rating-view').style.display   = 'flex';
  document.getElementById('corner-controls').style.display = 'flex';
  document.getElementById('results-toggle-btn').textContent = 'Results';

  document.getElementById('img-a').src = `images/${nameA}`;
  document.getElementById('img-b').src = `images/${nameB}`;
  document.getElementById('panel-a').dataset.name = nameA;
  document.getElementById('panel-b').dataset.name = nameB;
  updateStats();
}

function showResultsView() {
  document.getElementById('loading-view').style.display  = 'none';
  document.getElementById('rating-view').style.display   = 'none';
  document.getElementById('results-view').style.display  = 'flex';
  document.getElementById('results-toggle-btn').textContent = '← Rate';

  renderResultsGrid();

  // Live updates while results panel is open
  resultsUnsubscribe = onValue(ref(db, 'images'), snap => {
    const data = snap.val();
    if (data) {
      Object.assign(localScores, data);
      renderResultsGrid();
    }
  });
}

function renderResultsGrid() {
  const sorted = Object.entries(localScores)
    .sort((a, b) => b[1].score - a[1].score);

  const grid = document.getElementById('results-grid');
  grid.innerHTML = '';
  sorted.forEach(([name, img], i) => {
    const rank = i + 1;
    const cell = document.createElement('div');
    cell.className = 'thumb-cell';
    cell.innerHTML = `
      <img src="images/${name}" alt="">
      <div class="thumb-rank${rank <= 3 ? ' top3' : ''}">#${rank}</div>
      <div class="thumb-score">${Math.round(img.score)}</div>`;
    grid.appendChild(cell);
  });
}

function updateStats() {
  const low = lowGameCount(localScores);
  document.getElementById('stats-session').textContent =
    `${sessionComparisons} comparison${sessionComparisons === 1 ? '' : 's'} this session · ${totalComparisons} total`;
  document.getElementById('stats-progress').textContent =
    low > 0
      ? `${low} image${low === 1 ? '' : 's'} with fewer than ${PROGRESS_THRESHOLD} comparisons`
      : 'Refining rankings';
}

function exportCSV() {
  const rows = Object.entries(localScores)
    .filter(([, img]) => img.games > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([name, img]) =>
      [name, img.score.toFixed(2), img.wins, img.losses, img.games].join(',')
    );
  const csv = ['filename,score,wins,losses,games', ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'elo-rankings.csv';
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verify in browser**

Module-scoped functions aren't accessible from the DevTools console directly. To verify, temporarily add `window._test = { showRatingView, showResultsView, updateStats }` at the end of the UI section, then in the console:

```js
// Simulate loaded state
localScores = { 'a.jpg': { score: 1080, wins: 4, losses: 1, games: 5 }, 'b.jpg': { score: 940, wins: 2, losses: 3, games: 5 } };
// These will fail until Firebase is configured — that's OK for now.
// Just confirm img-a src becomes "images/a.jpg" (not a blob:// URL)
// and renderResultsGrid builds cells with "images/${name}" src.
```

Remove the `window._test` line after verification.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: adapt ui functions for localscores and static image paths"
```

---

### Task 4: Firebase score writes — applyResultFirebase + onPick + startRating

**Files:**
- Modify: `index.html` — EVENTS section

- [ ] **Step 1: Replace `// --- EVENTS ---` with:**

```js
// --- EVENTS ---
async function applyResultFirebase(winnerName, loserName) {
  const winRef  = ref(db, `images/${winnerName}`);
  const loseRef = ref(db, `images/${loserName}`);

  const [winResult, loseResult] = await Promise.all([
    runTransaction(winRef, current => {
      if (current === null) return current;
      const kWinner = current.games < K_THRESHOLD ? K_HIGH : K_LOW;
      const exp = expectedScore(current.score, localScores[loserName].score);
      return {
        score:   current.score + kWinner * (1 - exp),
        wins:    current.wins + 1,
        losses:  current.losses,
        games:   current.games + 1,
      };
    }),
    runTransaction(loseRef, current => {
      if (current === null) return current;
      const kLoser = current.games < K_THRESHOLD ? K_HIGH : K_LOW;
      const exp = expectedScore(localScores[winnerName].score, current.score);
      return {
        score:   current.score - kLoser * (1 - exp),
        wins:    current.wins,
        losses:  current.losses + 1,
        games:   current.games + 1,
      };
    }),
  ]);

  if (winResult.committed)  localScores[winnerName] = winResult.snapshot.val();
  if (loseResult.committed) localScores[loserName]  = loseResult.snapshot.val();

  runTransaction(ref(db, 'totalComparisons'), n => (n || 0) + 1);
}

async function onPick(winnerName, loserName) {
  await applyResultFirebase(winnerName, loserName);
  sessionComparisons++;
  const pair = selectNextPair(localScores, lastPair);
  lastPair = pair;
  showRatingView(pair[0], pair[1]);
}

function startRating() {
  const pair = selectNextPair(localScores, lastPair);
  lastPair = pair;
  showRatingView(pair[0], pair[1]);
}

document.getElementById('panel-a').addEventListener('click', () => {
  const a = document.getElementById('panel-a').dataset.name;
  const b = document.getElementById('panel-b').dataset.name;
  if (a && b) onPick(a, b);
});

document.getElementById('panel-b').addEventListener('click', () => {
  const a = document.getElementById('panel-a').dataset.name;
  const b = document.getElementById('panel-b').dataset.name;
  if (a && b) onPick(b, a);
});

document.addEventListener('keydown', e => {
  if (document.getElementById('rating-view').style.display === 'none') return;
  const a = document.getElementById('panel-a').dataset.name;
  const b = document.getElementById('panel-b').dataset.name;
  if (!a || !b) return;
  if (e.key === 'ArrowLeft')  onPick(a, b);
  if (e.key === 'ArrowRight') onPick(b, a);
});

document.getElementById('results-toggle-btn').addEventListener('click', () => {
  if (document.getElementById('results-view').style.display === 'none') {
    showResultsView();
  } else {
    if (resultsUnsubscribe) { resultsUnsubscribe(); resultsUnsubscribe = null; }
    showRatingView(
      document.getElementById('panel-a').dataset.name,
      document.getElementById('panel-b').dataset.name
    );
  }
});

document.getElementById('export-btn').addEventListener('click', exportCSV);
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: firebase runTransaction for score writes, async onPick"
```

---

### Task 5: Live totalComparisons listener + INIT startup sequence

**Files:**
- Modify: `index.html` — INIT section

- [ ] **Step 1: Replace `// --- INIT ---` with:**

```js
// --- INIT ---
async function init() {
  showLoadingStatus('Connecting…');

  // 1. Fetch images.json
  let filenames;
  try {
    const res = await fetch('images.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    filenames = await res.json();
  } catch (e) {
    showLoadingStatus(`Error: could not load images.json (${e.message})`);
    return;
  }

  if (filenames.length < 2) {
    showLoadingStatus('Error: add at least 2 images to the images/ folder and re-run generate-manifest.js');
    return;
  }

  // 2. Read current Firebase scores
  let firebaseImages = {};
  try {
    const snap = await get(ref(db, 'images'));
    firebaseImages = snap.val() || {};
  } catch (e) {
    showLoadingStatus(`Error: could not connect to Firebase (${e.message}). Check FIREBASE_CONFIG.`);
    return;
  }

  // 3. Build localScores — start from Firebase, add missing entries
  localScores = { ...firebaseImages };
  const missing = {};
  for (const name of filenames) {
    if (!localScores[name]) {
      const entry = { score: 1000, wins: 0, losses: 0, games: 0 };
      localScores[name] = entry;
      missing[name] = entry;
    }
  }
  if (Object.keys(missing).length > 0) {
    await update(ref(db, 'images'), missing);
  }

  // 4. Seed totalComparisons from Firebase
  const totalSnap = await get(ref(db, 'totalComparisons'));
  totalComparisons = totalSnap.val() || 0;

  // 5. Keep totalComparisons in sync (always-on listener)
  onValue(ref(db, 'totalComparisons'), snap => {
    totalComparisons = snap.val() || 0;
    if (document.getElementById('rating-view').style.display !== 'none') {
      updateStats();
    }
  });

  // 6. Begin rating
  startRating();
}

init();
```

- [ ] **Step 2: Set up a real Firebase project and paste config**

1. Go to console.firebase.google.com → Add project (or use existing).
2. Click "Build" → "Realtime Database" → Create database → Start in test mode.
3. Go to Project Settings → Your apps → Add app (Web) → Register.
4. Copy the `firebaseConfig` object shown.
5. In `index.html`, replace the `FIREBASE_CONFIG` placeholder values with the real config values.

- [ ] **Step 3: Set Firebase security rules**

In the Firebase console → Realtime Database → Rules, set:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
Publish.

- [ ] **Step 4: Verify in browser**

Add 2+ test images to `images/`, run `node generate-manifest.js`, open `index.html` in Chrome.

Expected:
- "Connecting…" shows briefly
- Two images appear side by side
- Stats bar shows "0 comparisons this session · 0 total"
- DevTools → Network: one request to `images.json`, Firebase WebSocket connection established
- DevTools → Application → Local Storage: **empty** (no localStorage writes)

- [ ] **Step 5: Verify concurrent safety**

Open `index.html` in two browser tabs. Rate in one tab. Within 1–2 seconds, the `totalComparisons` stat in the other tab should update automatically (onValue listener fires).

- [ ] **Step 6: Verify results view live updates**

In Tab A, click "Results". In Tab B, rate a pair. Within ~1 second, Tab A's results grid should re-sort.

- [ ] **Step 7: Verify export**

Rate ~5 pairs. Click "Export CSV". Open the file — should show only images with `games > 0`, sorted by score descending.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: firebase startup sequence, init merge, live totalcomparisons listener"
```

---

### Task 6: End-to-end verification + README instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Full flow verification**

Open `index.html` with 10+ real images loaded. Verify:
- Fresh load: "Connecting…" → rating view (no folder picker, no resume card)
- Click and arrow key picks both work; next pair loads instantly
- Results view: thumbnail grid sorted by score, live updates as you rate
- "← Rate" returns to same pair
- Export CSV: correct data, sorted, no unrated images
- Firebase console → Realtime Database: data visible and updating in real time

- [ ] **Step 2: Edge case — fewer than 2 images**

Clear `images.json` to `[]` (edit manually), reload. Should see error message, no crash.

- [ ] **Step 3: Edge case — bad Firebase config**

Temporarily set `databaseURL` to `"https://invalid-url.firebaseio.com"`, reload. Should see "Error: could not connect to Firebase" message.

Restore the real config.

- [ ] **Step 4: Create README.md**

```markdown
# Image Elo Rater (Shared)

Rate images head-to-head. All votes are shared — everyone who opens the link contributes to the same ranking.

## Setup

### 1. Firebase
1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Realtime Database (test mode)
3. Set rules to `{ "rules": { ".read": true, ".write": true } }`
4. Copy your config into `index.html` under `FIREBASE_CONFIG`

### 2. Add images
```
cp your-photos/*.jpg images/
node generate-manifest.js
git add images/ images.json
git commit -m "add images"
```

### 3. Deploy
Push to GitHub and enable GitHub Pages (Settings → Pages → Deploy from branch → main / root), or connect the repo to Vercel.

Share the URL — anyone who opens it can start rating immediately.

## Updating images
Add or remove files from `images/`, re-run `node generate-manifest.js`, commit and push.
Scores for removed images are preserved in Firebase.

## Export results
Click "Export CSV" in the app to download rankings sorted by score.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: setup and deployment instructions"
```
