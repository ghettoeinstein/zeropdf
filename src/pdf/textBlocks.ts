import type { PDFPageProxy } from "pdfjs-dist";
import { Util } from "pdfjs-dist";

export type TextBlock = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  bold: boolean;
};

// Generous on purpose: real headings often use letter-tracking or
// center-justified word spacing wider than a plain space character, and
// under-merging (splitting one line into several disconnected edit
// targets) is a much worse experience than occasionally over-merging.
// Multi-column layouts (e.g. a row of stat tiles) are still reliably
// separated by gaps several times larger than this.
const GAP_FACTOR = 1.1;
const BASELINE_TOLERANCE = 3;

/**
 * Extracts text runs in the same top-left-origin, unscaled-page-unit space
 * that annotation Marks already use (matches the SVG viewBox in PageView),
 * then merges adjacent runs on the same baseline into editable line blocks —
 * PDF text streams routinely split a line into many small positioned runs.
 */
export async function extractTextBlocks(
  page: PDFPageProxy,
): Promise<TextBlock[]> {
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  const content = await page.getTextContent();
  type Run = {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    bold: boolean;
  };
  const runs: Run[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const tx = Util.transform(viewport.transform, item.transform);
    const fontSize = Math.hypot(tx[0], tx[1]);
    if (!fontSize) continue;
    const width = item.width * Math.hypot(viewport.transform[0], viewport.transform[1]);
    runs.push({
      text: item.str,
      x: tx[4],
      y: tx[5] - fontSize,
      width,
      height: fontSize * 1.15,
      fontSize,
      bold: /bold/i.test(item.fontName || ""),
    });
  }
  runs.sort((a, b) => a.y - b.y || a.x - b.x);
  const blocks: TextBlock[] = [];
  let current: Run | null = null;
  for (const run of runs) {
    if (
      current &&
      Math.abs(run.y - current.y) <= BASELINE_TOLERANCE &&
      run.x - (current.x + current.width) <= current.fontSize * GAP_FACTOR
    ) {
      const needsSpace =
        run.x - (current.x + current.width) > current.fontSize * 0.08;
      current.text += (needsSpace ? " " : "") + run.text;
      current.width = run.x + run.width - current.x;
      current.height = Math.max(current.height, run.height);
      current.fontSize = Math.max(current.fontSize, run.fontSize);
      continue;
    }
    if (current) blocks.push({ ...current, id: "" });
    current = { ...run };
  }
  if (current) blocks.push({ ...current, id: "" });
  return blocks.map((b, i) => ({ ...b, id: `text-${i}` }));
}
