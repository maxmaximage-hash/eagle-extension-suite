const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { renderWatermarkLayer, renderWatermarkPreviewPayload, renderWatermarkVectorPreviewPayload } = require('../eagle-plugin/modules/watermark-editor/renderer.js');

const args = process.argv.slice(2);
const argument = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const host = argument('host', '127.0.0.1');
const port = Number(argument('port', '8799'));
const root = path.resolve(__dirname, '..', 'eagle-plugin');
const previewAssetsRoot = path.resolve(__dirname, '..', '.preview-assets');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ttc': 'font/collection',
  '.otc': 'font/collection',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};
const allowedFontRoots = [
  '/System/Library/Fonts',
  '/Library/Fonts',
  path.join(require('node:os').homedir(), 'Library', 'Fonts')
].map((value) => path.resolve(value));
const allowedFontExtensions = new Set(['.ttf', '.otf', '.ttc', '.otc', '.woff', '.woff2']);

function ensurePreviewImage() {
  fs.mkdirSync(previewAssetsRoot, { recursive: true });
  const filePath = path.join(previewAssetsRoot, 'privacy-sample.svg');
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800" viewBox="0 0 1200 1800">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#efe7dc"/>
          <stop offset="1" stop-color="#b9c9c1"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="1800" fill="url(#background)"/>
      <rect x="90" y="100" width="1020" height="1600" rx="42" fill="#fff" opacity=".88"/>
      <circle cx="245" cy="310" r="96" fill="#9f7b67"/>
      <text x="390" y="292" font-family="Arial" font-size="56" font-weight="700" fill="#27211e">学员聊天截图</text>
      <text x="390" y="362" font-family="Arial" font-size="35" fill="#756c66">头像、姓名与敏感信息测试区</text>
      <rect x="170" y="520" width="760" height="190" rx="34" fill="#dbeafe"/>
      <text x="215" y="605" font-family="Arial" font-size="39" fill="#1e3a5f">我的手机号是 138 0000 0000</text>
      <text x="215" y="665" font-family="Arial" font-size="31" fill="#52708d">这里可以框选矩形或椭圆进行打码</text>
      <rect x="270" y="790" width="760" height="190" rx="34" fill="#dcfce7"/>
      <text x="315" y="875" font-family="Arial" font-size="39" fill="#234b34">课程反馈和辅助说明文字</text>
      <text x="315" y="935" font-family="Arial" font-size="31" fill="#4d725d">打码不会修改 Eagle 原图</text>
      <rect x="170" y="1100" width="860" height="400" rx="38" fill="#f5f5f4"/>
      <text x="225" y="1200" font-family="Arial" font-size="34" fill="#57534e">长截图滚动与导出测试</text>
      <path d="M225 1270H970M225 1350H900M225 1430H940" stroke="#a8a29e" stroke-width="22" stroke-linecap="round"/>
    </svg>`);
  }
  return filePath;
}

const previewImagePath = ensurePreviewImage();

function readJsonBody(request, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Request body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  let pathname;
  let requestUrl;
  try {
    requestUrl = new URL(request.url, `http://${host}:${port}`);
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/api/font-file' && request.method === 'GET') {
    const fontPath = path.resolve(requestUrl.searchParams.get('path') || '');
    const allowedRoot = allowedFontRoots.some((rootPath) => fontPath.startsWith(`${rootPath}${path.sep}`));
    if (!allowedRoot || !allowedFontExtensions.has(path.extname(fontPath).toLowerCase())) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const stat = fs.statSync(fontPath);
      if (!stat.isFile()) throw new Error('Not a file');
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(fontPath).toLowerCase()] || 'font/otf',
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=3600'
      });
      fs.createReadStream(fontPath).pipe(response);
    } catch (error) {
      response.writeHead(404).end('Not found');
    }
    return;
  }

  if (pathname === '/api/preview-selection' && request.method === 'GET') {
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify([{
      id: 'preview-privacy-sample',
      name: '隐私打码测试图',
      ext: 'svg',
      filePath: previewImagePath,
      url: '/api/preview-image',
      width: 1200,
      height: 1800
    }]));
    return;
  }

  if (pathname === '/api/preview-image' && request.method === 'GET') {
    response.writeHead(200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(previewImagePath).pipe(response);
    return;
  }

  if (pathname === '/api/watermark-preview' && request.method === 'POST') {
    try {
      const payload = await readJsonBody(request);
      const width = Math.max(1, Math.min(16000, Math.round(Number(payload.width) || 1)));
      const height = Math.max(1, Math.min(32000, Math.round(Number(payload.height) || 1)));
      const png = await renderWatermarkLayer(payload.settings || {}, width, height);
      response.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': png.length,
        'Cache-Control': 'no-store'
      });
      response.end(png);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (pathname === '/api/watermark-preview-layout' && request.method === 'POST') {
    try {
      const payload = await readJsonBody(request);
      const width = Math.max(1, Math.min(16000, Math.round(Number(payload.width) || 1)));
      const height = Math.max(1, Math.min(32000, Math.round(Number(payload.height) || 1)));
      const result = await renderWatermarkPreviewPayload(payload.settings || {}, width, height);
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (pathname === '/api/watermark-preview-vector' && request.method === 'POST') {
    try {
      const payload = await readJsonBody(request);
      const width = Math.max(1, Math.min(16000, Math.round(Number(payload.width) || 1)));
      const height = Math.max(1, Math.min(32000, Math.round(Number(payload.height) || 1)));
      const result = await renderWatermarkVectorPreviewPayload(payload.settings || {}, width, height);
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(response);
  });
});

server.listen(port, host, () => {
  console.log(`Eagle plugin preview: http://${host}:${port}/`);
});
