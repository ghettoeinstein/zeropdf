import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FilePlus2,
  FileText,
  Highlighter,
  ImagePlus,
  Layers,
  LockKeyhole,
  Maximize2,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  RotateCw,
  ScanLine,
  ShieldCheck,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  Circle,
  MoveUpRight,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import PageView, { PdfCanvas } from "./components/PageView";
import Modal from "./components/Modal";
import Signature, { readImage } from "./components/Signature";
import {
  demoPdf,
  download,
  exportPdf,
  loadPdf,
  requiresFlatten,
} from "./pdf/engine";
import {
  commit,
  empty,
  movePage,
  outputName,
  redo,
  uid,
  undo,
  type FormValue,
  type History,
  type Mark,
  type Page,
  type Point,
  type Snapshot,
  type Source,
  type Tool,
} from "./state/model";

const tools: { id: Tool; label: string; icon: typeof Type; key?: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, key: "V" },
  { id: "text", label: "Text", icon: Type, key: "T" },
  { id: "draw", label: "Draw", icon: PenLine, key: "D" },
  { id: "highlight", label: "Highlight", icon: Highlighter, key: "H" },
  { id: "sign", label: "Sign", icon: PenLine, key: "S" },
  { id: "rectangle", label: "Shape", icon: Square, key: "R" },
  { id: "image", label: "Image", icon: ImagePlus, key: "I" },
  { id: "whiteout", label: "Whiteout", icon: ScanLine, key: "W" },
];
const colors = [
  "#192c23",
  "#497b37",
  "#3668d4",
  "#ca4c45",
  "#a269c7",
  "#edc449",
];
const initial: History = { past: [], present: empty, future: [] };
export default function App() {
  const [history, setHistory] = useState<History>(initial);
  const state = history.present;
  const sources = useRef(new Map<string, Source>());
  const [filename, setFilename] = useState("");
  const [activeId, setActiveId] = useState("");
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<string | null>(null);
  const [color, setColor] = useState(colors[0]);
  const [stroke, setStroke] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [rail, setRail] = useState(true);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<
    "privacy" | "help" | "export" | "signature" | "replace" | null
  >(null);
  const [saveName, setSaveName] = useState("");
  const [flatten, setFlatten] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [asset, setAsset] = useState<{ data: string; ratio: number } | null>(
    null,
  );
  const pendingFile = useRef<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mergeInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const workspace = useRef<HTMLElement>(null);
  const importing = useRef(false);
  const clipboard = useRef<Mark | null>(null);
  const insertAt = useRef<number | null>(null);
  const current = state.pages.find((p) => p.id === activeId) || state.pages[0];
  const activeIndex = current ? state.pages.indexOf(current) : 0;
  const selected = current?.marks.find((m) => m.id === selection);
  const ready = state.pages.length > 0;
  const organized = ready && requiresFlatten(state, sources.current);
  const dirty = history.past.length > 0;
  const scale =
    fit && current
      ? Math.max(
          0.2,
          Math.min(
            1.35,
            (viewportWidth - 88) /
              (current.rotation % 180 ? current.height : current.width),
          ),
        )
      : zoom;
  const change = useCallback(
    (update: (snapshot: Snapshot) => Snapshot) =>
      setHistory((h) => commit(h, update(h.present))),
    [],
  );
  const changePage = (f: (p: Page) => Page) =>
    change((s) => ({
      ...s,
      pages: s.pages.map((p) => (p.id === current?.id ? f(p) : p)),
    }));
  const updateMark = (mark: Mark, pageId = current?.id) =>
    change((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === pageId
          ? { ...p, marks: p.marks.map((m) => (m.id === mark.id ? mark : m)) }
          : p,
      ),
    }));
  const addMark = (mark: Mark, pageId = current?.id) => {
    change((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, marks: [...p.marks, mark] } : p,
      ),
    }));
    setSelection(mark.id);
    if (mark.type !== "draw" && mark.type !== "highlight") setTool("select");
  };
  const removeMark = () => {
    if (selected)
      changePage((p) => ({
        ...p,
        marks: p.marks.filter((m) => m.id !== selected.id),
      }));
    setSelection(null);
  };
  useEffect(() => {
    if (!workspace.current) return;
    const observer = new ResizeObserver(([e]) =>
      setViewportWidth(e.contentRect.width),
    );
    observer.observe(workspace.current);
    return () => observer.disconnect();
  }, [ready, rail]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  const importFile = async (file: File, append = false) => {
    if (importing.current) return;
    importing.current = true;
    setBusy(append ? "Adding pages…" : "Opening your PDF…");
    setError("");
    try {
      const loaded = await loadPdf(file);
      if (append) {
        sources.current.set(loaded.source.id, loaded.source);
        const location = insertAt.current;
        change((s) => {
          const pages = [...s.pages];
          pages.splice(
            location === null ? pages.length : location,
            0,
            ...loaded.pages,
          );
          return { pages, forms: { ...s.forms, ...loaded.forms } };
        });
        setActiveId(loaded.pages[0].id);
        setNotice(`${loaded.pages.length} pages added`);
      } else {
        for (const source of sources.current.values())
          void source.pdf.loadingTask.destroy();
        sources.current.clear();
        sources.current.set(loaded.source.id, loaded.source);
        setHistory({
          past: [],
          present: { pages: loaded.pages, forms: loaded.forms },
          future: [],
        });
        setFilename(file.name);
        setSaveName(outputName(file.name));
        setActiveId(loaded.pages[0].id);
        setFit(true);
      }
      setSelection(null);
      setTool("select");
      setAsset(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The PDF could not be opened.");
    } finally {
      setBusy("");
      importing.current = false;
      insertAt.current = null;
    }
  };
  const requestOpen = (file: File) => {
    if (dirty) {
      pendingFile.current = file;
      setModal("replace");
    } else void importFile(file);
  };
  const jump = (id: string) => {
    setActiveId(id);
    setSelection(null);
    document
      .getElementById(`page-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const duplicateMark = () => {
    if (selected)
      addMark({
        ...structuredClone(selected),
        id: uid(),
        x: selected.x + 12,
        y: selected.y + 12,
      });
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (modal || busy) return;
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setHistory(e.shiftKey ? redo : undo);
        setSelection(null);
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (ready) setModal("export");
        return;
      }
      if (e.key === "Escape") {
        setSelection(null);
        setTool("select");
        return;
      }
      if (selected && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        removeMark();
      }
      if (selected && mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        clipboard.current = structuredClone(selected);
      }
      if (current && mod && e.key.toLowerCase() === "v" && clipboard.current) {
        e.preventDefault();
        addMark({
          ...structuredClone(clipboard.current),
          id: uid(),
          x: clipboard.current.x + 12,
          y: clipboard.current.y + 12,
        });
      }
      if (selected && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        updateMark({
          ...selected,
          x: Math.max(
            0,
            selected.x +
              (e.key === "ArrowRight"
                ? step
                : e.key === "ArrowLeft"
                  ? -step
                  : 0),
          ),
          y: Math.max(
            0,
            selected.y +
              (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0),
          ),
        });
      }
      if (!mod && ready) {
        const next = tools.find(
          (t) => t.key?.toLowerCase() === e.key.toLowerCase(),
        );
        if (next) chooseTool(next.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  function chooseTool(next: Tool) {
    setSelection(null);
    if (next === "sign") {
      setModal("signature");
      return;
    }
    if (next === "image") {
      imageInput.current?.click();
      return;
    }
    setTool(next);
  }
  const placeAsset = (point: Point, pageId: string) => {
    if (!asset) return;
    const page = state.pages.find((p) => p.id === pageId)!;
    const width = Math.min(200, page.width - point.x);
    addMark(
      {
        id: uid(),
        type: tool,
        ...point,
        width,
        height: width / asset.ratio,
        color,
        fill: "none",
        stroke,
        opacity: 1,
        image: asset.data,
      },
      pageId,
    );
    setAsset(null);
  };
  const save = async (extract = false) => {
    setBusy("Preparing your PDF…");
    setProgress(0);
    setError("");
    try {
      const snapshot = extract ? { ...state, pages: [current!] } : state;
      const bytes = await exportPdf(
        snapshot,
        sources.current,
        flatten,
        setProgress,
      );
      download(
        bytes,
        extract
          ? `${filename.replace(/\.pdf$/i, "")}-page-${activeIndex + 1}.pdf`
          : saveName.trim() || outputName(filename),
      );
      setModal(null);
      setNotice(
        extract
          ? "Page downloaded"
          : "Your PDF is ready. Saved to your downloads.",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown export error";
      setError(
        /WinAnsi|encode/i.test(message)
          ? "Some characters cannot be exported with the built-in PDF fonts. Use Latin characters, or add your text as an image. Your edits are still here."
          : `Export failed: ${message}. Your edits are still here.`,
      );
    } finally {
      setBusy("");
    }
  };
  const pageAction = (
    action: "delete" | "duplicate" | "rotate" | "up" | "down",
  ) => {
    if (!current) return;
    if (action === "delete") {
      if (state.pages.length === 1) {
        setNotice("Keep at least one page in your document.");
        return;
      }
      change((s) => ({
        ...s,
        pages: s.pages.filter((p) => p.id !== current.id),
      }));
      setActiveId(state.pages[Math.max(0, activeIndex - 1)].id);
    }
    if (action === "rotate")
      changePage((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }));
    if (action === "duplicate") {
      const copy = {
        ...structuredClone(current),
        id: uid(),
        marks: current.marks.map((m) => ({ ...structuredClone(m), id: uid() })),
      };
      change((s) => {
        const pages = [...s.pages];
        pages.splice(activeIndex + 1, 0, copy);
        return { ...s, pages };
      });
      setActiveId(copy.id);
    }
    if (action === "up" || action === "down")
      change((s) => ({
        ...s,
        pages: movePage(
          s.pages,
          activeIndex,
          Math.max(
            0,
            Math.min(
              s.pages.length - 1,
              activeIndex + (action === "up" ? -1 : 1),
            ),
          ),
        ),
      }));
    setSelection(null);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    dragDepth.current = 0;
    if (busy) return;
    const file = Array.from(e.dataTransfer.files).find(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (file) requestOpen(file);
    else if (e.dataTransfer.files.length)
      setError("Choose a PDF file to open.");
  };

  return (
    <div
      className="app"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current--;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <input
        ref={fileInput}
        hidden
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) requestOpen(f);
        }}
      />
      <input
        ref={mergeInput}
        hidden
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f, true);
        }}
      />
      <input
        ref={imageInput}
        hidden
        type="file"
        accept="image/png,image/jpeg"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            try {
              const img = await readImage(file);
              setAsset({ data: img.data, ratio: img.width / img.height });
              setTool("image");
              setNotice("Click the page to place your image.");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not open image.",
              );
            }
        }}
      />
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="ZeroPDF"
        >
          <span className="brand-mark">
            Z<span>•</span>
          </span>
          Zero<span className="brand-light">PDF</span>
        </a>
        <div className="header-divider" />
        <span className="document-name">
          {ready ? (
            <>
              <FileText size={16} />
              <span>{filename}</span>
              <span className="session-tag">LOCAL</span>
            </>
          ) : (
            <span className="tagline">The device is the server.</span>
          )}
        </span>
        <div className="header-right">
          <button className="privacy-pill" onClick={() => setModal("privacy")}>
            <ShieldCheck size={15} />
            <span>100% on your device</span>
          </button>
          <button
            className="icon-button help-button"
            onClick={() => setModal("help")}
            aria-label="Keyboard shortcuts and help"
          >
            <HelpCircle size={19} />
          </button>
          {ready ? (
            <button
              className="primary download-button"
              disabled={!!busy}
              onClick={() => setModal("export")}
            >
              <ArrowDownToLine size={17} />
              <span>Download PDF</span>
            </button>
          ) : (
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => fileInput.current?.click()}
            >
              <Plus size={17} />
              Open PDF
            </button>
          )}
        </div>
      </header>
      <main className={ready ? "editor-layout" : "empty-layout"}>
        {!ready ? (
          <>
            <section className="welcome">
              <div className="eyebrow">
                <span className="tiny-line" />
                YOUR FILES. YOUR BROWSER. THAT’S IT.
              </div>
              <h1>
                Your PDF.
                <br />
                <span>Your business.</span>
              </h1>
              <p className="intro">
                Sign it. Fill it. Make it yours.
                <br />A little less paperwork, without the upload.
              </p>
              <button
                className="drop-zone"
                onClick={() => fileInput.current?.click()}
                disabled={!!busy}
              >
                <span className="file-symbol">
                  <FileText size={32} strokeWidth={1.5} />
                  <span className="plus-badge">
                    <Plus size={14} />
                  </span>
                </span>
                <span className="drop-title">
                  Open a PDF <ArrowUpRight size={21} />
                </span>
                <span className="drop-description">or drop one right here</span>
                <span className="file-local">
                  <LockKeyhole size={12} />
                  Nothing is uploaded. Ever.
                </span>
              </button>
              <button
                className="sample-button"
                disabled={!!busy}
                onClick={async () => {
                  try {
                    await importFile(await demoPdf());
                  } catch {
                    setError("Could not create the practice PDF.");
                  }
                }}
              >
                Just looking? Try a practice PDF <ChevronRight size={15} />
              </button>
            </section>
            <aside className="welcome-side">
              <div className="side-kicker">
                A SMALL TOOL.
                <br />A BIG RELIEF.
              </div>
              <div className="capability">
                <PenLine />
                <div>
                  <h3>Sign & fill</h3>
                  <p>
                    Finish the form.
                    <br />
                    Make your mark.
                  </p>
                </div>
              </div>
              <div className="capability">
                <Highlighter />
                <div>
                  <h3>Edit & annotate</h3>
                  <p>
                    Add text, images, and
                    <br />a little clarity.
                  </p>
                </div>
              </div>
              <div className="capability">
                <Layers />
                <div>
                  <h3>Organize & combine</h3>
                  <p>
                    The right pages.
                    <br />
                    In the right order.
                  </p>
                </div>
              </div>
              <div className="side-note">
                <LockKeyhole size={15} />
                <p>
                  No account. No cloud.
                  <br />
                  No paywall. Just done.
                </p>
              </div>
            </aside>
            <footer className="empty-footer">
              <span>Made for your documents. Built around your privacy.</span>
              <button onClick={() => setModal("privacy")}>
                How it stays private <ArrowUpRight size={14} />
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="editor-toolbar">
              <div className="toolbar-left">
                <button
                  className="icon-button"
                  onClick={() => setRail((v) => !v)}
                  aria-label={rail ? "Hide pages" : "Show pages"}
                >
                  {rail ? (
                    <PanelLeftClose size={18} />
                  ) : (
                    <PanelLeftOpen size={18} />
                  )}
                </button>
                <button
                  className="quiet open-another"
                  onClick={() => fileInput.current?.click()}
                  disabled={!!busy}
                >
                  <FilePlus2 size={16} />
                  Open
                </button>
                <span className="toolbar-rule" />
                <button
                  className="icon-button"
                  disabled={!history.past.length || !!busy}
                  onClick={() => {
                    setHistory(undo);
                    setSelection(null);
                  }}
                  aria-label="Undo"
                >
                  <Undo2 size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={!history.future.length || !!busy}
                  onClick={() => {
                    setHistory(redo);
                    setSelection(null);
                  }}
                  aria-label="Redo"
                >
                  <Redo2 size={18} />
                </button>
              </div>
              <div className="zoom-controls">
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  onClick={() => {
                    setZoom(Math.max(0.25, scale - 0.15));
                    setFit(false);
                  }}
                >
                  <Minus size={15} />
                </button>
                <button
                  className="zoom-label"
                  onClick={() => setFit((v) => !v)}
                >
                  {fit ? "Fit width" : `${Math.round(scale * 100)}%`}
                  <ChevronDown size={13} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  onClick={() => {
                    setZoom(Math.min(3, scale + 0.15));
                    setFit(false);
                  }}
                >
                  <Plus size={15} />
                </button>
                <button
                  className="icon-button fit-page"
                  aria-label="Fit page"
                  onClick={() => {
                    setFit(false);
                    setZoom(
                      Math.min(
                        (viewportWidth - 80) /
                          (current.rotation % 180
                            ? current.height
                            : current.width),
                        ((workspace.current?.clientHeight || 800) - 120) /
                          (current.rotation % 180
                            ? current.width
                            : current.height),
                      ),
                    );
                  }}
                >
                  <Maximize2 size={15} />
                </button>
              </div>
              <span className="session-note">
                <LockKeyhole size={12} />
                Session only
              </span>
            </div>
            {rail && (
              <aside className="page-rail">
                <div className="rail-heading">
                  <span>Pages</span>
                  <span>{state.pages.length}</span>
                </div>
                <div className="thumbnail-list">
                  {state.pages.map((p, i) => (
                    <button
                      key={p.id}
                      className={`thumbnail-item ${current.id === p.id ? "active" : ""}`}
                      aria-label={`Go to page ${i + 1}`}
                      aria-current={current.id === p.id ? "page" : undefined}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/zeropdf-page", p.id);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const id = e.dataTransfer.getData("text/zeropdf-page");
                        if (id) {
                          e.preventDefault();
                          e.stopPropagation();
                          const from = state.pages.findIndex(
                            (p) => p.id === id,
                          );
                          if (from >= 0)
                            change((s) => ({
                              ...s,
                              pages: movePage(s.pages, from, i),
                            }));
                        }
                      }}
                      onClick={() => jump(p.id)}
                    >
                      <div
                        className="thumbnail-paper"
                        style={{
                          aspectRatio:
                            p.rotation % 180
                              ? p.height / p.width
                              : p.width / p.height,
                        }}
                      >
                        <div
                          className="thumbnail-rotation"
                          style={{
                            width:
                              p.rotation % 180
                                ? `${(p.width / p.height) * 100}%`
                                : "100%",
                            aspectRatio: p.width / p.height,
                            transform: `translate(-50%,-50%) rotate(${p.rotation}deg)`,
                          }}
                        >
                          <PdfCanvas
                            pdf={sources.current.get(p.sourceId)!.pdf}
                            index={p.index}
                            width={110}
                            thumbnail
                          />
                        </div>
                        {p.marks.length > 0 && (
                          <span className="edited-dot" title="Contains edits" />
                        )}
                      </div>
                      <span className="thumbnail-number">
                        {i + 1}
                        {current.id === p.id && <span>Selected</span>}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  className="add-pages"
                  disabled={!!busy}
                  onClick={() => {
                    insertAt.current = null;
                    mergeInput.current?.click();
                  }}
                >
                  <Plus size={15} />
                  Add PDF
                </button>
                <div className="page-actions">
                  <button
                    className="icon-button"
                    aria-label="Rotate page"
                    onClick={() => pageAction("rotate")}
                  >
                    <RotateCw size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Duplicate page"
                    onClick={() => pageAction("duplicate")}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Delete page"
                    disabled={state.pages.length === 1}
                    onClick={() => pageAction("delete")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="page-actions">
                  <button
                    className="icon-button"
                    aria-label="Move page up"
                    disabled={activeIndex === 0}
                    onClick={() => pageAction("up")}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Move page down"
                    disabled={activeIndex === state.pages.length - 1}
                    onClick={() => pageAction("down")}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Extract current page"
                    onClick={() => void save(true)}
                  >
                    <ArrowDownToLine size={16} />
                  </button>
                </div>
                <button
                  className="quiet insert-pages"
                  onClick={() => {
                    insertAt.current = activeIndex + 1;
                    mergeInput.current?.click();
                  }}
                >
                  Insert PDF after page
                </button>
              </aside>
            )}
            <section
              ref={workspace}
              className={`workspace ${!rail ? "rail-hidden" : ""}`}
              aria-label="PDF workspace"
            >
              <div className="workspace-topline">
                <span>
                  {tool === "select"
                    ? "YOUR DOCUMENT"
                    : tool === "image" || tool === "sign"
                      ? "CLICK TO PLACE"
                      : `${tool.toUpperCase()} TOOL`}
                </span>
                <span>
                  {state.pages.length}{" "}
                  {state.pages.length === 1 ? "page" : "pages"} · Local editing
                </span>
              </div>
              {state.pages.map((p, i) => (
                <div
                  className="page-container"
                  id={`page-${p.id}`}
                  key={p.id}
                  onPointerDown={() => setActiveId(p.id)}
                >
                  <div className="page-label">
                    <span>PAGE {i + 1}</span>
                    {p.marks.length > 0 && (
                      <span>
                        {p.marks.length}{" "}
                        {p.marks.length === 1 ? "edit" : "edits"}
                      </span>
                    )}
                  </div>
                  <PageView
                    page={p}
                    pdf={sources.current.get(p.sourceId)!.pdf}
                    scale={scale}
                    tool={tool}
                    color={color}
                    stroke={stroke}
                    selection={current.id === p.id ? selection : null}
                    forms={state.forms}
                    onSelect={setSelection}
                    onAdd={(m) => addMark(m, p.id)}
                    onUpdate={(m) => updateMark(m, p.id)}
                    onForm={(key, value) =>
                      change((s) => ({
                        ...s,
                        forms: { ...s.forms, [key]: value },
                      }))
                    }
                    onActive={() => setActiveId(p.id)}
                    onPlaceAsset={(point) => placeAsset(point, p.id)}
                    disabled={!!busy}
                  />
                </div>
              ))}
              <div className="document-end">
                <LockKeyhole size={12} />
                Still on your device. Always.
              </div>
            </section>
            <aside className="inspector">
              <div className="inspector-heading">
                {selected ? "Edit selection" : "Make it yours"}
                <span className="small-label">
                  {selected ? "PROPERTIES" : "TOOLS"}
                </span>
              </div>
              <div
                className="tool-grid"
                role="toolbar"
                aria-label="Editing tools"
              >
                {tools.map((t) => (
                  <button
                    key={t.id}
                    className={
                      tool === t.id ||
                      (t.id === "rectangle" &&
                        ["ellipse", "line", "arrow"].includes(tool))
                        ? "active"
                        : ""
                    }
                    onClick={() => chooseTool(t.id)}
                    disabled={!!busy}
                    title={`${t.label} (${t.key})`}
                    aria-pressed={tool === t.id}
                  >
                    <t.icon size={20} strokeWidth={1.6} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              {["rectangle", "ellipse", "line", "arrow"].includes(tool) && (
                <div className="shape-options">
                  {[
                    { id: "rectangle", icon: Square },
                    { id: "ellipse", icon: Circle },
                    { id: "line", icon: Minus },
                    { id: "arrow", icon: MoveUpRight },
                  ].map((s) => (
                    <button
                      key={s.id}
                      className={`icon-button ${tool === s.id ? "active" : ""}`}
                      aria-label={s.id}
                      onClick={() => setTool(s.id as Tool)}
                    >
                      <s.icon size={18} />
                    </button>
                  ))}
                </div>
              )}
              <div className="properties">
                <label className="section-label">
                  {selected ? "Appearance" : "Tool settings"}
                </label>
                <div className="color-row">
                  {colors.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${(selected?.color || color) === c ? "chosen" : ""}`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                      onClick={() =>
                        selected
                          ? updateMark({ ...selected, color: c })
                          : setColor(c)
                      }
                    >
                      {(selected?.color || color) === c && (
                        <Check
                          size={13}
                          color={c === "#edc449" ? "#192c23" : "white"}
                        />
                      )}
                    </button>
                  ))}
                  <input
                    type="color"
                    aria-label="Custom color"
                    value={selected?.color || color}
                    onChange={(e) =>
                      selected
                        ? updateMark({ ...selected, color: e.target.value })
                        : setColor(e.target.value)
                    }
                  />
                </div>
                {selected?.type === "text" ? (
                  <>
                    <label className="field">
                      Text
                      <textarea
                        autoFocus
                        key={selected.id}
                        value={selected.text}
                        onChange={(e) =>
                          updateMark({ ...selected, text: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Font
                      <select
                        value={selected.font}
                        onChange={(e) =>
                          updateMark({
                            ...selected,
                            font: e.target.value as Mark["font"],
                          })
                        }
                      >
                        <option>Helvetica</option>
                        <option>Times-Roman</option>
                        <option>Courier</option>
                      </select>
                    </label>
                    <div className="field-pair">
                      <label className="field">
                        Size
                        <input
                          type="number"
                          min="6"
                          max="150"
                          value={selected.fontSize}
                          onChange={(e) =>
                            updateMark({
                              ...selected,
                              fontSize: Math.max(
                                6,
                                Math.min(150, Number(e.target.value)),
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        Line height
                        <input
                          type="number"
                          min="1"
                          max="3"
                          step="0.1"
                          value={selected.lineHeight || 1.3}
                          onChange={(e) =>
                            updateMark({
                              ...selected,
                              lineHeight: Math.max(1, Number(e.target.value)),
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="field">
                      Alignment
                      <select
                        value={selected.align || "left"}
                        onChange={(e) =>
                          updateMark({
                            ...selected,
                            align: e.target.value as Mark["align"],
                          })
                        }
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <label className="field range-label">
                    Stroke width <span>{selected?.stroke || stroke} pt</span>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={selected?.stroke || stroke}
                      onChange={(e) =>
                        selected
                          ? updateMark({
                              ...selected,
                              stroke: Number(e.target.value),
                            })
                          : setStroke(Number(e.target.value))
                      }
                    />
                  </label>
                )}
                {selected && (
                  <>
                    <label className="field range-label">
                      Opacity<span>{Math.round(selected.opacity * 100)}%</span>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={selected.opacity}
                        onChange={(e) =>
                          updateMark({
                            ...selected,
                            opacity: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    {["rectangle", "ellipse"].includes(selected.type) && (
                      <label className="field">
                        Fill
                        <select
                          value={selected.fill}
                          onChange={(e) =>
                            updateMark({ ...selected, fill: e.target.value })
                          }
                        >
                          <option value="none">No fill</option>
                          {colors.map((c) => (
                            <option value={c} key={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="field-pair">
                      <label className="field">
                        Width
                        <input
                          type="number"
                          min="1"
                          value={Math.round(Math.abs(selected.width))}
                          onChange={(e) =>
                            updateMark({
                              ...selected,
                              width: Math.max(1, Number(e.target.value)),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        Height
                        <input
                          type="number"
                          min="1"
                          value={Math.round(Math.abs(selected.height))}
                          onChange={(e) =>
                            updateMark({
                              ...selected,
                              height: Math.max(1, Number(e.target.value)),
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="field">
                      Rotation
                      <select
                        value={selected.rotation || 0}
                        onChange={(e) =>
                          updateMark({
                            ...selected,
                            rotation: Number(e.target.value),
                          })
                        }
                      >
                        <option value="0">0°</option>
                        <option value="90">90°</option>
                        <option value="180">180°</option>
                        <option value="270">270°</option>
                      </select>
                    </label>
                    <div className="selection-actions">
                      <button className="secondary" onClick={duplicateMark}>
                        <Copy size={14} />
                        Duplicate
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label="Delete selection"
                        onClick={removeMark}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <button
                      className="quiet"
                      onClick={() =>
                        changePage((p) => ({
                          ...p,
                          marks: [
                            ...p.marks.filter((m) => m.id !== selected.id),
                            selected,
                          ],
                        }))
                      }
                    >
                      Bring to front
                    </button>
                  </>
                )}
              </div>
              {tool === "whiteout" || selected?.type === "whiteout" ? (
                <div className="tool-tip warning">
                  <ScanLine size={18} />
                  <h4>A cover, not a redaction.</h4>
                  <p>
                    Whiteout hides content visually. The original information
                    can still be recovered.
                  </p>
                </div>
              ) : (
                <div className="tool-tip">
                  <MousePointer2 size={19} />
                  <h4>
                    {tool === "select"
                      ? "A place for every edit."
                      : tool === "text"
                        ? "Words where you need them."
                        : tool === "draw" || tool === "highlight"
                          ? "Go ahead. Make a mark."
                          : "Your document, your way."}
                  </h4>
                  <p>
                    {tool === "select"
                      ? "Select an added item to move or resize it. Click a form field to fill it in."
                      : tool === "text"
                        ? "Click anywhere on the page, then enter your text here."
                        : "Click and drag on the page to use the selected tool."}
                  </p>
                </div>
              )}
              <div className="inspector-footer">
                <ShieldCheck size={16} />
                <span>
                  Processed locally.
                  <br />
                  <strong>Never uploaded.</strong>
                </span>
              </div>
            </aside>
            <footer className="editor-status">
              <div>
                <span className="status-dot" />
                {dirty ? "Changes in this session" : "Ready to edit"}
                <span className="status-divider">/</span>
                <span className="status-desktop">
                  Download to keep your work
                </span>
              </div>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={activeIndex === 0}
                  onClick={() => jump(state.pages[activeIndex - 1].id)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  {activeIndex + 1} / {state.pages.length}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={activeIndex === state.pages.length - 1}
                  onClick={() => jump(state.pages[activeIndex + 1].id)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </footer>
          </>
        )}
      </main>
      {dragging && (
        <div className="drop-overlay">
          <Upload size={42} />
          <h2>Drop your PDF here.</h2>
          <p>It stays on your device.</p>
        </div>
      )}
      {busy && (
        <div className="busy-overlay" role="status">
          <div className="busy-card">
            <span className="spinner" />
            <h3>{busy}</h3>
            {progress > 0 && <progress value={progress} max="100" />}
            <p>Working locally on your device.</p>
          </div>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}
      {modal === "signature" && (
        <Signature
          onClose={() => setModal(null)}
          onError={setError}
          onUse={(data, ratio) => {
            setAsset({ data, ratio });
            setTool("sign");
            setModal(null);
            setNotice("Click the page to place your signature.");
          }}
        />
      )}
      {modal === "replace" && (
        <Modal title="Open another PDF?" onClose={() => setModal(null)}>
          <p>
            Your current edits are kept only in this session. Download them
            first if you want to keep them.
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setModal("export")}>
              Download current PDF
            </button>
            <button
              className="primary"
              onClick={() => {
                setModal(null);
                if (pendingFile.current) void importFile(pendingFile.current);
                pendingFile.current = null;
              }}
            >
              Open new PDF
            </button>
          </div>
        </Modal>
      )}
      {modal === "export" && (
        <Modal
          title="Ready when you are."
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <p className="muted">
            Your edits, saved as a regular PDF. Right to your device.
          </p>
          <label className="field">
            File name
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={flatten || organized}
              disabled={organized}
              onChange={(e) => setFlatten(e.target.checked)}
            />
            <span>
              Flatten form fields
              <small>
                {organized
                  ? "Page organization requires flattening forms in this version."
                  : "Make completed fields non-editable. Otherwise, keep forms interactive."}
              </small>
            </span>
          </label>
          <div className="export-summary">
            <FileText size={19} />
            <span>
              {state.pages.length} pages ·{" "}
              {state.pages.reduce((n, p) => n + p.marks.length, 0)} added edits
            </span>
            <LockKeyhole size={16} />
          </div>
          <p className="fine-print">
            Added annotations become page content. Whiteout does not securely
            remove underlying information.
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => setModal(null)}
            >
              Keep editing
            </button>
            <button
              className="primary"
              disabled={!!busy}
              onClick={() => void save()}
            >
              <ArrowDownToLine size={17} />
              {busy ? "Preparing…" : "Download PDF"}
            </button>
          </div>
          {busy && <p role="status">Preparing your PDF… {progress}%</p>}
        </Modal>
      )}
      {modal === "privacy" && (
        <Modal
          title="Your PDF never leaves your device."
          onClose={() => setModal(null)}
        >
          <div className="privacy-symbol">
            <ShieldCheck size={34} />
          </div>
          <p>
            The website delivers the editor. Your browser opens, renders, and
            changes the document locally. Downloads are created in your browser,
            too.
          </p>
          <ul className="privacy-list">
            <li>
              <Check size={17} />
              No document uploads or processing server
            </li>
            <li>
              <Check size={17} />
              No analytics, trackers, or remote fonts
            </li>
            <li>
              <Check size={17} />
              No accounts, subscriptions, or watermarks
            </li>
            <li>
              <Check size={17} />
              No automatic browser storage of documents
            </li>
          </ul>
          <p className="muted">
            The app loads its own scripts, PDF worker, and bundled fonts from
            this site. It does not fetch URLs embedded in your PDF or execute
            embedded PDF scripts. Your hosting provider may log normal requests
            for the app itself.
          </p>
          <p className="muted">
            Edits and signatures live in memory until you close or refresh the
            page. Download your work before leaving. Offline installation is
            planned for a later release.
          </p>
          <button className="primary full-width" onClick={() => setModal(null)}>
            Back to my workspace
          </button>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="A few useful shortcuts" onClose={() => setModal(null)}>
          <div className="shortcut-list">
            {[
              ["Undo", "⌘ / Ctrl + Z"],
              ["Redo", "⌘ / Ctrl + Shift + Z"],
              ["Download", "⌘ / Ctrl + S"],
              ["Copy / paste added item", "⌘ / Ctrl + C / V"],
              ["Delete selected item", "Delete / Backspace"],
              ["Nudge selection", "Arrow keys"],
              ["Nudge by 10 points", "Shift + Arrow"],
              ["Deselect", "Esc"],
              ["Select / Text / Draw", "V / T / D"],
              ["Highlight / Sign / Whiteout", "H / S / W"],
            ].map(([name, key]) => (
              <div key={name}>
                <span>{name}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Add new text or cover and replace content. Direct editing of
            existing PDF text and secure redaction are not supported.
          </p>
        </Modal>
      )}
    </div>
  );
}
