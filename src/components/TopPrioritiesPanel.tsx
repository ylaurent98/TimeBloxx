import { SectionCard } from "./SectionCard";

interface TopPrioritiesPanelProps {
  priorities: [string, string, string];
  onChange: (index: 0 | 1 | 2, value: string) => void;
}

export const TopPrioritiesPanel = ({
  priorities,
  onChange,
}: TopPrioritiesPanelProps) => (
  <SectionCard
    title="Top 3 Priorities"
    subtitle="Protect these first before everything else."
  >
    <div className="space-y-2">
      {priorities.map((priority, index) => (
        <label
          key={`priority-${index}`}
          className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50 to-orange-50 px-3 py-2.5"
        >
          <span className="font-display text-xl font-semibold text-rose-900">
            {index + 1}
          </span>
          <input
            value={priority}
            onChange={(event) =>
              onChange(index as 0 | 1 | 2, event.target.value)
            }
            placeholder={`Priority #${index + 1}`}
            className="w-full bg-transparent text-base font-semibold text-rose-950 outline-none placeholder:text-rose-900/55"
          />
        </label>
      ))}
    </div>
  </SectionCard>
);
