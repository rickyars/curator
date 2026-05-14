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
