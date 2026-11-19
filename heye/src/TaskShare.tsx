import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { statusLabel, validDay } from "./types";
import type { Task } from "./types";

export type SharedTask = Pick<Task, "id" | "day" | "title" | "status">;

export function taskFromLink() {
  const params = new URLSearchParams(location.search);
  const day = params.get("day");
  const id = params.get("task");
  if (!validDay(day) || !id || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return null;
  return { day, id: id.toLowerCase() };
}

export function TaskShare({ task }: { task: SharedTask }) {
  const [state, setState] = useState<"ready" | "copied" | "manual">("ready");
  const link = new URL("./", location.href);
  link.searchParams.set("day", task.day);
  link.searchParams.set("task", task.id);
  const message = ["「出发」任务提醒", task.title, task.day + " · " + statusLabel[task.status], link.href].join("\n");
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setState("copied");
    } catch {
      setState("manual");
    }
  }
  return <div>
    <button type="button" className="secondary wide" onClick={copy}><MessageCircle size={17}/>微信提醒对方</button>
    {state === "copied" && <p className="muted" role="status">已复制任务摘要和链接，打开微信，粘贴到你们的聊天里发送。</p>}
    {state === "manual" && <label>长按复制，再粘贴到微信聊天里发送
      <textarea readOnly rows={5} value={message} onFocus={e => e.currentTarget.select()} />
    </label>}
  </div>;
}
