"use strict";
const assert = require("node:assert/strict");
const workbench = require("../delivery.js");
const host = require("../../media-organizer/lib/delivery-template-core.js");
const sharedText = "我用夸克网盘给你分享了「verol」\n点击链接即可查看，保存后可下载原图\n/~SYNTHETIC001~:/\n链接：https://pan.quark.cn/s/a1b2c3d4e5f6";
const normalizationCases = [
  [sharedText, "https://pan.quark.cn/s/a1b2c3d4e5f6"],
  ["我用夸克网盘给你分享了「verol」… /~SYNTHETIC001~:/ 链接：https://pan.quark.cn/s/a1b2c3d4e5f6", "https://pan.quark.cn/s/a1b2c3d4e5f6"],
  ["[点击查看](https://pan.quark.cn/s/a1b2c3d4e5f6)", "https://pan.quark.cn/s/a1b2c3d4e5f6"],
  ["链接：【https://pan.quark.cn/s/a1b2c3d4e5f6】，请保存。", "https://pan.quark.cn/s/a1b2c3d4e5f6"],
  ["链接：pan.quark.cn/s/a1b2c3d4e5f6。", "https://pan.quark.cn/s/a1b2c3d4e5f6"],
  ["https://PAN.QUARK.CN/s/a1b2c3d4e5f6.", "https://pan.quark.cn/s/a1b2c3d4e5f6"],
  ["http://pan.quark.cn/s/a1b2c3d4e5f6", "https://pan.quark.cn/s/a1b2c3d4e5f6"],
  ["链接：https://pan.quark.cn/s/a1b2c3d4e5f6?pwd=1234，提取码 1234", "https://pan.quark.cn/s/a1b2c3d4e5f6?pwd=1234"],
  ["https://evilpan.quark.cn/s/a1b2c3d4e5f6", ""],
  ["https://pan.quark.cn.evil.example/s/a1b2c3d4e5f6", ""],
  ["https://pan.quark.cn@evil.example/s/a1b2c3d4e5f6", ""],
  ["https://evil.example/pan.quark.cn/s/a1b2c3d4e5f6", ""],
  ["ftp://pan.quark.cn/s/a1b2c3d4e5f6", ""],
  ["https://pan.quark.cn/other/a1b2c3d4e5f6", ""],
  ["https://example.com/share/a1b2c3d4e5f6", ""],
  ["我用夸克网盘给你分享了「verol」 /~SYNTHETIC001~:/", ""],
  ["", ""]
];

for (const core of [workbench, host]) {
  for (const [input, expected] of normalizationCases) {
    assert.equal(core.normalizeQuarkLink(input), expected, input);
    assert.equal(core.deliveryValues(core.DEFAULT_TEMPLATES[0], {}, "测试", input).quarkLink, expected);
  }
  const body = "  标准 {standardGroups}\n每组说明\n\n实际 {actualGroups}\n\n\n链接：{quarkLink}\n结束  \n";
  assert.equal(core.normalizeTemplate({body}).body, body);
  assert.equal(core.normalizeTemplate({body:""}).body, "");
  assert.equal(core.renderTemplate(body, {standardGroups:5, actualGroups:6, quarkLink:"https://pan.quark.cn/a"}),
    "  标准 5\n每组说明\n\n实际 6\n\n\n链接：https://pan.quark.cn/a\n结束  \n");
  const edited = "我自己改的第一行\r\n第二行\r\n\r\n链接：https://pan.quark.cn/s/a\r\n教程：https://example.com\r\n";
  assert.equal(core.updateQuarkLink(edited,"https://pan.quark.cn/s/a",sharedText), edited.replace("https://pan.quark.cn/s/a","https://pan.quark.cn/s/a1b2c3d4e5f6"));
  const annotated = "第一行\n链接：https://pan.quark.cn/s/a （提取码 abc）  \n结尾\n";
  assert.equal(core.updateQuarkLink(annotated,"https://pan.quark.cn/s/a","https://pan.quark.cn/s/b"), annotated.replace("pan.quark.cn/s/a","pan.quark.cn/s/b"));
  assert.equal(core.updateQuarkLink(annotated,"",sharedText), annotated.replace("https://pan.quark.cn/s/a","https://pan.quark.cn/s/a1b2c3d4e5f6"));
  const attachedNote = "第一行\n链接：pan.quark.cn/s/a，提取码 abc  \n结尾\n";
  assert.equal(core.updateQuarkLink(attachedNote,"",sharedText), attachedNote.replace("pan.quark.cn/s/a","https://pan.quark.cn/s/a1b2c3d4e5f6"));
  assert.equal(core.updateQuarkLink(edited,"https://pan.quark.cn/s/a","没有链接 /~SYNTHETIC001~:/"), edited);
  assert.equal(core.updateQuarkLink(edited,"https://pan.quark.cn/s/a","https://example.com"), edited);
  assert.equal(core.updateQuarkLink(annotated,"https://pan.quark.cn/s/a",""), annotated.replace("https://pan.quark.cn/s/a",""));
  assert.equal(core.updateQuarkLink("第一行\n链接：\n\n第三行", "", "https://pan.quark.cn/s/new"), "第一行\n链接：https://pan.quark.cn/s/new\n\n第三行");
  assert.equal(core.updateQuarkLink("自行删掉了链接行\n不添加别的行", "", "https://pan.quark.cn/s/new"), "自行删掉了链接行\n不添加别的行");
  assert.ok(core.DEFAULT_TEMPLATE_BODY.includes("氛围环境\n每组"));
  assert.ok(core.DEFAULT_TEMPLATE_BODY.includes("教程\nhttps://"));
}
assert.equal(workbench.DEFAULT_TEMPLATE_BODY,host.DEFAULT_TEMPLATE_BODY);
for (const [input] of normalizationCases) assert.equal(workbench.normalizeQuarkLink(input), host.normalizeQuarkLink(input));
console.log("delivery format preservation tests passed");
