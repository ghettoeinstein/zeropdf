import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  fieldKey,
  uid,
  type Mark,
  type Page,
  type Point,
  type FormValue,
  type Tool,
} from "../state/model";
import { extractTextBlocks, type TextBlock } from "../pdf/textBlocks";

let measureCtx: CanvasRenderingContext2D | null = null;
function measureWidth(text: string, fontSize: number) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * fontSize * 0.6;
  measureCtx.font = `${fontSize}px Arial, sans-serif`;
  return measureCtx.measureText(text || " ").width;
}

export function PdfCanvas({
  pdf,
  index,
  width,
  thumbnail = false,
  onCanvasReady,
}: {
  pdf: PDFDocumentProxy;
  index: number;
  width: number;
  thumbnail?: boolean;
  onCanvasReady?: (el: HTMLCanvasElement | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: thumbnail ? "150px" : "600px" },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [pdf, index, thumbnail]);
  useEffect(() => {
    let disposed = false;
    let task: RenderTask | undefined;
    const el = canvas.current;
    if (!visible || !el) return;
    const myGeneration = ++generation.current;
    const render = async () => {
      try {
        const page = await pdf.getPage(index + 1);
        if (disposed) return;
        const base = page.getViewport({ scale: 1, rotation: 0 });
        const scale =
          (width / base.width) * Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({
          scale: Math.min(scale, 4096 / Math.max(base.width, base.height)),
          rotation: 0,
        });
        el.width = viewport.width;
        el.height = viewport.height;
        const ctx = el.getContext("2d");
        if (!ctx) return;
        task = page.render({
          canvasContext: ctx,
          canvas: el,
          viewport,
          annotationMode: 0,
        });
        await task.promise;
      } catch (e) {
        if (
          !disposed &&
          !(e instanceof Error && e.name === "RenderingCancelledException")
        )
          setError("Unable to render this page.");
      }
    };
    void render();
    return () => {
      disposed = true;
      task?.cancel();
      const clear = () => {
        // A newer render may already own this canvas — never touch its
        // dimensions once a later generation has started.
        if (generation.current !== myGeneration) return;
        el.width = 0;
        el.height = 0;
      };
      if (task) void task.promise.catch(() => {}).finally(clear);
      else clear();
    };
  }, [pdf, index, width, visible]);
  return (
    <div ref={host} className="pdf-canvas">
      {error ? (
        <span className="render-error">{error}</span>
      ) : (
        <canvas
          ref={(el) => {
            canvas.current = el;
            onCanvasReady?.(el);
          }}
          aria-label={`PDF page ${index + 1}`}
        />
      )}
    </div>
  );
}
const families = {
  Helvetica: "Arial, sans-serif",
  "Times-Roman": "Times New Roman, serif",
  Courier: "Courier New, monospace",
};
export function MarkGraphic({ mark }: { mark: Mark }) {
  return (
    <g
      transform={`rotate(${mark.rotation || 0} ${mark.x + mark.width / 2} ${mark.y + mark.height / 2})`}
    >
      <MarkContent mark={mark} />
    </g>
  );
}
function MarkContent({ mark: m }: { mark: Mark }) {
  if (m.type === "text")
    return (
      <>
        {m.patchColor && (
          <rect
            x={m.x}
            y={m.y}
            width={Math.max(m.width, 1)}
            height={Math.max(m.height, 1)}
            fill={m.patchColor}
            opacity={m.opacity}
          />
        )}
        <foreignObject
          x={m.x}
          y={m.y}
          width={Math.max(m.width, 1)}
          height={Math.max(m.height, 1)}
        >
          <div
            style={{
              fontFamily: families[m.font || "Helvetica"],
              fontSize: m.fontSize || 16,
              lineHeight: m.lineHeight || 1.3,
              color: m.color,
              textAlign: m.align || "left",
              whiteSpace: "pre-wrap",
              overflowWrap: "normal",
              opacity: m.opacity,
              pointerEvents: "none",
            }}
          >
            {m.text}
          </div>
        </foreignObject>
      </>
    );
  if (m.image)
    return (
      <image
        href={m.image}
        x={m.x}
        y={m.y}
        width={m.width}
        height={m.height}
        preserveAspectRatio="none"
        opacity={m.opacity}
      />
    );
  if (m.points)
    return (
      <polyline
        points={m.points.map((p) => `${p.x + m.x},${p.y + m.y}`).join(" ")}
        stroke={m.color}
        strokeWidth={m.stroke}
        fill="none"
        opacity={m.opacity}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  if (m.type === "line" || m.type === "arrow") {
    const a = Math.atan2(m.height, m.width),
      l = Math.max(10, m.stroke * 4);
    return (
      <g
        stroke={m.color}
        strokeWidth={m.stroke}
        opacity={m.opacity}
        fill="none"
      >
        <line x1={m.x} y1={m.y} x2={m.x + m.width} y2={m.y + m.height} />
        {m.type === "arrow" && (
          <path
            d={`M ${m.x + m.width - l * Math.cos(a - 0.45)} ${m.y + m.height - l * Math.sin(a - 0.45)} L ${m.x + m.width} ${m.y + m.height} L ${m.x + m.width - l * Math.cos(a + 0.45)} ${m.y + m.height - l * Math.sin(a + 0.45)}`}
          />
        )}
      </g>
    );
  }
  if (m.type === "ellipse")
    return (
      <ellipse
        cx={m.x + m.width / 2}
        cy={m.y + m.height / 2}
        rx={m.width / 2}
        ry={m.height / 2}
        fill={m.fill}
        stroke={m.color}
        strokeWidth={m.stroke}
        opacity={m.opacity}
      />
    );
  return (
    <rect
      x={m.x}
      y={m.y}
      width={Math.max(0, m.width)}
      height={Math.max(0, m.height)}
      fill={m.type === "whiteout" ? "white" : m.fill}
      stroke={m.type === "whiteout" ? "none" : m.color}
      strokeWidth={m.stroke}
      opacity={m.opacity}
    />
  );
}

type Props = {
  page: Page;
  pdf: PDFDocumentProxy;
  scale: number;
  tool: Tool;
  color: string;
  stroke: number;
  selection: string | null;
  forms: Record<string, FormValue>;
  onSelect: (id: string | null) => void;
  onAdd: (mark: Mark) => void;
  onUpdate: (mark: Mark) => void;
  onForm: (key: string, value: FormValue) => void;
  onActive: () => void;
  onPlaceAsset: (point: Point) => void;
  onNotice?: (message: string) => void;
  disabled: boolean;
};
export default function PageView({
  page,
  pdf,
  scale,
  tool,
  color,
  stroke,
  selection,
  forms,
  onSelect,
  onAdd,
  onUpdate,
  onForm,
  onActive,
  onPlaceAsset,
  onNotice,
  disabled,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [editing, setEditing] = useState<{
    block: TextBlock;
    value: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTextBlocks([]);
    setEditing(null);
    pdf
      .getPage(page.index + 1)
      .then((p) => extractTextBlocks(p))
      .then((blocks) => {
        if (!cancelled) setTextBlocks(blocks);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdf, page.index, page.sourceId]);
  const sampleColor = (block: TextBlock) => {
    const el = canvasEl.current;
    if (!el || !el.width || !el.height) return "#ffffff";
    const ctx = el.getContext("2d");
    if (!ctx) return "#ffffff";
    const sx = el.width / page.width,
      sy = el.height / page.height;
    const px = Math.min(
      el.width - 1,
      Math.max(0, Math.round((block.x - 2) * sx)),
    );
    const py = Math.min(
      el.height - 1,
      Math.max(0, Math.round((block.y + block.height / 2) * sy)),
    );
    try {
      const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
      return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    } catch {
      return "#ffffff";
    }
  };
  const commitEdit = () => {
    if (!editing) return;
    const { block, value } = editing;
    setEditing(null);
    if (value === block.text) return;
    const lines = value.split("\n");
    const widestLine = Math.max(
      ...lines.map((l) => measureWidth(l, block.fontSize)),
    );
    const width = Math.max(block.width, widestLine * 1.08, 6);
    const height = block.height * Math.max(1, lines.length) + 2;
    const bg = sampleColor(block);
    const r = parseInt(bg.slice(1, 3), 16),
      g = parseInt(bg.slice(3, 5), 16),
      b = parseInt(bg.slice(5, 7), 16);
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const id = uid();
    onAdd({
      id,
      type: "text",
      x: block.x - 1,
      y: block.y - 1,
      width: width + 2,
      height,
      color: luminance < 130 ? "#ffffff" : "#000000",
      fill: "none",
      stroke: 0,
      opacity: 1,
      text: value,
      font: "Helvetica",
      fontSize: block.fontSize,
      align: "left",
      lineHeight: 1.2,
      patchColor: bg,
    });
    onSelect(id);
    onNotice?.(
      "Text visually replaced with a substituted font. The original text may still be recoverable from this file — this isn't secure redaction. Drag to move, or use the corner handle to resize.",
    );
  };
  const isEdited = (block: TextBlock) =>
    page.marks.some(
      (m) =>
        m.type === "text" &&
        m.patchColor &&
        Math.abs(m.x - (block.x - 1)) < 3 &&
        Math.abs(m.y - (block.y - 1)) < 3,
    );
  const [draft, setDraft] = useState<Mark | null>(null);
  const gesture = useRef<{
    start: Point;
    mark: Mark;
    mode: "new" | "move" | "resize";
  } | null>(null);
  const rotated = page.rotation % 180 !== 0;
  const width = page.width * scale,
    height = page.height * scale;
  const pointer = (event: React.PointerEvent): Point => {
    const matrix = svg.current!.getScreenCTM()!;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    return {
      x: Math.max(0, Math.min(page.width, p.x)),
      y: Math.max(0, Math.min(page.height, p.y)),
    };
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled || e.button !== 0) return;
    onActive();
    const p = pointer(e);
    const target = e.target as SVGElement;
    const id = target.closest("[data-mark]")?.getAttribute("data-mark");
    if (tool === "select") {
      const mark = page.marks.find((m) => m.id === id);
      onSelect(mark?.id || null);
      if (mark) {
        gesture.current = {
          start: p,
          mark,
          mode: target.getAttribute("data-resize") ? "resize" : "move",
        };
        setDraft(mark);
      }
    } else if (tool === "text") {
      onAdd({
        id: uid(),
        type: "text",
        ...p,
        width: Math.min(220, page.width - p.x),
        height: 70,
        color,
        fill: "none",
        stroke,
        opacity: 1,
        text: "Your text",
        font: "Helvetica",
        fontSize: 16,
        align: "left",
        lineHeight: 1.3,
      });
      return;
    } else if (tool === "image" || tool === "sign") {
      onPlaceAsset(p);
      return;
    } else {
      const mark: Mark = {
        id: uid(),
        type: tool,
        ...p,
        width: 1,
        height: 1,
        color,
        fill: "none",
        stroke: tool === "highlight" ? Math.max(14, stroke * 5) : stroke,
        opacity: tool === "highlight" ? 0.3 : 1,
        ...(tool === "draw" || tool === "highlight"
          ? { points: [{ x: 0, y: 0 }] }
          : {}),
      };
      gesture.current = { start: p, mark, mode: "new" };
      setDraft(mark);
      onSelect(null);
    }
    if (gesture.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g) return;
    const p = pointer(e),
      dx = p.x - g.start.x,
      dy = p.y - g.start.y;
    if (g.mode === "move")
      setDraft({
        ...g.mark,
        x: Math.max(0, Math.min(page.width - g.mark.width, g.mark.x + dx)),
        y: Math.max(0, Math.min(page.height - g.mark.height, g.mark.y + dy)),
      });
    else if (g.mode === "resize") {
      const w = Math.max(12, g.mark.width + dx),
        h = Math.max(12, g.mark.height + dy);
      setDraft({
        ...g.mark,
        width: w,
        height: h,
        points: g.mark.points?.map((pt) => ({
          x: (pt.x * w) / g.mark.width,
          y: (pt.y * h) / g.mark.height,
        })),
      });
    } else if (g.mark.points)
      setDraft((current) => {
        if (!current) return null;
        const point = { x: p.x - g.mark.x, y: p.y - g.mark.y };
        const last = current.points!.at(-1)!;
        return Math.hypot(point.x - last.x, point.y - last.y) < 1
          ? current
          : { ...current, points: [...current.points!, point] };
      });
    else if (g.mark.type === "line" || g.mark.type === "arrow")
      setDraft({ ...g.mark, width: dx, height: dy });
    else
      setDraft({
        ...g.mark,
        x: Math.min(p.x, g.start.x),
        y: Math.min(p.y, g.start.y),
        width: Math.abs(dx),
        height: Math.abs(dy),
      });
  };
  const up = () => {
    const g = gesture.current;
    if (!g || !draft) {
      gesture.current = null;
      return;
    }
    let mark = draft;
    if (g.mode === "new" && mark.points) {
      const xs = mark.points.map((p) => p.x),
        ys = mark.points.map((p) => p.y);
      const minX = Math.min(...xs),
        minY = Math.min(...ys);
      mark = {
        ...mark,
        x: mark.x + minX,
        y: mark.y + minY,
        width: Math.max(1, Math.max(...xs) - minX),
        height: Math.max(1, Math.max(...ys) - minY),
        points: mark.points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      };
    }
    if (g.mode === "new") {
      if (
        mark.points
          ? mark.points.length > 1
          : Math.abs(mark.width) + Math.abs(mark.height) > 6
      )
        onAdd(mark);
    } else onUpdate(mark);
    gesture.current = null;
    setDraft(null);
  };
  const marks = page.marks.map((m) => (draft?.id === m.id ? draft : m));
  const selected = marks.find((m) => m.id === selection);
  return (
    <div
      className="page-size"
      style={{
        width: rotated ? height : width,
        height: rotated ? width : height,
      }}
    >
      <div
        className="page-sheet"
        style={{
          width,
          height,
          transform: `translate(-50%, -50%) rotate(${page.rotation}deg)`,
        }}
      >
        <PdfCanvas
          pdf={pdf}
          index={page.index}
          width={width}
          onCanvasReady={(el) => {
            canvasEl.current = el;
          }}
        />
        <svg
          ref={svg}
          className={`annotation-layer tool-${tool}`}
          viewBox={`0 0 ${page.width} ${page.height}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            gesture.current = null;
            setDraft(null);
          }}
          aria-label="Document editing surface"
        >
          {marks.map((m) => (
            <g
              key={m.id}
              data-mark={m.id}
              style={{ cursor: tool === "select" ? "move" : undefined }}
            >
              <MarkGraphic mark={m} />
              <rect
                x={Math.min(m.x, m.x + m.width) - 3}
                y={Math.min(m.y, m.y + m.height) - 3}
                width={Math.abs(m.width) + 6}
                height={Math.abs(m.height) + 6}
                fill="transparent"
              />
            </g>
          ))}
          {draft && gesture.current?.mode === "new" && (
            <MarkGraphic mark={draft} />
          )}
          {selected && tool === "select" && (
            <g data-mark={selected.id}>
              <rect
                x={Math.min(selected.x, selected.x + selected.width) - 3}
                y={Math.min(selected.y, selected.y + selected.height) - 3}
                width={Math.abs(selected.width) + 6}
                height={Math.abs(selected.height) + 6}
                fill="none"
                stroke="#547b22"
                strokeWidth={1.5 / scale}
                strokeDasharray={`${4 / scale} ${3 / scale}`}
              />
              <rect
                data-resize="true"
                x={selected.x + selected.width - 5 / scale}
                y={selected.y + selected.height - 5 / scale}
                width={10 / scale}
                height={10 / scale}
                fill="#d7fc70"
                stroke="#547b22"
                strokeWidth={1 / scale}
                style={{ cursor: "nwse-resize" }}
              />
            </g>
          )}
        </svg>
        {page.widgets.map((w) => {
          const key = fieldKey(page.sourceId, w.name),
            value = forms[key];
          const style: React.CSSProperties = {
            left: `${(w.x / page.width) * 100}%`,
            top: `${(w.y / page.height) * 100}%`,
            width: `${(w.width / page.width) * 100}%`,
            height: `${(w.height / page.height) * 100}%`,
            fontSize: Math.max(9, Math.min(14, w.height * 0.6)) * scale,
            pointerEvents: tool === "select" && !disabled ? "auto" : "none",
          };
          const common = {
            className: "form-widget",
            style,
            "aria-label": w.name,
            disabled: w.readOnly || disabled,
            onFocus: onActive,
          };
          if (w.kind === "checkbox" || w.kind === "radio")
            return (
              <input
                key={w.id}
                {...common}
                type={w.kind}
                name={key}
                checked={
                  w.kind === "checkbox" ? !!value : value === w.buttonValue
                }
                onChange={(e) =>
                  onForm(
                    key,
                    w.kind === "checkbox"
                      ? e.target.checked
                      : w.buttonValue || "",
                  )
                }
              />
            );
          if (w.kind === "dropdown" || w.kind === "list")
            return (
              <select
                key={w.id}
                {...common}
                multiple={w.multiSelect}
                size={
                  w.kind === "list"
                    ? Math.max(2, Math.floor(w.height / 18))
                    : undefined
                }
                value={
                  w.multiSelect
                    ? Array.isArray(value)
                      ? value
                      : []
                    : Array.isArray(value)
                      ? value[0] || ""
                      : String(value || "")
                }
                onChange={(e) =>
                  onForm(
                    key,
                    Array.from(e.target.selectedOptions).map((o) => o.value),
                  )
                }
              >
                <option value="">Select…</option>
                {w.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          return w.multiline ? (
            <textarea
              key={w.id}
              {...common}
              value={String(value || "")}
              maxLength={w.maxLength || undefined}
              onChange={(e) => onForm(key, e.target.value)}
            />
          ) : (
            <input
              key={w.id}
              {...common}
              value={String(value || "")}
              maxLength={w.maxLength || undefined}
              onChange={(e) => onForm(key, e.target.value)}
            />
          );
        })}
        {tool === "select" &&
          !disabled &&
          textBlocks
            .filter(
              (block) => editing?.block.id === block.id || !isEdited(block),
            )
            .map((block) => {
            const style: React.CSSProperties = {
              left: `${(block.x / page.width) * 100}%`,
              top: `${(block.y / page.height) * 100}%`,
              width: `${(block.width / page.width) * 100}%`,
              height: `${(block.height / page.height) * 100}%`,
              fontSize: block.fontSize * scale,
            };
            if (editing?.block.id === block.id) {
              const lines = editing.value.split("\n");
              const widestLine = Math.max(
                block.width,
                ...lines.map((l) => measureWidth(l, block.fontSize) * 1.15),
              );
              const growStyle: React.CSSProperties = {
                ...style,
                left: `${(block.x / page.width) * 100}%`,
                width: `${(widestLine / page.width) * 100}%`,
                height: `${((block.height * Math.max(1, lines.length)) / page.height) * 100}%`,
              };
              return (
                <textarea
                  key={block.id}
                  className="text-edit-input"
                  style={growStyle}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  value={editing.value}
                  onChange={(e) =>
                    setEditing({ block, value: e.target.value })
                  }
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setEditing(null);
                    }
                  }}
                />
              );
            }
            return (
              <button
                key={block.id}
                type="button"
                className="text-edit-hit"
                style={style}
                title="Click to edit this text"
                onClick={() => setEditing({ block, value: block.text })}
              />
            );
          })}
      </div>
    </div>
  );
}
