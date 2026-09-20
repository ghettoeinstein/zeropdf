import { test, expect, type Page as BrowserPage } from "@playwright/test";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { readFile } from "node:fs/promises";
async function sample(page: BrowserPage) {
  await page.goto("/");
  await page.getByRole("button", { name: /try a practice PDF/i }).click();
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".busy-overlay")).toHaveCount(0);
}
async function exported(page: BrowserPage) {
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const event = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Download PDF", exact: true })
    .click();
  const dl = await event;
  return PDFDocument.load(await readFile((await dl.path())!));
}
test("opens, fills forms, adds text, exports, and makes no document requests", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await sample(page);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));
  await page
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Ada Lovelace");
  await page.getByRole("checkbox", { name: "Local only" }).check();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .locator(".annotation-layer")
    .first()
    .click({ position: { x: 120, y: 160 } });
  await page
    .locator(".properties")
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Added locally");
  const pdf = await exported(page);
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getForm().getTextField("Your name").getText()).toBe(
    "Ada Lovelace",
  );
  expect(pdf.getForm().getCheckBox("Local only").isChecked()).toBe(true);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "reopened.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  await page.getByRole("button", { name: "Open new PDF", exact: true }).click();
  await expect(page.getByText("reopened.pdf", { exact: true })).toBeVisible();
  await expect(page.locator(".busy-overlay")).toHaveCount(0);
  expect(await page.locator(".page-container").count()).toBe(2);
  await page.screenshot({
    path: "test-results/editor-desktop.png",
    fullPage: true,
  });
});
test("page operations undo, merge, rotate, duplicate and export with flattened forms", async ({
  page,
}) => {
  await sample(page);
  await page.getByRole("button", { name: "Rotate page", exact: true }).click();
  await page
    .getByRole("button", { name: "Duplicate page", exact: true })
    .click();
  await expect(page.locator(".page-container")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".page-container")).toHaveCount(2);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".page-container")).toHaveCount(3);
  await page.getByRole("button", { name: "Delete page", exact: true }).click();
  await expect(page.locator(".page-container")).toHaveCount(2);
  const other = await PDFDocument.create();
  other.addPage([400, 500]);
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "other.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await other.save()),
    });
  await expect(page.locator(".page-container")).toHaveCount(3);
  await expect(page.locator(".busy-overlay")).toHaveCount(0);
  const pdf = await exported(page);
  expect(pdf.getPageCount()).toBe(3);
  expect(pdf.getPage(0).getRotation().angle).toBe(90);
  expect(pdf.getPage(2).getSize()).toEqual({ width: 400, height: 500 });
  expect(pdf.getForm().getFields()).toHaveLength(0);
});
test("draws, places typed signature and image, and exports", async ({
  page,
}) => {
  await sample(page);
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  const surface = page.locator(".annotation-layer").first();
  const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + 70, box.y + 160);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 200, { steps: 12 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Sign", exact: true }).click();
  await page.getByRole("button", { name: "Type", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your name", exact: true })
    .last()
    .fill("Ada Lovelace");
  await page
    .getByRole("button", { name: "Use signature", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await surface.click({ position: { x: 120, y: 360 } });
  await page
    .locator("input[type=file]")
    .nth(2)
    .setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  await expect(page.locator(".tool-image")).toHaveCount(2);
  await surface.click({ position: { x: 200, y: 240 } });
  const pdf = await exported(page);
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPage(0).node.Resources()?.toString()).toContain("Image");
});
test("handles rotated crop boxes and rejects invalid PDFs without losing current work", async ({
  page,
}) => {
  await page.goto("/");
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([700, 900]);
  p.setCropBox(30, 40, 612, 792);
  p.setRotation(degrees(90));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  p.drawText("Rotated page", { x: 80, y: 700, font, size: 20 });
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "rotated.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  await expect(page.locator(".busy-overlay")).toHaveCount(0);
  await expect(page.locator(".page-container")).toHaveCount(1);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .locator(".annotation-layer")
    .click({ position: { x: 120, y: 120 } });
  await page
    .locator(".properties")
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Crop coordinates");
  const out = await exported(page);
  expect(out.getPage(0).getRotation().angle).toBe(90);
  expect(out.getPage(0).getCropBox()).toEqual({
    x: 30,
    y: 40,
    width: 612,
    height: 792,
  });
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "broken.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a PDF"),
    });
  await page.getByRole("button", { name: "Open new PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("valid PDF");
  await expect(page.locator(".page-container")).toHaveCount(1);
});
test("mobile workspace stays within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/welcome-mobile.png",
    fullPage: true,
  });
  await sample(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Text", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "test-results/editor-mobile.png",
    fullPage: true,
  });
});
