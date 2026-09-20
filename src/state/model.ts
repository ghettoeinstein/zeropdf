import type { PDFDocumentProxy } from "pdfjs-dist";
export type Tool =
  | "select"
  | "text"
  | "draw"
  | "highlight"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "whiteout"
  | "image"
  | "sign";
export type Point = { x: number; y: number };
export type Mark = {
  id: string;
  type: Tool;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fill: string;
  stroke: number;
  opacity: number;
  text?: string;
  font?: "Helvetica" | "Times-Roman" | "Courier";
  fontSize?: number;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  rotation?: number;
  points?: Point[];
  image?: string;
};
export type Widget = {
  id: string;
  name: string;
  kind: "text" | "checkbox" | "radio" | "dropdown" | "list";
  x: number;
  y: number;
  width: number;
  height: number;
  options?: { value: string; label: string }[];
  buttonValue?: string;
  readOnly?: boolean;
  multiSelect?: boolean;
  multiline?: boolean;
  maxLength?: number;
};
export type Page = {
  id: string;
  sourceId: string;
  index: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  rotation: number;
  marks: Mark[];
  widgets: Widget[];
};
export type FormValue = string | boolean | string[];
export type Snapshot = { pages: Page[]; forms: Record<string, FormValue> };
export type Source = {
  id: string;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
  name: string;
};
export type History = {
  past: Snapshot[];
  present: Snapshot;
  future: Snapshot[];
};
export const empty: Snapshot = { pages: [], forms: {} };
export const uid = () => crypto.randomUUID();
export const fieldKey = (sourceId: string, name: string) =>
  `${sourceId}::${name}`;
export function commit(history: History, next: Snapshot): History {
  return {
    past: [...history.past, history.present].slice(-80),
    present: next,
    future: [],
  };
}
export function undo(history: History): History {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past.at(-1)!,
    future: [history.present, ...history.future],
  };
}
export function redo(history: History): History {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
export function movePage(pages: Page[], from: number, to: number) {
  const next = [...pages];
  const [p] = next.splice(from, 1);
  if (p) next.splice(to, 0, p);
  return next;
}
export function outputName(name: string) {
  return `${name.replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_") || "document"}-edited.pdf`;
}
export function pdfPoint(
  page: Pick<Page, "height" | "originX" | "originY">,
  point: Point,
) {
  return { x: page.originX + point.x, y: page.originY + page.height - point.y };
}
export function textLines(
  mark: Mark,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of (mark.text || "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > mark.width) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}
