import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractTextBlocks } from "./textBlocks";

async function loadFirstPage(bytes: Uint8Array) {
  const pdf = await getDocument({ data: bytes }).promise;
  return pdf.getPage(1);
}

describe("extractTextBlocks", () => {
  it("merges a heading split into multiple runs by wide word-tracking into one editable block", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const size = 24;
    // Simulates a design tool exporting a centered/tracked heading as
    // separate text-show operators per word, with a gap wider than one
    // plain space — exactly what produced the "STATEMENT OF" /
    // "CAPABILITIES" split reported against a real exported PDF.
    const first = "STATEMENT OF";
    const gap = font.widthOfTextAtSize(" ", size) * 3.5;
    page.drawText(first, { x: 40, y: 120, font, size });
    const secondX = 40 + font.widthOfTextAtSize(first, size) + gap;
    page.drawText("CAPABILITIES", { x: secondX, y: 120, font, size });

    const bytes = await doc.save();
    const pdfPage = await loadFirstPage(bytes);
    const blocks = await extractTextBlocks(pdfPage);

    const merged = blocks.find((b) => b.text.includes("CAPABILITIES"));
    expect(merged?.text).toBe("STATEMENT OF CAPABILITIES");
    expect(blocks).toHaveLength(1);
  });

  it("does not merge clearly separate columns on the same baseline", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([700, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const size = 20;
    // A row of stat tiles, e.g. "10+", "26/26", "40%" — separated by a
    // real column gap, much wider than word-tracking. These must stay
    // as independent edit targets.
    page.drawText("10+", { x: 40, y: 100, font, size });
    page.drawText("26/26", { x: 220, y: 100, font, size });
    page.drawText("40%", { x: 400, y: 100, font, size });

    const bytes = await doc.save();
    const pdfPage = await loadFirstPage(bytes);
    const blocks = await extractTextBlocks(pdfPage);

    expect(blocks.map((b) => b.text)).toEqual(["10+", "26/26", "40%"]);
  });
});
