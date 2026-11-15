"use strict";

function createDeliveryCopyRuntime(options = {}) {
  const isMedia = typeof options.isMedia === "function"
    ? options.isMedia
    : () => true;

  function mediaItem(item) {
    if (isMedia(item)) return true;
    const source = `${String(item?.name || "")} ${String(item?.filePath || "")}`.trim().toLowerCase();
    return /\.(?:jpg|jpeg|png|gif|webp|heic|heif|avif|tif|tiff|bmp|mov|mp4|m4v|avi|mkv|webm)(?:$|[?#\s])/u.test(source);
  }

  function groupNumber(item) {
    const source = `${String(item?.name || "")} ${String(item?.filePath || "")}`.trim();
    const match = source.match(/(?:^|[/\\\s])([0-9]+)\s*[-_.]/u);
    return match ? Number(match[1]) : null;
  }

  function buildStats(input = {}) {
    const groups = Array.isArray(input.groups) ? input.groups : [];
    const itemsByFolder = input.itemsByFolder || {};
    const perGroup = groups.map((group) => {
      const items = Array.isArray(itemsByFolder[group?.id])
        ? itemsByFolder[group.id]
        : [];
      const media = items.filter(mediaItem);
      const peopleCount = media.filter((item) => groupNumber(item) === 1).length;
      const environmentCount = media.filter((item) => {
        const number = groupNumber(item);
        return Number.isFinite(number) && number >= 2;
      }).length;
      return {
        id: String(group?.id || ""),
        name: String(group?.name || "未命名文件夹"),
        peopleCount,
        environmentCount,
        hasPeople: peopleCount > 0
      };
    });
    const peopleCount = perGroup.reduce((sum, group) => sum + group.peopleCount, 0);
    const environmentCount = perGroup.reduce(
      (sum, group) => sum + group.environmentCount,
      0
    );
    const groupsWithPeople = perGroup.filter((group) => group.hasPeople).length;
    const groupCount = perGroup.length;
    return {
      groupCount,
      groupsWithPeople,
      groupsWithoutPeople: groupCount - groupsWithPeople,
      peopleCount,
      environmentCount,
      totalMedia: peopleCount + environmentCount,
      perGroup
    };
  }

  function normalizeLink(value) {
    return String(value || "")
      .trim()
      .replace(/^链接\s*[:：]\s*/u, "");
  }

  function renderTemplate(template, stats = {}, quarkLink = "") {
    const values = {
      groups: stats.groupCount ?? 0,
      groupsWithPeople: stats.groupsWithPeople ?? 0,
      groupsWithoutPeople: stats.groupsWithoutPeople ?? 0,
      peopleCount: stats.peopleCount ?? 0,
      environmentCount: stats.environmentCount ?? 0,
      totalMedia: stats.totalMedia ?? 0,
      quarkLink: normalizeLink(quarkLink)
    };
    return String(template || "").replace(/\{(groups|groupsWithPeople|groupsWithoutPeople|peopleCount|environmentCount|totalMedia|quarkLink)\}/g, (_match, key) => String(values[key]));
  }

  return { buildStats, normalizeLink, renderTemplate };
}

function partitionItemsByFolder(groups, items) {
  const result = {};
  for (const group of Array.isArray(groups) ? groups : []) {
    if (group?.id) result[String(group.id)] = [];
  }
  for (const item of Array.isArray(items) ? items : []) {
    const folders = Array.isArray(item?.folders) ? item.folders.map(String) : [];
    for (const folderId of folders) {
      if (result[folderId]) result[folderId].push(item);
    }
  }
  return result;
}

function leafFolderGroups(folders, rootId) {
  const byParent = new Map();
  for (const folder of Array.isArray(folders) ? folders : []) {
    if (!folder?.id) continue;
    const parent = String(folder.parent || "");
    const list = byParent.get(parent) || [];
    list.push(folder);
    byParent.set(parent, list);
  }
  function visit(folder) {
    const children = byParent.get(String(folder.id)) || [];
    if (!children.length) {
      return [{ id: String(folder.id), name: String(folder.name || "未命名文件夹") }];
    }
    return children.flatMap(visit);
  }
  return (byParent.get(String(rootId)) || []).flatMap(visit);
}

module.exports = { createDeliveryCopyRuntime, partitionItemsByFolder, leafFolderGroups };
