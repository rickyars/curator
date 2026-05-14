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
