import { describe, expect, it } from "vitest";
import {
  commit,
  empty,
  movePage,
  outputName,
  pdfPoint,
  redo,
  textLines,
  undo,
  type History,
  type Page,
  type Mark,
} from "./model";
describe("document editing state", () => {
  it("undoes and redoes edits without changing the original snapshot", () => {
    const initial: History = { past: [], present: empty, future: [] };
    const next = commit(initial, { pages: [], forms: { name: "Ada" } });
    expect(initial.present.forms).toEqual({});
    expect(undo(next).present).toBe(empty);
    expect(redo(undo(next)).present.forms.name).toBe("Ada");
    expect(
      commit(undo(next), { pages: [], forms: { name: "Grace" } }).future,
    ).toEqual([]);
  });
  it("reorders pages without mutating the original array", () => {
    const pages = [{ id: "a" }, { id: "b" }, { id: "c" }] as Page[];
    expect(movePage(pages, 0, 2).map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(pages.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  it("converts top-left document points to PDF crop-box coordinates", () => {
    expect(
      pdfPoint({ height: 700, originX: 30, originY: 40 }, { x: 100, y: 150 }),
    ).toEqual({ x: 130, y: 590 });
  });
  it("uses safe predictable download names", () => {
    expect(outputName("Lease.PDF")).toBe("Lease-edited.pdf");
    expect(outputName("../a:b.pdf")).toBe(".._a_b-edited.pdf");
    expect(outputName(".pdf")).toBe("document-edited.pdf");
  });
  it("preserves line breaks and wraps words", () => {
    expect(
      textLines(
        { text: "one two three\nfour", width: 7 } as Mark,
        (t) => t.length,
      ),
    ).toEqual(["one two", "three", "four"]);
  });
});
