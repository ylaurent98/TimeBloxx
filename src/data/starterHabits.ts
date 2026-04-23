import type { Habit } from "../types";

type HabitSeed = {
  id: string;
  name: string;
  category: string;
};

const HABIT_SEEDS: HabitSeed[] = [
  {
    id: "habit-morning-pages",
    name: "Morning Pages & Creative brainstorming",
    category: "Morning",
  },
  { id: "habit-creatine", name: "Creatine", category: "Morning" },
  { id: "habit-water", name: "Water", category: "Morning" },
  { id: "habit-affirmations", name: "Affirmations", category: "Morning" },
  {
    id: "habit-journal-tracker",
    name: "Complete journal/tracker",
    category: "Morning",
  },
  { id: "habit-meditate", name: "Meditate", category: "Morning" },
  { id: "habit-walk-sunlight", name: "Walk/Sunlight", category: "Morning" },
  { id: "habit-exercise", name: "Exercise", category: "Morning" },
  { id: "habit-sauna", name: "Sauna", category: "Morning" },
  { id: "habit-shower", name: "Shower", category: "Morning" },
  { id: "habit-piano", name: "Piano", category: "Morning" },
  { id: "habit-breakfast", name: "Breakfast", category: "Morning" },
  { id: "habit-supplements", name: "Supplements", category: "Morning" },
  {
    id: "habit-am-skincare",
    name: "Brush teeth, Skinoren, Vit C, Hyaluronic Acid, Niacinamide, SPF",
    category: "Morning",
  },
  {
    id: "habit-get-ready",
    name: "Get ready for the day",
    category: "Morning",
  },
  {
    id: "habit-move-30",
    name: "Move throughout the day - burpees/walks every 30 mins",
    category: "Day",
  },
  { id: "habit-read", name: "Read", category: "Evening" },
  { id: "habit-stretch", name: "Stretch", category: "Evening" },
  { id: "habit-brush-teeth-pm", name: "Brush Teeth", category: "Evening" },
  { id: "habit-retinol", name: "Retinol", category: "Evening" },
  { id: "habit-minoxodil", name: "Minoxodil", category: "Evening" },
  { id: "habit-moisturizer", name: "Moisturizer", category: "Evening" },
];

export const STARTER_HABITS: Habit[] = HABIT_SEEDS.map((habit, index) => ({
  id: habit.id,
  name: habit.name,
  category: habit.category,
  order: index,
  createdAt: new Date(2026, 0, index + 1).toISOString(),
  archivedAt: null,
}));
