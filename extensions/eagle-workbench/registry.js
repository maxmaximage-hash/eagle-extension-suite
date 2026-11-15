"use strict";

// This registry is deliberately read-only. It is generated from the source
// manifests at release time and never contains mutable business state.
const WORKBENCH_VERSION = "1.4";
const WORKBENCH_DISPLAY_VERSION = "1.4";

const MODULES = Object.freeze([
  Object.freeze({
    id: "com.max.eagle-photo-taken-sort:sorting",
    manifestPath: "../media-organizer/manifest.json",
    sourceVersion: "2.5.22-qa.98",
    displayVersion: "2.6",
    name: "排序与自动编号",
    packageName: "媒体智能整理",
    version: "2.6",
    category: "核心功能",
    typeLabel: "Eagle 扩展",
    description: "拍摄时间排序、多级排序、手动顺序和文件夹自动编号。",
    changelog: [
      "2.6 版本继续保留原有排序、手动顺序、锁定和自动编号规则。",
      "排序与重命名业务保持隔离，自动编号只处理 1-/2- 开头的媒体。",
      "修复智能文件夹连续拖动偶发失效，拖动后的顺序可以稳定保存。",
      "修复完整集合顺序与当前可见窗口顺序不同步导致的第二次拖动失败。",
      "连续拖动后保持当前资源库与 MAX 照片集数量不变。",
    ],
  }),
  Object.freeze({
    id: "com.max.eagle-photo-taken-sort:media-rename",
    manifestPath: "../media-organizer/manifest.json",
    sourceVersion: "2.5.22-qa.98",
    displayVersion: "1.0",
    name: "人物与环境图重命名",
    packageName: "媒体智能整理",
    version: "1.0",
    category: "核心功能",
    typeLabel: "Eagle 扩展",
    description: "按当前顺序将选中的人物图重命名为 1-场景名加连续编号，将选中的环境图重命名为 2-场景名加连续编号。",
    changelog: [
      "1.0 支持在插件窗口中预览并确认选中人物图的连续编号。",
      "1.0 支持在插件窗口中预览并确认选中环境图的连续编号。",
      "人物图和环境图入口独立于文件夹排序和自动编号。",
    ],
  }),
  Object.freeze({
    id: "com.max.eagle-photo-taken-sort:delivery-copy",
    manifestPath: "../media-organizer/manifest.json",
    sourceVersion: "2.5.22-qa.98",
    displayVersion: "1.0",
    name: "交付文案生成",
    packageName: "媒体智能整理",
    version: "1.0",
    category: "核心功能",
    typeLabel: "Eagle 扩展",
    description: "扫描直属子文件夹并生成可编辑、可复制的交付文案统计。",
    changelog: [
      "1.0 支持统计组数、带人物组数、人物图数量和环境图数量。",
      "支持编辑夸克链接、文案内容并一键复制。",
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
    sourceVersion: "2.5.22-qa.98",
    displayVersion: "2.5",
    name: "地点与元数据标签",
    packageName: "媒体智能整理",
    version: "2.5.22-qa.98",
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
    displayVersion: "0.2",
    name: "Live Photo 管家",
    packageName: "MAX Live Photo 管家",
    version: "0.2.0-dev.11",
    category: "后台服务",
    typeLabel: "后台服务",
    description: "为 Eagle 原生 Live Photo 卡片维护配对、台账、缩略图和右键导出；诊断窗口不参与日常浏览。",
    changelog: [
      "0.2 开始记录可恢复台账，并支持单项静态图/MOV 本地导出。",
      "原生网格路线已验证：单个 .livp 在 Eagle 文件夹中显示为一张原生卡片；右键桥接和悬停播放继续开发。",
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
