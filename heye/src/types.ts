export type Status = "todo" | "review" | "returned" | "done";
export type Event = {
  id: number;
  actor: number;
  kind: Status;
  note: string;
  created: string;
};
export type Task = {
  id: string;
  day: string;
  author: number;
  title: string;
  detail: string;
  status: Status;
  revision: number;
  created: string;
  events: Event[];
};
export type Note = {
  day: string;
  author: number;
  body: string;
  updated: string;
};
export type Member = { slot: number; name: string };
export type Board = {
  seat: number;
  members: Member[];
  tasks: Task[];
  notes: Note[];
  activeDays: string[];
  history: {
    day: string;
    total: number;
    done: number;
    notes: number;
    waiting: number;
  }[];
  more: boolean;
};
export const emptyBoard: Board = {
  seat: 0,
  members: [],
  tasks: [],
  notes: [],
  activeDays: [],
  history: [],
  more: false,
};
export const statusLabel: Record<Status, string> = {
  todo: "待完成",
  review: "待确认",
  returned: "待补充",
  done: "已确认",
};
export const todayCN = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function validDay(day: unknown): day is string {
  if (
    typeof day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    day < "2000-01-01" ||
    day > "2199-12-31"
  )
    return false;
  const n = Date.parse(day + "T12:00:00Z");
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === day;
}
export function offsetDay(day: string, n: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
export function monday(day: string) {
  return offsetDay(day, -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7));
}
export function dateLabel(day: string, weekday = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    ...(weekday ? { weekday: "long" as const } : {}),
  }).format(new Date(day + "T12:00:00Z"));
}
