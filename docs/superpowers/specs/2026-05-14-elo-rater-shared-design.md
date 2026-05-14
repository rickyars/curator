# Image Elo Rater — Shared (Firebase) Design Spec

**Date:** 2026-05-14  
**Status:** Approved  
**Builds on:** `docs/superpowers/specs/2026-05-13-elo-rater-design.md`

---

## Overview

A shared version of the Image Elo Rater hosted on any static host (GitHub Pages, Vercel, or similar). Images are committed to the repo and served as static files. Scores are stored in Firebase Realtime Database — all users rate the same images and their votes feed a single shared Elo pool. No server, no build step, no folder picker.

---

## Decisions Made

| Question | Decision |
|---|---|
| Score model | Shared pool — all votes combine into one global ranking |
| User identity | Anonymous — no login, no names |
| Backend | Firebase Realtime Database (free Spark tier) |
| Frontend hosting | Static hosting — GitHub Pages or Vercel (no difference to the app) |
| Image manifest | Manual — `node generate-manifest.js`, then commit |

---

## File Structure

```
index.html              ← the app
images.json             ← generated manifest: ["photo001.jpg", ...]
images/                 ← photos committed to the repo
  photo001.jpg
  photo002.jpg
  ...
generate-manifest.js    ← run locally to rebuild images.json
```

`generate-manifest.js` scans the `images/` directory for accepted extensions (jpg, jpeg, png, gif, webp), writes a sorted JSON array to `images.json`, and exits. Run with `node generate-manifest.js` whenever images are added or removed.

---

## Firebase Data Model

One Realtime Database at the project root:

```json
{
  "images": {
    "photo001.jpg": { "score": 1000, "wins": 0, "losses": 0, "games": 0 },
    "photo002.jpg": { "score": 1184, "wins": 12, "losses": 3, "games": 15 }
  },
  "totalComparisons": 847
}
```

- New filenames (in `images.json` but absent from Firebase) are initialized at score 1000, all counts zero, on first load.
- Filenames present in Firebase but absent from `images.json` are ignored for pairing; their scores are preserved.
- `totalComparisons` is the global all-users count, incremented atomically on every pick.

---

## Firebase Setup (one-time, by repo owner)

1. Create a Firebase project at console.firebase.google.com (free Spark plan).
2. Enable Realtime Database. Choose any region.
3. Set security rules to public read/write:
   ```json
   { "rules": { ".read": true, ".write": true } }
   ```
4. Copy the project config (apiKey, databaseURL, etc.) into `index.html`.

Firebase config is safe to commit publicly with these open rules — the database only stores image scores, no personal data.

---

## App Startup Sequence

1. Show "Loading…" spinner (replaces the folder picker / resume card from the original).
2. Fetch `images.json` (static file — list of filenames).
3. One-time `get()` from Firebase to read current scores.
4. Merge: for each filename in `images.json` not present in Firebase, write `{ score: 1000, wins: 0, losses: 0, games: 0 }` using `update()` with only the missing keys — existing scores are never overwritten. Safe for concurrent opens (two users initializing the same key simultaneously both write identical defaults).
5. If fewer than 2 images, show an error and stop.
6. Begin rating — call `startRating()` and show the rating view.

---

## Score Writes — `runTransaction`

Every pick uses Firebase `runTransaction` on both the winner and loser nodes to ensure atomic updates under concurrent use:

```js
async function applyResultFirebase(winnerName, loserName) {
  const db = getDatabase();
  const winRef = ref(db, `images/${winnerName}`);
  const loseRef = ref(db, `images/${loserName}`);

  // Transactions run independently; local state updated after both resolve
  const [winSnap, loseSnap] = await Promise.all([
    runTransaction(winRef, img => {
      if (!img) return img;
      const k = img.games < K_THRESHOLD ? K_HIGH : K_LOW;
      const exp = 1 / (1 + Math.pow(10, (localScores[loserName].score - img.score) / 400));
      return { ...img, score: img.score + k * (1 - exp), wins: img.wins + 1, games: img.games + 1 };
    }),
    runTransaction(loseRef, img => {
      if (!img) return img;
      const k = img.games < K_THRESHOLD ? K_HIGH : K_LOW;
      const exp = 1 / (1 + Math.pow(10, (img.score - localScores[winnerName].score) / 400));
      return { ...img, score: img.score - k * (1 - exp), losses: img.losses + 1, games: img.games + 1 };
    }),
  ]);

  // Update local cache from transaction results
  localScores[winnerName] = winSnap.snapshot.val();
  localScores[loserName]  = loseSnap.snapshot.val();

  // Increment totalComparisons
  runTransaction(ref(db, 'totalComparisons'), n => (n || 0) + 1);
}
```

`localScores` is an in-memory cache of the Firebase data used for pairing and display, updated after each transaction.

**Known limitation:** The expected-score calculation inside each transaction reads `localScores` (local cache) rather than the live Firebase value of the opponent. If another user updates the opponent's score between our last sync and this pick, the expected score will be slightly stale. This produces a minor Elo approximation error — acceptable for this use case. A fully correct solution would require a multi-path transaction reading both scores atomically, which adds significant complexity.

---

## Results View — Live Updates

While the results panel is open, an `onValue` listener on `images/` updates `localScores` and re-renders the grid whenever any user makes a pick. The listener is attached when the results view opens and detached when it closes.

---

## Stats Bar

- **Left:** `{sessionComparisons} comparisons this session · {totalComparisons} total` — `totalComparisons` comes from a live `onValue` listener on `totalComparisons` node (always active).
- **Center:** keyboard hint (unchanged)
- **Right:** `{n} images with fewer than 5 comparisons` or `Refining rankings` — computed from `localScores` (updated after each pick)

---

## Pairing Algorithm

Unchanged from the original — `selectNextPair(localScores, lastPair)`. Operates on the in-memory `localScores` cache.

---

## Loading View

Replaces the folder picker and resume card entirely:

```
[ connecting to Firebase... ]
```

A simple centered spinner/text. Disappears when startup is complete. On error (Firebase unreachable, `images.json` missing), shows an error message.

---

## Export

Unchanged — "Export CSV" exports all entries in `localScores` with `games > 0`, sorted by score descending.

---

## What Is Removed vs. Original

| Removed | Reason |
|---|---|
| Folder picker / drop zone | Images served from repo |
| Drag-and-drop | No longer needed |
| Resume card | No per-user state to resume |
| localStorage entirely | Firebase is the source of truth |
| `loadData`, `saveData`, `mergeFolder` | Replaced by Firebase reads/writes |
| `lastSession` timestamp | No per-user session tracking |
| `ACCEPTED_EXTS` filter in app | Filtering done in `generate-manifest.js` |

---

## What Is Unchanged

- Dark theme, full-viewport layout, contain image sizing
- Pairing algorithm (weighted random + closest score)
- Elo formula and K-factor logic
- Results thumbnail grid
- Export CSV
- Keyboard shortcuts (← →)
- `sessionComparisons` (in-memory, per-user)
- Progress indicator ("X images with fewer than 5 comparisons")

---

## Out of Scope

No authentication. No per-user score history. No undo. No admin panel. No CI/CD manifest generation.
