const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const developerHome = `/${['Users', 'max'].join('/')}`;
const pluginPackage = require('../eagle-plugin/package.json');
const pluginLock = require('../eagle-plugin/package-lock.json');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.wrangler', '.git'].includes(entry.name)) return [];
      return sourceFiles(filename);
    }
    if (/\.(?:eagleplugin|png|jpe?g|webp|gif|woff2?)$/i.test(entry.name)) return [];
    return [filename];
  });
}

test('稳定发行源码、测试和说明不含开发者绝对路径或内嵌发布密钥', () => {
  for (const filename of sourceFiles(root)) {
    const content = fs.readFileSync(filename, 'utf8');
    assert.equal(content.includes(developerHome), false, `${path.relative(root, filename)} 包含开发者绝对路径`);
    assert.doesNotMatch(content, /(?:api[_-]?key|access[_-]?token|wrangler[_-]?token)\s*[:=]\s*['"][^'"]+['"]/i, `${path.relative(root, filename)} 疑似包含内嵌密钥`);
  }
});

test('Eagle 生产依赖锁定到 sharp 0.35.3 安全修复版本', () => {
  assert.equal(pluginPackage.dependencies.sharp, '0.35.3');
  assert.equal(pluginLock.packages['node_modules/sharp'].version, '0.35.3');
});
