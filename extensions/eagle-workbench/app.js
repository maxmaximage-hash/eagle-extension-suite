"use strict";

(function initWorkbench() {
  const registry = window.EagleWorkbenchRegistry;
  const groups = document.getElementById("moduleGroups");
  if (!registry || !groups) return;

  document.getElementById("workbenchVersion").textContent = registry.WORKBENCH_DISPLAY_VERSION || registry.WORKBENCH_VERSION;

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
})();
