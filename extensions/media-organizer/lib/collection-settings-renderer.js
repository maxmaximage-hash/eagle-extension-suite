"use strict";

function createCollectionSettingsRenderer(options = {}) {
  const renderNormalRename = typeof options.renderNormalRename === "function"
    ? options.renderNormalRename
    : () => {};

  function renderSettings(input = {}) {
    const collectionKind = String(input.collectionKind || "global");
    const panels = Array.isArray(input.panels) ? input.panels : [];
    const renameSection = input.renameSection || options.renameSection || null;
    const smart = collectionKind === "smart";
    let collectionActionsContainer = null;

    for (const panel of panels) {
      if (!panel?.classList?.contains) continue;
      const isCollectionActionsPanel = panel.classList.contains(
        "eagle-photo-collection-actions"
      );
      if (isCollectionActionsPanel) collectionActionsContainer = panel;
      panel.style.display =
        isCollectionActionsPanel || input.multiSortSelected === true
          ? ""
          : "none";
    }

    if (smart) {
      renameSection?.remove?.();
      return {
        collectionKind,
        collectionActionsContainer,
        renameSection: null
      };
    }

    if (
      collectionKind === "normal" &&
      collectionActionsContainer &&
      renameSection &&
      renameSection.parentElement !== collectionActionsContainer
    ) {
      collectionActionsContainer.append(renameSection);
    }
    if (
      collectionKind === "normal" &&
      renameSection?.parentElement === collectionActionsContainer
    ) {
      renderNormalRename({
        collectionActionsContainer,
        renameSection
      });
    }
    return {
      collectionKind,
      collectionActionsContainer,
      renameSection:
        renameSection?.parentElement === collectionActionsContainer
          ? renameSection
          : null
    };
  }

  return Object.freeze({ renderSettings });
}

module.exports = { createCollectionSettingsRenderer };
