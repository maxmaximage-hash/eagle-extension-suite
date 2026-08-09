(function attachQuickExport(global) {
  'use strict';

  const VERSION = '1.0.1';

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function nextPaint() {
    return new Promise((resolve) => {
      if (typeof global.requestAnimationFrame === 'function') {
        global.requestAnimationFrame(() => resolve());
      } else {
        global.setTimeout(resolve, 0);
      }
    });
  }

  function template(title) {
    return `
      <div class="export-actions export-actions-bottom gravity-quick-export">
        <h2>${title || '快速导出'}</h2>
        <label class="full">导出文件夹<div class="inline"><input data-export-directory readonly placeholder="选择导出到哪里"/><button type="button" data-export-choose>选择</button></div></label>
        <div class="export-mode-field full"><span>导出方式</span><div class="segmented export-mode-switch" role="group" aria-label="导出方式"><button type="button" data-export-mode="quality">按质量</button><button type="button" data-export-mode="size">按文件大小</button></div></div>
        <label class="range-field full export-quality-field" data-export-quality-field><span>图片质量</span><div class="range-row export-quality-row"><input data-export-quality type="range" min="40" max="100" step="1"/><span class="export-quality-value"><input class="range-number" data-export-quality-number type="number" min="40" max="100" step="1"/><span class="export-quality-unit">%</span></span></div></label>
        <label class="full export-size-field" data-export-size-field>目标文件大小（MB）<input data-export-size type="number" min="0.1" step="0.1" placeholder="例如 3"/></label>
        <div class="export-collision-field full"><span>同名文件</span><div class="segmented export-collision-switch" role="group" aria-label="同名文件处理方式"><button type="button" data-collision-mode="rename">生成新文件名</button><button type="button" data-collision-mode="overwrite">覆盖同名文件</button></div></div>
        <button class="primary" data-export-start>导出当前预览照片</button>
        <div class="progress hidden" data-export-progress>
          <div><span data-export-progress-text>准备导出</span><span data-export-progress-count>0/0</span><button type="button" data-export-close aria-label="关闭本轮导出任务" title="关闭本轮导出任务">×</button></div>
          <progress data-export-progress-bar value="0"></progress>
        </div>
      </div>`;
  }

  function mount(containerId, options = {}) {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) throw new Error('找不到快速导出容器');
    const state = options.state || {};
    let runVersion = 0;
    let itemCount = 0;
    container.innerHTML = template(options.title);

    const find = (selector) => container.querySelector(selector);
    const all = (selector) => [...container.querySelectorAll(selector)];
    const directory = find('[data-export-directory]');
    const quality = find('[data-export-quality]');
    const qualityNumber = find('[data-export-quality-number]');
    const size = find('[data-export-size]');
    const qualityField = find('[data-export-quality-field]');
    const sizeField = find('[data-export-size-field]');
    const start = find('[data-export-start]');
    const progress = find('[data-export-progress]');
    const progressText = find('[data-export-progress-text]');
    const progressCount = find('[data-export-progress-count]');
    const progressBar = find('[data-export-progress-bar]');

    const persist = () => options.onStateChange?.(state);

    function updateRangeProgress(input) {
      if (!input) return;
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const value = Number(input.value || 0);
      input.style.setProperty('--range-progress', `${((value - min) / Math.max(1, max - min)) * 100}%`);
    }

    function sync() {
      state.compressionMode = state.compressionMode === 'size' ? 'size' : 'quality';
      state.collisionMode = state.collisionMode === 'overwrite' ? 'overwrite' : 'rename';
      state.quality = Math.round(clamp(state.quality, 40, 100, 100));
      directory.value = state.directory || '';
      quality.value = state.quality;
      qualityNumber.value = state.quality;
      size.value = state.maxFileSizeMb || '';
      const qualityActive = state.compressionMode === 'quality';
      qualityField.hidden = !qualityActive;
      qualityField.setAttribute('aria-hidden', qualityActive ? 'false' : 'true');
      qualityField.style.setProperty('display', qualityActive ? '' : 'none', qualityActive ? '' : 'important');
      quality.disabled = !qualityActive;
      qualityNumber.disabled = !qualityActive;
      sizeField.hidden = qualityActive;
      sizeField.setAttribute('aria-hidden', qualityActive ? 'true' : 'false');
      sizeField.style.setProperty('display', qualityActive ? 'none' : '', qualityActive ? 'important' : '');
      size.disabled = qualityActive;
      all('[data-export-mode]').forEach((button) => {
        const active = button.dataset.exportMode === state.compressionMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      all('[data-collision-mode]').forEach((button) => {
        const active = button.dataset.collisionMode === state.collisionMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      updateRangeProgress(quality);
      start.textContent = options.buttonLabel
        ? options.buttonLabel(itemCount)
        : itemCount
          ? `导出当前预览 ${itemCount} 张照片`
          : '导出当前预览照片';
    }

    function reset() {
      runVersion += 1;
      progress.hidden = true;
      progress.classList.add('hidden');
      progress.style.setProperty('display', 'none', 'important');
      progressText.textContent = '准备导出';
      progressCount.textContent = '0/0';
      progressBar.value = 0;
      progressBar.removeAttribute('max');
      start.disabled = false;
      options.onReset?.();
    }

    async function run() {
      if (state.compressionMode === 'size' && !(Number(state.maxFileSizeMb) > 0)) {
        options.notify?.('请先输入目标文件大小', 'error');
        return;
      }
      if (!state.directory) {
        const selected = await options.chooseDirectory?.();
        if (selected) state.directory = selected;
        sync();
      }
      if (!state.directory) {
        options.notify?.('请先选择导出目录', 'error');
        return;
      }
      const currentRun = ++runVersion;
      progress.hidden = false;
      progress.classList.remove('hidden');
      progress.style.removeProperty('display');
      start.disabled = true;
      try {
        const results = await options.exportItems?.({
          state,
          async onProgress({ current, total, item }) {
            if (currentRun !== runVersion) return;
            progressText.textContent = `正在处理：${item.name}`;
            progressCount.textContent = `${current}/${total}`;
            progressBar.max = total;
            progressBar.value = current;
            await nextPaint();
          }
        });
        if (currentRun !== runVersion) return;
        const list = Array.isArray(results) ? results : [];
        const failed = list.filter((result) => !result.ok);
        progressText.textContent = failed.length ? `完成，${failed.length} 张失败` : '全部导出完成';
        options.onResult?.(list, failed.length);
        if (!list.some((result) => result.ok)) {
          options.notify?.(failed.length ? `导出失败，共 ${failed.length} 张` : '没有生成导出文件', 'error');
        }
      } catch (error) {
        if (currentRun !== runVersion) return;
        progressText.textContent = error.message;
        options.notify?.(error.message, 'error');
      } finally {
        if (currentRun === runVersion) start.disabled = false;
      }
    }

    find('[data-export-choose]').addEventListener('click', async () => {
      const selected = await options.chooseDirectory?.();
      if (selected) {
        state.directory = selected;
        sync();
        persist();
      }
    });
    start.addEventListener('click', run);
    find('[data-export-close]').addEventListener('click', reset);
    quality.addEventListener('input', () => {
      state.quality = Math.round(clamp(quality.value, 40, 100, 100));
      qualityNumber.value = state.quality;
      updateRangeProgress(quality);
      persist();
    });
    qualityNumber.addEventListener('input', () => {
      if (qualityNumber.value === '') return;
      state.quality = Math.round(clamp(qualityNumber.value, 40, 100, 100));
      qualityNumber.value = state.quality;
      quality.value = state.quality;
      updateRangeProgress(quality);
      persist();
    });
    qualityNumber.addEventListener('change', () => {
      if (qualityNumber.value === '') qualityNumber.value = state.quality;
    });
    size.addEventListener('change', () => {
      const raw = String(size.value || '').trim();
      state.maxFileSizeMb = raw ? Math.max(0, Number(raw)) : '';
      persist();
    });
    all('[data-export-mode]').forEach((button) => button.addEventListener('click', () => {
      state.compressionMode = button.dataset.exportMode === 'size' ? 'size' : 'quality';
      sync();
      persist();
    }));
    all('[data-collision-mode]').forEach((button) => button.addEventListener('click', () => {
      state.collisionMode = button.dataset.collisionMode === 'overwrite' ? 'overwrite' : 'rename';
      sync();
      persist();
    }));

    sync();
    reset();
    return Object.freeze({
      version: VERSION,
      setItemCount(count) {
        itemCount = Math.max(0, Number(count) || 0);
        sync();
      },
      setDirectory(nextDirectory) {
        state.directory = nextDirectory || '';
        sync();
      },
      sync,
      reset,
      run
    });
  }

  global.GravityQuickExport = Object.freeze({ version: VERSION, mount });
})(globalThis);
