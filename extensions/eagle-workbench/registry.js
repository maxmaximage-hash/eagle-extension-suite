"use strict";

// This registry is deliberately read-only. It is generated from the source
// manifests at release time and never contains mutable business state.
const WORKBENCH_VERSION = "1.1";
const WORKBENCH_DISPLAY_VERSION = "1.1";

const MODULES = Object.freeze([
  Object.freeze({
    id: "com.max.eagle-photo-taken-sort",
    manifestPath: "../media-organizer/manifest.json",
    displayVersion: "2.5",
    name: "排序与重命名",
    packageName: "媒体智能整理",
    version: "2.5.22-qa.94",
    category: "核心功能",
    typeLabel: "Eagle 扩展",
    description: "拍摄时间排序、多级排序、手动顺序、自动编号和安全改名。",
    changelog: [
      "修复智能文件夹连续拖动偶发失效，拖动后的顺序可以稳定保存。",
      "修复完整集合顺序与当前可见窗口顺序不同步导致的第二次拖动失败。",
      "连续拖动后保持当前资源库与 MAX 照片集数量不变。",
    ],
  }),
  Object.freeze({
    id: "com.max.eagle-online-showcase",
    manifestPath: "../online-publisher/eagle-plugin/manifest.json",
    displayVersion: "1.2",
    name: "水印、打码与发布",
    packageName: "MAX Publisher",
    version: "1.2.7",
    category: "核心功能",
    typeLabel: "Eagle 扩展",
    description: "本地水印、隐私模糊/马赛克、字体管理、导出和线上作品页发布。",
    changelog: [
      "1.2.7 升级 sharp 依赖，修复已知高危安全问题并通过依赖审计。",
      "修复字体路径在不同 Mac 上不可移植的问题，缺失字体会明确提示并降级。",
      "保持水印、隐私打码、导出与线上发布链路相互独立。",
    ],
  }),
  Object.freeze({
    id: "com.max.eagle-photo-taken-sort:metadata",
    manifestPath: "../media-organizer/manifest.json",
    displayVersion: "2.5",
    name: "地点与元数据标签",
    packageName: "媒体智能整理",
    version: "2.5.22-qa.94",
    category: "核心功能",
    typeLabel: "Eagle 扩展",
    description: "GPS/元数据读取、地点审核、人工纠正和文件夹地点标签。",
    changelog: [
      "2.5 版本将地点与元数据标签和排序业务隔离，互不改变对方的状态。",
      "修复后台元数据读取阻塞 Eagle 原生预览的问题。",
      "自动标签默认关闭，首次开启先建立基线，避免误写已有素材。",
    ],
  }),
  Object.freeze({
    id: "chrome:xiaohongshu-post-importer",
    manifestPath: "../xiaohongshu-post-importer/manifest.json",
    displayVersion: "1.0",
    name: "小红书整帖导入",
    packageName: "小红书整帖保存至 Eagle",
    version: "1.0.0",
    category: "外部工具",
    typeLabel: "Chrome 扩展",
    description: "将公开笔记中的静态图片转换为 JPG 并生成 Eagle 导入计划。",
    changelog: [
      "1.0 保持整篇笔记图片导入能力，普通图片和 Live 图静态图片统一转换为 JPG。",
      "导入通过 Eagle 本地接口完成，不修改排序状态或 Library 内部文件。",
    ],
  }),
  Object.freeze({
    id: "chrome:instagram-post-importer",
    manifestPath: "../instagram-post-importer/manifest.json",
    displayVersion: "1.1",
    name: "Instagram 整帖导入",
    packageName: "Instagram 整帖保存至 Eagle",
    version: "1.1.2",
    category: "外部工具",
    typeLabel: "Chrome 扩展",
    description: "从公开 Instagram 帖子整理图片和视频为 Eagle 导入计划。",
    changelog: [
      "1.1 保持整帖图片与视频批量导入能力，并保留来源链接。",
      "普通图片和直连视频可直接导入；分片视频会明确提示无法导入。",
    ],
  }),
  Object.freeze({
    id: "com.max.eagle-live-photo-manager",
    manifestPath: "../live-photo-manager/manifest.json",
    displayVersion: "0.1",
    name: "Live Photo 管家",
    packageName: "MAX Live Photo 管家",
    version: "0.1.0-demo.1",
    category: "试验功能",
    typeLabel: "试验功能",
    description: "识别 JPG/HEIC 与 MOV 配对并提供本地预览和队列。",
    changelog: [
      "0.1 Demo 支持识别 Live Photo 配对、预览、暂停、取消和失败熔断。",
      "当前仍是只读试验功能，不写入 Eagle Library，也不修改源文件。",
    ],
  }),
  Object.freeze({
    id: "com.max.eagle-avatar-source-publisher",
    manifestPath: "../avatar-source-publisher/manifest.json",
    displayVersion: "1.0",
    name: "头像共享源",
    packageName: "MAX 头像共享源",
    version: "1.0.0",
    category: "后台服务",
    typeLabel: "后台服务",
    description: "从指定头像文件夹生成版本化共享 manifest，供 MORROW 使用。",
    changelog: [
      "1.0 生成带版本号和哈希校验的头像共享快照，供 MORROW 读取。",
      "NAS 不可用或校验失败时保留上一次有效状态，不把不可访问误判为删除。",
    ],
  }),
]);

function cloneRegistry() {
  return {
    workbenchVersion: WORKBENCH_VERSION,
    modules: MODULES.map((module) => ({ ...module })),
  };
}

if (typeof module !== "undefined") module.exports = { WORKBENCH_VERSION, WORKBENCH_DISPLAY_VERSION, MODULES, cloneRegistry };
if (typeof window !== "undefined") window.EagleWorkbenchRegistry = { WORKBENCH_VERSION, WORKBENCH_DISPLAY_VERSION, MODULES, cloneRegistry };
