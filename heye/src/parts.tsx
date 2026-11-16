import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
} from "lucide-react";
import { monday, offsetDay, dateLabel, statusLabel } from "./types";
import type { Task } from "./types";
const weekNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
export function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    dlg?.showModal();
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dlg?.close();
      document.body.style.overflow = prior;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const b = ref.current!.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            close();
        }
      }}
      aria-labelledby="dialog-title"
    >
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button className="iconBtn" onClick={close} aria-label="关闭">
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function TaskLine({ task, open }: { task: Task; open: () => void }) {
  return (
    <button className="taskLine" onClick={open}>
      <span className={"taskBox " + (task.status === "done" ? "checked" : "")}>
        {task.status === "done" ? <Check size={14} /> : null}
      </span>
      <span className="taskText">
        <strong>{task.title}</strong>
        {task.detail && <small>{task.detail}</small>}
      </span>
      <span className={"status " + task.status}>
        {task.self_task && task.status === "done"
          ? "已完成"
          : statusLabel[task.status]}
      </span>
      <ChevronRight size={15} />
    </button>
  );
}
export function WeekStrip({
  day,
  today,
  active,
  choose,
}: {
  day: string;
  today: string;
  active: string[];
  choose: (d: string) => void;
}) {
  const start = monday(day);
  return (
    <section className="week" aria-label="按日期查看任务">
      <div className="weekHead">
        <div className="sectionCap">
          <CalendarDays size={17} />
          <strong>
            {day.slice(0, 4)} 年 {Number(day.slice(5, 7))} 月
          </strong>
        </div>
        <div className="weekTools">
          <button
            className="iconBtn"
            onClick={() => choose(offsetDay(day, -7))}
            aria-label="上一周"
          >
            <ChevronLeft size={17} />
          </button>
          <button className="todayBtn" onClick={() => choose(today)}>
            今天
          </button>
          <button
            className="iconBtn"
            onClick={() => choose(offsetDay(day, 7))}
            aria-label="下一周"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="weekDays">
        {weekNames.map((name, i) => {
          const d = offsetDay(start, i);
          return (
            <button
              key={d}
              className={
                "weekDay " +
                (d === day ? "selected " : "") +
                (d === today ? "isToday" : "")
              }
              aria-pressed={d === day}
              aria-label={dateLabel(d, true) + (d === today ? "，今天" : "")}
              onClick={() => choose(d)}
            >
              <small>{name}</small>
              <strong>{d.slice(8)}</strong>
              <span
                className={d === today || active.includes(d) ? "hasDot" : ""}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
