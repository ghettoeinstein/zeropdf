import type { DocumentFacts } from "./facts";

export type Recommendation = {
  id: string;
  severity: "info" | "suggestion" | "warning";
  title: string;
  reason: string;
  priority: number;
};

type Rule = {
  id: string;
  when: (facts: DocumentFacts) => boolean;
  build: (facts: DocumentFacts) => Omit<Recommendation, "id">;
};

/**
 * Every rule here only states what was actually observed, per
 * docs/PRD_ZEROGUIDE.md §15 (No Hallucination Contract). None of these
 * point at an action button — FreePDF doesn't have OCR, metadata removal,
 * or redaction verification yet, so promising one would be exactly the
 * kind of overclaim this system exists to prevent. Add an `action` field
 * to Recommendation and wire it up only once the underlying feature ships.
 */
const rules: Rule[] = [
  {
    id: "no-extractable-text",
    when: (f) => f.pagesWithNoExtractableText.length > 0,
    build: (f) => ({
      severity: "info",
      title:
        f.pagesWithNoExtractableText.length === 1
          ? "1 page has no extractable text"
          : `${f.pagesWithNoExtractableText.length} pages have no extractable text`,
      reason:
        "These pages contain no text FreePDF can select, search, or edit directly — likely a scanned image. FreePDF doesn't run OCR yet, so their content can only be edited visually (cover and redraw), not as real text.",
      priority: 55 + Math.min(f.pagesWithNoExtractableText.length, 20),
    }),
  },
  {
    id: "empty-form-fields",
    when: (f) => f.emptyFormFieldCount > 0,
    build: (f) => ({
      severity: "suggestion",
      title:
        f.emptyFormFieldCount === 1
          ? "1 form field is empty"
          : `${f.emptyFormFieldCount} of ${f.formFieldCount} form fields are empty`,
      reason:
        "FreePDF can't tell which fields are meant to be required — only that they're currently blank.",
      priority: 40 + Math.min(f.emptyFormFieldCount, 20),
    }),
  },
  {
    id: "metadata-present",
    when: (f) =>
      !!f.metadata &&
      (f.metadata.hasAuthor ||
        f.metadata.hasCreator ||
        f.metadata.hasProducer ||
        f.metadata.hasTitle ||
        f.metadata.hasSubject ||
        f.metadata.hasKeywords),
    build: (f) => {
      const present = Object.entries(f.metadata!)
        .filter(([, v]) => v)
        .map(([k]) => k.replace("has", "").toLowerCase());
      return {
        severity: "info",
        title: "This file carries document metadata",
        reason: `${present.join(", ")} ${present.length === 1 ? "is" : "are"} embedded in the file. FreePDF doesn't remove metadata yet — the fields are only being reported, not stripped.`,
        priority: 35,
      };
    },
  },
  {
    id: "rotated-pages",
    when: (f) => f.rotatedPageCount > 0,
    build: (f) => ({
      severity: "info",
      title: `${f.rotatedPageCount} of ${f.pageCount} ${f.rotatedPageCount === 1 ? "page is" : "pages are"} rotated`,
      reason: "Rotation is applied at display and export time, not baked into the page content.",
      priority: 20,
    }),
  },
  {
    id: "mixed-page-sizes",
    when: (f) => f.mixedPageSizes,
    build: () => ({
      severity: "info",
      title: "Pages in this document have different sizes",
      reason: "Mixed page dimensions are preserved as-is; FreePDF doesn't normalize them automatically.",
      priority: 15,
    }),
  },
  {
    id: "unsaved-edits",
    when: (f) => f.editCount > 0,
    build: (f) => ({
      severity: "info",
      title: `${f.editCount} ${f.editCount === 1 ? "edit" : "edits"} not yet exported`,
      reason: "These changes exist only in this browser tab until you download the PDF.",
      priority: 25,
    }),
  },
];

export function evaluateRules(facts: DocumentFacts): Recommendation[] {
  return rules
    .filter((r) => r.when(facts))
    .map((r) => ({ id: r.id, ...r.build(facts) }))
    .sort((a, b) => b.priority - a.priority);
}
