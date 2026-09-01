# Image Elo Rater

Rate images head-to-head, two at a time. Click (or use ← / →) to pick the better one; every vote updates an Elo score. Open the results grid anytime to see the ranking.

There are two independent modes:

| | **Local mode** (`local.html`) | **Shared mode** (`index.html`) |
|---|---|---|
| Setup | None | Firebase project |
| Images | Drag & drop any folder | Committed to `images/` + manifest |
| Scores stored in | Your browser (localStorage) | Firebase Realtime Database |
| Who votes | Just you | Everyone with the link |
| How to run | Open the file in a browser | Needs a web server |

## Local mode — zero setup

1. Open `local.html` in a browser (double-clicking the file works — no server needed).
2. Drop an image folder onto the page, or click **Choose folder**.
3. Rate. Scores save automatically; next visit, click **Load folder to continue** and re-select the same folder (the browser can't remember folder access, but your scores persist).

Accepts `jpg`, `jpeg`, `png`, `gif`, `webp`. Subfolders are included.

### Multiple projects in local mode

Just drop a different folder — use the **New folder** button on the welcome screen. Scores are keyed by **filename**, so this works cleanly as long as filenames don't repeat across projects. If two projects both contain `IMG_0001.jpg`, they'll share one score.

- Exported CSVs and the results grid only show images from the currently loaded folder.
- To start a project completely fresh, clear the site's localStorage (DevTools → Application → Local Storage → delete `elo-rater-data`), or rename files to be unique per project.

### Finding near-duplicates

`find-near-duplicates.py` clusters visually-similar images (not just byte-identical ones) using perceptual hashing. It's a standalone script — the computation happens outside the browser, since it's too heavy to run in-page. Works the same way in both modes.

1. Install dependencies: `pip install imagehash Pillow`
2. Run it against your folder, writing a JSON report:
   ```
   python find-near-duplicates.py "path/to/your/folder" --out clusters.json
   ```
   Add `--recursive` if images are in subfolders. `--threshold` (default 6) controls how similar images must be to cluster together — lower is stricter.
3. In the corner controls, click **Duplicates** → **Load Duplicate Report** and select `clusters.json`.
4. Clusters are sorted largest-first by default — click **Sort** to toggle back to the report's original order.
5. Each cluster shows all its images side by side (click any thumbnail to open it full-size in a lightbox, with ‹ › buttons or the ← → arrow keys to step through the rest of the cluster without closing it). Click **Keep only this** on the one you want to keep — every other image in that cluster gets flagged for removal in one click — or use the 🗑️ button to remove individual images one at a time. Or click **Judge this cluster** to run a mini-tournament (head-to-head voting scoped to just that cluster) and, at the end, choose how many of the survivors to keep. The review screen pre-checks the top scorer plus anything you'd already favorited (☆, see below) in that cluster — uncheck anything you don't want kept, including all of them if none are worth keeping.
6. Flagging is the same mechanism as the regular remove-from-tournament flow: check the **Removed** tab to restore anything you flagged by mistake. There's no separate undo — it's the same revert path.

In local mode the report is remembered across reloads (stored alongside your scores in localStorage) — reload it again only if you re-run the script. In shared mode, loading a report saves it to Firebase so every voter sees the same clusters; whoever loads a new report replaces it for everyone.

### Favorites

Click the ☆ next to the 🗑️ on either panel to bookmark an image — it fills in as ★ and shows up under the **Favorites** tab. Favoriting doesn't affect Elo score or pairing; it's purely a bookmark. Unfavorite from the rating view or from the Favorites tab itself.

### Shared code

`pairing.js` holds the pairing/Elo logic (`selectNextPair`, Elo K-factor constants, etc.) used identically by both `local.html` and `index.html` — edit it once, not twice. Both files load it as a plain `<script>` tag before their own script runs. Beyond that, local.html (localStorage) and index.html (Firebase) intentionally diverge only where the underlying storage/persistence model requires it — every user-facing feature is meant to exist in both.

## Shared mode — one ranking, many voters

### One-time setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) and enable **Realtime Database**.
2. `cp firebase-config.example.js firebase-config.js` and fill in your project's web-app config (Project settings → General → Your apps). This file is gitignored — it never gets committed.
3. Point `.firebaserc` at your project ID, then deploy the database rules:
   ```
   npx firebase-tools deploy --only database
   ```

### Add images

```
cp your-photos/*.jpg images/
node generate-manifest.js        # writes images.json
```

`images/` is gitignored — images are deployed, not committed. Optionally run `node find-duplicates.js` first to catch exact duplicate files.

### Run locally

`index.html` uses ES modules, so it needs a web server (opening the file directly won't work):

```
npx serve .          # or: python -m http.server 8000
```

Then open http://localhost:3000 (or :8000). This talks to the **real** Firebase database — your test votes count.

### Deploy

```
npx firebase-tools deploy        # hosting + rules
```

Share the hosting URL; anyone who opens it votes into the same ranking.

### Multiple projects in shared mode

All scores live under one `images` node in one database, keyed by filename — so **one deployment = one image set**. To run several projects:

1. **Copy the repo folder per project** (simplest). Each copy gets its own `images/`, its own Firebase project (or at least its own Realtime Database instance — set a different `databaseURL` in that copy's `firebase-config.js`), and its own `.firebaserc` / hosting URL.
2. **Or reuse one deployment serially**: swap out the contents of `images/`, re-run `node generate-manifest.js`, and redeploy. Old scores stay in Firebase harmlessly (images not in the manifest are ignored), but if a new project reuses a filename from an old one, it inherits that file's old score — wipe the `images` node in the Firebase console between projects to avoid this.

### Updating images within a project

Add/remove files in `images/`, re-run `node generate-manifest.js`, redeploy. Scores for removed images are preserved in Firebase and restored if the file comes back.

## Export

Click **Export CSV** in either mode to download `filename,score,wins,losses,games` sorted by score.

## Tuning

Constants at the top of `pairing.js` (shared by both modes — see [Shared code](#shared-code) above):

| Constant | Default | Meaning |
|---|---|---|
| `K_HIGH` / `K_LOW` | 32 / 16 | Elo K-factor before/after `K_THRESHOLD` games |
| `K_THRESHOLD` | 10 | Games after which an image's rating moves more slowly |
| `LOW_GAME_CAP` | 15 | Pairing prefers opponents with fewer games than this |
| `PROGRESS_THRESHOLD` | 5 | Stats bar counts images below this many comparisons |
