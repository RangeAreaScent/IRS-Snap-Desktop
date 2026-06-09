import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "snap.listWidth";
const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const RAIL_WIDTH = 84;

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return clamp(n);
  } catch {}
  return DEFAULT_WIDTH;
}

function clamp(n: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n));
}

function applyWidth(px: number) {
  document.documentElement.style.setProperty("--list-width", `${px}px`);
}

export function Splitter() {
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef<number>(loadWidth());

  // Apply the stored width as soon as we mount — avoids the React-paint flash
  // where the default 380px shows for a frame before the user's preference
  // lands.
  useEffect(() => {
    applyWidth(widthRef.current);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const next = clamp(e.clientX - RAIL_WIDTH);
      widthRef.current = next;
      applyWidth(next);
    }
    function onUp() {
      setDragging(false);
      try {
        localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      } catch {}
    }
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  return (
    <div
      className={`splitter${dragging ? " splitter--dragging" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize"
    />
  );
}
