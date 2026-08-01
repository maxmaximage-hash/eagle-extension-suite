const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { renderWatermarked } = require('../modules/watermark-editor/renderer.js');
const { loadState, saveState } = require('./config.js');

function hash(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 10);
}

function safeName(value) {
  return String(value || 'image').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

function uniqueOutputPath(outputPath) {
  if (!fs.existsSync(outputPath)) return outputPath;
  const extension = path.extname(outputPath);
  const stem = outputPath.slice(0, -extension.length);
  let index = 2;
  let candidate = `${stem}-${index}${extension}`;
  while (fs.existsSync(candidate)) {
    index += 1;
    candidate = `${stem}-${index}${extension}`;
  }
  return candidate;
}

function originalFileForInfoDirectory(directory, item) {
  if (!directory || !fs.existsSync(directory)) return '';
  const files = fs.readdirSync(directory);
  const ext = String(item.ext || '').toLowerCase();
  const exact = files.find((file) => file === item.name + '.' + item.ext);
  const fallback = files.find((file) => {
    if (file === 'metadata.json' || file.endsWith('_thumbnail.png')) return false;
    return ext ? file.toLowerCase().endsWith('.' + ext) : true;
  });
  return exact || fallback || '';
}

function resolveItemFilePath(item, config) {
  if (item.filePath && fs.existsSync(item.filePath)) return item.filePath;
  const libraryRoot = config.cloudflare && config.cloudflare.eagleLibraryRoot;
  if (!libraryRoot) return '';
  const directory = path.join(libraryRoot, 'images', item.id + '.info');
  const file = originalFileForInfoDirectory(directory, item);
  return file ? path.join(directory, file) : '';
}

function ensureCleanDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}

function nodeCommand() {
  const candidates = [
    process.env.MAX_PUBLISHER_NODE,
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    'node'
  ].filter(Boolean);
  return candidates.find((candidate) => candidate === 'node' || fs.existsSync(candidate)) || 'node';
}

function resolveWrangler(config) {
  if (config.cloudflare.wranglerCommand) return { command: config.cloudflare.wranglerCommand, argsPrefix: [] };
  const local = path.join(config.cloudflare.pagesRoot || '', '..', 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
  if (fs.existsSync(local)) return { command: nodeCommand(), argsPrefix: [local] };
  return { command: 'npx', argsPrefix: ['wrangler'] };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const pathParts = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      process.env.PATH || ''
    ].filter(Boolean);
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: process.platform === 'win32',
      env: { ...process.env, PATH: pathParts.join(path.delimiter), FORCE_COLOR: '0' }
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(output.trim() || command + ' exited with ' + code));
    });
  });
}

async function deployPages(config) {
  const pagesRoot = config.cloudflare.pagesRoot;
  const projectName = config.cloudflare.projectName;
  if (!pagesRoot || !fs.existsSync(pagesRoot)) throw new Error('请先设置 Cloudflare Pages 项目目录');
  if (!projectName) throw new Error('请先设置 Cloudflare Pages 项目名');
  const { command, argsPrefix } = resolveWrangler(config);
  const args = [...argsPrefix, 'pages', 'deploy', 'public', '--project-name', projectName, '--commit-dirty=true'];
  return run(command, args, { cwd: pagesRoot });
}

class Publisher {
  constructor({ eagleApi, getConfig, onStatus }) {
    this.eagle = eagleApi;
    this.getConfig = getConfig;
    this.onStatus = onStatus || (() => {});
    this.running = false;
  }

  status(stage, detail = {}) {
    this.onStatus({ stage, at: Date.now(), ...detail });
  }

  async taggedItems(tag) {
    return this.eagle.item.get({ tags: [tag] });
  }

  async exportSelected(destination, options, onProgress) {
    const items = Array.isArray(options.items) && options.items.length
      ? options.items
      : await this.eagle.item.getSelected();
    return this.exportItems(destination, items, options, renderWatermarked, onProgress);
  }

