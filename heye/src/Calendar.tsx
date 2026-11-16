import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check, Plus } from "lucide-react";
import { request } from "./client";
import { Dialog } from "./parts";
import type { Board } from "./types";
import { todayCN } from "./types";
export const firstPointsDay = "2026-11-17";
const fmt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function clockLabel(due: string, now: number) {
  const mins = Math.ceil((Date.parse(due) - now) / 60000);
  if (mins <= 0) return "已到约定时间";
  const d = Math.floor(mins / 1440),
    h = Math.floor((mins % 1440) / 60),
    m = mins % 60;
  return (
    "还剩 " + (d ? d + " 天 " : "") + (h ? h + " 小时 " : "") + m + " 分钟"
  );
}
type Props = { board: Board; name: (s: number) => string; loading: boolean };
export function Calendar({
  board,
  name,
  loading,
  refresh,
  history,
}: { refresh: () => Promise<void>; history: () => void } & Props) {
  const [now, setNow] = useState(Date.now),
    [form, setForm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    id = useRef("");
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  async function save(p: Record<string, unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(p);
      if (p.action === "event-create") setForm(false);
      setNotice(
        p.action === "event-create" ? "事件已添加" : "已记录你的完成确认",
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "暂时无法保存，请重试。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="sectionHead">
        <h2>共同事件</h2>
        <button
          className="primary"
          onClick={() => {
            id.current = crypto.randomUUID();
            setError("");
            setForm(true);
          }}
        >
          <Plus size={16} />
          添加事件
        </button>
      </div>
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {!form && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {(board.events ?? []).map((e) => {
        const mine = board.seat === 1 ? e.first_at : e.second_at;
        return (
          <article className="eventCard" key={e.id}>
            <strong className="countLabel">
              <CalendarClock size={17} />
              {clockLabel(e.due, now)}
            </strong>
            <h3>{e.title}</h3>
            <p className="muted">{fmt.format(new Date(e.due))}（北京时间）</p>
            <div className="eventPeople">
              {[1, 2].map((s) => (
                <span key={s}>
                  {name(s)} ·{" "}
                  {(s === 1 ? e.first_at : e.second_at) ? "已完成" : "待完成"}
                </span>
              ))}
            </div>
            <button
              className="secondary"
              disabled={!!mine || busy}
              onClick={() => void save({ action: "event-confirm", id: e.id })}
            >
              <Check size={16} />
              {mine ? "已确认，等待对方" : "我已完成"}
            </button>
          </article>
        );
      })}
      {!board.events?.length && (
        <div className="empty">
          {loading ? "正在同步…" : "还没有进行中的事件"}
        </div>
      )}
      <button className="secondary wide" onClick={history}>
        查看共同完成的事件
      </button>
      {form && (
        <Dialog
          title="添加倒计时事件"
          close={() => {
            if (!busy) setForm(false);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save({
                action: "event-create",
                id: id.current,
                title: String(f.get("title")).trim(),
                due: String(f.get("when")) + ":00+08:00",
              });
            }}
          >
            <label>
              事件名称
              <input
                name="title"
                maxLength={100}
                required
                placeholder="例如：一起去看展"
              />
            </label>
            <label>
              目标时间（北京时间）
              <input
                type="datetime-local"
                name="when"
                required
                min="2000-01-01T00:00"
                max="2199-12-31T23:59"
                defaultValue={todayCN() + "T20:00"}
              />
            </label>
            <p className="muted">两人分别确认后，事件会进入完成记录。</p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy} className="primary wide">
              保存事件
            </button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
const reasons = {
  assign: "布置任务",
  task: "完成任务",
  recommend: "完成推荐",
  event: "共同完成事件",
};
export function Points({ board, name, loading }: Props) {
  return (
    <section>
      <div className="sectionHead">
        <h2>两人的积分</h2>
      </div>
      <div className="scoreGrid">
        {[board.seat || 1, 3 - (board.seat || 1)].map((s) => (
          <article key={s}>
            <small>{name(s)}</small>
            <strong>
              {board.balances?.[s] ?? 0}
              <small> 分</small>
            </strong>
          </article>
        ))}
      </div>
      <details className="eventCard" open={!board.ledger?.length}>
        <summary>积分规则 · 11 月 17 日起</summary>
        <p>
          普通任务按易、中、难分别得 2、4、6
          分。给对方发布普通或推荐任务，发布者分别扣 1、2、3
          分；给自己发布免费。
        </p>
        <p>
          完成对方明确推荐的任务得 10
          分，和难度奖励取其一。共同事件由两人确认后，各得 10 分。
        </p>
        <p>
          北京时间 2026 年 11 月 17
          日零点起，新发布且任务日期在当日及以后的任务参与计分。共同事件按第二人确认时间计分。起始分为
          0，可以暂时为负。
        </p>
      </details>
      <h3 className="ledgerHead">近期积分明细</h3>
      {(board.ledger ?? []).map((x) => (
        <div className="ledgerRow" key={x.source + x.person + x.reason}>
          <div>
            <strong>{x.title}</strong>
            <small>
              {name(x.person)} · {reasons[x.reason]} ·{" "}
              {fmt.format(new Date(x.recorded))}
            </small>
          </div>
          <b>
            {x.amount > 0 ? "+" : ""}
            {x.amount}
          </b>
        </div>
      ))}
      {!board.ledger?.length && (
        <div className="empty">{loading ? "正在同步…" : "还没有积分变动"}</div>
      )}
    </section>
  );
}
