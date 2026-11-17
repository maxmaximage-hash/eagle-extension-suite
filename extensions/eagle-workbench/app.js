"use strict";

(function initWorkbench() {
  const registry = window.EagleWorkbenchRegistry;
  const delivery = window.EagleWorkbenchDelivery;
  const groups = document.getElementById("moduleGroups");
  if (!registry || !groups) return;

  document.getElementById("workbenchVersion").textContent =
    registry.WORKBENCH_DISPLAY_VERSION || registry.WORKBENCH_VERSION;

  const message = document.getElementById("message");
  const deliveryOverlay = document.getElementById("deliveryOverlay");
  const DELIVERY_TEMPLATES_STORAGE_KEY = "eagle.workbench.delivery.templates.v2";
  const DELIVERY_ACTIVE_TEMPLATE_STORAGE_KEY = "eagle.workbench.delivery.active-template.v1";
  let signalEagleReady;
  const eagleReady = new Promise(resolve => {
    signalEagleReady = resolve;
    if (typeof window.eagle?.onPluginCreate === "function") {
      window.eagle.onPluginCreate(resolve);
    } else {
      // Browser previews and unit tests have no Eagle lifecycle to await.
      resolve();
    }
  });
  let deliveryReady = null;
  const deliveryState = {
    templates: loadDeliveryTemplates(),
    templateId: loadActiveDeliveryTemplateId(),
    stats: null,
    folderName: "",
    quarkLink: "",
    renderedLink: ""
  };

  function setMessage(text, tone = "") {
    if (!message) return;
    message.textContent = String(text || "");
    message.dataset.tone = tone;
  }

  function electronIpcRenderer() {
    const candidates = [
      () => window.require?.("electron")?.ipcRenderer,
      () => window.process?.getBuiltinModule?.("electron")?.ipcRenderer,
      () => window.process?.mainModule?.require?.("electron")?.ipcRenderer
    ];
    for (const candidate of candidates) {
      try {
        const ipc = candidate();
        if (ipc && typeof ipc.sendTo === "function") return ipc;
      } catch {}
    }
    return null;
  }

  async function writeEntryRequest(pluginId) {
    await eagleReady;
    const fs = window.require?.("fs");
    const path = window.require?.("path");
    const getPath = window.eagle?.app?.getPath;
    if (!fs?.promises || !path?.join || typeof getPath !== "function") return false;
    const userDataPath = await getPath("userData");
    const normalizedUserDataPath = String(userDataPath || "");
    const userDataRoot = path.basename(normalizedUserDataPath).toLowerCase() === "eagle"
      ? normalizedUserDataPath
      : path.join(normalizedUserDataPath, "Eagle");
    const root = path.join(userDataRoot, "PluginData", "com.max.eagle-photo-taken-sort");
    const requestPath = path.join(root, "workbench-entry-request.json");
    const temporaryPath = `${requestPath}.tmp-${Date.now()}`;
    const payload = JSON.stringify({
      version: 1,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      pluginId,
      requestedAt: new Date().toISOString()
    });
    await fs.promises.mkdir(root, { recursive: true });
    await fs.promises.writeFile(temporaryPath, payload, "utf8");
    await fs.promises.rename(temporaryPath, requestPath);
    return true;
  }

  async function openPlugin(pluginId, label) {
    await eagleReady;
    const requestedLabel = String(label || "功能面板").replace(/^打开\s*/, "");
    const ipc = electronIpcRenderer();
    const parentId = Number(window.parentID);
    if (ipc && Number.isInteger(parentId)) {
      ipc.sendTo(parentId, "open-plugin", pluginId);
      setMessage(`已请求打开${requestedLabel}。`);
      return true;
    }
    try {
      if (await writeEntryRequest(pluginId)) {
        setMessage(`已请求打开${requestedLabel}。`);
        return true;
      }
    } catch (error) {
      setMessage(`${label}打开请求失败：${error?.message || String(error)}`, "error");
      return false;
    }
    setMessage(`${label}暂时无法打开，请从 Eagle 的插件菜单打开对应面板。`, "error");
    return false;
  }

  function storage() {
    try { return window.localStorage; } catch { return null; }
  }

  const DELIVERY_SHARED_CONFIG_FILE = "delivery-templates.json";
  let deliverySharedWriteChain = Promise.resolve();

  function sharedDeliveryConfigPath(userDataPath, path) {
    const normalized = String(userDataPath || "");
    const userDataRoot = path.basename(normalized).toLowerCase() === "eagle"
      ? normalized
      : path.join(normalized, "Eagle");
    return path.join(
      userDataRoot,
      "PluginData",
      "com.max.eagle-photo-taken-sort",
      DELIVERY_SHARED_CONFIG_FILE
    );
  }

  async function resolveSharedDeliveryConfigPath() {
    await eagleReady;
    const path = window.require?.("path");
    const getPath = window.eagle?.app?.getPath;
    if (!path?.join || typeof getPath !== "function") return "";
    const userDataPath = await getPath("userData");
    return sharedDeliveryConfigPath(userDataPath, path);
  }

  function normalizeDeliveryConfig(input = {}) {
    const templates = delivery.cloneTemplates(input.templates);
    const requestedId = String(input.activeTemplateId || "");
    const activeTemplateId = templates.some((template) => template.id === requestedId)
      ? requestedId
      : templates[0]?.id || "";
    return { version: 1, templates, activeTemplateId };
  }

  async function readSharedDeliveryConfig() {
    const fs = window.require?.("fs");
    const path = await resolveSharedDeliveryConfigPath();
    if (!fs?.promises || !path) return null;
    try {
      return normalizeDeliveryConfig(JSON.parse(await fs.promises.readFile(path, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  function writeSharedDeliveryConfig() {
    const config = normalizeDeliveryConfig({
      templates: deliveryState.templates,
      activeTemplateId: deliveryState.templateId
    });
    deliverySharedWriteChain = deliverySharedWriteChain.then(async () => {
      const fs = window.require?.("fs");
      const path = await resolveSharedDeliveryConfigPath();
      if (!fs?.promises || !path) return false;
      try {
        await fs.promises.mkdir(path.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
        const temporaryPath = `${path}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await fs.promises.writeFile(temporaryPath, JSON.stringify(config, null, 2), "utf8");
        await fs.promises.rename(temporaryPath, path);
        return true;
      } catch (error) {
        setMessage(`共享交付模板保存失败：${error?.message || String(error)}`, "error");
        return false;
      }
    });
    return deliverySharedWriteChain;
  }

  async function hydrateSharedDeliveryConfig() {
    const config = await readSharedDeliveryConfig();
    if (!config) {
      // Publish the local/default state once so the native layout panel has a
      // single durable source even before the first explicit template save.
      await writeSharedDeliveryConfig();
      return;
    }
    deliveryState.templates = config.templates;
    deliveryState.templateId = config.activeTemplateId;
    persistDeliveryTemplates();
    persistActiveDeliveryTemplateId();
    renderDeliveryTemplateSelect();
    writeDeliveryTemplateForm(activeDeliveryTemplate());
    if (deliveryState.stats) updateDeliveryText();
  }

  function loadDeliveryTemplates() {
    const fallback = delivery.cloneTemplates(delivery.DEFAULT_TEMPLATES);
    const store = storage();
    if (!store) return fallback;
    try {
      const parsed = JSON.parse(store.getItem(DELIVERY_TEMPLATES_STORAGE_KEY) || "null");
      return parsed?.length ? delivery.cloneTemplates(parsed) : fallback;
    } catch {
      return fallback;
    }
  }

  function persistDeliveryTemplates() {
    const store = storage();
    if (store) {
      try {
        store.setItem(DELIVERY_TEMPLATES_STORAGE_KEY, JSON.stringify(deliveryState.templates));
      } catch {}
    }
    void writeSharedDeliveryConfig();
  }

  function loadActiveDeliveryTemplateId() {
    const store = storage();
    if (!store) return "";
    try {
      return String(store.getItem(DELIVERY_ACTIVE_TEMPLATE_STORAGE_KEY) || "");
    } catch {
      return "";
    }
  }

  function persistActiveDeliveryTemplateId() {
    const store = storage();
    if (store && deliveryState.templateId) {
      try {
        store.setItem(DELIVERY_ACTIVE_TEMPLATE_STORAGE_KEY, deliveryState.templateId);
      } catch {}
    }
    void writeSharedDeliveryConfig();
  }

  function deliveryElement(id) {
    return document.getElementById(id);
  }

  function activeDeliveryTemplate() {
    const found = deliveryState.templates.find((template) => template.id === deliveryState.templateId);
    if (found) return found;
    deliveryState.templateId = deliveryState.templates[0]?.id || "";
    persistActiveDeliveryTemplateId();
    return deliveryState.templates[0] || delivery.normalizeTemplate({});
  }

  function readDeliveryTemplateForm() {
    const current = activeDeliveryTemplate();
    return delivery.normalizeTemplate({
      ...current,
      name: deliveryElement("deliveryTemplateName")?.value,
      body: deliveryElement("deliveryTemplateBody")?.value,
      standardGroups: deliveryElement("deliveryStandardGroups")?.value,
      standardGroupsWithPeople: deliveryElement("deliveryStandardPeopleGroups")?.value,
      standardGroupsWithoutPeople: deliveryElement("deliveryStandardEnvironmentGroups")?.value,
      standardPeoplePerGroup: deliveryElement("deliveryPeoplePerGroup")?.value,
      standardEnvironmentPerGroup: deliveryElement("deliveryEnvironmentPerGroup")?.value,
      standardPublishGroups: deliveryElement("deliveryPublishGroups")?.value
    });
  }

  function writeDeliveryTemplateForm(template) {
    const normalized = delivery.normalizeTemplate(template);
    for (const [id, value] of [
      ["deliveryTemplateName", normalized.name],
      ["deliveryTemplateBody", normalized.body],
      ["deliveryStandardGroups", normalized.standardGroups],
      ["deliveryStandardPeopleGroups", normalized.standardGroupsWithPeople],
      ["deliveryStandardEnvironmentGroups", normalized.standardGroupsWithoutPeople],
      ["deliveryPeoplePerGroup", normalized.standardPeoplePerGroup],
      ["deliveryEnvironmentPerGroup", normalized.standardEnvironmentPerGroup],
      ["deliveryPublishGroups", normalized.standardPublishGroups]
    ]) {
      const element = deliveryElement(id);
      if (element) element.value = value;
    }
  }

  function saveActiveDeliveryTemplate() {
    const normalized = readDeliveryTemplateForm();
    const index = deliveryState.templates.findIndex((template) => template.id === deliveryState.templateId);
    if (index >= 0) deliveryState.templates[index] = normalized;
    else deliveryState.templates.push(normalized);
    deliveryState.templateId = normalized.id;
    persistDeliveryTemplates();
    persistActiveDeliveryTemplateId();
    renderDeliveryTemplateSelect();
    writeDeliveryTemplateForm(normalized);
    return normalized;
  }

  function renderDeliveryTemplateSelect() {
    const select = deliveryElement("deliveryTemplateSelect");
    if (!select) return;
    select.replaceChildren();
    for (const template of deliveryState.templates) {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      option.selected = template.id === deliveryState.templateId;
      select.appendChild(option);
    }
  }

  function renderDeliveryStats() {
    const target = deliveryElement("deliveryStats");
    if (!target) return;
    target.replaceChildren();
    const stats = deliveryState.stats;
    if (!stats) {
      target.textContent = "尚未扫描当前文件夹。";
      return;
    }
    const values = delivery.deliveryValues(activeDeliveryTemplate(), stats, deliveryState.folderName, deliveryState.quarkLink);
    const rows = [
      ["当前文件夹", deliveryState.folderName],
      ["实际组数", `${values.actualGroups} 组`],
      ["带人物组数", `${values.actualGroupsWithPeople} 组`],
      ["不带人物组数", `${values.actualGroupsWithoutPeople} 组`],
      ["人物图", `${values.actualPeopleCount} 张`],
      ["环境图", `${values.actualEnvironmentCount} 张`],
      ["合计", `${values.actualTotalCount} 张`],
      ["超额组数", `${values.extraGroups} 组`]
    ];
    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "delivery-stat-row";
      const name = document.createElement("span");
      name.textContent = label;
      const count = document.createElement("strong");
      count.textContent = value;
      row.append(name, count);
      target.appendChild(row);
    }
  }

  function updateDeliveryText() {
    const template = saveActiveDeliveryTemplate();
    const raw = String(deliveryElement("deliveryQuarkLink")?.value || "");
    const link = delivery.normalizeQuarkLink(raw) || (raw.trim() ? deliveryState.quarkLink : "");
    deliveryState.quarkLink = link;
    const values = delivery.deliveryValues(template, deliveryState.stats, deliveryState.folderName, link);
    const text = delivery.renderTemplate(template.body, values);
    const target = deliveryElement("deliveryText");
    if (target) target.value = text;
    deliveryState.renderedLink = link;
    renderDeliveryStats();
  }

  function updateDeliveryLink() {
    const input = deliveryElement("deliveryQuarkLink");
    const raw = String(input?.value || "");
    const link = delivery.normalizeQuarkLink(raw);
    if (raw.trim() && !link) return;
    if (input) input.value = link;
    const target = deliveryElement("deliveryText");
    if (target) target.value = delivery.updateQuarkLink(target.value, deliveryState.renderedLink, link);
    deliveryState.quarkLink = link;
    deliveryState.renderedLink = link;
  }

  function flattenFolders(input) {
    const result = [];
    const visited = new Set();
    function visit(folder, inheritedParent = "") {
      if (!folder?.id || visited.has(String(folder.id))) return;
      const rawParent = folder.parent;
      const parent = rawParent && typeof rawParent === "object"
        ? String(rawParent.id || inheritedParent || "")
        : String(rawParent || inheritedParent || "");
      const current = { ...folder, id: String(folder.id), parent };
      visited.add(String(current.id));
      result.push(current);
      for (const child of Array.isArray(folder.children) ? folder.children : []) {
        visit(child, current.id);
      }
    }
    for (const folder of Array.isArray(input) ? input : []) visit(folder);
    return result;
  }

  function folderDescendantIds(allFolders, rootId) {
    const childrenByParent = new Map();
    for (const folder of Array.isArray(allFolders) ? allFolders : []) {
      const parent = String(folder?.parent || "");
      const list = childrenByParent.get(parent) || [];
      list.push(String(folder.id));
      childrenByParent.set(parent, list);
    }
    const result = [];
    const visited = new Set();
    function visit(id) {
      const normalized = String(id || "");
      if (!normalized || visited.has(normalized)) return;
      visited.add(normalized);
      result.push(normalized);
      for (const childId of childrenByParent.get(normalized) || []) visit(childId);
    }
    visit(rootId);
    return result;
  }

  function itemIdentity(item) {
    return String(item?.id || item?.uuid || item?.filePath || item?.name || "");
  }

  async function readFolderItems(eagle, folderIds) {
    const entries = await Promise.all(folderIds.map(async (folderId) => {
      const items = await eagle.item.get({ folders: [folderId] });
      return Array.isArray(items) ? items : [];
    }));
    const result = [];
    const seen = new Set();
    for (const items of entries) {
      for (const item of items) {
        const identity = itemIdentity(item);
        if (identity && seen.has(identity)) continue;
        if (identity) seen.add(identity);
        result.push(item);
      }
    }
    return result;
  }

  async function scanDeliveryFolder() {
    const eagle = window.eagle;
    const summary = deliveryElement("deliverySummary");
    if (!eagle?.folder?.getSelected || !eagle.folder.getAll || !eagle.item?.get) {
      throw new Error("当前窗口没有可用的 Eagle 文件夹读取接口");
    }
    if (summary) summary.textContent = "正在扫描当前文件夹的直属子文件夹...";
    const selected = await eagle.folder.getSelected();
    const selectedFolders = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (selectedFolders.length !== 1 || !selectedFolders[0]?.id) {
      throw new Error("请在 Eagle 侧栏只选中一个普通总文件夹");
    }
    const allFolders = flattenFolders(await eagle.folder.getAll());
    const rootId = String(selectedFolders[0].id);
    const root = allFolders.find((folder) => String(folder.id) === rootId) || selectedFolders[0];
    const directFolders = allFolders.filter((folder) => String(folder.parent || "") === rootId);
    const groups = await Promise.all(directFolders.map(async (folder) => {
      // A delivery group may contain layout/asset subfolders. Eagle's item
      // query is scoped to one folder and does not reliably include those
      // descendants, so read the complete group subtree and de-duplicate by
      // the stable item id before counting 1-/2- prefixed media.
      const folderIds = folderDescendantIds(allFolders, folder.id);
      const items = await readFolderItems(eagle, folderIds);
      return { id: folder.id, name: folder.name, items };
    }));
    deliveryState.folderName = String(root.name || selectedFolders[0].name || "当前文件夹");
    deliveryState.stats = delivery.calculateDeliveryStats(groups);
    renderDeliveryStats();
    updateDeliveryText();
    if (summary) {
      summary.textContent = `${deliveryState.folderName} · ${groups.length} 组 · 人物图 ${deliveryState.stats.actualPeopleCount} 张 · 环境图 ${deliveryState.stats.actualEnvironmentCount} 张`;
    }
    return deliveryState.stats;
  }

  async function openDeliveryDialog() {
    if (!deliveryOverlay) return;
    await ensureDeliveryReady();
    if (!deliveryState.templateId) deliveryState.templateId = deliveryState.templates[0]?.id || "";
    renderDeliveryTemplateSelect();
    writeDeliveryTemplateForm(activeDeliveryTemplate());
    deliveryOverlay.hidden = false;
    setMessage("交付文案面板已打开。");
    try {
      await scanDeliveryFolder();
    } catch (error) {
      deliveryState.stats = null;
      renderDeliveryStats();
      const summary = deliveryElement("deliverySummary");
      if (summary) summary.textContent = error?.message || String(error);
      const status = deliveryElement("deliveryMessage");
      if (status) status.textContent = error?.message || String(error);
    }
  }

  function closeDeliveryDialog() {
    if (deliveryOverlay) deliveryOverlay.hidden = true;
  }

  async function copyDeliveryText() {
    const text = String(deliveryElement("deliveryText")?.value || "");
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = deliveryElement("deliveryText");
      textarea?.focus();
      textarea?.select();
      document.execCommand?.("copy");
    }
    const status = deliveryElement("deliveryMessage");
    if (status) status.textContent = "交付文案已复制，可以直接发送给客户。";
  }

  function bindDeliveryUi() {
    deliveryElement("deliveryClose")?.addEventListener("click", closeDeliveryDialog);
    deliveryOverlay?.addEventListener("click", (event) => {
      if (event.target === deliveryOverlay) closeDeliveryDialog();
    });
    deliveryElement("deliveryTemplateSelect")?.addEventListener("change", (event) => {
      deliveryState.templateId = event.target.value;
      persistActiveDeliveryTemplateId();
      writeDeliveryTemplateForm(activeDeliveryTemplate());
      if (deliveryState.stats) updateDeliveryText();
    });
    deliveryElement("deliveryNewTemplate")?.addEventListener("click", () => {
      const template = delivery.normalizeTemplate({
        id: `template-${Date.now().toString(36)}`,
        name: "新交付档位",
        body: delivery.DEFAULT_TEMPLATE_BODY
      });
      deliveryState.templates.push(template);
      deliveryState.templateId = template.id;
      persistDeliveryTemplates();
      persistActiveDeliveryTemplateId();
      renderDeliveryTemplateSelect();
      writeDeliveryTemplateForm(template);
      deliveryElement("deliveryTemplateName")?.focus();
    });
    deliveryElement("deliverySaveTemplate")?.addEventListener("click", () => {
      saveActiveDeliveryTemplate();
      if (deliveryState.stats) updateDeliveryText();
      const status = deliveryElement("deliveryMessage");
      if (status) status.textContent = "模板已保存。";
    });
    deliveryElement("deliveryDeleteTemplate")?.addEventListener("click", () => {
      if (deliveryState.templates.length <= 1) return;
      deliveryState.templates = deliveryState.templates.filter((template) => template.id !== deliveryState.templateId);
      deliveryState.templateId = deliveryState.templates[0].id;
      persistDeliveryTemplates();
      persistActiveDeliveryTemplateId();
      renderDeliveryTemplateSelect();
      writeDeliveryTemplateForm(activeDeliveryTemplate());
      if (deliveryState.stats) updateDeliveryText();
    });
    deliveryElement("deliveryScan")?.addEventListener("click", () => {
      void scanDeliveryFolder().catch((error) => {
        const status = deliveryElement("deliveryMessage");
        if (status) status.textContent = error?.message || String(error);
      });
    });
    deliveryElement("deliveryRefreshText")?.addEventListener("click", updateDeliveryText);
    deliveryElement("deliveryUpdateLink")?.addEventListener("click", updateDeliveryLink);
    deliveryElement("deliveryCopy")?.addEventListener("click", () => void copyDeliveryText());
    deliveryElement("deliveryQuarkLink")?.addEventListener("input", updateDeliveryLink);
    deliveryElement("deliveryQuarkLink")?.addEventListener("paste", (event) => {
      const link = delivery.normalizeQuarkLink(event.clipboardData?.getData("text/plain") || "");
      if (!link) return;
      event.preventDefault();
      deliveryElement("deliveryQuarkLink").value = link;
      updateDeliveryLink();
    });
  }

  function renderModule(module) {
    const article = document.createElement("article");
    article.className = "card";
    article.innerHTML = `<div class="card-head"><h3></h3><span class="badge"></span></div><div class="version-line"><strong></strong><span>产品版本</span></div><section class="capability"><h4>基本功能</h4><p class="meta"></p></section><section class="changelog"><h4>版本日志</h4><ul></ul></section>`;
    article.querySelector("h3").textContent = module.name;
    const badge = article.querySelector(".badge");
    badge.textContent = module.typeLabel || "扩展模块";
    badge.classList.add(module.typeLabel === "试验功能" ? "warning" : "neutral");
    article.querySelector(".version-line strong").textContent = module.displayVersion || module.version;
    article.querySelector(".meta").textContent = `${module.packageName} · ${module.description}`;
    const changelog = article.querySelector(".changelog ul");
    for (const item of module.changelog || []) {
      const li = document.createElement("li");
      li.textContent = item;
      changelog.appendChild(li);
    }
    if (module.entry?.pluginId || module.entry?.action) {
      const actions = document.createElement("div");
      actions.className = "card-actions";
      const open = document.createElement("button");
      open.type = "button";
      open.className = module.entry.action === "delivery"
        ? "open-module open-delivery"
        : "open-module";
      open.dataset.pluginId = module.entry.pluginId || "";
      open.dataset.entryAction = module.entry.action || "";
      open.dataset.pluginLabel = module.entry.label || module.packageName;
      open.textContent = module.entry.label || "打开功能面板";
      actions.appendChild(open);
      article.appendChild(actions);
    }
    return article;
  }

  const byCategory = new Map();
  for (const module of registry.MODULES) {
    if (!byCategory.has(module.category)) byCategory.set(module.category, []);
    byCategory.get(module.category).push(module);
  }
  for (const [category, modules] of byCategory) {
    const section = document.createElement("section");
    section.className = "group";
    section.innerHTML = `<h2></h2><div class="cards"></div>`;
    section.querySelector("h2").textContent = category;
    const cards = section.querySelector(".cards");
    modules.forEach((module) => cards.appendChild(renderModule(module)));
    groups.appendChild(section);
  }

  groups.addEventListener("click", (event) => {
    const button = event.target.closest("button.open-module");
    if (!button) return;
    if (button.dataset.entryAction === "delivery") {
      void openDeliveryDialog().catch(error => setMessage(`交付模板读取失败：${error?.message || String(error)}`, "error"));
      return;
    }
    void openPlugin(button.dataset.pluginId, button.dataset.pluginLabel || "功能面板");
  });
  bindDeliveryUi();
  function ensureDeliveryReady() {
    if (!deliveryReady) {
      deliveryReady = eagleReady.then(hydrateSharedDeliveryConfig).catch(error => {
        deliveryReady = null;
        throw error;
      });
    }
    return deliveryReady;
  }
  let entryPathPromise;
  function deliveryEntryPath() {
    if (!entryPathPromise) entryPathPromise = resolveSharedDeliveryConfigPath().then(configPath =>
      configPath ? configPath.replace(/delivery-templates\.json$/, "delivery-workbench-request.json") : ""
    ).catch(error => {
      entryPathPromise = null;
      throw error;
    });
    return entryPathPromise;
  }
  const consumeDeliveryEntry = window.EagleWorkbenchDeliveryEntry.createDeliveryEntryConsumer({
    read: async () => {
      await ensureDeliveryReady();
      const fs = window.require?.("fs");
      const path = await deliveryEntryPath();
      if (!fs?.promises || !path) return null;
      try { return JSON.parse(await fs.promises.readFile(path, "utf8")); }
      catch (error) { if (error.code === "ENOENT") return null; throw error; }
    },
    remove: async (id) => {
      const fs = window.require?.("fs");
      const path = await deliveryEntryPath();
      try {
        const current = JSON.parse(await fs.promises.readFile(path, "utf8"));
        if (current.id === id) await fs.promises.unlink(path);
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    },
    open: async (request) => {
      await hydrateSharedDeliveryConfig();
      if (deliveryState.templates.some(template => template.id === request.templateId)) {
        deliveryState.templateId = request.templateId;
        persistActiveDeliveryTemplateId();
      }
      await window.eagle?.window?.show?.();
      await openDeliveryDialog();
    }
  });
  const checkDeliveryEntry = () => void consumeDeliveryEntry().catch(error =>
    setMessage(`模板管理打开失败：${error?.message || String(error)}`, "error")
  );
  const deliveryEntryTimer = setInterval(checkDeliveryEntry, 500);
  window.addEventListener("beforeunload", () => clearInterval(deliveryEntryTimer));
  window.eagle?.onPluginRun?.(() => {
    signalEagleReady();
    checkDeliveryEntry();
  });
  checkDeliveryEntry();
})();
