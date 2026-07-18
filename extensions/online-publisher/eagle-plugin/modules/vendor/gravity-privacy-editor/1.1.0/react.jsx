import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Check,
  Eye,
  EyeSlash,
  Selection,
  SquaresFour,
  X,
} from "@phosphor-icons/react";
import { privacyLayerHasMasks } from "./schema.js";
import {
  clampPrivacyRect,
  drawPrivacyEffect,
  movePrivacyRect,
  resizePrivacyRect,
} from "./renderer.js";
import "./privacy-editor.css";

function defaultSamples({ region }) {
  if (!region?.rect) return [];
  return [{ sourceRect: region.rect, destinationRect: region.rect }];
}

export const PrivacyCanvas = forwardRef(function PrivacyCanvas({
  targetRef,
  layer,
  contentKey,
  width = 430,
  height = 932,
  className = "gravity-privacy-canvas",
  captureSource,
  resolveRegions,
  resolveSamples = defaultSamples,
  subscribeLayout,
  refreshDelay = 48,
}, ref) {
  const canvasRef = useRef(null);
  const sourceRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const refreshRequestRef = useRef(0);
  const refreshTimerRef = useRef(null);
  const layerRef = useRef(layer);
  layerRef.current = layer;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const target = targetRef.current;
    const currentLayer = layerRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (
      !target
      || !sourceRef.current?.image
      || !currentLayer?.previewVisible
      || !privacyLayerHasMasks(currentLayer)
    ) return;
    const regions = resolveRegions?.({
      target,
      layer: currentLayer,
      source: sourceRef.current,
      width,
      height,
    }) || [];
    regions.forEach((region) => {
      const samples = resolveSamples?.({
        target,
        layer: currentLayer,
        region,
        source: sourceRef.current,
        width,
        height,
      }) || [];
      samples.forEach((sample) => {
        drawPrivacyEffect(context, sourceRef.current.image, {
          sourceRect: sample.sourceRect,
          destinationRect: sample.destinationRect,
          effectType: currentLayer.effectType,
          intensity: currentLayer.intensity,
          shape: region?.item?.shape || region?.shape || "rect",
        });
      });
    });
  }, [height, resolveRegions, resolveSamples, targetRef, width]);

  const refresh = useCallback(() => {
    refreshRequestRef.current += 1;
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const run = async () => {
      while (true) {
        const requestId = refreshRequestRef.current;
        const target = targetRef.current;
        const currentLayer = layerRef.current;
        if (!target || !currentLayer?.previewVisible || !privacyLayerHasMasks(currentLayer)) {
          sourceRef.current = null;
          draw();
          if (requestId === refreshRequestRef.current) break;
          continue;
        }
        const captured = await captureSource?.({
          target,
          layer: currentLayer,
          width,
          height,
        });
        if (requestId !== refreshRequestRef.current) continue;
        const image = captured?.image || captured;
        sourceRef.current = image
          ? { image, metadata: captured?.metadata || {} }
          : null;
        draw();
        break;
      }
    };
    const promise = run().finally(() => {
      if (refreshPromiseRef.current === promise) refreshPromiseRef.current = null;
    });
    refreshPromiseRef.current = promise;
    return promise;
  }, [captureSource, draw, height, targetRef, width]);

  const redraw = useCallback((nextLayer) => {
    if (nextLayer) layerRef.current = nextLayer;
    const currentLayer = layerRef.current;
    if (
      currentLayer?.previewVisible
      && privacyLayerHasMasks(currentLayer)
      && !sourceRef.current
    ) {
      refresh().catch(() => {});
      return;
    }
    draw();
  }, [draw, refresh]);

  useImperativeHandle(ref, () => ({ refresh, redraw }), [refresh, redraw]);

  const hasMasks = privacyLayerHasMasks(layer);
  useEffect(() => {
    if (!hasMasks || !layer?.previewVisible) {
      sourceRef.current = null;
      draw();
      return undefined;
    }
    const timer = window.setTimeout(() => refresh().catch(() => {}), 30);
    return () => window.clearTimeout(timer);
  }, [contentKey, draw, hasMasks, layer?.previewVisible, refresh]);

  useEffect(() => {
    draw();
  }, [draw, layer?.effectType, layer?.intensity, layer?.items, layer?.smartMasks]);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || !subscribeLayout) return undefined;
    return subscribeLayout({
      target,
      onChange: () => {
        draw();
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = window.setTimeout(() => refresh().catch(() => {}), refreshDelay);
      },
    });
  }, [draw, refresh, refreshDelay, subscribeLayout, targetRef]);

  useEffect(() => () => window.clearTimeout(refreshTimerRef.current), []);

  return <canvas ref={canvasRef} className={className} width={width} height={height} aria-hidden="true" />;
});

