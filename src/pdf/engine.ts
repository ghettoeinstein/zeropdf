import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
  StandardFonts,
  rgb,
  degrees,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  type PDFFont,
} from "pdf-lib";
import {
  fieldKey,
  pdfPoint,
  textLines,
  uid,
  type Source,
  type Page,
  type Snapshot,
  type Mark,
  type FormValue,
  type Widget,
} from "../state/model";
GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdf(
  file: File,
): Promise<{
  source: Source;
  pages: Page[];
  forms: Record<string, FormValue>;
}> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
    throw new Error("This file doesn't appear to be a valid PDF.");
  // pdf-lib cannot safely modify encrypted PDFs, even if PDF.js can display them.
  let lib: PDFDocument;
  try {
    lib = await PDFDocument.load(bytes);
  } catch (error) {
    if (/encrypt/i.test(String(error)))
      throw new Error(
        "This PDF is encrypted. Save an unencrypted copy in your PDF reader, then open it here.",
      );
    throw new Error(
      "This PDF is damaged or uses an unsupported format. Try saving a new copy in your PDF reader.",
    );
  }
  const loading = getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    disableFontFace: false,
    useWasm: false,
  });
  let pdf;
  try {
    pdf = await loading.promise;
  } catch {
    await loading.destroy();
    throw new Error(
      "This PDF could not be rendered. Try saving a new copy in your PDF reader.",
    );
  }
  const source: Source = { id: uid(), bytes, pdf, name: file.name };
  try {
    const forms: Record<string, FormValue> = {};
    for (const field of lib.getForm().getFields()) {
      const key = fieldKey(source.id, field.getName());
      if (field instanceof PDFTextField) forms[key] = field.getText() || "";
      if (field instanceof PDFCheckBox) forms[key] = field.isChecked();
      if (field instanceof PDFRadioGroup)
        forms[key] = field.getSelected() || "";
      if (field instanceof PDFDropdown || field instanceof PDFOptionList)
        forms[key] = field.getSelected();
    }
    const pages: Page[] = [];
    for (let index = 0; index < pdf.numPages; index++) {
      const p = await pdf.getPage(index + 1);
      const viewport = p.getViewport({ scale: 1, rotation: 0 });
      const widgets: Widget[] = [];
      for (const a of await p.getAnnotations({ intent: "display" })) {
        if (a.subtype !== "Widget" || !a.fieldName || a.hidden || a.noView)
          continue;
        let kind: Widget["kind"] | undefined;
        if (a.fieldType === "Tx") kind = "text";
        else if (a.fieldType === "Btn" && a.checkBox) kind = "checkbox";
        else if (a.fieldType === "Btn" && a.radioButton) kind = "radio";
        else if (a.fieldType === "Ch") kind = a.combo ? "dropdown" : "list";
        if (!kind) continue;
        const rect = [
          ...viewport.convertToViewportPoint(a.rect[0], a.rect[1]),
          ...viewport.convertToViewportPoint(a.rect[2], a.rect[3]),
        ];
        widgets.push({
          id: a.id,
          name: a.fieldName,
          kind,
          x: Math.min(rect[0], rect[2]),
          y: Math.min(rect[1], rect[3]),
          width: Math.abs(rect[2] - rect[0]),
          height: Math.abs(rect[3] - rect[1]),
          options: a.options?.map(
            (o: { exportValue: string; displayValue: string }) => ({
              value: o.exportValue,
              label: o.displayValue,
            }),
          ),
          buttonValue: a.buttonValue || a.exportValue,
          readOnly: a.readOnly,
          multiSelect: a.multiSelect,
          multiline: a.multiLine,
          maxLength: a.maxLen,
        });
      }
      pages.push({
        id: uid(),
        sourceId: source.id,
        index,
        width: viewport.width,
        height: viewport.height,
        originX: p.view[0],
        originY: p.view[1],
        rotation: p.rotate,
        marks: [],
        widgets,
      });
    }
    return { source, pages, forms };
  } catch (error) {
    await pdf.loadingTask.destroy();
    throw error;
  }
}

