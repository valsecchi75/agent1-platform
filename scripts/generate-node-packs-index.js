/**
 * Scans custom_nodes/*/manifest.json and generates node-packs.json.
 * Called by PUSH_TO_GITHUB.bat before commit in the agent1-registry folder.
 *
 * Usage:
 *   node generate-node-packs-index.js
 *
 * Place this file in the root of agent1-registry/ alongside custom_nodes/.
 */
const fs = require('fs');
const path = require('path');

const CUSTOM_NODES_DIR = path.join(__dirname, 'custom_nodes');
const OUTPUT_FILE = path.join(__dirname, 'node-packs.json');

function main() {
  const packs = [];

  if (!fs.existsSync(CUSTOM_NODES_DIR)) {
    console.log('No custom_nodes/ directory found. Writing empty registry.');
    writeOutput(packs);
    return;
  }

  const dirs = fs.readdirSync(CUSTOM_NODES_DIR, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const manifestPath = path.join(CUSTOM_NODES_DIR, dir.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      // Skip core packs — they ship with the app
      if (manifest.isCore) continue;

      // Check for preview image
      const previewDir = path.join(CUSTOM_NODES_DIR, dir.name, 'preview');
      let previewPath = '';
      if (fs.existsSync(previewDir)) {
        const images = fs.readdirSync(previewDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
        if (images.length > 0) {
          previewPath = `custom_nodes/${dir.name}/preview/${images[0]}`;
        }
      }

      packs.push({
        id: manifest.id || dir.name,
        name: manifest.name || dir.name,
        description: manifest.description || '',
        author: manifest.author || 'Unknown',
        version: manifest.version || '0.0.0',
        category: manifest.category || 'misc',
        tags: manifest.tags || [],
        nodeCount: Array.isArray(manifest.nodes) ? manifest.nodes.length : 0,
        minAppVersion: manifest.minAppVersion || '0.9.0',
        manifestPath: `custom_nodes/${dir.name}/manifest.json`,
        previewPath: previewPath,
        createdAt: manifest.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        changelog: manifest.changelog || '',
      });
    } catch (err) {
      console.warn(`Skipping ${dir.name}: ${err.message}`);
    }
  }

  writeOutput(packs);
}

function writeOutput(packs) {
  const registry = {
    registryVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    baseUrl: 'https://raw.githubusercontent.com/valsecchi75/agent1-registry/main/',
    packs: packs,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`Generated node-packs.json with ${packs.length} pack(s).`);
}

main();
