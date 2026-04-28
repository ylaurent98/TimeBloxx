import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  resizable?: boolean;
  movable?: boolean;
  moveId?: string;
  storageScope?: string;
}

const safeSegment = (value: string) => value.replace(/\s+/g, "-").toLowerCase();
const SNAP_GRID_PX = 16;
const snapToGrid = (value: number) => Math.round(value / SNAP_GRID_PX) * SNAP_GRID_PX;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const positionStorageKey = (scope: string, moveId: string) =>
  `timebloxx.integrations.cardPosition.${safeSegment(scope)}.${safeSegment(moveId)}`;
const sizeStorageKey = (scope: string, moveId: string) =>
  `timebloxx.integrations.cardSize.${safeSegment(scope)}.${safeSegment(moveId)}`;

export const SectionCard = ({
  title,
  subtitle,
  actions,
  className = "",
  titleClassName = "",
  resizable = false,
  movable = false,
  moveId,
  storageScope = "local",
  children,
}: SectionCardProps) => {
  const cardId = moveId ?? title;
  const offsetStorageKey = positionStorageKey(storageScope, cardId);
  const resizeStorageKey = sizeStorageKey(storageScope, cardId);
  const sectionRef = useRef<HTMLElement | null>(null);
  const skipFirstResizePersistRef = useRef(true);
  const [offset, setOffset] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = window.localStorage.getItem(offsetStorageKey);
      if (!raw) {
        return { x: 0, y: 0 };
      }
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      return {
        x: Number.isFinite(parsed.x) ? Number(parsed.x) : 0,
        y: Number.isFinite(parsed.y) ? Number(parsed.y) : 0,
      };
    } catch {
      return { x: 0, y: 0 };
    }
  });
  const dragOriginRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );
  const [savedSize, setSavedSize] = useState<{ width?: number; height?: number }>(() => {
    try {
      const raw = window.localStorage.getItem(resizeStorageKey);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as { width?: number; height?: number };
      return {
        width: Number.isFinite(parsed.width) ? Number(parsed.width) : undefined,
        height: Number.isFinite(parsed.height) ? Number(parsed.height) : undefined,
      };
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!movable) {
      return;
    }
    window.localStorage.setItem(offsetStorageKey, JSON.stringify(offset));
  }, [movable, offset, offsetStorageKey]);

  useEffect(() => {
    if (!movable || !sectionRef.current) {
      return;
    }

    const clampToViewport = () => {
      const card = sectionRef.current;
      if (!card) {
        return;
      }
      const boundary =
        (card.closest('[data-drag-boundary="dashboard"]') as HTMLElement | null) ??
        card.parentElement;
      if (!boundary) {
        return;
      }
      const parentRect = boundary.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const naturalLeft = cardRect.left - offset.x;
      const naturalTop = cardRect.top - offset.y;
      const minX = Math.ceil(parentRect.left + 8 - naturalLeft);
      const maxX = Math.floor(parentRect.right - 8 - naturalLeft - cardRect.width);
      const minY = Math.ceil(parentRect.top + 8 - naturalTop);
      const maxY = Math.floor(parentRect.bottom - 8 - naturalTop - cardRect.height);
      const boundedMinX = Math.min(minX, maxX);
      const boundedMaxX = Math.max(minX, maxX);
      const boundedMinY = Math.min(minY, maxY);
      const boundedMaxY = Math.max(minY, maxY);
      const nextX = snapToGrid(clamp(offset.x, boundedMinX, boundedMaxX));
      const nextY = snapToGrid(clamp(offset.y, boundedMinY, boundedMaxY));
      if (nextX !== offset.x || nextY !== offset.y) {
        setOffset({ x: nextX, y: nextY });
      }
    };

    clampToViewport();
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, [movable, offset.x, offset.y]);

  useEffect(() => {
    if (!resizable || !sectionRef.current) {
      return;
    }
    const card = sectionRef.current;
    const parent = card.parentElement;
    if (!parent) {
      return;
    }
    const parentRect = parent.getBoundingClientRect();
    const maxWidth = Math.max(220, Math.floor(parentRect.width - 8));
    if (savedSize.width && savedSize.width > maxWidth) {
      const nextSize = { ...savedSize, width: maxWidth };
      setSavedSize(nextSize);
      window.localStorage.setItem(resizeStorageKey, JSON.stringify(nextSize));
    }
  }, [resizable, resizeStorageKey, savedSize]);

  useEffect(() => {
    if (!resizable || !sectionRef.current || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      if (skipFirstResizePersistRef.current) {
        skipFirstResizePersistRef.current = false;
        return;
      }
      const element = entry.target as HTMLElement;
      const nextSize = {
        width: Math.round(element.offsetWidth),
        height: Math.round(element.offsetHeight),
      };
      if (nextSize.width === savedSize.width && nextSize.height === savedSize.height) {
        return;
      }
      setSavedSize(nextSize);
      window.localStorage.setItem(resizeStorageKey, JSON.stringify(nextSize));
    });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [resizable, resizeStorageKey, savedSize.height, savedSize.width]);

  useEffect(() => {
    if (!movable) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const origin = dragOriginRef.current;
      if (!origin) {
        return;
      }
      const nextX = origin.baseX + (event.clientX - origin.startX);
      const nextY = origin.baseY + (event.clientY - origin.startY);
      setOffset({
        x: snapToGrid(nextX),
        y: snapToGrid(nextY),
      });
    };

    const onPointerUp = () => {
      dragOriginRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [movable]);

  return (
    <section
      ref={sectionRef}
      className={`rounded-3xl border border-rose-200/80 bg-white/80 p-4 shadow-[0_12px_30px_-18px_rgba(122,68,98,0.45)] backdrop-blur-sm sm:p-5 ${
        resizable ? "resize overflow-auto min-h-[220px] min-w-[220px] max-w-full" : "max-w-full"
      } ${movable ? "relative z-[2]" : ""} ${className}`}
      style={{
        ...(movable
          ? {
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }
          : {}),
        ...(resizable && (savedSize.width || savedSize.height)
          ? {
              width: savedSize.width ? `${savedSize.width}px` : undefined,
              height: savedSize.height ? `${savedSize.height}px` : undefined,
            }
          : {}),
      }}
    >
      <div
        className={`mb-3 flex flex-wrap items-center justify-between gap-2 ${
          movable ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onPointerDown={(event) => {
          if (!movable) {
            return;
          }
          const target = event.target as HTMLElement;
          if (target.closest("button, input, textarea, select, a, label")) {
            return;
          }
          dragOriginRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            baseX: offset.x,
            baseY: offset.y,
          };
        }}
      >
        <div>
          <h2 className={`direction-a-card-title font-display text-xl font-semibold text-rose-950 sm:text-2xl ${titleClassName}`}>
            {title}
          </h2>
          {subtitle ? (
            <p className="direction-a-card-subtitle text-sm text-rose-900/70 sm:text-[15px]">{subtitle}</p>
          ) : null}
          <div className="direction-a-card-title-divider mt-2" />
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
};