  async exportItems(destination, items, options, renderItem, onProgress) {
    if (!items.length) throw new Error('请先在 Eagle 中选择需要导出的图片');
    if (typeof renderItem !== 'function') throw new Error('缺少导出渲染器');
    fs.mkdirSync(destination, { recursive: true });
    const results = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const inputPath = resolveItemFilePath(item, { cloudflare: { eagleLibraryRoot: options.eagleLibraryRoot } });
      if (!inputPath) {
        results.push({ id: item.id, ok: false, error: '原图文件不存在' });
      } else {
        const format = options.format === 'png' ? 'png' : options.format === 'webp' ? 'webp' : 'jpg';
        const filename = `${safeName(item.name)}${options.suffix || '-watermarked'}.${format}`;
        const requestedOutputPath = path.join(destination, filename);
        const outputPath = options.collisionMode === 'overwrite'
          ? requestedOutputPath
          : uniqueOutputPath(requestedOutputPath);
        try {
          await renderItem(inputPath, outputPath, {
            maxWidth: options.maxWidth,
            quality: options.compressionMode === 'size' ? 100 : options.quality,
            maxFileSizeMb: options.compressionMode === 'size' ? options.maxFileSizeMb : '',
            maxOutputBytes: options.compressionMode === 'quality' ? fs.statSync(inputPath).size : 0,
            format,
            watermark: options.watermark,
            privacyLayer: options.privacyLayer,
            annotations: options.annotations
          });
          const limitBytes = options.compressionMode === 'size'
            ? Math.floor(Number(options.maxFileSizeMb || 0) * 1_000_000)
            : 0;
          if (limitBytes && fs.statSync(outputPath).size > limitBytes) {
            throw new Error(`导出结果超过 ${options.maxFileSizeMb} MB 上限`);
          }
          results.push({ id: item.id, ok: true, outputPath });
        } catch (error) {
          results.push({ id: item.id, ok: false, error: error.message });
        }
      }
      if (onProgress) await onProgress({ current: index + 1, total: items.length, item, results });
    }
    return results;
  }

  async sync({ force = false } = {}) {
    if (this.running) return { skipped: true, reason: 'running' };
    this.running = true;
    const config = this.getConfig();
    const state = loadState();
    const nextState = { ...state, items: { ...state.items } };
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'max-eagle-publisher-'));
    try {
      this.status('scanning');
      const items = await this.taggedItems(config.publishTag);
      const pagesRoot = config.cloudflare.pagesRoot;
      const publicRoot = path.join(pagesRoot, 'public');
      const imagesRoot = path.join(publicRoot, 'images');
      if (!pagesRoot || !fs.existsSync(publicRoot)) throw new Error('请先设置 Cloudflare Pages 项目目录');
      const watermarkHash = hash(config.online.watermark);
      const currentIds = new Set(items.map((item) => item.id));
      const manifestItems = [];
      let changed = force;

      if (force) ensureCleanDirectory(imagesRoot);
      else fs.mkdirSync(imagesRoot, { recursive: true });

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const inputPath = resolveItemFilePath(item, config);
        if (!inputPath) continue;
        const modifiedAt = Number(item.modifiedAt || item.modificationTime || item.mtime || 0);
        const signature = `${modifiedAt}:${watermarkHash}:${config.online.maxWidth}`;
        const previous = nextState.items[item.id];
        this.status('processing', { current: index + 1, total: items.length, name: item.name });

        if (!force && previous && previous.signature === signature && Array.isArray(previous.variants)) {
          manifestItems.push(previous.manifest);
          continue;
        }

        const variants = [];
        const widths = [...new Set([640, 1280, Number(config.online.maxWidth || 1920)])].sort((a, b) => a - b);
        for (const width of widths) {
          const filename = `${item.id}-${modifiedAt}-${watermarkHash}-${width}.jpg`;
          const localPath = path.join(imagesRoot, filename);
          const metadata = await renderWatermarked(inputPath, localPath, {
            maxWidth: width,
            quality: config.online.jpegQuality,
            format: 'jpg',
            watermark: config.online.watermark
          });
          const key = `images/${filename}`;
          variants.push({ key, width: metadata.width, height: metadata.height, url: `/${key}` });
        }
        const largest = variants[variants.length - 1];
        const manifest = {
          id: item.id,
          name: item.name,
          width: largest.width,
          height: largest.height,
          modifiedAt,
          src: largest.url,
          srcset: variants.map((variant) => `${variant.url} ${variant.width}w`).join(', ')
        };
        nextState.items[item.id] = { signature, variants, manifest };
        manifestItems.push(manifest);
        changed = true;
      }

      for (const [id, previous] of Object.entries(nextState.items)) {
        if (!currentIds.has(id)) {
          for (const variant of previous.variants || []) fs.rmSync(path.join(publicRoot, variant.key), { force: true });
          delete nextState.items[id];
          changed = true;
        }
      }

      manifestItems.sort((a, b) => b.modifiedAt - a.modifiedAt);
      const galleryPath = path.join(publicRoot, 'gallery.json');
      const previousGallery = fs.existsSync(galleryPath) ? fs.readFileSync(galleryPath, 'utf8') : '';
      let previousManifest = null;
      try {
        previousManifest = previousGallery ? JSON.parse(previousGallery) : null;
      } catch (error) {
        previousManifest = null;
      }
      const manifest = {
        version: 1,
        generatedAt: changed || !previousManifest || !previousManifest.generatedAt ? new Date().toISOString() : previousManifest.generatedAt,
        count: manifestItems.length,
        items: manifestItems
      };
      const nextGallery = JSON.stringify(manifest, null, 2);
      if (previousGallery !== nextGallery) {
        fs.writeFileSync(galleryPath, nextGallery);
        changed = true;
      }

      const alreadyDeployed = state.lastResult && state.lastResult.deployed === true;
      if (!changed && alreadyDeployed) {
        nextState.lastSyncAt = Date.now();
        nextState.lastError = null;
        nextState.lastResult = { published: manifestItems.length, processed: items.length, deployed: true, skippedDeploy: true };
        saveState(nextState);
        this.status('complete', nextState.lastResult);
        return nextState.lastResult;
      }

      this.status('deploying', { published: manifestItems.length });
      const deployOutput = await deployPages(config);

      nextState.lastSyncAt = Date.now();
      nextState.lastError = null;
      nextState.lastResult = { published: manifestItems.length, processed: items.length, deployed: true, deployOutput };
      saveState(nextState);
      this.status('complete', nextState.lastResult);
      return nextState.lastResult;
    } catch (error) {
      nextState.lastSyncAt = Date.now();
      nextState.lastError = error.message;
      saveState(nextState);
      this.status('error', { message: error.message });
      throw error;
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
      this.running = false;
    }
  }
}

module.exports = { Publisher, hash, safeName, uniqueOutputPath, resolveItemFilePath };