const DEFAULT_EDITOR_CLASSES = Object.freeze({
  overlay: "gravity-privacy-editor",
  region: "gravity-privacy-region",
  selected: "is-selected",
  smart: "is-smart",
  draft: "gravity-privacy-draft",
  resizeHandle: "gravity-privacy-resize-handle",
});

const RESIZE_HANDLES = Object.freeze([
  ["nw", "左上"],
  ["n", "上方"],
  ["ne", "右上"],
  ["e", "右侧"],
  ["se", "右下"],
  ["s", "下方"],
  ["sw", "左下"],
  ["w", "左侧"],
]);

function logicalPointFromClient(overlay, clientX, clientY, width, height) {
  const rect = overlay?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return {
    x: Math.max(0, Math.min(width, (clientX - rect.left) * (width / Math.max(1, rect.width)))),
    y: Math.max(0, Math.min(height, (clientY - rect.top) * (height / Math.max(1, rect.height)))),
  };
}

export function PrivacyEditor({
  targetRef,
  layer,
  tool,
  shape = "rect",
  selectedId,
  width = 430,
  height = 932,
  displayScale = 1,
  classNames = DEFAULT_EDITOR_CLASSES,
  resolveItemRect,
  resolveVisibleRect = ({ rect }) => rect,
  resolveSmartRegions = () => [],
  createItemFromRect = ({ rect }) => clampPrivacyRect(rect, { width, height }),
  resolveElementMask,
  subscribeLayout,
  onSelect,
  onAdd,
  onUpdate,
}) {
  const overlayRef = useRef(null);
  const manipulationRef = useRef(null);
  const manipulationConfigRef = useRef(null);
  const [draftRect, setDraftRect] = useState(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const classes = { ...DEFAULT_EDITOR_CLASSES, ...(classNames || {}) };
  manipulationConfigRef.current = {
    width,
    height,
    targetRef,
    createItemFromRect,
    onUpdate,
  };

  useEffect(() => {
    const target = targetRef.current;
    if (!target || !subscribeLayout) return undefined;
    return subscribeLayout({
      target,
      onChange: () => setLayoutVersion((value) => value + 1),
    });
  }, [subscribeLayout, targetRef]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        (event.key === "Delete" || event.key === "Backspace")
        && selectedId
        && !event.target.closest("input, textarea")
      ) {
        event.preventDefault();
        onUpdate(selectedId, null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onUpdate, selectedId]);

  useEffect(() => {
    const move = (event) => {
      const session = manipulationRef.current;
      const config = manipulationConfigRef.current;
      if (!session || !config || event.pointerId !== session.pointerId) return;
      if (event.cancelable) event.preventDefault();
      const point = logicalPointFromClient(
        overlayRef.current,
        event.clientX,
        event.clientY,
        config.width,
        config.height,
      );
      const deltaX = point.x - session.start.x;
      const deltaY = point.y - session.start.y;
      const nextRect = session.mode === "move"
        ? movePrivacyRect(session.rect, deltaX, deltaY, {
          width: config.width,
          height: config.height,
        })
        : resizePrivacyRect(session.rect, session.mode, deltaX, deltaY, {
          width: config.width,
          height: config.height,
          minSize: 12,
        });
      config.onUpdate(session.item.id, config.createItemFromRect({
        target: config.targetRef.current,
        rect: nextRect,
        preferredItem: session.item,
      }));
    };

    const finish = (event) => {
      const session = manipulationRef.current;
      if (!session) return;
      if ("pointerId" in event && event.pointerId !== session.pointerId) return;
      manipulationRef.current = null;
      if (session.captureTarget?.hasPointerCapture?.(session.pointerId)) {
        session.captureTarget.releasePointerCapture(session.pointerId);
      }
    };

    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
    window.addEventListener("blur", finish);
    return () => {
      manipulationRef.current = null;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", finish, true);
      window.removeEventListener("blur", finish);
    };
  }, []);

  const pointFromEvent = (event) => {
    return logicalPointFromClient(overlayRef.current, event.clientX, event.clientY, width, height);
  };

  const beginDrawing = (event) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    const target = targetRef.current;
    if (tool === "element") {
      const item = resolveElementMask?.({
        target,
        clientX: event.clientX,
        clientY: event.clientY,
        overlay: overlayRef.current,
      });
      if (item) onAdd(item);
      return;
    }
    if (tool !== "draw") {
      onSelect("");
      return;
    }
    const start = pointFromEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraftRect({
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
      startX: start.x,
      startY: start.y,
    });
  };

  const moveDrawing = (event) => {
    if (!draftRect) return;
    const point = pointFromEvent(event);
    setDraftRect((current) => ({
      ...current,
      x: Math.min(current.startX, point.x),
      y: Math.min(current.startY, point.y),
      width: Math.abs(point.x - current.startX),
      height: Math.abs(point.y - current.startY),
    }));
  };

  const finishDrawing = (event) => {
    if (!draftRect) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (draftRect.width >= 8 && draftRect.height >= 8) {
      onAdd(createItemFromRect({ target: targetRef.current, rect: draftRect, shape }));
    }
    setDraftRect(null);
  };

  const beginManipulation = (event, item, mode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    onSelect(item.id);
    const start = pointFromEvent(event);
    const rect = resolveItemRect?.({ target: targetRef.current, item });
    if (!rect) return;
    const captureTarget = overlayRef.current;
    try {
      captureTarget?.setPointerCapture(event.pointerId);
    } catch {
      // Window-level listeners still keep the manipulation active in older Electron builds.
    }
    manipulationRef.current = {
      pointerId: event.pointerId,
      captureTarget,
      item,
      mode,
      rect,
      start,
    };
  };

  const target = targetRef.current;
  return (
    <div
      ref={overlayRef}
      className={`${classes.overlay} is-${tool}`}
      onPointerDown={beginDrawing}
      onPointerMove={moveDrawing}
      onPointerUp={finishDrawing}
      onPointerCancel={finishDrawing}
    >
      {(layer?.items || []).map((item) => {
        const rect = resolveItemRect?.({ target, item });
        const visibleRect = resolveVisibleRect({ target, rect, item });
        if (!rect || !visibleRect) return null;
        return (
          <div
            key={`${item.id}-${layoutVersion}`}
            className={`${classes.region} ${item.shape === "ellipse" ? "is-ellipse" : "is-rect"} ${selectedId === item.id ? classes.selected : ""}`}
            style={{
              left: visibleRect.x,
              top: visibleRect.y,
              width: visibleRect.width,
              height: visibleRect.height,
              "--gravity-privacy-handle-size": `${12 / Math.max(0.05, Number(displayScale) || 1)}px`,
              "--gravity-privacy-handle-border": `${2 / Math.max(0.05, Number(displayScale) || 1)}px`,
            }}
            onPointerDown={(event) => beginManipulation(event, item, "move")}
          >
            {RESIZE_HANDLES.map(([direction, label]) => (
              <button
                key={direction}
                className={`${classes.resizeHandle} is-${direction}`}
                type="button"
                aria-label={`从${label}调整隐私区域大小`}
                onPointerDown={(event) => beginManipulation(event, item, direction)}
              />
            ))}
          </div>
        );
      })}
      {(resolveSmartRegions({ target, layer }) || []).map((region) => {
        const visibleRect = resolveVisibleRect({ target, rect: region.rect, region });
        if (!visibleRect) return null;
        return (
          <div
            key={`${region.id}-${layoutVersion}`}
            className={`${classes.region} ${classes.smart}`}
            style={{
              left: visibleRect.x,
              top: visibleRect.y,
              width: visibleRect.width,
              height: visibleRect.height,
            }}
            aria-label={region.label}
          />
        );
      })}
      {draftRect && (
        <div
          className={`${classes.draft} ${shape === "ellipse" ? "is-ellipse" : "is-rect"}`}
          style={{
            left: draftRect.x,
            top: draftRect.y,
            width: draftRect.width,
            height: draftRect.height,
          }}
        />
      )}
    </div>
  );
}

