import { useRef, useState } from "react";
import { Undo2, Upload, Trash2 } from "lucide-react";
import Modal from "./Modal";
import "@fontsource/caveat/latin-400.css";
import type { Point } from "../state/model";
export async function readImage(
  file: File,
): Promise<{ data: string; width: number; height: number }> {
  if (!["image/png", "image/jpeg"].includes(file.type))
    throw new Error("Choose a PNG or JPEG image.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("This image could not be opened."));
    reader.readAsDataURL(file);
  });
  const img = new Image();
  img.src = data;
  await img.decode();
  return { data, width: img.naturalWidth, height: img.naturalHeight };
}
export default function Signature({
  onClose,
  onUse,
  onError,
}: {
  onClose: () => void;
  onUse: (data: string, ratio: number) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<"draw" | "type" | "upload">("draw");
  const [name, setName] = useState("");
  const [paths, setPaths] = useState<Point[][]>([]);
  const active = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const point = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * 520) / rect.width,
      y: ((e.clientY - rect.top) * 200) / rect.height,
    };
  };
  const use = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1040;
    canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#192c23";
    ctx.fillStyle = "#192c23";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (mode === "type") {
      await document.fonts.load("60px Caveat");
      ctx.font = "60px Caveat";
      const size = Math.min(
        60,
        (480 / Math.max(1, ctx.measureText(name).width)) * 60,
      );
      ctx.font = `${size}px Caveat`;
      ctx.fillText(name, 20, 128);
    } else
      paths.forEach((path) => {
        ctx.beginPath();
        path.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.stroke();
      });
    onUse(canvas.toDataURL("image/png"), 2.6);
  };
  return (
    <Modal title="Make your mark" onClose={onClose}>
      <p className="muted">A signature, kept only in this editing session.</p>
      <div className="segmented">
        {(["draw", "type", "upload"] as const).map((m) => (
          <button
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => setMode(m)}
          >
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      {mode === "draw" && (
        <>
          <svg
            className="signature-pad"
            viewBox="0 0 520 200"
            aria-label="Draw your signature"
            onPointerDown={(e) => {
              active.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              setPaths((p) => [...p, [point(e)]]);
            }}
            onPointerMove={(e) => {
              if (!active.current) return;
              const p = point(e);
              setPaths((paths) => [
                ...paths.slice(0, -1),
                [...paths.at(-1)!, p],
              ]);
            }}
            onPointerUp={() => (active.current = false)}
            onPointerCancel={() => (active.current = false)}
          >
            {paths.map((p, i) => (
              <polyline
                key={i}
                points={p.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#192c23"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
          <div className="row">
            <button
              className="quiet"
              disabled={!paths.length}
              onClick={() => setPaths((p) => p.slice(0, -1))}
            >
              <Undo2 size={15} />
              Undo stroke
            </button>
            <button className="quiet" onClick={() => setPaths([])}>
              <Trash2 size={15} />
              Clear
            </button>
          </div>
        </>
      )}
      {mode === "type" && (
        <>
          <label className="field">
            Your name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Morgan"
            />
          </label>
          <div className="typed-signature">{name || "Your signature"}</div>
        </>
      )}
      {mode === "upload" && (
        <button
          className="upload-signature"
          onClick={() => input.current?.click()}
        >
          <Upload />
          Choose a PNG or JPEG<span>Transparent PNG works best</span>
        </button>
      )}
      <input
        ref={input}
        hidden
        type="file"
        accept="image/png,image/jpeg"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file)
            try {
              const img = await readImage(file);
              onUse(img.data, img.width / img.height);
            } catch (error) {
              onError(String(error));
            }
        }}
      />
      <p className="fine-print">
        This adds a visual signature, not a certificate-based digital signature.
      </p>
      <div className="modal-actions">
        <button className="secondary" onClick={onClose}>
          Cancel
        </button>
        {mode !== "upload" && (
          <button
            className="primary"
            disabled={
              mode === "type" ? !name.trim() : !paths.some((p) => p.length > 1)
            }
            onClick={() => void use()}
          >
            Use signature
          </button>
        )}
      </div>
    </Modal>
  );
}
