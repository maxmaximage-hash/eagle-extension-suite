"use strict";

const assert = require("assert");
const {
  createCollectionSettingsRenderer
} = require("../lib/collection-settings-renderer");

class FakeClassList {
  constructor(names = []) {
    this.names = new Set(names);
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeNode {
  constructor(classNames = []) {
    this.classList = new FakeClassList(classNames);
    this.children = [];
    this.parentElement = null;
    this.style = {};
  }

  append(...nodes) {
    for (const node of nodes) {
      node.remove();
      node.parentElement = this;
      this.children.push(node);
    }
  }

  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }

  querySelector(selector) {
    const className = selector.startsWith(".") ? selector.slice(1) : "";
    if (!className) return null;
    return this.walk().find((node) => node.classList.contains(className)) || null;
  }

  querySelectorAll(selector) {
    const className = selector.startsWith(".") ? selector.slice(1) : "";
    if (!className) return [];
    return this.walk().filter((node) => node.classList.contains(className));
  }

  walk() {
    return this.children.flatMap((child) => [child, ...child.walk()]);
  }
}

const actions = new FakeNode(["eagle-photo-collection-actions"]);
const settings = new FakeNode(["eagle-photo-taken-settings"]);
const manualSection = new FakeNode(["eagle-photo-sort-manual-section"]);
const renameSection = new FakeNode(["eagle-photo-sort-rename-section"]);
actions.append(manualSection, renameSection);

let normalRenameRenders = 0;
const renderer = createCollectionSettingsRenderer({
  renameSection,
  renderNormalRename() {
    normalRenameRenders += 1;
  }
});

assert.doesNotThrow(() => renderer.renderSettings({
  collectionKind: "normal",
  panels: [settings, actions],
  multiSortSelected: true
}));
assert.strictEqual(renameSection.parentElement, actions);
assert.strictEqual(actions.querySelectorAll(
  ".eagle-photo-sort-rename-section"
).length, 1);

for (let index = 0; index < 4; index += 1) {
  assert.doesNotThrow(() => renderer.renderSettings({
    collectionKind: "smart",
    panels: [settings, actions],
    multiSortSelected: false
  }));
}
assert.strictEqual(renameSection.parentElement, null);
assert.strictEqual(actions.querySelector(
  ".eagle-photo-sort-rename-section"
), null);
assert.strictEqual(normalRenameRenders, 1);

assert.doesNotThrow(() => renderer.renderSettings({
  collectionKind: "normal",
  panels: [settings, actions],
  multiSortSelected: false
}));
assert.strictEqual(renameSection.parentElement, actions);
assert.strictEqual(actions.querySelectorAll(
  ".eagle-photo-sort-rename-section"
).length, 1);
assert.strictEqual(normalRenameRenders, 2);

assert.doesNotThrow(() => renderer.renderSettings({
  collectionKind: "smart",
  panels: [settings, actions],
  multiSortSelected: true
}));
assert.doesNotThrow(() => renderer.renderSettings({
  collectionKind: "normal",
  panels: [settings, actions],
  multiSortSelected: true
}));
assert.strictEqual(actions.querySelectorAll(
  ".eagle-photo-sort-rename-section"
).length, 1);
assert.strictEqual(normalRenameRenders, 3);

console.log("collection settings renderer tests passed");
