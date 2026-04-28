import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  resizable?: boolean;
  movable?: boolean;
  moveId?: string;
  storageScope?: string;
}

const safeSegment = (value: string) => value.replace(/\s+/g, "-").toLowerCase();
const positionStorageKey = (scope: string, moveId: string) =>
  `timebloxx.integrations.cardPosition.${safeSegment(scope)}.${safeSegment(moveId)}`;
const sizeStorageKey = (scope: string, moveId: string) =>
  `timebloxx.integrations.cardSize.${safeSegment(scope)}.${safeSegment(moveId)}`;

export const SectionCard = ({
  title,
  subtitle,
  actions,
  className = "",
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
      setOffset({
        x: origin.baseX + (event.clientX - origin.startX),
        y: origin.baseY + (event.clientY - origin.startY),
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
        resizable ? "resize overflow-auto min-h-[220px] min-w-[280px]" : ""
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
          <h2 className="font-display text-xl font-semibold text-rose-950 sm:text-2xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm text-rose-900/70 sm:text-[15px]">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
};
