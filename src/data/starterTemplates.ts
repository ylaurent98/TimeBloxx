import type { TimeBlockTemplate } from "../types";

export const PASTEL_PALETTE = [
  "#f8a6bf",
  "#f2b8a2",
  "#f7c59f",
  "#f6d38a",
  "#bed7a7",
  "#a8d8c8",
  "#a6d7e8",
  "#b9c5f8",
  "#cdb6f2",
  "#e0b8df",
];

type TemplateSeed = {
  id: string;
  title: string;
  category?: string;
  minutes: number;
  variable?: boolean;
  colorIndex: number;
};

const TEMPLATE_SEEDS: TemplateSeed[] = [
  { id: "tpl-gym-1", title: "Gym #1", category: "Exercise", minutes: 75, colorIndex: 0 },
  { id: "tpl-gym-2", title: "Gym #2", category: "Exercise", minutes: 75, colorIndex: 1 },
  { id: "tpl-gym-3", title: "Gym #3", category: "Exercise", minutes: 75, colorIndex: 2 },
  { id: "tpl-gym-4", title: "Gym #4", category: "Exercise", minutes: 75, colorIndex: 3 },
  {
    id: "tpl-mcgill-warmup",
    title: "McGill warmup",
    category: "Exercise",
    minutes: 7,
    colorIndex: 4,
  },
  { id: "tpl-treadmill", title: "Treadmill", category: "Exercise", minutes: 7, colorIndex: 5 },
  { id: "tpl-walk-gym", title: "Walk to gym", category: "Transportation", minutes: 15, colorIndex: 6 },
  { id: "tpl-walk-back", title: "Walk back", category: "Transportation", minutes: 15, colorIndex: 7 },
  { id: "tpl-dance", title: "Dance", category: "Exercise", minutes: 165, colorIndex: 8 },
  { id: "tpl-swim", title: "Swim", category: "Exercise", minutes: 90, colorIndex: 9 },
  {
    id: "tpl-campina",
    title: "Go to Campina",
    category: "Transportation",
    minutes: 120,
    colorIndex: 0,
  },
  {
    id: "tpl-piano-practice",
    title: "Piano practice",
    category: "Music",
    minutes: 45,
    variable: true,
    colorIndex: 1,
  },
  { id: "tpl-piano-class", title: "Piano class", category: "Music", minutes: 60, colorIndex: 2 },
  { id: "tpl-meal-prep", title: "Meal prep", category: "Life", minutes: 180, colorIndex: 3 },
  {
    id: "tpl-grocery-shop",
    title: "Grocery shop",
    category: "Errands",
    minutes: 60,
    colorIndex: 4,
  },
  { id: "tpl-stretch", title: "Stretch", category: "Exercise", minutes: 13, colorIndex: 5 },
  { id: "tpl-sauna", title: "Sauna", category: "Recovery", minutes: 20, colorIndex: 6 },
  { id: "tpl-hiit", title: "HIIT", category: "Exercise", minutes: 30, colorIndex: 7 },
  { id: "tpl-liss", title: "LISS", category: "Exercise", minutes: 30, colorIndex: 8 },
  {
    id: "tpl-morning-routine",
    title: "Morning skincare + shower + hair + teeth",
    category: "Routine",
    minutes: 60,
    colorIndex: 9,
  },
  {
    id: "tpl-evening-routine",
    title: "Evening skincare + brush teeth",
    category: "Routine",
    minutes: 10,
    colorIndex: 0,
  },
];

export const STARTER_TEMPLATES: TimeBlockTemplate[] = TEMPLATE_SEEDS.map(
  (seed, index) => ({
    id: seed.id,
    title: seed.title,
    description: "",
    defaultDurationMin: seed.minutes,
    category: seed.category ?? "General",
    color: PASTEL_PALETTE[seed.colorIndex % PASTEL_PALETTE.length],
    isVariableDuration: Boolean(seed.variable),
    createdAt: new Date(2026, 0, index + 1).toISOString(),
  }),
);
