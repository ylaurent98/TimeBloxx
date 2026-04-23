import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { PASTEL_PALETTE } from "../data/starterTemplates";
import type {
  BlockEditInput,
  DateKey,
  OneTimeBlockInput,
  ReusableTemplateInput,
  ScheduleTemplateInput,
  TimeBlock,
  TimeBlockTemplate,
} from "../types";
import { isValidDateKey } from "../utils/date";
import { blockEndLabel, formatDuration, timeToMinutes } from "../utils/format";
import { SectionCard } from "./SectionCard";

interface TimeBlocksPanelProps {
  selectedDate: DateKey;
  blocks: TimeBlock[];
  templates: TimeBlockTemplate[];
  onAddOneTimeBlock: (input: OneTimeBlockInput) => void;
  onCreateReusableTemplate: (input: ReusableTemplateInput) => void;
  onScheduleTemplate: (templateId: string, input?: ScheduleTemplateInput) => void;
  onUpdateTemplate: (
    templateId: string,
    updates: Pick<
      TimeBlockTemplate,
      | "title"
      | "description"
      | "category"
      | "defaultDurationMin"
      | "color"
      | "isVariableDuration"
    >,
  ) => void;
  onDeleteTemplate: (templateId: string) => void;
  onToggleComplete: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onDuplicateBlock: (blockId: string) => void;
  onEditBlock: (blockId: string, input: BlockEditInput) => void;
  onMoveBlock: (blockId: string, targetDate: DateKey) => void;
  onReorderUntimedBlock: (blockId: string, direction: -1 | 1) => void;
}

const actionButton =
  "rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 transition hover:border-rose-300 hover:bg-rose-50";

const iconActionButton =
  "rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm font-semibold text-rose-900 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50";

const parsePositive = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
};

const COMMON_CATEGORIES = [
  "Exercise",
  "Transportation",
  "Reading",
  "Work",
  "Study",
  "Errands",
  "Recovery",
  "Routine",
  "Music",
  "General",
];

const toRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((part) => part + part)
          .join("")
      : clean;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return `rgba(244, 188, 213, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getOverlapIds = (blocks: TimeBlock[]) => {
  const timed = blocks
    .filter((block) => block.startTime)
    .map((block) => ({
      id: block.id,
      start: timeToMinutes(block.startTime ?? "00:00"),
      end: timeToMinutes(block.startTime ?? "00:00") + block.durationMin,
    }))
    .sort((a, b) => a.start - b.start);

  const overlaps = new Set<string>();
  if (timed.length < 2) {
    return overlaps;
  }

  let active = timed[0];

  for (let index = 1; index < timed.length; index += 1) {
    const current = timed[index];
    if (current.start < active.end) {
      overlaps.add(current.id);
      overlaps.add(active.id);
      if (current.end > active.end) {
        active = current;
      }
    } else {
      active = current;
    }
  }

  return overlaps;
};

export const TimeBlocksPanel = ({
  selectedDate,
  blocks,
  templates,
  onAddOneTimeBlock,
  onCreateReusableTemplate,
  onScheduleTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onToggleComplete,
  onDeleteBlock,
  onDuplicateBlock,
  onEditBlock,
  onMoveBlock,
  onReorderUntimedBlock,
}: TimeBlocksPanelProps) => {
  const [createType, setCreateType] = useState<"one-time" | "reusable">(
    "one-time",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [durationMin, setDurationMin] = useState("60");
  const [startTime, setStartTime] = useState("");
  const [color, setColor] = useState(PASTEL_PALETTE[0]);
  const [isVariableDuration, setIsVariableDuration] = useState(false);
  const [alsoScheduleToday, setAlsoScheduleToday] = useState(true);

  const [templateDurationOverrides, setTemplateDurationOverrides] = useState<
    Record<string, string>
  >({});
  const [templateStartOverrides, setTemplateStartOverrides] = useState<
    Record<string, string>
  >({});

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateDraftTitle, setTemplateDraftTitle] = useState("");
  const [templateDraftDescription, setTemplateDraftDescription] = useState("");
  const [templateDraftCategory, setTemplateDraftCategory] = useState("General");
  const [templateDraftDuration, setTemplateDraftDuration] = useState("45");
  const [templateDraftColor, setTemplateDraftColor] = useState(PASTEL_PALETTE[0]);
  const [templateDraftVariable, setTemplateDraftVariable] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockDraftTitle, setBlockDraftTitle] = useState("");
  const [blockDraftDescription, setBlockDraftDescription] = useState("");
  const [blockDraftCategory, setBlockDraftCategory] = useState("General");
  const [blockDraftDuration, setBlockDraftDuration] = useState("60");
  const [blockDraftStartTime, setBlockDraftStartTime] = useState("");
  const [blockDraftActualDuration, setBlockDraftActualDuration] = useState("");
  const [blockDraftActualStartTime, setBlockDraftActualStartTime] = useState("");
  const [blockDraftColor, setBlockDraftColor] = useState(PASTEL_PALETTE[0]);
  const [blockDraftDate, setBlockDraftDate] = useState(selectedDate);
  const [expandedDescriptionBlockId, setExpandedDescriptionBlockId] = useState<
    string | null
  >(null);

  const sortedBlocks = useMemo(
    () =>
      [...blocks].sort((a, b) => {
        if (a.startTime && b.startTime) {
          return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        }
        if (a.startTime) {
          return -1;
        }
        if (b.startTime) {
          return 1;
        }
        return a.order - b.order;
      }),
    [blocks],
  );

  const untimedIds = useMemo(
    () => sortedBlocks.filter((block) => !block.startTime).map((block) => block.id),
    [sortedBlocks],
  );

  const overlapIds = useMemo(() => getOverlapIds(blocks), [blocks]);

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    const parsedDuration = parsePositive(durationMin);
    if (createType === "one-time") {
      if (!parsedDuration) {
        return;
      }

      onAddOneTimeBlock({
        title: normalizedTitle,
        description: description.trim(),
        category: category.trim() || "General",
        durationMin: parsedDuration,
        startTime: startTime || null,
        color,
      });
    } else {
      const safeDuration = parsedDuration ?? 45;
      onCreateReusableTemplate({
        title: normalizedTitle,
        description: description.trim(),
        category: category.trim() || "General",
        defaultDurationMin: safeDuration,
        color,
        isVariableDuration,
        scheduleOnDate: alsoScheduleToday ? selectedDate : undefined,
        scheduleStartTime: alsoScheduleToday ? startTime || null : undefined,
        scheduleDurationMin: alsoScheduleToday ? safeDuration : undefined,
      });
    }

    setTitle("");
    setDescription("");
    setStartTime("");
  };

  const startTemplateEdit = (template: TimeBlockTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateDraftTitle(template.title);
    setTemplateDraftDescription(template.description);
    setTemplateDraftCategory(template.category);
    setTemplateDraftDuration(String(template.defaultDurationMin));
    setTemplateDraftColor(template.color);
    setTemplateDraftVariable(template.isVariableDuration);
  };

  const saveTemplateEdit = () => {
    if (!editingTemplateId) {
      return;
    }

    const parsedDuration = parsePositive(templateDraftDuration);
    const normalizedTitle = templateDraftTitle.trim();
    if (!parsedDuration || !normalizedTitle) {
      return;
    }

    onUpdateTemplate(editingTemplateId, {
      title: normalizedTitle,
      description: templateDraftDescription.trim(),
      category: templateDraftCategory.trim() || "General",
      defaultDurationMin: parsedDuration,
      color: templateDraftColor,
      isVariableDuration: templateDraftVariable,
    });

    setEditingTemplateId(null);
  };

  const startBlockEdit = (block: TimeBlock) => {
    setEditingBlockId(block.id);
    setBlockDraftTitle(block.title);
    setBlockDraftDescription(block.description);
    setBlockDraftCategory(block.category);
    setBlockDraftDuration(String(block.durationMin));
    setBlockDraftStartTime(block.startTime ?? "");
    setBlockDraftActualDuration(
      block.actualDurationMin == null ? "" : String(block.actualDurationMin),
    );
    setBlockDraftActualStartTime(block.actualStartTime ?? "");
    setBlockDraftColor(block.color);
    setBlockDraftDate(selectedDate);
  };

  const saveBlockEdit = () => {
    if (!editingBlockId) {
      return;
    }

    const normalizedTitle = blockDraftTitle.trim();
    const parsedDuration = parsePositive(blockDraftDuration);
    const parsedActualDuration =
      blockDraftActualDuration.trim() === ""
        ? null
        : parsePositive(blockDraftActualDuration);
    if (!normalizedTitle || !parsedDuration || !isValidDateKey(blockDraftDate)) {
      return;
    }
    if (blockDraftActualDuration.trim() !== "" && !parsedActualDuration) {
      return;
    }

    onEditBlock(editingBlockId, {
      title: normalizedTitle,
      description: blockDraftDescription.trim(),
      category: blockDraftCategory.trim() || "General",
      durationMin: parsedDuration,
      startTime: blockDraftStartTime || null,
      actualDurationMin: parsedActualDuration,
      actualStartTime: blockDraftActualStartTime || null,
      color: blockDraftColor,
      targetDate: blockDraftDate,
    });
    setEditingBlockId(null);
  };

  const handleMovePrompt = (blockId: string) => {
    const answer = window.prompt(
      "Move block to date (YYYY-MM-DD)",
      selectedDate,
    );
    if (!answer || !isValidDateKey(answer)) {
      return;
    }
    onMoveBlock(blockId, answer);
  };

  const completedCount = blocks.filter((block) => block.completed).length;

  return (
    <SectionCard
      title="Time Blocks"
      subtitle={`${completedCount}/${blocks.length} complete`}
    >
      <form
        className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-3"
        onSubmit={handleCreateSubmit}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              createType === "one-time"
                ? "bg-rose-300/70 text-rose-950"
                : "bg-white text-rose-900 hover:bg-rose-100"
            }`}
            onClick={() => setCreateType("one-time")}
          >
            One-time block
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              createType === "reusable"
                ? "bg-rose-300/70 text-rose-950"
                : "bg-white text-rose-900 hover:bg-rose-100"
            }`}
            onClick={() => setCreateType("reusable")}
          >
            Reusable template
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
          />
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            list="timeblock-categories"
            placeholder="Category"
            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
          />
          <input
            type="number"
            min={1}
            value={durationMin}
            onChange={(event) => setDurationMin(event.target.value)}
            placeholder="Duration (min)"
            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
          />
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
          />
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm">
            <span className="text-rose-900/70">Color</span>
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            className="h-7 w-8 cursor-pointer rounded border-none bg-transparent p-0"
            />
          </div>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description (optional)"
            className="sm:col-span-2 xl:col-span-5 min-h-[74px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
          />
        </div>

        {createType === "reusable" ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-rose-900">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={isVariableDuration}
                onChange={(event) => setIsVariableDuration(event.target.checked)}
              />
              Variable duration template
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={alsoScheduleToday}
                onChange={(event) => setAlsoScheduleToday(event.target.checked)}
              />
              Also add to selected day
            </label>
          </div>
        ) : null}

        <div className="mt-3">
          <button
            type="submit"
            className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-300"
          >
            {createType === "one-time" ? "Add block" : "Save reusable block"}
          </button>
        </div>
        <datalist id="timeblock-categories">
          {COMMON_CATEGORIES.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </form>

      {overlapIds.size > 0 ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          Warning: {overlapIds.size} timed block
          {overlapIds.size === 1 ? "" : "s"} overlap.
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {sortedBlocks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-rose-200 bg-white/70 px-3 py-4 text-sm text-rose-900/70">
            No blocks yet for this day.
          </p>
        ) : null}

        {sortedBlocks.map((block) => {
          const untimedIndex = untimedIds.indexOf(block.id);
          const canMoveUp = untimedIndex > 0;
          const canMoveDown =
            untimedIndex > -1 && untimedIndex < untimedIds.length - 1;

          return (
            <article
              key={block.id}
              className="rounded-2xl border p-3"
              style={{
                borderColor: toRgba(block.color, block.completed ? 0.9 : 0.55),
                backgroundColor: toRgba(block.color, block.completed ? 0.72 : 0.17),
              }}
            >
              <div className="flex flex-wrap items-start gap-2">
                <button
                  type="button"
                  onClick={() => onToggleComplete(block.id)}
                  className={`mt-0.5 h-6 w-6 rounded-full border text-xs font-bold transition ${
                    block.completed
                      ? "border-rose-900 bg-rose-900 text-white"
                      : "border-rose-400 bg-white text-rose-900 hover:bg-rose-100"
                  }`}
                >
                  {block.completed ? "✓" : ""}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDescriptionBlockId((previous) =>
                          previous === block.id ? null : block.id,
                        )
                      }
                      className={`rounded px-1 text-left font-semibold text-rose-950 underline decoration-dotted underline-offset-2 ${
                        block.completed ? "line-through decoration-2" : ""
                      }`}
                    >
                      {block.title}
                    </button>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-rose-900">
                      {formatDuration(block.durationMin)}
                    </span>
                    {block.startTime ? (
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-rose-900">
                        {block.startTime} -{" "}
                        {blockEndLabel(block.startTime, block.durationMin)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-rose-900">
                        Flexible order
                      </span>
                    )}
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-rose-900">
                      {block.source === "template" ? "Reusable" : "One-time"}
                    </span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-rose-900">
                      {block.category}
                    </span>
                    {block.completed ? (
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-rose-900">
                        Actual: {formatDuration(block.actualDurationMin ?? block.durationMin)}
                      </span>
                    ) : null}
                    {block.completed && block.actualStartTime ? (
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-rose-900">
                        {block.actualStartTime} -{" "}
                        {blockEndLabel(
                          block.actualStartTime,
                          block.actualDurationMin ?? block.durationMin,
                        )}
                      </span>
                    ) : null}
                    {overlapIds.has(block.id) ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        Overlap
                      </span>
                    ) : null}
                  </div>

                  {expandedDescriptionBlockId === block.id ? (
                    <p className="mt-2 rounded-lg border border-rose-200 bg-white/80 px-2 py-1 text-xs text-rose-900">
                      {block.description.trim() || "No description yet."}
                    </p>
                  ) : null}

                  {!block.startTime ? (
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onReorderUntimedBlock(block.id, -1)}
                        disabled={!canMoveUp}
                        className={iconActionButton}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => onReorderUntimedBlock(block.id, 1)}
                        disabled={!canMoveDown}
                        className={iconActionButton}
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startBlockEdit(block)}
                    className={actionButton}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateBlock(block.id)}
                    className={actionButton}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMovePrompt(block.id)}
                    className={actionButton}
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteBlock(block.id)}
                    className={actionButton}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingBlockId === block.id ? (
                <div className="mt-3 grid gap-2 rounded-xl border border-white/90 bg-white/70 p-3 sm:grid-cols-2">
                  <input
                    value={blockDraftTitle}
                    onChange={(event) => setBlockDraftTitle(event.target.value)}
                    placeholder="Title"
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                  />
                  <textarea
                    value={blockDraftDescription}
                    onChange={(event) =>
                      setBlockDraftDescription(event.target.value)
                    }
                    placeholder="Description"
                    className="sm:col-span-2 min-h-[74px] rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                  />
                  <input
                    value={blockDraftCategory}
                    onChange={(event) => setBlockDraftCategory(event.target.value)}
                    list="timeblock-categories"
                    placeholder="Category"
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                  />
                  <input
                    type="number"
                    min={1}
                    value={blockDraftDuration}
                    onChange={(event) => setBlockDraftDuration(event.target.value)}
                    placeholder="Duration (min)"
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                  />
                  <input
                    type="time"
                    value={blockDraftStartTime}
                    onChange={(event) => setBlockDraftStartTime(event.target.value)}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                  />
                  <input
                    type="number"
                    min={1}
                    value={blockDraftActualDuration}
                    onChange={(event) => setBlockDraftActualDuration(event.target.value)}
                    placeholder="Actual duration (min)"
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                  />
                  <input
                    type="time"
                    value={blockDraftActualStartTime}
                    onChange={(event) => setBlockDraftActualStartTime(event.target.value)}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                  />
                  <input
                    type="date"
                    value={blockDraftDate}
                    onChange={(event) => setBlockDraftDate(event.target.value)}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                  />
                  <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm">
                    <span className="text-rose-900/70">Color</span>
                    <input
                      type="color"
                      value={blockDraftColor}
                      onChange={(event) => setBlockDraftColor(event.target.value)}
                      className="h-6 w-8 cursor-pointer rounded border-none bg-transparent p-0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveBlockEdit}
                      className={actionButton}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingBlockId(null)}
                      className={actionButton}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-rose-200/80 bg-rose-50/35 p-3">
        <button
          type="button"
          onClick={() => setIsLibraryOpen((previous) => !previous)}
          className="flex w-full items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-left transition hover:bg-white"
        >
          <span className="font-display text-lg font-semibold text-rose-950">
            Reusable Block Library
          </span>
          <span className="text-sm font-semibold text-rose-900/80">
            {isLibraryOpen ? "Hide" : "Show"}
          </span>
        </button>

        {isLibraryOpen ? (
          <>
            <p className="mb-3 mt-2 text-sm text-rose-900/70">
              Add any template to the selected day with one click.
            </p>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1 soft-scroll">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-xl border border-rose-200 bg-white/85 p-2"
                >
                  {editingTemplateId === template.id ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={templateDraftTitle}
                        onChange={(event) => setTemplateDraftTitle(event.target.value)}
                        placeholder="Template title"
                        className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-rose-400"
                      />
                      <textarea
                        value={templateDraftDescription}
                        onChange={(event) =>
                          setTemplateDraftDescription(event.target.value)
                        }
                        placeholder="Template description"
                        className="sm:col-span-2 min-h-[74px] rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-rose-400"
                      />
                      <input
                        value={templateDraftCategory}
                        onChange={(event) => setTemplateDraftCategory(event.target.value)}
                        list="timeblock-categories"
                        placeholder="Template category"
                        className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-rose-400"
                      />
                      <input
                        type="number"
                        min={1}
                        value={templateDraftDuration}
                        onChange={(event) =>
                          setTemplateDraftDuration(event.target.value)
                        }
                        className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-rose-400"
                      />
                      <input
                        type="color"
                        value={templateDraftColor}
                        onChange={(event) => setTemplateDraftColor(event.target.value)}
                        className="h-9 w-full rounded-lg border border-rose-200 bg-white px-2 py-1"
                      />
                      <label className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={templateDraftVariable}
                          onChange={(event) =>
                            setTemplateDraftVariable(event.target.checked)
                          }
                        />
                        Variable duration
                      </label>
                      <div className="flex items-center gap-1 sm:col-span-2">
                        <button
                          type="button"
                          onClick={saveTemplateEdit}
                          className={actionButton}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTemplateId(null)}
                          className={actionButton}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-rose-950">
                          {template.title}
                        </p>
                        <p className="text-xs text-rose-900/70">
                          {template.category} •{" "}
                          Default: {formatDuration(template.defaultDurationMin)}
                          {template.isVariableDuration ? " (variable)" : ""}
                        </p>
                        {template.description.trim() ? (
                          <p className="mt-0.5 truncate text-xs text-rose-900/65">
                            {template.description}
                          </p>
                        ) : null}
                      </div>

                      <input
                        type="number"
                        min={1}
                        value={templateDurationOverrides[template.id] ?? ""}
                        onChange={(event) =>
                          setTemplateDurationOverrides((previous) => ({
                            ...previous,
                            [template.id]: event.target.value,
                          }))
                        }
                        placeholder="min"
                        className="w-16 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
                        title="Custom duration minutes"
                      />
                      <input
                        type="time"
                        value={templateStartOverrides[template.id] ?? ""}
                        onChange={(event) =>
                          setTemplateStartOverrides((previous) => ({
                            ...previous,
                            [template.id]: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
                        title="Optional start time"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const override = parsePositive(
                            templateDurationOverrides[template.id] ?? "",
                          );
                          onScheduleTemplate(template.id, {
                            durationMin: override ?? undefined,
                            startTime:
                              templateStartOverrides[template.id]?.trim() ||
                              undefined,
                          });
                        }}
                        className={actionButton}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => startTemplateEdit(template)}
                        className={actionButton}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTemplate(template.id)}
                        className={actionButton}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {templates.length === 0 ? (
                <p className="rounded-xl border border-dashed border-rose-200 bg-white/70 px-3 py-4 text-sm text-rose-900/70">
                  No reusable templates yet.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </SectionCard>
  );
};
