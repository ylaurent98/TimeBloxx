import type { PropsWithChildren, ReactNode } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export const SectionCard = ({
  title,
  subtitle,
  actions,
  className = "",
  children,
}: SectionCardProps) => (
  <section
    className={`rounded-3xl border border-rose-200/80 bg-white/80 p-4 shadow-[0_12px_30px_-18px_rgba(122,68,98,0.45)] backdrop-blur-sm sm:p-5 ${className}`}
  >
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
