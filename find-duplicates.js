const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const IMAGES_DIR = path.join(__dirname, 'images');
const ACCEPTED   = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

function scan(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scan(full));
    } else if (ACCEPTED.has(entry.name.split('.').pop().toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const files = scan(IMAGES_DIR);
console.log(`Scanning ${files.length} images...`);

const byHash = {};
for (const file of files) {
  const hash = hashFile(file);
  if (!byHash[hash]) byHash[hash] = [];
  byHash[hash].push(file);
}

const dupes = Object.values(byHash).filter(group => group.length > 1);

if (dupes.length === 0) {
  console.log('No duplicates found.');
} else {
  console.log(`\nFound ${dupes.length} duplicate group${dupes.length === 1 ? '' : 's'}:\n`);
  dupes.forEach((group, i) => {
    console.log(`Group ${i + 1}:`);
    group.forEach(f => console.log(`  ${path.relative(IMAGES_DIR, f)}`));
    console.log();
  });
}
