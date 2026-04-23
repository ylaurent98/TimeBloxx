export type DateKey = string;

export type BlockSource = "one-time" | "template";

export interface TimeBlockTemplate {
  id: string;
  title: string;
  description: string;
  defaultDurationMin: number;
  category: string;
  color: string;
  isVariableDuration: boolean;
  createdAt: string;
}

export interface TimeBlock {
  id: string;
  title: string;
  description: string;
  category: string;
  durationMin: number;
  startTime: string | null;
  actualDurationMin: number | null;
  actualStartTime: string | null;
  color: string;
  completed: boolean;
  source: BlockSource;
  templateId?: string;
  order: number;
  createdAt: string;
}

export interface TodoItem {
  id: string;
  text: string;
  dueTime: string | null;
  completed: boolean;
  source?: "local" | "todoist";
  externalId?: string | null;
  labels?: string[];
  order: number;
  createdAt: string;
}

export interface TodoistSettings {
  apiToken: string | null;
  lastSyncAt: string | null;
}

export interface TodoistTaskOption {
  id: string;
  content: string;
  labels: string[];
  projectName: string | null;
  groups: string[];
  dueDate: string | null;
  dueDatetime: string | null;
}

export interface Habit {
  id: string;
  name: string;
  category: string;
  order: number;
  createdAt: string;
  archivedAt: string | null;
}

export interface DailyData {
  blocks: TimeBlock[];
  todos: TodoItem[];
  topPriorities: [string, string, string];
  habitChecks: Record<string, boolean>;
}

export interface PlannerData {
  version: number;
  templates: TimeBlockTemplate[];
  habits: Habit[];
  days: Record<DateKey, DailyData>;
  weeklyTaskBank: Record<string, TodoItem[]>;
  weeklyBlockBank: Record<string, TimeBlock[]>;
  todoist: TodoistSettings;
}

export interface OneTimeBlockInput {
  title: string;
  description: string;
  category: string;
  durationMin: number;
  startTime?: string | null;
  color: string;
}

export interface ReusableTemplateInput {
  title: string;
  description: string;
  category: string;
  defaultDurationMin: number;
  color: string;
  isVariableDuration: boolean;
  scheduleOnDate?: DateKey;
  scheduleStartTime?: string | null;
  scheduleDurationMin?: number;
}

export interface BlockEditInput {
  title: string;
  description: string;
  category: string;
  durationMin: number;
  startTime?: string | null;
  actualDurationMin?: number | null;
  actualStartTime?: string | null;
  color: string;
  targetDate: DateKey;
}

export interface ScheduleTemplateInput {
  durationMin?: number;
  startTime?: string | null;
}