function color(hex: string) {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}
export function requiresFlatten(
  snapshot: Snapshot,
  sources: Map<string, Source>,
) {
  const source = sources.get(snapshot.pages[0]?.sourceId);
  return (
    !source ||
    snapshot.pages.length !== source.pdf.numPages ||
    snapshot.pages.some((p, i) => p.sourceId !== source.id || p.index !== i)
  );
}
export async function exportPdf(
  snapshot: Snapshot,
  sources: Map<string, Source>,
  flatten: boolean,
  onProgress: (n: number) => void = () => {},
) {
  if (!snapshot.pages.length)
    throw new Error("Add at least one page before downloading.");
  const organized = requiresFlatten(snapshot, sources);
  const loaded = new Map<string, PDFDocument>();
  for (const id of new Set(snapshot.pages.map((p) => p.sourceId))) {
    const source = sources.get(id);
    if (!source) throw new Error("The source document is no longer available.");
    const doc = await PDFDocument.load(source.bytes);
    const form = doc.getForm();
    for (const field of form.getFields()) {
      const value = snapshot.forms[fieldKey(id, field.getName())];
      if (value === undefined) continue;
      if (field instanceof PDFTextField && typeof value === "string")
        field.setText(value);
      if (field instanceof PDFCheckBox) value ? field.check() : field.uncheck();
      if (field instanceof PDFRadioGroup && typeof value === "string")
        value ? field.select(value) : field.clear();
      if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        const selected = Array.isArray(value)
          ? value
          : typeof value === "string"
            ? [value]
            : [];
        selected.length ? field.select(selected) : field.clear();
      }
    }
    if (form.getFields().length) {
      form.updateFieldAppearances();
      if (flatten || organized) form.flatten();
    }
    loaded.set(id, doc);
  }
  const output = organized
    ? await PDFDocument.create()
    : loaded.get(snapshot.pages[0].sourceId)!;
  const fonts: Record<string, PDFFont> = {};
  for (const name of [
    StandardFonts.Helvetica,
    StandardFonts.TimesRoman,
    StandardFonts.Courier,
  ])
    fonts[name] = await output.embedFont(name);
  for (let i = 0; i < snapshot.pages.length; i++) {
    const spec = snapshot.pages[i];
    const page = organized
      ? output.addPage(
          (await output.copyPages(loaded.get(spec.sourceId)!, [spec.index]))[0],
        )
      : output.getPage(i);
    page.setRotation(degrees(spec.rotation));
    for (const m of spec.marks) {
      const center = pdfPoint(spec, {
        x: m.x + m.width / 2,
        y: m.y + m.height / 2,
      });
      const angle = (-(m.rotation || 0) * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle);
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(
          c,
          s,
          -s,
          c,
          center.x - c * center.x + s * center.y,
          center.y - s * center.x - c * center.y,
        ),
      );
      const top = pdfPoint(spec, m);
      const bottom = pdfPoint(spec, { x: m.x, y: m.y + m.height });
      const common = { color: color(m.color), opacity: m.opacity };
      if (m.type === "text") {
        if (m.patchColor)
          page.drawRectangle({
            x: bottom.x,
            y: bottom.y,
            width: m.width,
            height: m.height,
            color: color(m.patchColor),
            opacity: m.opacity,
          });
        const font = fonts[m.font || "Helvetica"];
        const size = m.fontSize || 16;
        const lines = textLines(m, (t) => font.widthOfTextAtSize(t, size));
        for (let j = 0; j < lines.length; j++) {
          const width = font.widthOfTextAtSize(lines[j], size);
          const offset =
            m.align === "center"
              ? (m.width - width) / 2
              : m.align === "right"
                ? m.width - width
                : 0;
          page.drawText(lines[j], {
            ...common,
            x: top.x + offset,
            y: top.y - size - j * size * (m.lineHeight || 1.3),
            size,
            font,
          });
        }
      } else if (m.image) {
        const image = m.image.startsWith("data:image/png")
          ? await output.embedPng(m.image)
          : await output.embedJpg(m.image);
        page.drawImage(image, {
          x: bottom.x,
          y: bottom.y,
          width: m.width,
          height: m.height,
          opacity: m.opacity,
        });
      } else if (m.points) {
        for (let j = 1; j < m.points.length; j++) {
          const a = m.points[j - 1],
            b = m.points[j];
          page.drawLine({
            start: pdfPoint(spec, { x: m.x + a.x, y: m.y + a.y }),
            end: pdfPoint(spec, { x: m.x + b.x, y: m.y + b.y }),
            thickness: m.stroke,
            ...common,
          });
        }
      } else if (m.type === "line" || m.type === "arrow") {
        page.drawLine({
          start: top,
          end: pdfPoint(spec, { x: m.x + m.width, y: m.y + m.height }),
          thickness: m.stroke,
          ...common,
        });
        if (m.type === "arrow") {
          const angle = Math.atan2(m.height, m.width);
          const length = Math.max(10, m.stroke * 4);
          const end = { x: m.x + m.width, y: m.y + m.height };
          for (const delta of [-0.45, 0.45])
            page.drawLine({
              start: pdfPoint(spec, end),
              end: pdfPoint(spec, {
                x: end.x - length * Math.cos(angle + delta),
                y: end.y - length * Math.sin(angle + delta),
              }),
              thickness: m.stroke,
              ...common,
            });
        }
      } else if (m.type === "ellipse") {
        page.drawEllipse({
          x: top.x + m.width / 2,
          y: top.y - m.height / 2,
          xScale: m.width / 2,
          yScale: m.height / 2,
          borderColor: color(m.color),
          borderWidth: m.stroke,
          color: m.fill === "none" ? undefined : color(m.fill),
          opacity: m.opacity,
          borderOpacity: m.opacity,
        });
      } else {
        page.drawRectangle({
          x: bottom.x,
          y: bottom.y,
          width: m.width,
          height: m.height,
          borderColor: color(m.color),
          borderWidth: m.type === "whiteout" ? 0 : m.stroke,
          color:
            m.type === "whiteout"
              ? rgb(1, 1, 1)
              : m.fill === "none"
                ? undefined
                : color(m.fill),
          opacity: m.opacity,
          borderOpacity: m.opacity,
        });
      }
      page.pushOperators(popGraphicsState());
    }
    onProgress(Math.round(((i + 1) / snapshot.pages.length) * 90));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const bytes = await output.save();
  onProgress(100);
  return bytes;
}
export function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function demoPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const p = pdf.addPage([612, 792]);
  const ink = rgb(0.1, 0.16, 0.14),
    gray = rgb(0.4, 0.45, 0.43);
  p.drawText("A little less paperwork.", {
    x: 58,
    y: 704,
    size: 29,
    font: bold,
    color: ink,
  });
  p.drawText("A little more possibility.", {
    x: 58,
    y: 664,
    size: 29,
    font: bold,
    color: ink,
  });
  p.drawText("YOUR ZEROPDF PRACTICE DOCUMENT", {
    x: 58,
    y: 746,
    size: 10,
    font: bold,
    color: gray,
  });
  p.drawLine({
    start: { x: 58, y: 636 },
    end: { x: 554, y: 636 },
    color: rgb(0.8, 0.84, 0.8),
    thickness: 1,
  });
  [
    "This is a real PDF, ready for a test drive.",
    "Add a note. Highlight a sentence. Make it yours.",
    "Everything happens right here on your device.",
  ].forEach((text, i) =>
    p.drawText(text, { x: 58, y: 601 - i * 24, size: 14, font, color: ink }),
  );
  p.drawText("TRY FILLING THESE FIELDS", {
    x: 58,
    y: 466,
    size: 10,
    font: bold,
    color: gray,
  });
  const form = pdf.getForm();
  const name = form.createTextField("Your name");
  name.addToPage(p, {
    x: 58,
    y: 396,
    width: 496,
    height: 36,
    borderWidth: 1,
    borderColor: rgb(0.75, 0.8, 0.75),
  });
  p.drawText("Your name", { x: 58, y: 445, size: 12, font, color: gray });
  const check = form.createCheckBox("Local only");
  check.addToPage(p, { x: 58, y: 348, width: 18, height: 18 });
  p.drawText("My files belong on my device.", {
    x: 90,
    y: 352,
    size: 13,
    font,
    color: ink,
  });
  p.drawText("Make your mark here", {
    x: 58,
    y: 258,
    size: 12,
    font,
    color: gray,
  });
  p.drawLine({
    start: { x: 58, y: 181 },
    end: { x: 350, y: 181 },
    color: rgb(0.75, 0.8, 0.75),
    thickness: 1,
  });
  p.drawText("No account. No cloud. No paywall.", {
    x: 58,
    y: 70,
    size: 11,
    font,
    color: gray,
  });
  const p2 = pdf.addPage([612, 792]);
  p2.drawText("Room for your ideas.", {
    x: 58,
    y: 700,
    size: 28,
    font: bold,
    color: ink,
  });
  p2.drawText("Try drawing, adding an image, or rearranging these pages.", {
    x: 58,
    y: 665,
    size: 13,
    font,
    color: gray,
  });
  return new File([new Uint8Array(await pdf.save())], "welcome.pdf", {
    type: "application/pdf",
  });
}
