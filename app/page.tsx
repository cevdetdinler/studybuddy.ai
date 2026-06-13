"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const A = "https://qclay.design/lovable/sixsense";

/* ------------------------------------------------------------------ */
/* Pixel grid background                                               */
/* ------------------------------------------------------------------ */

const COLS = 12;
const ROWS = 16;
const TILE = 32;
const GAP = 1;
const GRID_W = COLS * (TILE + GAP) - GAP;
const GRID_H = ROWS * (TILE + GAP) - GAP;
const BASE_FILL_RATIO = 0.35;
const HOVER_FILL_RATIO = 0.7;

let spriteCache: Promise<HTMLCanvasElement[]> | null = null;

function loadSprites(dpr: number) {
  if (!spriteCache) {
    const names = [
      "tile-empty.svg",
      "tile-1.svg",
      "tile-2.svg",
      "tile-3.svg",
      "tile-4.svg",
      "tile-5.svg",
    ];
    spriteCache = Promise.all(
      names.map(
        (n) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = `/tiles/${n}`;
          })
      )
    ).then((imgs) =>
      imgs.map((img) => {
        const c = document.createElement("canvas");
        c.width = TILE * dpr;
        c.height = TILE * dpr;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return c;
      })
    );
  }
  return spriteCache;
}

function PixelGrid({ side }: { side: "left" | "right" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = GRID_W * dpr;
    canvas.height = GRID_H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const total = COLS * ROWS;
    const on = new Uint8Array(total);
    const sprite = new Uint8Array(total);
    const base = new Uint8Array(total);
    const hover = new Set<number>();
    let sprites: HTMLCanvasElement[] | null = null;
    let disposed = false;
    let rafId = 0;
    const timers: number[] = [];

    for (let i = 0; i < total; i++) {
      sprite[i] = 1 + Math.floor(Math.random() * 5);
      if (Math.random() < BASE_FILL_RATIO) base[i] = 1;
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const randomSprite = (i: number) => {
      sprite[i] = 1 + Math.floor(Math.random() * 5);
    };

    const draw = () => {
      if (!sprites) return;
      ctx.clearRect(0, 0, GRID_W, GRID_H);
      for (let i = 0; i < total; i++) {
        const x = (i % COLS) * (TILE + GAP);
        const y = Math.floor(i / COLS) * (TILE + GAP);
        ctx.drawImage(on[i] ? sprites[sprite[i]] : sprites[0], x, y, TILE, TILE);
      }
    };

    loadSprites(dpr).then((s) => {
      if (disposed) return;
      sprites = s;

      if (reduced) {
        for (let i = 0; i < total; i++) on[i] = base[i];
        draw();
        return;
      }

      // Reveal: fisher-yates shuffled order over base-filled cells.
      const order: number[] = [];
      for (let i = 0; i < total; i++) if (base[i]) order.push(i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const perTick = Math.max(1, Math.ceil(order.length / 18));
      let p = 0;
      const reveal = () => {
        for (let k = 0; k < perTick && p < order.length; k++, p++) {
          on[order[p]] = 1;
        }
        draw();
        if (p < order.length) rafId = requestAnimationFrame(reveal);
      };
      draw();
      rafId = requestAnimationFrame(reveal);

      // Ambient flicker: toggle 3 random non-hovered cells, indefinitely.
      const ambient = () => {
        for (let k = 0; k < 3; k++) {
          const i = Math.floor(Math.random() * total);
          if (hover.has(i)) continue;
          on[i] = Math.random() < BASE_FILL_RATIO ? 1 : 0;
          if (on[i]) randomSprite(i);
        }
        draw();
        timers.push(window.setTimeout(ambient, 120 + Math.random() * 180));
      };
      timers.push(window.setTimeout(ambient, 120 + Math.random() * 180));

      // Hover flicker: re-randomize ~18% of hovered cells.
      const hoverFlicker = () => {
        if (hover.size > 0) {
          hover.forEach((i) => {
            if (Math.random() < 0.18) {
              on[i] = Math.random() < HOVER_FILL_RATIO ? 1 : 0;
              if (on[i]) randomSprite(i);
            }
          });
          draw();
        }
        timers.push(window.setTimeout(hoverFlicker, 70 + Math.random() * 90));
      };
      timers.push(window.setTimeout(hoverFlicker, 70 + Math.random() * 90));
    });

    // Hover blob: organic radius around cursor, rAF-throttled pointermove.
    let pending = false;
    let px = -1e4;
    let py = -1e4;
    const reconcile = () => {
      pending = false;
      if (disposed || !sprites) return;
      const rect = canvas.getBoundingClientRect();
      const cx = (px - rect.left) / (TILE + GAP);
      const cy = (py - rect.top) / (TILE + GAP);
      const t = performance.now();
      const next = new Set<number>();
      for (let i = 0; i < total; i++) {
        const gx = (i % COLS) + 0.5;
        const gy = Math.floor(i / COLS) + 0.5;
        const dx = gx - cx;
        const dy = gy - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > 7) continue;
        const ang = Math.atan2(dy, dx);
        const n =
          Math.sin(ang * 3 + t * 0.0011) * 0.55 +
          Math.sin(ang * 5 - t * 0.0017 + 1.3) * 0.3 +
          Math.sin(ang * 2 + t * 0.0007 + 2.1) * 0.2;
        const rMax = 4 * (0.95 + n * 0.3);
        if (dist <= rMax - 0.5) {
          next.add(i);
        } else if (dist <= rMax + 0.4) {
          const edge =
            (Math.sin(gx * 12.9898 + gy * 78.233 + t * 0.002) + 1) * 0.5;
          if (edge > 0.45) next.add(i);
        }
      }
      next.forEach((i) => {
        if (!hover.has(i)) {
          hover.add(i);
          on[i] = Math.random() < HOVER_FILL_RATIO ? 1 : 0;
          if (on[i]) randomSprite(i);
        }
      });
      hover.forEach((i) => {
        if (!next.has(i)) {
          hover.delete(i);
          on[i] = base[i];
        }
      });
      draw();
    };
    const onMove = (e: PointerEvent) => {
      if (reduced) return;
      px = e.clientX;
      py = e.clientY;
      if (!pending) {
        pending = true;
        requestAnimationFrame(reconcile);
      }
    };
    window.addEventListener("pointermove", onMove);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      timers.forEach(clearTimeout);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const mask =
    side === "left"
      ? "radial-gradient(ellipse 80% 80% at 30% 50%, black 0%, transparent 75%)"
      : "radial-gradient(ellipse 80% 80% at 70% 50%, black 0%, transparent 75%)";

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        [side]: 0,
        top: "50%",
        transform: "translateY(-40%)",
        zIndex: 0,
        pointerEvents: "none",
        width: GRID_W,
        height: GRID_H,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Folder / lights stack + floating cards                              */
/* ------------------------------------------------------------------ */

const FOLDER_W = 113.67;
const FOLDER_CX = FOLDER_W / 2;

type StackItem = {
  src: string;
  bottom: number;
  left: number;
  centered: boolean;
  w: number;
  h: number;
  rise: boolean;
  dur: number;
  delay: number;
};

const STACK: StackItem[] = [
  { src: "blue-light-2.svg", bottom: 50, left: 54.6, centered: true, w: 104, h: 170, rise: false, dur: 0.8, delay: 1.0 },
  { src: "blue-light.svg", bottom: 28, left: 54.6, centered: true, w: 104, h: 170, rise: false, dur: 0.8, delay: 1.0 },
  { src: "light-1.svg", bottom: 35, left: 57.2, centered: true, w: 180.5, h: 124.5, rise: false, dur: 1.0, delay: 1.0 },
  { src: "folder-3.svg", bottom: 60, left: 23.4, centered: false, w: 69.71, h: 45, rise: true, dur: 0.6, delay: 0.8 },
  { src: "small-light-2.svg", bottom: 55, left: 67.6, centered: true, w: 39, h: 17, rise: false, dur: 0.6, delay: 1.4 },
  { src: "small-light.svg", bottom: 50, left: 44.2, centered: true, w: 39, h: 25, rise: false, dur: 0.6, delay: 1.4 },
  { src: "folder-2.svg", bottom: 45, left: 18.98, centered: false, w: 79, h: 51, rise: true, dur: 0.6, delay: 0.6 },
  { src: "light-2.svg", bottom: 20, left: 57.2, centered: true, w: 109, h: 162.5, rise: false, dur: 1.0, delay: 1.1 },
  { src: "folder-1.svg", bottom: 30, left: 13, centered: false, w: 91, h: 58, rise: true, dur: 0.6, delay: 0.4 },
  { src: "folder-0.svg?v=2", bottom: 0, left: 0, centered: false, w: FOLDER_W, h: 76.5, rise: true, dur: 0.6, delay: 0.0 },
];

type Card = {
  src: string;
  w: number;
  h: number;
  x: number;
  y: number;
  r: number;
  sx: number;
  sy: number;
  idleY: number[];
  idleR: number[];
  idleDur: number;
};

const CARDS: Card[] = [
  {
    src: "image-1.png", w: 88.55, h: 68.46, x: -82, y: 123, r: -16, sx: -5, sy: 7,
    idleY: [0, -6, 0, 4, 0], idleR: [0, -2, 0, 2, 0], idleDur: 6,
  },
  {
    src: "image-2.png", w: 105, h: 87, x: 68, y: 124, r: 24, sx: 35, sy: 33,
    idleY: [0, 5, 0, -5, 0], idleR: [0, 2, 0, -2, 0], idleDur: 7,
  },
  {
    src: "image-3.png", w: 105, h: 96, x: -4, y: 148, r: -4, sx: -4, sy: 27,
    idleY: [0, -4, 0, 6, 0], idleR: [0, -1.5, 0, 1.5, 0], idleDur: 8,
  },
];

function FolderStack() {
  const [hovered, setHovered] = useState<number | null>(null);
  const anyHover = hovered !== null;

  return (
    <div
      style={{
        position: "relative",
        width: FOLDER_W,
        height: 220,
        overflow: "visible",
      }}
    >
      {STACK.map((item, zi) =>
        item.rise ? (
          <motion.img
            key={item.src}
            src={`${A}/${item.src}`}
            alt=""
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: item.dur,
              delay: item.delay,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              position: "absolute",
              bottom: item.bottom,
              left: item.left,
              width: item.w,
              height: item.h,
              zIndex: zi + 1,
              pointerEvents: "none",
            }}
          />
        ) : (
          <motion.img
            key={item.src}
            src={`${A}/${item.src}`}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: item.dur, delay: item.delay, ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: item.bottom,
              left: item.left,
              width: item.w,
              height: item.h,
              zIndex: zi + 1,
              transform: "translateX(-50%)",
              pointerEvents: "none",
            }}
          />
        )
      )}

      {CARDS.map((c, i) => (
        <motion.div
          key={c.src}
          onHoverStart={() => setHovered(i)}
          onHoverEnd={() => setHovered((h) => (h === i ? null : h))}
          initial={{
            opacity: 0,
            width: 20,
            height: 20,
            left: FOLDER_CX + c.sx,
            bottom: c.sy,
            rotate: 0,
            x: "-50%",
          }}
          animate={{
            opacity: 1,
            width: c.w,
            height: c.h,
            left: FOLDER_CX + c.x,
            bottom: c.y,
            rotate: c.r,
            x: "-50%",
            scale: hovered === i ? 1.08 : 1,
          }}
          transition={{
            duration: 1.4,
            delay: 0.6 + i * 0.25,
            ease: [0.16, 1, 0.3, 1],
            scale: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0 },
          }}
          style={{
            position: "absolute",
            transformOrigin: "50% 100%",
            zIndex: hovered === i ? 20 : 12 + i,
            cursor: "pointer",
          }}
        >
          <motion.div
            animate={anyHover ? { y: 0, rotate: 0 } : { y: c.idleY, rotate: c.idleR }}
            transition={
              anyHover
                ? { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
                : { duration: c.idleDur, repeat: Infinity, ease: "easeInOut" }
            }
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow:
                "0 16px 40px rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.10)",
            }}
          >
            <img
              src={`${A}/${c.src}`}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              draggable={false}
            />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Typewriter                                                          */
/* ------------------------------------------------------------------ */

const PHRASES = [
  "Summarize chapter 5 of my biology notes",
  "Quiz me on the French Revolution",
  "Make flashcards for my physics exam",
  "Explain photosynthesis like I'm 12",
  "Find the key definitions in my lecture slides",
];

function useTypewriter(phrases: string[]) {
  const [text, setText] = useState("");

  useEffect(() => {
    let phrase = 0;
    let pos = 0;
    let deleting = false;
    let timer = 0;

    const tick = () => {
      const p = phrases[phrase];
      if (!deleting) {
        pos++;
        setText(p.slice(0, pos));
        if (pos === p.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1400);
        } else {
          timer = window.setTimeout(tick, 22 + Math.random() * 25);
        }
      } else {
        pos--;
        setText(p.slice(0, pos));
        if (pos === 0) {
          deleting = false;
          phrase = (phrase + 1) % phrases.length;
        }
        timer = window.setTimeout(tick, 14);
      }
    };

    timer = window.setTimeout(tick, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return text;
}

/* ------------------------------------------------------------------ */
/* Send button                                                         */
/* ------------------------------------------------------------------ */

function SendButton({ onClick }: { onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [arrowToggle, setArrowToggle] = useState(0);
  const ringRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef(false);
  const angleRef = useRef(0);
  const speedRef = useRef(0);
  const lastRef = useRef(0);
  const runningRef = useRef(false);
  const rafRef = useRef(0);

  const step = useCallback((now: number) => {
    const dt = Math.min(now - lastRef.current, 64);
    lastRef.current = now;
    const target = hoveredRef.current ? 360 / 1500 : 0;
    const tau = hoveredRef.current ? 250 : 700;
    const k = 1 - Math.exp(-dt / tau);
    speedRef.current += (target - speedRef.current) * k;
    angleRef.current = (angleRef.current + speedRef.current * dt) % 360;
    if (ringRef.current) {
      ringRef.current.style.transform = `rotate(${angleRef.current}deg)`;
    }
    if (!hoveredRef.current && speedRef.current < 0.0005) {
      runningRef.current = false;
      return;
    }
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const startSpin = useCallback(() => {
    if (!runningRef.current) {
      runningRef.current = true;
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(step);
    }
  }, [step]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const ringMask =
    "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)";

  return (
    <motion.div
      onHoverStart={() => {
        setHovered(true);
        hoveredRef.current = true;
        setArrowToggle((n) => n + 1);
        startSpin();
      }}
      onHoverEnd={() => {
        setHovered(false);
        hoveredRef.current = false;
      }}
      onClick={onClick}
      animate={{ scale: hovered ? 1.05 : 1 }}
      transition={{ duration: 0.2 }}
      style={{
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
        y: "10%",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 15,
          background: "rgba(151,195,255,0.15)",
          zIndex: 1,
        }}
      />
      <div style={{ position: "relative", width: 36, height: 36, zIndex: 2 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            background: "linear-gradient(180deg, #70A8F2 0%, #3D82DE 100%)",
            padding: 8,
            overflow: "hidden",
            zIndex: 2,
            boxShadow:
              "inset 0 1px 18px 2px rgba(173,208,255,0.20), inset 0 1px 4px 2px rgba(222,236,255,0.80), 0 42px 107px 0 rgba(61,130,222,0.34), 0 10px 10px 0 rgba(61,130,222,0.20), 0 3.714px 4.846px 0 rgba(61,130,222,0.15)",
          }}
        >
          <img
            src={`${A}/dots.svg`}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.7,
              zIndex: 2,
            }}
          />
        </div>

        {/* Spinning conic ring */}
        <div
          ref={ringRef}
          style={{
            position: "absolute",
            inset: -1,
            borderRadius: 13,
            padding: 1,
            zIndex: 3,
            pointerEvents: "none",
            background:
              "conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, #FFFFFF 60deg, #9EC7FF 120deg, rgba(255,255,255,0) 200deg, rgba(255,255,255,0) 360deg)",
            WebkitMask: ringMask,
            WebkitMaskComposite: "xor",
            mask: ringMask,
            maskComposite: "exclude",
          }}
        />

        {/* Static fallback border */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            border: "1px solid #9EC7FF",
            zIndex: 4,
            pointerEvents: "none",
          }}
        />

        {/* Hover shine sweep — plays once per hover */}
        {arrowToggle > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              overflow: "hidden",
              zIndex: 4,
              pointerEvents: "none",
            }}
          >
            <motion.div
              key={`blink-${arrowToggle}`}
              initial={{ x: "-120%" }}
              animate={{ x: "120%" }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: "absolute",
                inset: 0,
                mixBlendMode: "screen",
                background:
                  "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)",
              }}
            />
          </div>
        )}

        {/* Arrow swap */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
          }}
        >
          <div
            style={{
              position: "relative",
              width: 16,
              height: 16,
              overflow: "hidden",
            }}
          >
            {arrowToggle === 0 ? (
              <img
                src={`${A}/arrow-up.svg`}
                alt=""
                style={{ position: "absolute", inset: 0, width: 16, height: 16 }}
              />
            ) : (
              <>
                <motion.img
                  key={`out-${arrowToggle}`}
                  src={`${A}/arrow-up.svg`}
                  alt=""
                  initial={{ y: 0, opacity: 1 }}
                  animate={{ y: -16, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.65, 0, 0.35, 1] }}
                  style={{ position: "absolute", inset: 0, width: 16, height: 16 }}
                />
                <motion.img
                  key={`in-${arrowToggle}`}
                  src={`${A}/arrow-up.svg`}
                  alt=""
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.32, ease: [0.65, 0, 0.35, 1] }}
                  style={{ position: "absolute", inset: 0, width: 16, height: 16 }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const MODES = [
  { id: "chat", label: "AI Tutor" },
  { id: "search", label: "Search" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quiz", label: "Quiz" },
  { id: "eli12", label: "ELI12" },
] as const;

type ModeId = (typeof MODES)[number]["id"];

type UploadedDoc = { documentId: string; documentName: string };

export default function Landing() {
  const router = useRouter();
  const typed = useTypewriter(PHRASES);

  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [mode, setMode] = useState<ModeId>("chat");
  const [modeOpen, setModeOpen] = useState(false);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `Upload failed (${res.status})`);
        setDocs((d) => [
          ...d,
          { documentId: j.documentId, documentName: j.documentName },
        ]);
      }
    } catch (e: any) {
      setUploadError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeDoc(id: string) {
    setDocs((d) => d.filter((x) => x.documentId !== id));
    fetch(`/api/documents?documentId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  function submit() {
    if (uploading) return;
    const params = new URLSearchParams();
    const q = input.trim();
    if (q) params.set("q", q);
    if (mode !== "chat") params.set("tab", mode);
    // Scope the study session to the uploaded doc when there's exactly one;
    // with several, leave it on "All documents".
    if (docs.length === 1) params.set("doc", docs[0].documentId);
    const qs = params.toString();
    router.push(qs ? `/study?${qs}` : "/study");
  }

  const modeLabel = MODES.find((m) => m.id === mode)!.label;

  const toolBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.80)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  };

  return (
    <div
      style={{
        background: "#EEF1F7",
        minHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: '"Inter Tight", sans-serif',
        color: "#0D1B4B",
        colorScheme: "light",
      }}
    >
      {/* 1. Pixel-grid backgrounds */}
      <PixelGrid side="left" />
      <PixelGrid side="right" />

      {/* 2. Navbar */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          zIndex: 50,
          background: "transparent",
        }}
      >
        <div
          style={{
            marginTop: 22,
            marginLeft: 22,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.3px",
              color: "#11315D",
              whiteSpace: "nowrap",
            }}
          >
            StudyBuddy AI
          </span>
        </div>
      </nav>

      {/* 3. Left sidebar */}
      <div
        style={{
          position: "fixed",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          className="landing-icon-filled"
          onClick={() => router.push("/study")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
          aria-label="Chat"
        >
          <img src={`${A}/chat.svg`} alt="" style={{ width: 18, height: 18 }} />
        </button>
        <button
          className="landing-icon-ghost"
          onClick={() => router.push("/study?tab=search")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
          aria-label="Search"
        >
          <img src={`${A}/search.svg`} alt="" style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* 4. Main column */}
      <main
        style={{
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 60,
          maxWidth: 760,
          width: "100%",
          position: "relative",
        }}
      >
        <FolderStack />

        {/* 4c. Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          style={{
            fontSize: 32,
            fontWeight: 400,
            lineHeight: "32px",
            letterSpacing: "-0.64px",
            color: "#11315D",
            width: 385,
            maxWidth: "100%",
            margin: "32px auto 8px",
            textAlign: "center",
          }}
        >
          Let&apos;s turn your notes
          <br />
          into real understanding
        </motion.h1>

        {/* 4d. Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: "rgba(13,27,75,0.50)",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          What would you like to study today?
        </motion.p>

        {/* 4e. Prompt input box */}
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.55, ease: "easeOut" }}
          style={{
            width: 702,
            maxWidth: "100%",
            padding: 4,
            borderRadius: 24,
            border: "0.5px solid rgba(0,0,0,0.05)",
            background: "rgba(157,196,250,0.15)",
            backdropFilter: "blur(50px)",
            WebkitBackdropFilter: "blur(50px)",
          }}
        >
          <div
            style={{
              width: "100%",
              height: 116,
              background: "#FFFFFF",
              borderRadius: 20,
              border: "1px solid rgba(34,106,205,0.05)",
              padding: "14px 14px 12px 16px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Prompt input with typewriter placeholder */}
            <div style={{ position: "relative", flex: 1, minHeight: 32 }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                aria-label="What would you like to study?"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  resize: "none",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 15,
                  lineHeight: "22px",
                  fontWeight: 400,
                  fontFamily: "inherit",
                  color: "#0D1B4B",
                  padding: 0,
                }}
              />
              {input === "" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    fontSize: 15,
                    lineHeight: "22px",
                    fontWeight: 400,
                    color: "rgba(13,27,75,0.45)",
                    display: "flex",
                    alignItems: "flex-start",
                    pointerEvents: "none",
                  }}
                >
                  <span>{typed}</span>
                  {!inputFocused && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 2,
                        height: 18,
                        background: "#0D1B4B",
                        marginLeft: 2,
                        marginTop: 2,
                        animation: "promptCaretBlink 1s steps(1) infinite",
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Bottom toolbar */}
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transform: "translateY(35%)",
                }}
              >
                {/* Mode selector pill */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setModeOpen((o) => !o)}
                    aria-label="Select study mode"
                    aria-expanded={modeOpen}
                    style={{
                      width: "auto",
                      height: 28,
                      background: "#E8F1FF",
                      border: "none",
                      borderRadius: 8,
                      padding: "0 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        flexShrink: 0,
                        background:
                          "linear-gradient(166deg, #A0E4FF 9.8%, #9CA4FB 184.41%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={`${A}/ai-select.svg`}
                        alt=""
                        style={{ width: 8, height: 8 }}
                      />
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        lineHeight: "16px",
                        color: "#5085CE",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {modeLabel}
                    </span>
                    <ChevronDown size={12} color="#5085CE" strokeWidth={2} />
                  </button>

                  {modeOpen && (
                    <>
                      <div
                        onClick={() => setModeOpen(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 30 }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: 34,
                          left: 0,
                          zIndex: 31,
                          background: "#FFFFFF",
                          border: "1px solid rgba(34,106,205,0.12)",
                          borderRadius: 10,
                          boxShadow: "0 12px 32px rgba(13,27,75,0.12)",
                          padding: 4,
                          minWidth: 130,
                        }}
                      >
                        {MODES.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setMode(m.id);
                              setModeOpen(false);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                              background: m.id === mode ? "#E8F1FF" : "transparent",
                              color: m.id === mode ? "#5085CE" : "rgba(13,27,75,0.75)",
                            }}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  style={{ display: "none" }}
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  style={toolBtn}
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Attach notes (PDF, .txt, .md)"
                >
                  <img src={`${A}/Capa_1.svg`} alt="" style={{ width: 14, height: 14 }} />
                </button>

                {(uploading || docs.length > 0 || uploadError) && (
                  <div
                    style={{
                      width: 1,
                      height: 18,
                      background: "rgba(0,0,0,0.12)",
                      margin: "0 2px",
                    }}
                  />
                )}

                {uploading && (
                  <div
                    style={{
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      color: "rgba(13,27,75,0.55)",
                    }}
                  >
                    <Loader2 size={13} className="animate-spin" />
                    Uploading…
                  </div>
                )}

                {/* Uploaded document pills */}
                {docs.map((d) => (
                  <div
                    key={d.documentId}
                    style={{
                      height: 28,
                      background: "rgba(0,0,0,0.05)",
                      borderRadius: 6,
                      padding: "0 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      maxWidth: 160,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "rgba(13,27,75,0.65)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={d.documentName}
                    >
                      {d.documentName}
                    </span>
                    <button
                      onClick={() => removeDoc(d.documentId)}
                      aria-label={`Remove ${d.documentName}`}
                      style={{
                        fontSize: 12,
                        color: "rgba(0,0,0,0.35)",
                        marginLeft: 2,
                        cursor: "pointer",
                        border: "none",
                        background: "transparent",
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {uploadError && (
                  <span style={{ fontSize: 12, color: "#D14343" }}>
                    {uploadError}
                  </span>
                )}
              </div>

              <SendButton onClick={submit} />
            </div>
          </div>
        </motion.div>
      </main>

      {/* 5. Footer */}
      <footer
        style={{
          position: "fixed",
          bottom: 20,
          left: 0,
          width: "100%",
          zIndex: 5,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 400,
          color: "rgba(13,27,75,0.45)",
        }}
      >
        By sending a message to StudyBuddy AI, you agree to our{" "}
        <span
          style={{
            color: "rgba(13,27,75,0.65)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            cursor: "pointer",
          }}
        >
          Terms
        </span>{" "}
        and have read our{" "}
        <span
          style={{
            color: "rgba(13,27,75,0.65)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            cursor: "pointer",
          }}
        >
          Privacy Policy.
        </span>
      </footer>
    </div>
  );
}