const DEFAULT_PANEL_CLASSES = Object.freeze({
  inner: "gravity-privacy-panel-inner",
  heading: "gravity-privacy-panel-heading",
  section: "gravity-privacy-panel-section",
  toolGroup: "gravity-privacy-tool-group",
  intensity: "gravity-privacy-intensity",
  smartGroup: "gravity-privacy-smart-group",
  check: "gravity-privacy-check",
  layerActions: "gravity-privacy-layer-actions",
  danger: "danger",
  active: "is-active",
});

export function PrivacyControlPanel({
  layer,
  tool,
  title = "隐私打码",
  subtitle = "预览即导出",
  smartOptions = [],
  selectedId,
  classNames = DEFAULT_PANEL_CLASSES,
  onClose,
  onToolChange,
  onEffectChange,
  onIntensityChange,
  onSmartToggle,
  onPreviewToggle,
  onDeleteSelected,
  onClear,
}) {
  const classes = { ...DEFAULT_PANEL_CLASSES, ...(classNames || {}) };
  const hasMasks = privacyLayerHasMasks(layer);
  return (
    <div className={classes.inner}>
      <div className={classes.heading}>
        <span><strong>{title}</strong><small>{subtitle}</small></span>
        <button type="button" aria-label="关闭隐私打码面板" onClick={onClose}><X size={15} /></button>
      </div>

      <section className={classes.section}>
        <label>选择方式</label>
        <div className={classes.toolGroup}>
          <button className={tool === "draw" ? classes.active : ""} type="button" onClick={() => onToolChange?.("draw")}><Selection size={16} />框选</button>
          <button className={tool === "element" ? classes.active : ""} type="button" onClick={() => onToolChange?.("element")}><SquaresFour size={16} />点选元素</button>
        </div>
      </section>

      <section className={classes.section}>
        <label>显示效果</label>
        <div className={classes.toolGroup}>
          <button className={layer?.effectType === "blur" ? classes.active : ""} type="button" onClick={() => onEffectChange?.("blur")}>模糊</button>
          <button className={layer?.effectType === "pixelate" ? classes.active : ""} type="button" onClick={() => onEffectChange?.("pixelate")}>马赛克</button>
        </div>
        <label className={classes.intensity}>
          <span>强度</span>
          <b>{layer?.intensity ?? 12}</b>
          <input type="range" min="2" max="24" step="1" value={layer?.intensity ?? 12} onInput={(event) => onIntensityChange?.(Number(event.currentTarget.value))} />
        </label>
      </section>

      {smartOptions.length > 0 && (
        <section className={classes.section}>
          <label>智能打码</label>
          <div className={classes.smartGroup}>
            {smartOptions.map(({ key, label }) => {
              const active = Boolean(layer?.smartMasks?.[key]);
              return (
                <button
                  key={key}
                  className={active ? classes.active : ""}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  onClick={() => onSmartToggle?.(key)}
                >
                  <span className={classes.check}>{active && <Check size={11} weight="bold" />}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className={`${classes.section} ${classes.layerActions}`}>
        <label>图层</label>
        <button
          className={layer?.previewVisible ? classes.active : ""}
          type="button"
          onClick={onPreviewToggle}
        >
          {layer?.previewVisible ? <Eye size={16} /> : <EyeSlash size={16} />}
          {layer?.previewVisible ? "预览显示" : "预览隐藏"}
        </button>
        <button type="button" disabled={!selectedId} onClick={onDeleteSelected}><TrashIcon />删除所选</button>
        <button className={classes.danger} type="button" disabled={!hasMasks} onClick={onClear}><TrashIcon />清除全部</button>
      </section>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 4.5h9M6 2.75h4M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
