const fs   = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'images');
const OUT_FILE   = path.join(__dirname, 'images.json');
const ACCEPTED   = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

function scan(dir, base) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files = files.concat(scan(path.join(dir, entry.name), path.join(base, entry.name)));
    } else if (ACCEPTED.has(entry.name.split('.').pop().toLowerCase())) {
      files.push(path.join(base, entry.name).replace(/\\/g, '/'));
    }
  }
  return files;
}

const files = scan(IMAGES_DIR, '').sort();

fs.writeFileSync(OUT_FILE, JSON.stringify(files, null, 2));
console.log(`Written ${files.length} entries to images.json`);
