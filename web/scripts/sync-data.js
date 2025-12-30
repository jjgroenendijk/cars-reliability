const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE = path.resolve(__dirname, '../../data/processed');
const TARGET = path.resolve(__dirname, '../public/data');
const CHECKSUM_FILE = path.join(TARGET, '.sync-checksum');

/**
 * Calculate MD5 checksum of all JSON files in a directory.
 * @param {string} dir - Directory path
 * @returns {string} Combined checksum of all JSON files
 */
function calculateChecksum(dir) {
  if (!fs.existsSync(dir)) {
    return '';
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort(); // Ensure consistent ordering

  if (files.length === 0) {
    return '';
  }

  const hashes = files.map(f => {
    const content = fs.readFileSync(path.join(dir, f));
    return crypto.createHash('md5').update(content).digest('hex');
  });

  return hashes.join('-');
}

/**
 * Sync JSON files from source to target directory.
 */
function syncData() {
  // Check if source directory exists
  if (!fs.existsSync(SOURCE)) {
    console.warn('Warning: data/processed directory not found.');
    console.warn('Run the Python pipeline first: cd scripts && uv run data_process.py');
    process.exit(0); // Exit gracefully, don't fail the build
  }

  // Ensure target directory exists
  if (!fs.existsSync(TARGET)) {
    fs.mkdirSync(TARGET, { recursive: true });
  }

  // Calculate checksums
  const sourceChecksum = calculateChecksum(SOURCE);
  let targetChecksum = '';

  if (fs.existsSync(CHECKSUM_FILE)) {
    try {
      targetChecksum = fs.readFileSync(CHECKSUM_FILE, 'utf8').trim();
    } catch (err) {
      // If checksum file is corrupt, regenerate
      targetChecksum = '';
    }
  }

  // Check if sync is needed
  if (sourceChecksum === targetChecksum && sourceChecksum !== '') {
    console.log('Data already in sync, skipping copy.');
    process.exit(0);
  }

  // Sync files
  const files = fs.readdirSync(SOURCE).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.warn('Warning: No JSON files found in data/processed');
    process.exit(0);
  }

  files.forEach(file => {
    fs.copyFileSync(
      path.join(SOURCE, file),
      path.join(TARGET, file)
    );
  });

  // Update checksum
  fs.writeFileSync(CHECKSUM_FILE, sourceChecksum);

  console.log(`Synced ${files.length} JSON files from data/processed to web/public/data`);
}

// Run sync
syncData();
