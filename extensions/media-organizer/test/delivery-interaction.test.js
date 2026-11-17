"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const pluginPath = path.join(__dirname, "..", "plugin.js");
const source = fs.readFileSync(pluginPath, "utf8");
const sandbox = {
  Buffer, URL, clearInterval, clearTimeout, console, process, require, setInterval, setTimeout,
  eagle: { library: {}, onLibraryChanged() {}, onPluginCreate() {}, onPluginRun() {} },
  window: { location: { pathname: path.join(__dirname, "..", "index.html") } }
};
vm.runInNewContext(`${source}\n;globalThis.buildInjection = injectionSource;`, sandbox);
const injected = sandbox.buildInjection();
function injectedFunction(name) {
  const start = injected.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = injected.indexOf("\n    }", start) + "\n    }".length;
  return injected.slice(start, end);
}
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.handlers = {}; this.dataset = {}; this.value = ""; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  focus() {}
  select() {}
  setSelectionRange() {}
}
let contextId = "library|normal:parent";
let renderCount = 0;
const alerts = [];
const nodes = [];
const ui = {
  api: { deliveryCopyRequest: { id: "request-1", contextId }, deliveryCopyStatus: "queued" },
  document: { createElement(tag) { const node = new Node(tag); nodes.push(node); return node; }, body: new Node("body") },
  deliveryTemplateRuntime: require("../lib/delivery-template-core"),
  closeRenamePreview() {},
  currentContextId() { return contextId; },
  renderSettings() { renderCount += 1; },
  bodyScope: { $evalAsync() {}, currentFolder: { id: "parent", name: "客户", children: [{ id: "child", name: "一组" }] } },
  folderLevelRuntime: { directChildren(folder) { return folder.children; } },
  currentCollection() { return { kind: "normal" }; },
  window: { localStorage: { getItem() { return ""; }, setItem() {} }, alert(message) { alerts.push(message); } },
  navigator: { clipboard: { async writeText() {} } }, setTimeout() {}, console
};
vm.createContext(ui);
vm.runInContext([
  "clearDeliveryCopyRequest", "showDeliveryCopyError", "requestDeliveryCopy", "requestDeliveryWorkbench", "clearDeliveryWorkbenchRequest", "openDeliveryCopyModal"
].map(injectedFunction).join("\n"), ui);
const payload = { requestId: "request-1", contextId, rootName: "客户", stats: { groupCount: 1, groupsWithPeople: 1, peopleCount: 2, environmentCount: 3 } };
assert.equal(ui.openDeliveryCopyModal(payload), true);
assert.equal(ui.api.deliveryCopyStatus, "idle");
assert.equal(ui.api.deliveryCopyRequest, null);
assert.ok(renderCount > 0, "successful dialog must reset the rendered entry state");
const manage = nodes.find(node => node.textContent === "工作台管理模板");
manage.handlers.click();
assert.equal(ui.api.deliveryWorkbenchRequest.templateId, "tier-3980", "host renderer without Node or parentID must dispatch workbench request");
const firstManageId = ui.api.deliveryWorkbenchRequest.id;
manage.handlers.click();
assert.equal(ui.api.deliveryWorkbenchRequest.id, firstManageId, "repeated manage clicks must not enqueue duplicates");
const output = nodes.find(node => node.tag === "textarea");
const link = nodes.find(node => node.tag === "input");
output.value = "用户编辑的第一行\n第二行\n\n最后一段\n链接：";
link.value = "https://pan.quark.cn/s/example";
link.handlers.input();
assert.equal(output.value, "用户编辑的第一行\n第二行\n\n最后一段\n链接：https://pan.quark.cn/s/example");
const shareText = "我用夸克网盘给你分享了「verol」，点击链接或复制整段内容，打开「夸克网盘APP」即可获取。\n/~SYNTHETIC001~:/\n链接：https://pan.quark.cn/s/a1b2c3d4e5f6";
let pastePrevented = false;
assert.equal(typeof link.handlers.paste, "function", "full multiline sharing messages must be handled before url inputs strip newlines");
link.handlers.paste({ clipboardData: { getData() { return shareText; } }, preventDefault() { pastePrevented = true; } });
assert.equal(pastePrevented, true);
assert.equal(link.value, "https://pan.quark.cn/s/a1b2c3d4e5f6");
assert.equal(output.value, "用户编辑的第一行\n第二行\n\n最后一段\n链接：https://pan.quark.cn/s/a1b2c3d4e5f6");
link.value = "https://pan.quark";
link.handlers.input();
assert.ok(output.value.endsWith("https://pan.quark.cn/s/a1b2c3d4e5f6"), "partial typing must not erase the previous valid link");
nodes.find(node => node.tag === "select").handlers.change();
assert.ok(output.value.includes("链接：https://pan.quark.cn/s/a1b2c3d4e5f6"), "template changes retain the last valid link while input is partial");
output.value = "用户编辑的第一行\n第二行\n\n最后一段\n链接：https://pan.quark.cn/s/a1b2c3d4e5f6";
link.value = "无效的分享文字";
nodes.find(node => node.textContent === "复制文案").handlers.click();
assert.equal(link.value, "https://pan.quark.cn/s/a1b2c3d4e5f6", "copying must retain the previously valid URL");
link.value = "";
link.handlers.input();
assert.ok(output.value.endsWith("链接："), "explicitly clearing the field clears only the link");
const newer = { id: "request-2", contextId };
ui.api.deliveryCopyRequest = newer;
ui.api.deliveryCopyStatus = "queued";
assert.equal(ui.openDeliveryCopyModal(payload), false, "late completion must not overwrite a newer dialog request");
assert.equal(ui.api.deliveryCopyRequest, newer);
const queuedId = ui.api.deliveryCopyRequest.id;
ui.requestDeliveryCopy();
assert.equal(ui.api.deliveryCopyRequest.id, queuedId, "repeat clicks share the in-flight request");
contextId = "library|normal:new-parent";
ui.bodyScope.currentFolder.id = "new-parent";
ui.requestDeliveryCopy();
assert.notEqual(ui.api.deliveryCopyRequest.id, queuedId, "switching folder allows a new explicit request");
const latestId = ui.api.deliveryCopyRequest.id;
ui.showDeliveryCopyError("读取失败", queuedId, "library|normal:parent");
assert.equal(ui.api.deliveryCopyRequest.id, latestId, "late failure cannot cancel a newer request");
ui.showDeliveryCopyError("读取失败", latestId, contextId);
assert.equal(ui.api.deliveryCopyRequest, null);
assert.equal(ui.api.deliveryCopyStatus, "error");
assert.ok(alerts.some(message => message.includes("读取失败")), "failure must be visible and retriable");
const layoutButtonRendering = injected.slice(injected.indexOf('const deliveryButton = panel.querySelector('), injected.indexOf('if (!renameSection) return;'));
assert.doesNotMatch(layoutButtonRendering, /暂停扫描|暂停当前扫描/);
assert.match(layoutButtonRendering, /deliveryButton\.textContent = "生成交付文案"/);
console.log("delivery interaction tests passed");

