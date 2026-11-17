"use strict";

(function exposeDeliveryModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.EagleWorkbenchDelivery = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const DEFAULT_TEMPLATE_BODY = `🔻久等了兄弟 精修照片已经全部为你打包好

📌交付标准 {standardGroups}组，{standardGroupsWithPeople}组人像精拍，{standardGroupsWithoutPeople} 组不带人氛围环境
每组 {standardPeoplePerGroup} 张人物共 {standardPeopleCount} 张，{standardEnvironmentPerGroup} 张环境共 {standardEnvironmentCount} 张，共计 {standardTotalCount} 张

📌实际交付 {actualGroups} 组，{actualGroupsWithPeople} 组人像精拍，{actualGroupsWithoutPeople} 组不带人氛围环境
人物图共计 {actualPeopleCount} 张，环境图 {actualEnvironmentCount} 张
超额交付的为免费赠送内容

📌发布排版看00号文件夹，每组有排版设计和配文
📌照片全部按序编号，1-开头为人物图，2-开头为环境图，直接按照模版发布
📌排版可发 {standardPublishGroups}组
📌发布频率1周1条，快速起号一期线下内容可以在两个月内发完
📌发布时段晚上7-8点

链接：{quarkLink}
链接永久有效，未来拍摄的照片也会更新在这个链接上请大家妥善保存

🔱照片最高画质保存方法（三步）🔱
1️⃣点开下面照片链接，点击左下角按钮“保存到网盘”（不要在链接直接预览，因为是压缩的缩略图）

2️⃣将文件夹保存至自己的夸克网盘后可以全部一次性下载 （夸克比百度网盘方便，没有的下一个）

3️⃣下载后照片会在传输列表，此时照片还不会到你的相册里，长按任意文件会出现全选标志，全选已经下载的照片，再点左下角的保存至相册，此时所有照片的原画质版本就会全部保存到你的相册里

📱基础的朋友圈包装可以看这一篇教程
https://x1mv4oqq6lz.feishu.cn/wiki/F1ebwsdKQiqUPVkqeA6cj7xwn7b?from=from_copylink

🎮如果你不会发朋友圈，不会排版的可以看下面这条基础排版小攻略，当然你也可以私信与我们联系指导
https://x1mv4oqq6lz.feishu.cn/wiki/H2KewUklOiAh0CkqEqwcdwthnMh

📍如果你想修改定位可以看下面这篇改定位攻略
https://x1mv4oqq6lz.feishu.cn/wiki/Vdk1w759iiE3sDkDBafcL2i6nme?from=from_copylink

📷后期照片有任何需要调整需求，或者社交软件账号搭建问题可随时联系团队导师`;

  const DEFAULT_TEMPLATES = [
    {
      id: "tier-3980",
      name: "3980",
      standardGroups: 5,
      standardGroupsWithPeople: 3,
      standardGroupsWithoutPeople: 2,
      standardPeoplePerGroup: 3,
      standardEnvironmentPerGroup: 10,
      standardPublishGroups: 9,
      body: DEFAULT_TEMPLATE_BODY
    },
    {
      id: "tier-6600",
      name: "6600",
      standardGroups: 0,
      standardGroupsWithPeople: 0,
      standardGroupsWithoutPeople: 0,
      standardPeoplePerGroup: 0,
      standardEnvironmentPerGroup: 0,
      standardPublishGroups: 0,
      body: DEFAULT_TEMPLATE_BODY
    },
    {
      id: "tier-10000",
      name: "10000",
      standardGroups: 0,
      standardGroupsWithPeople: 0,
      standardGroupsWithoutPeople: 0,
      standardPeoplePerGroup: 0,
      standardEnvironmentPerGroup: 0,
      standardPublishGroups: 0,
      body: DEFAULT_TEMPLATE_BODY
    }
  ];

  const NUMBER_FIELDS = [
    "standardGroups",
    "standardGroupsWithPeople",
    "standardGroupsWithoutPeople",
    "standardPeoplePerGroup",
    "standardEnvironmentPerGroup",
    "standardPublishGroups"
  ];

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }

  function normalizeTemplate(input = {}) {
    const template = {
      id: String(input.id || `template-${Date.now().toString(36)}`),
      name: String(input.name || "未命名档位").trim() || "未命名档位",
      body: String(input.body ?? DEFAULT_TEMPLATE_BODY),
      standardGroups: number(input.standardGroups),
      standardGroupsWithPeople: number(input.standardGroupsWithPeople),
      standardGroupsWithoutPeople: number(input.standardGroupsWithoutPeople),
      standardPeoplePerGroup: number(input.standardPeoplePerGroup),
      standardEnvironmentPerGroup: number(input.standardEnvironmentPerGroup),
      standardPublishGroups: number(input.standardPublishGroups)
    };
    if (!template.standardGroups) {
      template.standardGroups =
        template.standardGroupsWithPeople + template.standardGroupsWithoutPeople;
    }
    if (!template.standardGroupsWithoutPeople && template.standardGroups) {
      template.standardGroupsWithoutPeople = Math.max(
        0,
        template.standardGroups - template.standardGroupsWithPeople
      );
    }
    return template;
  }

  function cloneTemplates(templates) {
    const source = Array.isArray(templates) && templates.length
      ? templates
      : DEFAULT_TEMPLATES;
    return source.map(normalizeTemplate);
  }

  function itemGroupNumber(item) {
    const source = String(item?.name || "").trimStart();
    const match = source.match(/^(\d+)\s*[-_.]/u);
    return match ? Number(match[1]) : null;
  }

  function countItemPrefix(items, prefix) {
    const expected = String(prefix || "").replace(/[-_.]+$/, "");
    const expectedNumber = Number(expected);
    return (Array.isArray(items) ? items : []).filter((item) => {
      const number = itemGroupNumber(item);
      return Number.isFinite(expectedNumber)
        ? number === expectedNumber
        : String(item?.name || "").trimStart().startsWith(prefix);
    }).length;
  }

  function calculateDeliveryStats(groups) {
    const normalizedGroups = (Array.isArray(groups) ? groups : []).map((group) => {
      const items = Array.isArray(group?.items) ? group.items : [];
      const peopleCount = countItemPrefix(items, "1-");
      const environmentCount = countItemPrefix(items, "2-");
      return {
        id: String(group?.id || ""),
        name: String(group?.name || "未命名文件夹"),
        peopleCount,
        environmentCount,
        totalCount: peopleCount + environmentCount
      };
    });
    const actualGroups = normalizedGroups.length;
    const actualGroupsWithPeople = normalizedGroups.filter((group) => group.peopleCount > 0).length;
    const actualGroupsWithoutPeople = actualGroups - actualGroupsWithPeople;
    const actualPeopleCount = normalizedGroups.reduce((sum, group) => sum + group.peopleCount, 0);
    const actualEnvironmentCount = normalizedGroups.reduce((sum, group) => sum + group.environmentCount, 0);
    return {
      groups: normalizedGroups,
      actualGroups,
      actualGroupsWithPeople,
      actualGroupsWithoutPeople,
      actualPeopleCount,
      actualEnvironmentCount,
      actualTotalCount: actualPeopleCount + actualEnvironmentCount
    };
  }

  function normalizeQuarkLink(value) {
    const source = String(value ?? "");
    const candidates = /(?:https?:\/\/)?pan\.quark\.cn\/s\/[^\s<>"'`()[\]{}，。！？；：、（）【】《》…]+/gi;
    for (const match of source.matchAll(candidates)) {
      if (match.index > 0 && /[a-z0-9._~:/@%+\\-]/i.test(source[match.index - 1])) continue;
      const raw = match[0].replace(/[.,;:!?]+$/u, "");
      try {
        const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        if (url.hostname !== "pan.quark.cn" || url.username || url.password || url.port) continue;
        if (!/^\/s\/[a-z0-9_-]+\/?$/i.test(url.pathname)) continue;
        url.protocol = "https:";
        return url.href;
      } catch (_) { /* Ignore text that is not a complete share URL. */ }
    }
    return "";
  }

  function deliveryValues(template, stats, folderName, quarkLink = "") {
    const normalized = normalizeTemplate(template);
    const actual = stats || {};
    const standardPeopleCount =
      normalized.standardGroupsWithPeople * normalized.standardPeoplePerGroup;
    const standardEnvironmentCount =
      normalized.standardGroups * normalized.standardEnvironmentPerGroup;
    const standardTotalCount = standardPeopleCount + standardEnvironmentCount;
    const actualGroups = number(actual.actualGroups);
    const actualGroupsWithPeople = number(actual.actualGroupsWithPeople);
    const actualGroupsWithoutPeople = number(actual.actualGroupsWithoutPeople);
    const actualPeopleCount = number(actual.actualPeopleCount);
    const actualEnvironmentCount = number(actual.actualEnvironmentCount);
    const actualTotalCount = actualPeopleCount + actualEnvironmentCount;
    const standardGroups = normalized.standardGroups;
    const standardGroupsWithPeople = normalized.standardGroupsWithPeople;
    const standardGroupsWithoutPeople = normalized.standardGroupsWithoutPeople;
    return {
      folderName: String(folderName || "当前文件夹"),
      quarkLink: normalizeQuarkLink(quarkLink),
      standardGroups,
      standardGroupsWithPeople,
      standardGroupsWithoutPeople,
      standardPeoplePerGroup: normalized.standardPeoplePerGroup,
      standardEnvironmentPerGroup: normalized.standardEnvironmentPerGroup,
      standardPublishGroups: normalized.standardPublishGroups,
      standardPeopleCount,
      standardEnvironmentCount,
      standardTotalCount,
      actualGroups,
      actualGroupsWithPeople,
      actualGroupsWithoutPeople,
      actualPeopleCount,
      actualEnvironmentCount,
      actualTotalCount,
      extraGroups: Math.max(0, actualGroups - standardGroups),
      extraGroupsWithPeople: Math.max(0, actualGroupsWithPeople - standardGroupsWithPeople),
      extraGroupsWithoutPeople: Math.max(0, actualGroupsWithoutPeople - standardGroupsWithoutPeople),
      extraPeopleCount: Math.max(0, actualPeopleCount - standardPeopleCount),
      extraEnvironmentCount: Math.max(0, actualEnvironmentCount - standardEnvironmentCount),
      extraTotalCount: Math.max(0, actualTotalCount - standardTotalCount)
    };
  }

  function updateQuarkLink(text, previousLink = "", nextLink = "") {
    const source = String(text ?? "");
    const link = normalizeQuarkLink(nextLink);
    if (String(nextLink ?? "").trim() && !link) return source;
    const previous = normalizeQuarkLink(previousLink);
    let replaced = false;
    const replaceExisting = (value, expected) => value.replace(
      /(?:https?:\/\/)?pan\.quark\.cn\/s\/[^\s<>"'`()[\]{}，。！？；：、（）【】《》…]+/gi,
      (candidate, offset) => {
        if (replaced || (offset > 0 && /[a-z0-9._~:/@%+\\-]/i.test(value[offset - 1]))) return candidate;
        if (normalizeQuarkLink(candidate) !== expected) return candidate;
        replaced = true;
        return link + (candidate.match(/[.,;:!?]+$/u)?.[0] || "");
      }
    );
    if (previous) {
      const updated = replaceExisting(source, previous);
      if (replaced) return updated;
    }
    return source.replace(/^([ \t]*链接[ \t]*[:：][ \t]*)([^\r\n]*)/m, (line, prefix, rest) => {
      const current = normalizeQuarkLink(rest);
      if (current) return prefix + replaceExisting(rest, current);
      if (/(?:https?:\/\/|pan\.quark\.cn\/)/i.test(rest)) return line;
      return prefix + link + rest;
    });
  }

  function renderTemplate(body, values) {
    const source = String(body || "");
    return source.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(values || {}, key)
        ? String(values[key])
        : match
    );
  }

  return {
    DEFAULT_TEMPLATE_BODY,
    DEFAULT_TEMPLATES,
    NUMBER_FIELDS,
    calculateDeliveryStats,
    cloneTemplates,
    deliveryValues,
    normalizeQuarkLink,
    normalizeTemplate,
    renderTemplate,
    updateQuarkLink
  };
});
