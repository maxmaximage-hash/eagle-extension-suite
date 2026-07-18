import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  ArrowsOut,
  Circle,
  Cursor,
  Eye,
  EyeSlash,
  Minus,
  Plus,
  Rectangle,
  TextT,
  Trash,
} from "@phosphor-icons/react";
import {
  PrivacyEditor,
  createPrivacyLayer,
  normalizePrivacyItem,
  normalizePrivacyLayer,
  drawPrivacyEffect,
} from "../eagle-plugin/modules/vendor/gravity-privacy-editor/1.1.0/index.js";

const EMPTY_LAYER = createPrivacyLayer();

function snapshot(layer, annotations) {
  return {
    layer: structuredClone(layer),
    annotations: structuredClone(annotations),
  };
}

function defaultAnnotation(width, height) {
  return {
    id: `annotation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    text: "",
    x: Math.round(width * 0.08),
    y: Math.round(height * 0.08),
    fontSize: Math.max(24, Math.round(width * 0.045)),
    fontFamily: "PingFang SC",
    fontFace: "PingFang SC",
    fontPostscriptName: "",
    fontPath: "",
    fontWeight: 400,
    fontStyle: "normal",
    letterSpacing: 0,
    lineSpacing: 1.28,
    textAlign: "left",
    color: "#ffffff",
    opacity: 1,
    strokeColor: "#000000",
    strokeWidth: 0,
    shadowEnabled: false,
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowOffset: 2,
    shadowRadius: 12,
    shadowAngle: 45,
    rotation: 0,
  };
}

function MaskCanvas({ image, item, effectType, intensity }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !item) return;
    const width = Math.max(1, Math.round(item.width));
    const height = Math.max(1, Math.round(item.height));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    drawPrivacyEffect(context, image, {
      sourceRect: { x: item.x, y: item.y, width: item.width, height: item.height },
      destinationRect: { x: 0, y: 0, width, height },
      effectType,
      intensity,
      shape: item.shape,
    });
  }, [effectType, image, intensity, item]);

  return (
    <canvas
      ref={canvasRef}
      className={`privacy-mask-preview is-${item.shape}`}
      style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
      aria-hidden="true"
    />
  );
}

function TextAnnotation({
  annotation,
  selected,
  zoom,
  onSelect,
  onMove,
}) {
  const textRef = useRef(null);

  useEffect(() => {
    globalThis.GravityFontManager?.applyPreview?.(textRef.current, annotation);
  }, [
    annotation.fontFamily,
    annotation.fontFace,
    annotation.fontPostscriptName,
    annotation.fontPath,
  ]);

  const beginMove = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(annotation.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = annotation.x;
    const originY = annotation.y;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      onMove(annotation.id, {
        x: Math.max(0, originX + (moveEvent.clientX - startX) / Math.max(0.01, zoom)),
        y: Math.max(0, originY + (moveEvent.clientY - startY) / Math.max(0.01, zoom)),
      });
    };
    const finish = (upEvent) => {
      if (target.hasPointerCapture(upEvent.pointerId)) target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  };

  const radians = Number(annotation.shadowAngle || 0) * Math.PI / 180;
  const shadowX = Math.cos(radians) * Number(annotation.shadowOffset || 0);
  const shadowY = Math.sin(radians) * Number(annotation.shadowOffset || 0);
  const shadow = annotation.shadowEnabled
    ? `${shadowX}px ${shadowY}px ${Number(annotation.shadowRadius || 0) / 4}px ${annotation.shadowColor}`
    : "none";

  return (
    <div
      className={`privacy-text-annotation ${selected ? "is-selected" : ""}`}
      style={{
        left: annotation.x,
        top: annotation.y,
        transform: `rotate(${Number(annotation.rotation || 0)}deg)`,
      }}
      onPointerDown={beginMove}
    >
      <span
        ref={textRef}
        style={{
          display: "block",
          color: annotation.color,
          opacity: annotation.opacity,
          fontSize: annotation.fontSize,
          letterSpacing: `${annotation.fontSize * annotation.letterSpacing}px`,
          lineHeight: annotation.lineSpacing,
          textAlign: annotation.textAlign,
          whiteSpace: "pre",
          WebkitTextStroke: `${annotation.strokeWidth}px ${annotation.strokeColor}`,
          paintOrder: "stroke fill",
          textShadow: shadow,
        }}
      >
        {annotation.text || <em>输入文字</em>}
      </span>
    </div>
  );
}

function WatermarkPreview({ payload }) {
  if (!payload?.assets?.length || !payload?.placements?.length) return null;
  return (
    <div className="privacy-watermark-preview" aria-hidden="true">
      {payload.placements.map((placement, index) => {
        const asset = payload.assets[placement.asset];
        if (!asset) return null;
        return (
          <img
            key={`${placement.asset}-${index}`}
            src={asset.dataUrl}
            alt=""
            style={{
              left: placement.left,
              top: placement.top,
              width: asset.width,
              height: asset.height,
            }}
          />
        );
      })}
    </div>
  );
}

function RangeField({ label, value, min, max, step = 1, onChange, suffix = "" }) {
  return (
    <label className="privacy-range-field">
      <span>{label}<b>{value}{suffix}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(event) => onChange(Number(event.currentTarget.value))} />
    </label>
  );
}

export function EaglePrivacyWorkspace({ host }) {
  const viewportRef = useRef(null);
  const coordinateRef = useRef(null);
  const imageRef = useRef(null);
  const quickExportRef = useRef(null);
  const exportControllerRef = useRef(null);
  const sessionRef = useRef({ layer: EMPTY_LAYER, annotations: [], item: null, watermarkPresetId: "" });
  const historyKeyRef = useRef({ key: "", at: 0 });

  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [layer, setLayer] = useState(EMPTY_LAYER);
  const [annotations, setAnnotations] = useState([]);
  const [selectedMaskId, setSelectedMaskId] = useState("");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState("");
  const [tool, setTool] = useState("rect");
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState("width");
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [presets, setPresets] = useState([]);
  const [watermarkPresetId, setWatermarkPresetId] = useState("");
  const [watermarkPayload, setWatermarkPayload] = useState(null);
  const [imageElement, setImageElement] = useState(null);

  const currentItem = items[currentIndex] || null;
  const selectedMask = layer.items.find((item) => item.id === selectedMaskId) || null;
  const selectedAnnotation = annotations.find((item) => item.id === selectedAnnotationId) || null;
  sessionRef.current = { layer, annotations, item: currentItem, watermarkPresetId };

  const syncImageElement = useCallback((image) => {
    if (!image || !image.naturalWidth || !image.naturalHeight) return;
    setImageElement((current) => current === image ? current : image);
    setDimensions((current) => (
      current.width === image.naturalWidth && current.height === image.naturalHeight
        ? current
        : { width: image.naturalWidth, height: image.naturalHeight }
    ));
  }, []);

  const attachImageElement = useCallback((image) => {
    imageRef.current = image;
    if (!image) {
      setImageElement(null);
      return;
    }
    if (image.complete) syncImageElement(image);
  }, [syncImageElement]);

  const fontGroups = useMemo(() => globalThis.GravityFontManager?.groups?.() || [], [items, selectedAnnotationId]);
  const favoriteFonts = globalThis.GravityFontManager?.favorites?.() || [];
  const fontEntry = selectedAnnotation
    ? globalThis.GravityFontManager?.entry?.(selectedAnnotation.fontFamily)
    : null;

  const remember = useCallback((key = "") => {
    const now = Date.now();
    const previous = historyKeyRef.current;
    if (key && previous.key === key && now - previous.at < 500) {
      historyKeyRef.current = { key, at: now };
      return;
    }
    historyKeyRef.current = { key, at: now };
    setUndoStack((stack) => [...stack.slice(-49), snapshot(sessionRef.current.layer, sessionRef.current.annotations)]);
    setRedoStack([]);
  }, []);

  const resetSession = useCallback(() => {
    setLayer(createPrivacyLayer());
    setAnnotations([]);
    setSelectedMaskId("");
    setSelectedAnnotationId("");
    setImageElement(null);
    setTool("rect");
    setFitMode("width");
    setUndoStack([]);
    setRedoStack([]);
    setWatermarkPresetId("");
    setWatermarkPayload(null);
    historyKeyRef.current = { key: "", at: 0 };
    host?.clearResult?.();
    exportControllerRef.current?.reset?.();
  }, [host]);

  const loadSelection = useCallback(async () => {
    const selected = await host?.loadSelection?.();
    const nextItems = Array.isArray(selected) ? selected : [];
    setItems(nextItems);
    setCurrentIndex(0);
    setDimensions({
      width: Math.max(0, Number(nextItems[0]?.width || 0)),
      height: Math.max(0, Number(nextItems[0]?.height || 0)),
    });
    resetSession();
    exportControllerRef.current?.setItemCount(nextItems.length ? 1 : 0);
  }, [host, resetSession]);

  useEffect(() => {
    loadSelection().catch((error) => host?.notify?.(error.message, "error"));
    setPresets(host?.getWatermarkPresets?.() || []);
    const reset = () => resetSession();
    const refresh = () => {
      setPresets(host?.getWatermarkPresets?.() || []);
      loadSelection().catch((error) => host?.notify?.(error.message, "error"));
    };
    window.addEventListener("max-privacy-reset", reset);
    window.addEventListener("max-privacy-refresh-selection", refresh);
    return () => {
      window.removeEventListener("max-privacy-reset", reset);
      window.removeEventListener("max-privacy-refresh-selection", refresh);
    };
  }, [host, loadSelection, resetSession]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    const widthScale = Math.max(0.05, (viewportSize.width - 30) / dimensions.width);
    const windowScale = Math.max(0.05, Math.min(widthScale, (viewportSize.height - 30) / dimensions.height));
    if (fitMode === "width") setZoom(widthScale);
    if (fitMode === "window") setZoom(windowScale);
    if (fitMode === "actual") setZoom(1);
  }, [dimensions, fitMode, viewportSize]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height || !watermarkPresetId) {
      setWatermarkPayload(null);
      return;
    }
    const preset = presets.find((item) => item.id === watermarkPresetId);
    if (!preset) {
      setWatermarkPayload(null);
      return;
    }
    let canceled = false;
    host?.renderWatermarkPreview?.(preset.watermark, dimensions.width, dimensions.height)
      .then((payload) => {
        if (!canceled) setWatermarkPayload(payload);
      })
      .catch(() => {
        if (!canceled) setWatermarkPayload(null);
      });
    return () => { canceled = true; };
  }, [dimensions, host, presets, watermarkPresetId]);

  useEffect(() => {
    if (!quickExportRef.current || exportControllerRef.current || !globalThis.GravityQuickExport) return;
    const state = host?.getExportState?.() || {
      directory: "",
      compressionMode: "quality",
      quality: 100,
      maxFileSizeMb: "",
      collisionMode: "rename",
    };
    exportControllerRef.current = globalThis.GravityQuickExport.mount(quickExportRef.current, {
      state,
      chooseDirectory: () => host?.chooseDirectory?.(),
      onStateChange: () => host?.saveExportState?.(),
      notify: (message, type) => host?.notify?.(message, type),
      onResult: (results, failed) => host?.showResult?.(results, failed),
      onReset: () => host?.clearResult?.(),
      buttonLabel: (count) => count ? `导出当前预览 ${count} 张照片` : "导出当前预览照片",
      exportItems: ({ state: exportState, onProgress }) => {
        const current = sessionRef.current;
        if (!current.item) throw new Error("请先在 Eagle 中选择需要打码的图片");
        return host?.exportPrivacy?.({
          item: current.item,
          privacyLayer: current.layer,
          annotations: current.annotations,
          watermarkPresetId: current.watermarkPresetId,
          exportState,
          onProgress,
        });
      },
    });
    exportControllerRef.current.setItemCount(currentItem ? 1 : 0);
  }, [currentItem, host]);

  useEffect(() => {
    exportControllerRef.current?.setItemCount(currentItem ? 1 : 0);
  }, [currentItem]);

  const updateLayer = (nextLayer, historyKey = "") => {
    remember(historyKey);
    setLayer(normalizePrivacyLayer(nextLayer, {
      width: dimensions.width || 1,
      height: dimensions.height || 1,
      allowedAnchors: ["image"],
      defaultAnchor: "image",
    }));
  };

  const addMask = (item) => {
    remember("add-mask");
    const next = normalizePrivacyItem({
      ...item,
      anchor: "image",
      shape: tool === "ellipse" ? "ellipse" : "rect",
      order: layer.items.length,
    }, layer.items.length, {
      width: dimensions.width,
      height: dimensions.height,
      allowedAnchors: ["image"],
      defaultAnchor: "image",
    });
    setLayer({ ...layer, items: [...layer.items, next] });
    setSelectedMaskId(next.id);
    setSelectedAnnotationId("");
    setTool("select");
  };

  const updateMask = (id, nextItem) => {
    if (!nextItem) {
      remember("delete-mask");
      setLayer((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== id),
      }));
      setSelectedMaskId("");
      return;
    }
    remember(`mask-transform-${id}`);
    setLayer((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...nextItem } : item),
    }));
  };

  const patchGlobalMask = (patch) => {
    updateLayer({ ...layer, ...patch }, "mask-global-style");
  };

  const addText = () => {
    if (!dimensions.width) return;
    remember("add-text");
    const next = defaultAnnotation(dimensions.width, dimensions.height);
    const entry = globalThis.GravityFontManager?.entry?.(next.fontFamily);
    const face = entry?.faces?.[0];
    if (face) globalThis.GravityFontManager.applyFace(next, face);
    setAnnotations([...annotations, next]);
    setSelectedAnnotationId(next.id);
    setSelectedMaskId("");
    setTool("text");
  };

  const patchAnnotation = (id, patch, historyKey = `text-${id}`) => {
    remember(historyKey);
    setAnnotations((list) => list.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const deleteSelected = () => {
    if (selectedMaskId) updateMask(selectedMaskId, null);
    if (selectedAnnotationId) {
      remember("delete-text");
      setAnnotations((list) => list.filter((item) => item.id !== selectedAnnotationId));
      setSelectedAnnotationId("");
    }
  };

  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setRedoStack((stack) => [...stack, snapshot(layer, annotations)]);
    setUndoStack((stack) => stack.slice(0, -1));
    setLayer(previous.layer);
    setAnnotations(previous.annotations);
    setSelectedMaskId("");
    setSelectedAnnotationId("");
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setUndoStack((stack) => [...stack, snapshot(layer, annotations)]);
    setRedoStack((stack) => stack.slice(0, -1));
    setLayer(next.layer);
    setAnnotations(next.annotations);
    setSelectedMaskId("");
    setSelectedAnnotationId("");
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.target.closest("input, textarea, select")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedAnnotationId) {
        event.preventDefault();
        remember("delete-text");
        setAnnotations((list) => list.filter((item) => item.id !== selectedAnnotationId));
        setSelectedAnnotationId("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const selectFont = (family) => {
    if (!selectedAnnotation) return;
    const next = { ...selectedAnnotation, fontFamily: family };
    const entry = globalThis.GravityFontManager?.entry?.(family);
    const face = entry?.faces?.[0];
    if (face) globalThis.GravityFontManager.applyFace(next, face);
    patchAnnotation(selectedAnnotation.id, next, "text-font");
  };

  const selectFace = (postscriptName) => {
    if (!selectedAnnotation || !fontEntry) return;
    const face = fontEntry.faces.find((item) => item.postscriptName === postscriptName);
    if (!face) return;
    const next = { ...selectedAnnotation };
    globalThis.GravityFontManager.applyFace(next, face);
    patchAnnotation(selectedAnnotation.id, next, "text-face");
  };

  const imageUrl = currentItem?.url || "";

  return (
    <div className="privacy-workspace">
      <div className="privacy-topbar">
        <div className="privacy-toolset">
          <button className={tool === "select" ? "active" : ""} type="button" onClick={() => setTool("select")}><Cursor size={17} />选择</button>
          <button className={tool === "rect" ? "active" : ""} type="button" onClick={() => setTool("rect")}><Rectangle size={17} />矩形</button>
          <button className={tool === "ellipse" ? "active" : ""} type="button" onClick={() => setTool("ellipse")}><Circle size={17} />椭圆</button>
          <button className={tool === "text" ? "active" : ""} type="button" onClick={addText}><TextT size={17} />文字</button>
        </div>
        <div className="privacy-toolset privacy-history-tools">
          <button type="button" disabled={!undoStack.length} onClick={undo} aria-label="撤销"><ArrowCounterClockwise size={17} /></button>
          <button type="button" disabled={!redoStack.length} onClick={redo} aria-label="重做"><ArrowClockwise size={17} /></button>
          <button type="button" disabled={!selectedMaskId && !selectedAnnotationId} onClick={deleteSelected}><Trash size={17} />删除</button>
        </div>
        <div className="privacy-toolset privacy-zoom-tools">
          <button type="button" aria-label="缩小画布" title="缩小画布" onClick={() => { setFitMode("custom"); setZoom((value) => Math.max(0.05, value - 0.1)); }}><Minus size={16} /></button>
          <b>{Math.round(zoom * 100)}%</b>
          <button type="button" aria-label="放大画布" title="放大画布" onClick={() => { setFitMode("custom"); setZoom((value) => Math.min(4, value + 0.1)); }}><Plus size={16} /></button>
          <button className={fitMode === "width" ? "active" : ""} type="button" onClick={() => setFitMode("width")}>适应宽度</button>
          <button className={fitMode === "window" ? "active" : ""} type="button" onClick={() => setFitMode("window")}><ArrowsOut size={16} />适应窗口</button>
          <button className={fitMode === "actual" ? "active" : ""} type="button" onClick={() => setFitMode("actual")}>100%</button>
        </div>
        <button className="privacy-reset-task" type="button" onClick={loadSelection}>结束并重新读取</button>
      </div>

      <div className="privacy-main">
        <section className="privacy-canvas-card">
          <div className="privacy-canvas-header">
            <div>
              <strong>{currentItem?.name || "尚未选择图片"}</strong>
              <small>{dimensions.width ? `${dimensions.width} × ${dimensions.height}` : "请先在 Eagle 选择一张图片"}</small>
            </div>
            <button type="button" onClick={() => setLayer({ ...layer, previewVisible: !layer.previewVisible })}>
              {layer.previewVisible ? <Eye size={16} /> : <EyeSlash size={16} />}
              {layer.previewVisible ? "隐藏打码" : "显示打码"}
            </button>
          </div>
          <div className="privacy-canvas-viewport" ref={viewportRef}>
            {!currentItem && <div className="privacy-empty-state"><strong>请在 Eagle 选择图片</strong><span>重新进入“隐私打码”即可读取当前图片</span></div>}
            {currentItem && (
              <div
                className="privacy-stage-size"
                style={{
                  width: dimensions.width * zoom || 1,
                  height: dimensions.height * zoom || 1,
                }}
              >
                <div
                  ref={coordinateRef}
                  className="privacy-coordinate-layer"
                  style={{
                    width: dimensions.width || 1,
                    height: dimensions.height || 1,
                    transform: `scale(${zoom})`,
                  }}
                  onPointerDown={(event) => {
                    if (event.target === event.currentTarget) {
                      setSelectedMaskId("");
                      setSelectedAnnotationId("");
                    }
                  }}
                >
                  <img
                    key={currentItem.id || imageUrl}
                    ref={attachImageElement}
                    src={imageUrl}
                    alt={currentItem.name}
                    draggable="false"
                    onLoad={(event) => syncImageElement(event.currentTarget)}
                  />
                  {layer.previewVisible && (imageElement || imageRef.current) && layer.items.map((item) => (
                    <MaskCanvas
                      key={item.id}
                      image={imageElement || imageRef.current}
                      item={item}
                      effectType={layer.effectType}
                      intensity={layer.intensity}
                    />
                  ))}
                  {annotations.map((annotation) => (
                    <TextAnnotation
                      key={annotation.id}
                      annotation={annotation}
                      selected={annotation.id === selectedAnnotationId}
                      zoom={zoom}
                      onSelect={(id) => {
                        setSelectedAnnotationId(id);
                        setSelectedMaskId("");
                        setTool("select");
                      }}
                      onMove={(id, patch) => patchAnnotation(id, patch, `text-move-${id}`)}
                    />
                  ))}
                  <WatermarkPreview payload={watermarkPayload} />
                  {dimensions.width > 0 && (
                    <PrivacyEditor
                      targetRef={coordinateRef}
                      layer={layer}
                      tool={tool === "rect" || tool === "ellipse" ? "draw" : "select"}
                      shape={tool === "ellipse" ? "ellipse" : "rect"}
                      selectedId={selectedMaskId}
                      width={dimensions.width}
                      height={dimensions.height}
                      displayScale={zoom}
                      resolveItemRect={({ item }) => item}
                      createItemFromRect={({ rect, shape, preferredItem }) => ({
                        ...(preferredItem || {}),
                        ...rect,
                        shape: preferredItem?.shape || shape,
                      })}
                      onSelect={(id) => {
                        setSelectedMaskId(id);
                        setSelectedAnnotationId("");
                      }}
                      onAdd={addMask}
                      onUpdate={updateMask}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="privacy-inspector">
          <section className="privacy-panel">
            <h2>隐私打码</h2>
            <div className="privacy-segmented">
              <button className={layer.effectType === "blur" ? "active" : ""} type="button" onClick={() => patchGlobalMask({ effectType: "blur" })}>模糊</button>
              <button className={layer.effectType === "pixelate" ? "active" : ""} type="button" onClick={() => patchGlobalMask({ effectType: "pixelate" })}>马赛克</button>
            </div>
            <RangeField
              label="全部区域强度"
              value={layer.intensity}
              min={2}
              max={24}
              onChange={(value) => patchGlobalMask({ intensity: value })}
            />
            <div className="privacy-panel-actions">
              <button type="button" disabled={!selectedMask} onClick={() => updateMask(selectedMaskId, null)}>删除所选区域</button>
              <button type="button" disabled={!layer.items.length} onClick={() => { remember("clear-masks"); setLayer({ ...layer, items: [] }); setSelectedMaskId(""); }}>清除全部打码</button>
            </div>
          </section>

          <section className="privacy-panel">
            <div className="privacy-panel-title-row"><h2>文字标注</h2><button type="button" onClick={addText}>＋ 添加文字</button></div>
            {!selectedAnnotation && <p className="privacy-panel-empty">添加或选择一个文字图层后进行编辑。</p>}
            {selectedAnnotation && (
              <div className="privacy-text-controls">
                <label className="privacy-full">文字内容<textarea rows="3" value={selectedAnnotation.text} onChange={(event) => patchAnnotation(selectedAnnotation.id, { text: event.target.value }, "text-content")} /></label>
                <label className="privacy-full">字体
                  <select value={selectedAnnotation.fontFamily} onChange={(event) => selectFont(event.target.value)}>
                    {favoriteFonts.length > 0 && <optgroup label="收藏">{favoriteFonts.map((font) => <option key={`favorite-${font}`} value={font}>{font}</option>)}</optgroup>}
                    {fontGroups.map((group) => <optgroup key={group.id || group.label} label={group.label}>{group.fonts.map((font) => <option key={`${group.id}-${font}`} value={font}>{font}</option>)}</optgroup>)}
                  </select>
                </label>
                <label className="privacy-full">字重
                  <select value={selectedAnnotation.fontPostscriptName || selectedAnnotation.fontFace} onChange={(event) => selectFace(event.target.value)}>
                    {(fontEntry?.faces || []).map((face) => <option key={face.postscriptName} value={face.postscriptName}>{face.label || face.fullName}</option>)}
                  </select>
                </label>
                <RangeField label="大小" value={Math.round(selectedAnnotation.fontSize)} min={10} max={Math.max(120, Math.round(dimensions.width * 0.2))} onChange={(value) => patchAnnotation(selectedAnnotation.id, { fontSize: value }, "text-size")} />
                <RangeField label="字间距" value={selectedAnnotation.letterSpacing} min={-0.2} max={0.8} step={0.01} onChange={(value) => patchAnnotation(selectedAnnotation.id, { letterSpacing: value }, "text-spacing")} />
                <RangeField label="行间距" value={selectedAnnotation.lineSpacing} min={0.6} max={3} step={0.02} onChange={(value) => patchAnnotation(selectedAnnotation.id, { lineSpacing: value }, "text-line")} />
                <RangeField label="不透明度" value={Math.round(selectedAnnotation.opacity * 100)} min={0} max={100} suffix="%" onChange={(value) => patchAnnotation(selectedAnnotation.id, { opacity: value / 100 }, "text-opacity")} />
                <RangeField label="旋转" value={selectedAnnotation.rotation} min={-180} max={180} onChange={(value) => patchAnnotation(selectedAnnotation.id, { rotation: value }, "text-rotation")} />
                <label>文字颜色<input type="color" value={selectedAnnotation.color} onChange={(event) => patchAnnotation(selectedAnnotation.id, { color: event.target.value }, "text-color")} /></label>
                <label>描边颜色<input type="color" value={selectedAnnotation.strokeColor} onChange={(event) => patchAnnotation(selectedAnnotation.id, { strokeColor: event.target.value }, "text-stroke-color")} /></label>
                <RangeField label="描边" value={selectedAnnotation.strokeWidth} min={0} max={16} step={0.5} onChange={(value) => patchAnnotation(selectedAnnotation.id, { strokeWidth: value }, "text-stroke")} />
                <div className="privacy-segmented privacy-full">
                  {["left", "center", "right"].map((align) => <button key={align} className={selectedAnnotation.textAlign === align ? "active" : ""} type="button" onClick={() => patchAnnotation(selectedAnnotation.id, { textAlign: align }, "text-align")}>{align === "left" ? "左对齐" : align === "center" ? "居中" : "右对齐"}</button>)}
                </div>
                <label className="privacy-switch privacy-full"><input type="checkbox" checked={selectedAnnotation.shadowEnabled} onChange={(event) => patchAnnotation(selectedAnnotation.id, { shadowEnabled: event.target.checked }, "text-shadow")} />阴影</label>
                {selectedAnnotation.shadowEnabled && <>
                  <label>阴影颜色<input type="color" value={selectedAnnotation.shadowColor} onChange={(event) => patchAnnotation(selectedAnnotation.id, { shadowColor: event.target.value }, "text-shadow-color")} /></label>
                  <RangeField label="阴影不透明度" value={Math.round(selectedAnnotation.shadowOpacity * 100)} min={0} max={100} suffix="%" onChange={(value) => patchAnnotation(selectedAnnotation.id, { shadowOpacity: value / 100 }, "text-shadow-opacity")} />
                  <RangeField label="阴影距离" value={selectedAnnotation.shadowOffset} min={0} max={40} onChange={(value) => patchAnnotation(selectedAnnotation.id, { shadowOffset: value }, "text-shadow-offset")} />
                  <RangeField label="阴影扩散" value={selectedAnnotation.shadowRadius} min={0} max={100} onChange={(value) => patchAnnotation(selectedAnnotation.id, { shadowRadius: value }, "text-shadow-radius")} />
                  <RangeField label="阴影角度" value={selectedAnnotation.shadowAngle} min={-180} max={180} onChange={(value) => patchAnnotation(selectedAnnotation.id, { shadowAngle: value }, "text-shadow-angle")} />
                </>}
                <button className="privacy-delete-layer privacy-full" type="button" onClick={() => { remember("delete-text"); setAnnotations(annotations.filter((item) => item.id !== selectedAnnotation.id)); setSelectedAnnotationId(""); }}>删除文字图层</button>
              </div>
            )}
          </section>

          <section className="privacy-panel">
            <h2>水印预设</h2>
            <label className="privacy-full">这次导出使用
              <select value={watermarkPresetId} onChange={(event) => setWatermarkPresetId(event.target.value)}>
                <option value="">不使用水印</option>
                {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
            </label>
            <button className="privacy-open-watermark" type="button" onClick={() => host?.openWatermarkEditor?.()}>前往水印编辑器</button>
          </section>

          <div ref={quickExportRef} className="privacy-quick-export-host" />
        </aside>
      </div>
    </div>
  );
}
