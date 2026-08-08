const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(
  path.join(projectRoot, relativePath),
  "utf8"
);

const contract = read("docs/PERMANENT-REGRESSION-CONTRACT.md");
const rules = read("docs/SORTING-RULES.md");
const readme = read("README.md");
for (let index = 1; index <= 54; index += 1) {
  const id = "R" + String(index).padStart(2, "0");
  assert.match(contract, new RegExp("\\| " + id + " \\|"), id + " must remain in the permanent contract");
}

for (const requiredMeaning of [
  "手动拖动是最高优先级",
  "连续拖动 20 次",
  "与拍摄时间是否存在无关",
  "零排序、零刷新、零重命名",
  "不要求用户打开“媒体智能整理”标签窗口",
  "当前层加全部后代",
  "不扫描整库",
  "主窗口只提交带 collection ID 的后台安全批任务",
  "编号路径禁止使用 `item.save()`",
    "快速连续拖动 20 次",
    "内部临时名绝不出现在真实界面",
    "拖动后的最终编号必须立即显示",
    "文件夹切换、分页、刷新、启动和列表补全",
    "中断恢复必须按精确 item ID",
    "手动拖动改为 collection 默认能力",
    "网格外拖放完全归 Eagle",
    "Eagle 原生缩略图和预览优先",
    "同组序号真正变化的最小连续区间",
    "当前智能 collection 身份必须覆盖残留",
    "同网格 `dragend` 补交",
    "唯一顺序协调器",
    "拍摄时间升序和降序",
    "被动 pointer 会话",
    "`SmartDragTargetResolver`",
    "不捕获指针、不模拟鼠标、不增加覆盖层",
    "“命令生成”与“命令应用”必须分开确认",
    "重入当前智能 collection",
    "共用唯一 `drag-feedback-controller`",
    "500ms 轮询只保证入口存在",
    "禁止改写 Eagle `allData/filtereds`",
    "smart 禁止遍历/显示全部 helper",
    "当前 Eagle left/right helper",
    "SmartCollectionHostSnapshot",
    "sourceIdentity",
    "queryEpoch",
    "临时全库",
    "BOOTING → WAITING_LIBRARY → READY_TO_INJECT → ACTIVE / STOPPED",
    "Library loaded",
    "零 executeInMain",
    "新故障登记规则"
]) {
  assert.ok(contract.includes(requiredMeaning), "contract must retain: " + requiredMeaning);
}

for (const requiredRule of [
  "唯一用户结果",
  "作用层级",
  "顺序优先级",
  "手动拖动规则",
  "自动编号规则",
  "排序锁定规则",
  "事件权限表",
  "真实 Eagle 验收层级",
  "手动拖动没有开关",
  "不得存在第二条业务链",
  "规则层级总览",
  "对象与范围矩阵",
  "“应用到全部”的逐项语义",
  "唯一顺序公式",
  "父层直属子文件夹编号",
  "手动顺序生命周期",
  "Eagle 原生功能不可侵犯"
]) {
  assert.ok(rules.includes(requiredRule), "sorting rules must retain: " + requiredRule);
}

assert.ok(
  readme.includes("docs/SORTING-RULES.md"),
  "README must point to the sole sorting specification"
);
assert.doesNotMatch(
  readme,
  /关闭[^\n]*手动拖动[^\n]*立即回到纯比较器结果/,
  "README must not revive the bug where disabling drag clears manual order"
);
assert.doesNotMatch(
  readme,
  /删除或导入新的[\s\S]{0,80}都会再次补齐编号/,
  "README must not grant rename permission to membership changes"
);

const evidence = {
  "test/sort-core.test.js": ["Twenty consecutive drops"],
  "test/order-coordinator-core.test.js": [
    "authority",
    "manualAvailable"
  ],
  "test/rename-core.test.js": [
    "twenty-drop session",
    "buildExecutionPhases",
    "limitPlanToOrdinalChanges"
  ],
  "test/monitor-core.test.js": ["protection toggles must not request"],
  "test/startup-readiness-gate-core.test.js": [
    "waiting must have zero injection/I/O",
    "same ready generation injects exactly once",
    "must not create a retry storm",
    "evidence-driven, not fixed-delay"
  ],
  "test/plugin-source.test.js": [
    "previousApi\\.integrationResult",
    "const dropHandler",
    "assert.doesNotMatch(source, /observeMembershipChange/)",
    "queueCurrentRenamePlan",
    "runDragIntegrationTest",
    "runDragEndScenario",
    "dispatchNativeRename",
    "pendingAfterRun",
    "restore-interrupted-batch"
  ],
  "test/folder-tree-batch-core.test.js": ["applyToFolderTree"],
  "test/folder-level-core.test.js": ["direct-folders", "smartWithStaleFolder"],
  "test/collection-core.test.js": [
    "24185",
    "empty smart result must never fall through",
    "R52: all-view first frame",
    "R52: unknown view must fail open"
  ],
  "test/smart-collection-host-snapshot-core.test.js": [
    "24319",
    "eagle-allData",
    "legal smart query",
    "transient empty"
  ],
  "test/rename-batch-core.test.js": ["conflictIds", "allowedChangeIds"],
  "test/team-state-sync-core.test.js": ["legacy current-view keys"],
  "test/host-input-adapter.test.js": [
    "nativeDropCommitted",
    "nativeDragStart",
    "native-drag-pending",
    "pointer-cancel",
    "collectionKind: \"normal\""
  ],
  "test/smart-drag-target-resolver.test.js": [
    "composedPath",
    "elementsFromPoint",
    "selected-target"
  ],
  "test/drag-feedback-controller.test.js": [
    "target-unknown",
    "helper-missing",
    "eagle-photo-drop-before",
    "smart feedback must expose exactly one current helper",
    "eagle-photo-smart-active-helper",
    "pointercancel",
    "window-blur"
  ],
  "test/manual-move-application-core.test.js": [
    "VISIBLE_VERIFY_OK",
    "VISIBLE_VERIFY_FAIL",
    "correct and submitted once",
    "disk unavailable"
  ]
};

for (const [file, markers] of Object.entries(evidence)) {
  const source = read(file);
  for (const marker of markers) {
    assert.ok(source.includes(marker), file + " must retain regression evidence: " + marker);
  }
}

const packageJson = JSON.parse(read("package.json"));
assert.ok(
  packageJson.scripts.test.includes("test/permanent-regression-contract.test.js"),
  "npm test must execute the permanent regression contract gate"
);

console.log("permanent regression contract tests passed");
