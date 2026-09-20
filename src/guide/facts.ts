import type { Page, Snapshot, Source } from "../state/model";

/**
 * Deterministic, locally-observed facts about the open document.
 * Every field here must be computable from data ZeroPDF already has —
 * no inference, no guessing. See docs/PRD_ZEROGUIDE.md.
 */
export type DocumentFacts = {
  pageCount: number;
  pagesWithNoExtractableText: number[];
  formFieldCount: number;
  emptyFormFieldCount: number;
  editCount: number;
  rotatedPageCount: number;
  mixedPageSizes: boolean;
  metadata: Source["metadata"] | null;
};

async function pageHasExtractableText(source: Source, index: number) {
  const page = await source.pdf.getPage(index + 1);
  const content = await page.getTextContent();
  return content.items.some((item) => "str" in item && item.str.trim());
}

export async function collectDocumentFacts(
  snapshot: Snapshot,
  sources: Map<string, Source>,
): Promise<DocumentFacts> {
  const pages: Page[] = snapshot.pages;
  const pagesWithNoExtractableText: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    const source = sources.get(pages[i].sourceId);
    if (!source) continue;
    const has = await pageHasExtractableText(source, pages[i].index);
    if (!has) pagesWithNoExtractableText.push(i);
  }
  let formFieldCount = 0;
  let emptyFormFieldCount = 0;
  const seen = new Set<string>();
  for (const page of pages) {
    for (const widget of page.widgets) {
      const key = `${page.sourceId}::${widget.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      formFieldCount++;
      const value = snapshot.forms[key];
      const empty =
        value === undefined ||
        value === "" ||
        value === false ||
        (Array.isArray(value) && value.length === 0);
      if (empty) emptyFormFieldCount++;
    }
  }
  const editCount = pages.reduce((n, p) => n + p.marks.length, 0);
  const rotatedPageCount = pages.filter((p) => p.rotation % 360 !== 0).length;
  const sizes = new Set(pages.map((p) => `${p.width}x${p.height}`));
  const firstSource = pages[0] ? sources.get(pages[0].sourceId) : undefined;
  return {
    pageCount: pages.length,
    pagesWithNoExtractableText,
    formFieldCount,
    emptyFormFieldCount,
    editCount,
    rotatedPageCount,
    mixedPageSizes: sizes.size > 1,
    metadata: firstSource?.metadata ?? null,
  };
}
