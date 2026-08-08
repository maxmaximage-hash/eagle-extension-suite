(() => {
  const EVENT_NAME = "xhs-eagle-note-state";
  const noteId = location.pathname.match(/\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/)?.[1] || "";

  function findNote(state) {
    const maps = [
      state?.note?.noteDetailMap,
      state?.noteDetailMap,
      state?.note?.detailMap
    ].filter(Boolean);
    for (const map of maps) {
      if (noteId && map[noteId]) return map[noteId]?.note || map[noteId];
      const first = Object.values(map)[0];
      if (first) return first?.note || first;
    }
    return null;
  }

  try {
    const state = globalThis.__INITIAL_STATE__ || globalThis.__INITIAL_SSR_STATE__ || null;
    const note = findNote(state);
    const carrier = document.createElement("script");
    carrier.id = "xhs-eagle-note-payload";
    carrier.type = "application/json";
    carrier.textContent = JSON.stringify(note || null).replace(/<\//g, "<\\/");
    document.documentElement.appendChild(carrier);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
})();