async function verifyWorkbenchLaunch() {
  const start = source.indexOf("async function handleDeliveryWorkbenchRequest(");
  assert.notEqual(start, -1, "workbench launch request must have a plugin-owned handler");
  const end = source.indexOf("\n}", start) + 2;
  const handler = source.slice(start, end);
  const actions = [];
  const hostPluginModule = {
    installedPluginMaps: { "com.max.eagle-workbench": { manifest: { id: "com.max.eagle-workbench" } } },
    isPluginDisabled() { return false; },
    openPluginById(id, options) { actions.push(["open", id, options]); }
  };
  const scope = {
    lastDeliveryWorkbenchRequestId: "",
    SHARED_DELIVERY_CONFIG_PATH: "/PluginData/com.max.eagle-photo-taken-sort/delivery-templates.json",
    readSharedDeliveryConfig() { return { templates: [{ id: "tier-3980" }] }; },
    writeSharedDeliveryConfig(config) { actions.push(["config", config]); },
    fs: { promises: {
      async mkdir() {},
      async writeFile(file, text) { actions.push(["write", file, JSON.parse(text)]); },
      async rename() { actions.push(["rename"]); }
    } },
    path,
    window: {}, // ordinary service plugins have no parentID in the current Eagle host
    require() { throw new Error("launch must not depend on plugin renderer IPC"); },
    async executeInMain(code) {
      if (code.includes("openPluginById")) {
        actions.push(["host-source", code]);
        return vm.runInNewContext(code, { pluginModule: hostPluginModule });
      }
      actions.push(["ack", code]);
    },
    console: { warn() {} }
  };
  vm.createContext(scope);
  vm.runInContext(handler, scope);
  await scope.handleDeliveryWorkbenchRequest({ id: "manage-1", templateId: "tier-3980" });
  const write = actions.find(entry => entry[0] === "write");
  assert.equal(write[2].action, "manage-delivery-templates");
  assert.equal(write[2].templateId, "tier-3980");
  const open = actions.find(entry => entry[0] === "open");
  assert.equal(open[1], "com.max.eagle-workbench");
  assert.equal(open[2].entry, "manage-delivery-templates");
  assert.ok(actions.some(entry => entry[0] === "host-source" && entry[1].includes("pluginModule.openPluginById")), "use Eagle's real host plugin manager through the existing bridge");
  assert.ok(actions.indexOf(write) < actions.indexOf(open), "the entry intent must exist before a cold workbench is opened");
  const length = actions.length;
  await scope.handleDeliveryWorkbenchRequest({ id: "manage-1", templateId: "tier-3980" });
  assert.equal(actions.length, length, "same launch request is delivered once");
  delete hostPluginModule.installedPluginMaps["com.max.eagle-workbench"];
  await scope.handleDeliveryWorkbenchRequest({ id: "manage-2", templateId: "tier-3980" });
  assert.ok(actions.at(-1)[1].includes("clearDeliveryWorkbenchRequest"));
  assert.ok(actions.at(-1)[1].includes("未安装"), "missing host plugin must report an error, not a silent no-op");
}
verifyWorkbenchLaunch().then(() => console.log("delivery workbench launch tests passed"));
