const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(projectRoot, 'eagle-plugin', 'modules', 'font-manager', 'catalog.js');
const profilerPath = process.argv[2] || '/tmp/max-fonts-system.json';

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(catalogPath, 'utf8'), context);
const catalog = context.window.MAX_FONT_CATALOG || [];
const profiler = JSON.parse(fs.readFileSync(profilerPath, 'utf8'));
const byPostscript = new Map();
const byFamily = new Map();

for (const font of profiler.SPFontsDataType || []) {
  if (!font.path) continue;
  for (const face of font.typefaces || []) {
    if (face._name) byPostscript.set(face._name, font.path);
    if (face.family && !byFamily.has(face.family)) byFamily.set(face.family, font.path);
  }
}

let updated = 0;
for (const entry of catalog) {
  for (const face of entry.faces || []) {
    const nextPath = byPostscript.get(face.postscriptName) || byFamily.get(entry.family) || '';
    if (nextPath && face.fontPath !== nextPath) {
      face.fontPath = nextPath;
      updated += 1;
    }
  }
}

fs.writeFileSync(catalogPath, `window.MAX_FONT_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`);
console.log(`Updated ${updated} font faces in ${catalogPath}`);
