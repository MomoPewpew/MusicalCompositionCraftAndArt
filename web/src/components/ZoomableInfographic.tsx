"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DRAG_THRESHOLD_PX = 5;
const CLICK_MAX_MS = 300;

type Pan = { x: number; y: number };

type ZoomableInfographicProps = {
  src: string;
  alt: string;
};

export function ZoomableInfographic({ src, alt }: ZoomableInfographicProps) {
  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [zoomWidth, setZoomWidth] = useState<number | null>(null);

  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const panAtPointerDown = useRef<Pan>({ x: 0, y: 0 });
  const dragged = useRef(false);

  const resetZoom = useCallback(() => {
    setZoomed(false);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
    pointerStart.current = null;
    dragged.current = false;
  }, []);

  useEffect(() => {
    if (!zoomed) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") resetZoom();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [zoomed, resetZoom]);

  const onZoomImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setZoomWidth(Math.max(img.naturalWidth, window.innerWidth * 0.9));
  };

  const onOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    panAtPointerDown.current = pan;
    dragged.current = false;
    setIsDragging(false);
  };

  const onOverlayPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current) return;

    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;

    if (
      !dragged.current &&
      (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)
    ) {
      dragged.current = true;
      setIsDragging(true);
    }

    if (dragged.current) {
      setPan({
        x: panAtPointerDown.current.x + dx,
        y: panAtPointerDown.current.y + dy
      });
    }
  };

  const onOverlayPointerUp = () => {
    if (!pointerStart.current) return;

    const elapsed = Date.now() - pointerStart.current.time;
    if (!dragged.current && elapsed <= CLICK_MAX_MS) {
      resetZoom();
      return;
    }

    pointerStart.current = null;
    dragged.current = false;
    setIsDragging(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setZoomWidth(null);
          setZoomed(true);
        }}
        className={[
          "group mx-auto block w-full max-w-3xl cursor-zoom-in rounded-xl border border-black/10 bg-white p-3",
          "transition hover:border-black/20 hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
          "dark:border-white/10 dark:bg-zinc-900/40 dark:hover:border-white/20",
          "dark:focus-visible:ring-white/20"
        ].join(" ")}
        aria-label={`Zoom ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static infographic PNG */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="mx-auto block h-auto max-h-[min(70vh,720px)] w-full object-contain"
        />
        <p className="mt-2 text-center text-xs text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">
          Click to zoom · drag to pan · click again to close
        </p>
      </button>

      {zoomed ? (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label={`Zoomed view: ${alt}`}
          onPointerDown={onOverlayPointerDown}
          onPointerMove={onOverlayPointerMove}
          onPointerUp={onOverlayPointerUp}
          onPointerCancel={onOverlayPointerUp}
          style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static infographic PNG */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            onLoad={onZoomImageLoad}
            className="pointer-events-none absolute left-1/2 top-6 max-w-none select-none"
            style={{
              transform: `translate(calc(-50% + ${pan.x}px), ${pan.y}px)`,
              width: zoomWidth ? `${zoomWidth}px` : "90vw",
              height: "auto"
            }}
          />
        </div>
      ) : null}
    </>
  );
}
