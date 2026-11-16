import { Artwork, Theme } from "./Theme";
import { Calendar, Points, firstPointsDay } from "./Calendar";
import { CalendarClock, Coins } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  History,
  Image as ImageIcon,
  ListChecks,
  LogOut,
  Plus,
  RotateCcw,
  Send,
  Ticket,
  UsersRound,
} from "lucide-react";
import Entry, { Mark, RouteSketch } from "./Entry";
import Photos from "./Photos";
import { Shelf, Finished } from "./Shelf";
import Invitation from "./Invitation";
import { ApiError, hasSession, leave, request } from "./client";
import { Dialog, TaskLine, WeekStrip } from "./parts";
import { dateLabel, emptyBoard, statusLabel, todayCN } from "./types";
import type { Board, Task } from "./types";
type FormAction = "submit" | "approve" | "return";
type Modal =
  | { type: "space" }
  | { type: "invitation" }
  | { type: "create" }
  | { type: "detail"; id: string }
  | { type: FormAction; task: Task };
const eventNames = {
  todo: "发布任务",
  review: "提交完成",
  returned: "退回补充",
  done: "确认完成",
};
const stamp = (s: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(s));
export default function Journal({ initialDay }: { initialDay: string }) {
  const [signed, setSigned] = useState(hasSession);
  const [openInvite, setOpenInvite] = useState(
    () =>
      location.hash === "#invite" ||
      new URLSearchParams(location.search).get("view") === "invite",
  );
  const onExit = useCallback(() => {
    setOpenInvite(false);
    setSigned(false);
  }, []);
  if (!signed) return <Entry onEnter={() => setSigned(true)} />;
  return (
    <Dashboard
      initialDay={initialDay}
      openInvite={openInvite}
      onExit={onExit}
    />
  );
}
function Dashboard({
  initialDay,
  openInvite,
  onExit,
}: {
  initialDay: string;
  openInvite: boolean;
  onExit: () => void;
}) {
  const [day, setDay] = useState(initialDay),
    [today, setToday] = useState(initialDay),
    [view, setView] = useState<
      "day" | "history" | "finished" | "shelf" | "events" | "points"
    >("day"),
    [filter, setFilter] = useState("all");
  const [board, setBoard] = useState<Board>(emptyBoard),
    [modal, setModal] = useState<Modal | null>(
      openInvite ? { type: "invitation" } : null,
    ),
    [error, setError] = useState(""),
    [formError, setFormError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState("");
  const [historyType, setHistoryType] = useState("all");
  const seq = useRef(0),
    active = useRef(true),
    locked = useRef(false),
    newId = useRef("");
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const refresh = useCallback(
    async (before?: string, quiet = false) => {
      const n = ++seq.current;
      if (!quiet) setLoading(true);
      try {
        const result: Board = await request({
          action: "read",
          day,
          view,
          filter,
          before,
        });
        if (!active.current || n !== seq.current) return;
        setBoard((prev) =>
          before
            ? { ...result, history: [...prev.history, ...result.history] }
            : result,
        );
        setError("");
      } catch (e) {
        if (!active.current || n !== seq.current) return;
        if (e instanceof ApiError && e.status === 401) {
          exitRef.current();
          return;
        }
        setError("同步失败，请检查网络后重试。");
      } finally {
        if (active.current && n === seq.current) setLoading(false);
      }
    },
    [day, view, filter],
  );
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      seq.current++;
    };
  }, []);
  useEffect(() => {
    setBoard((b) => ({ ...emptyBoard, seat: b.seat, members: b.members }));
    void refresh();
    return () => {
      seq.current++;
    };
  }, [refresh]);
  useEffect(() => {
    const tick = () => {
      setToday(todayCN());
      if (
        document.visibilityState === "visible" &&
        view !== "history" &&
        !locked.current
      )
        void refresh(undefined, true);
    };
    const t = setInterval(tick, 25000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", tick);
    };
  }, [refresh, view]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3200);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function show(m: Modal) {
    setFormError("");
    setModal(m);
    if (m.type === "create") newId.current = crypto.randomUUID();
  }
  function close() {
    if (!locked.current) setModal(null);
  }
  function choose(d: string) {
    setDay(d);
    setView("day");
  }
  const name = (seat: number) =>
    board.members.find((m) => m.slot === seat)?.name ||
    (seat === board.seat ? "我" : "对方");
  const partner = board.seat ? name(3 - board.seat) : "对方";
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (locked.current || !modal) return;
    locked.current = true;
    setBusy(true);
    setFormError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (modal.type === "create") {
        await request({
          action: "create",
          target: f.target,
          difficulty: f.difficulty || 1,
          day: f.day,
          title: f.title,
          detail: f.detail,
          id: newId.current,
        });
        choose(String(f.day));
        setToast(
          f.target === "self" ? "已加入我的个人任务" : "任务已发给" + partner,
        );
      } else if ("task" in modal) {
        await request({
          action: modal.type,
          id: modal.task.id,
          revision: modal.task.revision,
          note: f.note,
        });
        setToast(
          modal.type === "return"
            ? "已退回补充"
            : modal.type === "approve"
              ? "已确认完成"
              : "已提交给对方确认",
        );
      }
      setModal(null);
      await latestRefresh.current(undefined, true);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const detail =
    modal?.type === "detail"
      ? board.tasks.find((t) => t.id === modal.id)
      : null;
  function navHistory() {
    setHistoryType("all");
    setView("finished");
  }
  return (
    <div className="app">
      <header className="top">
        <div className="topInner">
          <button className="brand" onClick={() => choose(today)}>
            <Mark />
            <b>出发</b>
          </button>
          <nav className="mainNav">
            <button
              className={view === "day" ? "active" : ""}
              onClick={() => choose(today)}
            >
              <ListChecks size={17} />
              任务
            </button>
            <button
              className={view === "shelf" ? "active" : ""}
              onClick={() => setView("shelf")}
            >
              <BookOpen size={17} />
              清单
            </button>
            <button
              className={
                view === "history" || view === "finished" ? "active" : ""
              }
              onClick={navHistory}
            >
              <History size={17} />
              历史记录
            </button>
            <button
              className={view === "events" ? "active" : ""}
              onClick={() => setView("events")}
            >
              <CalendarClock size={17} />
              事件
            </button>
          </nav>
          <div className="topActions">
            <Theme />
            <button
              className="secondary"
              aria-label="积分"
              onClick={() => setView("points")}
            >
              <Coins size={17} />
              积分
            </button>
            <button
              className="secondary"
              onClick={() => show({ type: "space" })}
            >
              <UsersRound size={16} />
              我们俩
            </button>
          </div>
        </div>
      </header>
      <main className="main">
        <section className="dashHero">
          <div>
            <small>{dateLabel(day, true)}</small>
            <h1>
              {view === "events"
                ? "事件倒计时"
                : view === "points"
                  ? "积分账本"
                  : view === "shelf"
                    ? "书影音清单"
                    : view === "history" || view === "finished"
                      ? "历史记录"
                      : day === today
                        ? "今天的任务"
                        : "当天的任务"}
            </h1>
            <p>
              {board.seat ? name(board.seat) + " 与 " + partner : "双人空间"}
            </p>
          </div>
          <RouteSketch />
          <Artwork />
        </section>
        {error && (
          <p className="error" role="alert">
            {error} <button onClick={() => void refresh()}>重新同步</button>
          </p>
        )}
        {(view === "history" || view === "finished") && (
          <nav className="shelfFilters" aria-label="历史视图">
            <button
              aria-pressed={view === "finished"}
              onClick={() => setView("finished")}
            >
              完成记录
            </button>
            <button
              aria-pressed={view === "history"}
              onClick={() => setView("history")}
            >
              按日查看
            </button>
          </nav>
        )}
        {view === "events" ? (
          <Calendar
            board={board}
            loading={loading}
            name={name}
            refresh={() => latestRefresh.current(undefined, true)}
            history={() => {
              setHistoryType("event");
              setView("finished");
            }}
          />
        ) : view === "points" ? (
          <Points board={board} loading={loading} name={name} />
        ) : view === "shelf" ? (
          <Shelf
            board={board}
            loading={loading}
            name={name}
            refresh={() => latestRefresh.current(undefined, true)}
          />
        ) : view === "finished" ? (
          <Finished
            initialType={historyType}
            board={board}
            loading={loading}
            name={name}
          />
        ) : view === "day" ? (
          <>
            <WeekStrip
              day={day}
              today={today}
              active={board.activeDays}
              choose={choose}
            />
            <div className="sectionHead">
              <h2>
                双人任务{" "}
                <small>
                  {board.tasks.filter((t) => t.status === "done").length}/
                  {board.tasks.length} 已完成
                </small>
              </h2>
              <button
                className="primary"
                onClick={() => show({ type: "create" })}
              >
                <Plus size={16} />
                发任务
              </button>
            </div>
            <div className="lanes">
              {[
                {
                  key: "received",
                  title: partner + "发给我的",
                  items: board.tasks.filter(
                    (t) => !t.self_task && t.author !== board.seat,
                  ),
                  empty: "还没有收到任务",
                },
                {
                  key: "sent",
                  title: "我发给" + partner + "的",
                  items: board.tasks.filter(
                    (t) => !t.self_task && t.author === board.seat,
                  ),
                  empty: "还没有发出的任务",
                },
                {
                  key: "self",
                  title: "我的个人任务",
                  items: board.tasks.filter(
                    (t) => t.self_task && t.author === board.seat,
                  ),
                  empty: "还没有给自己的任务",
                },
                {
                  key: "partner",
                  title: partner + "的个人任务",
                  items: board.tasks.filter(
                    (t) => t.self_task && t.author !== board.seat,
                  ),
                  empty: partner + "当天还没有给自己的任务",
                },
              ].map(({ key, title, items, empty }) => {
                return (
                  <section key={key} className={"lane " + key}>
                    <header>
                      <span className="laneIcon">
                        {key === "sent" ? (
                          <ArrowUpRight />
                        ) : key === "received" ? (
                          <ArrowDownLeft />
                        ) : (
                          <ListChecks />
                        )}
                      </span>
                      <h3>{title}</h3>
                      <span className="pill">{items.length}</span>
                    </header>
                    {items.length ? (
                      <div className="taskList">
                        {items.map((t) => (
                          <TaskLine
                            key={t.id}
                            task={t}
                            open={() => show({ type: "detail", id: t.id })}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="empty">
                        <span>{loading ? "正在同步…" : empty}</span>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
            <Photos
              seat={board.seat}
              day={day}
              photos={board.photos}
              who={name}
              refresh={() => latestRefresh.current(undefined, true)}
            />
          </>
        ) : (
          <>
            <div className="sectionHead">
              <h2>按日查看</h2>
              <input
                className="date"
                aria-label="跳转日期"
                type="date"
                min="2000-01-01"
                max="2199-12-31"
                onChange={(e) => e.target.value && choose(e.target.value)}
              />
            </div>
            <section className="archive">
              <div className="filterTabs">
                {[
                  ["all", "全部记录"],
                  ["review", "待我确认"],
                ].map(([v, t]) => (
                  <button
                    key={v}
                    className={filter === v ? "active" : ""}
                    onClick={() => setFilter(v)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {board.history.map((h) => (
                <button
                  className="historyRow"
                  key={h.day}
                  onClick={() => choose(h.day)}
                >
                  <span className="dayBadge">
                    <b>{h.day.slice(8)}</b>
                    <small>{Number(h.day.slice(5, 7))}月</small>
                  </span>
                  <span>
                    <strong>{h.day}</strong>
                    <small>
                      {h.total} 项任务 · {h.done} 项已完成 · {h.photos} 张照片
                    </small>
                  </span>
                  {h.waiting > 0 && <i className="status review">待我确认</i>}
                  <ChevronRight size={16} />
                </button>
              ))}
              {!board.history.length && (
                <div className="empty">
                  {loading
                    ? "正在同步…"
                    : filter === "review"
                      ? "没有待确认的任务"
                      : "还没有任务或照片记录"}
                </div>
              )}
              {board.more && (
                <button
                  className="secondary more"
                  onClick={() => void refresh(board.history.at(-1)?.day)}
                  disabled={loading}
                >
                  加载更早记录
                </button>
              )}
            </section>
          </>
        )}
      </main>
      <nav className="pocketNav" aria-label="手机导航">
        <button
          className={view === "day" ? "active" : ""}
          onClick={() => choose(today)}
        >
          <ListChecks />
          任务
        </button>
        <button onClick={() => show({ type: "create" })}>
          <Plus />
          发任务
        </button>
        <button
          className={view === "shelf" ? "active" : ""}
          onClick={() => setView("shelf")}
        >
          <BookOpen />
          清单
        </button>
        <button
          className={view === "history" || view === "finished" ? "active" : ""}
          onClick={navHistory}
        >
          <History />
          历史
        </button>
        <button
          className={view === "events" ? "active" : ""}
          onClick={() => setView("events")}
        >
          <CalendarClock />
          事件
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal?.type === "invitation" && (
        <Invitation close={close} onExit={onExit} />
      )}
      {modal?.type === "space" && (
        <Dialog title="我们俩" close={close}>
          <div className="people">
            {[board.seat, 3 - board.seat].map((s, i) => (
              <div key={s}>
                <span className="initial">{name(s).slice(0, 1)}</span>
                <div>
                  <strong>{name(s)}</strong>
                  <small>
                    {i === 0
                      ? "我的名字"
                      : board.members.find((m) => m.slot === s)
                        ? "另一半"
                        : "等待另一半加入"}
                  </small>
                </div>
              </div>
            ))}
          </div>
          {board.seat === 1 && (
            <button
              className="primary wide"
              onClick={() => show({ type: "invitation" })}
            >
              <Ticket size={17} />
              查看邀请码
            </button>
          )}
          <button
            className="secondary wide"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await leave();
                onExit();
              } catch {
                setFormError("暂时无法退出，请重试。");
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={16} />
            退出此设备
          </button>
          {formError && <p className="error">{formError}</p>}
        </Dialog>
      )}
      {modal && (modal.type === "create" || "task" in modal) && (
        <Dialog
          close={close}
          title={
            modal.type === "create"
              ? "发布任务"
              : modal.type === "submit"
                ? "提交完成"
                : modal.type === "approve"
                  ? "确认完成"
                  : "退回补充"
          }
        >
          <form onSubmit={save}>
            {modal.type === "create" ? (
              <>
                <label>
                  任务给谁
                  <select name="target" defaultValue="partner">
                    <option value="partner">给对方 · {partner}</option>
                    <option value="self">给自己</option>
                    {today >= firstPointsDay && (
                      <option value="recommend">
                        推荐给对方 · 完成得 10 分
                      </option>
                    )}
                  </select>
                </label>
                {today >= firstPointsDay && (
                  <label>
                    任务难度
                    <select name="difficulty" defaultValue="1">
                      <option value="1">易 · 完成 +2 / 布置 −1</option>
                      <option value="2">中 · 完成 +4 / 布置 −2</option>
                      <option value="3">难 · 完成 +6 / 布置 −3</option>
                    </select>
                    <small>给自己免费；推荐任务的完成奖励固定为 10 分。</small>
                  </label>
                )}
                <label>
                  任务内容
                  <input
                    name="title"
                    required
                    maxLength={100}
                    placeholder="希望对方完成什么？"
                    autoFocus
                  />
                </label>
                <label>
                  任务日期
                  <input
                    name="day"
                    type="date"
                    required
                    min="2000-01-01"
                    max="2199-12-31"
                    defaultValue={day}
                  />
                </label>
                <label>
                  完成要求 <small>选填</small>
                  <textarea name="detail" maxLength={1000} rows={3} />
                </label>
              </>
            ) : (
              <>
                <p className="quote">{modal.task.title}</p>
                <label>
                  {modal.type === "return" ? "需要补充什么" : "说明（选填）"}
                  <textarea
                    name="note"
                    maxLength={1000}
                    required={modal.type === "return"}
                    rows={3}
                    autoFocus
                  />
                </label>
              </>
            )}
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <div className="actions">
              <button type="button" className="secondary" onClick={close}>
                取消
              </button>
              <button className="primary" disabled={busy}>
                {busy
                  ? "正在保存…"
                  : modal.type === "create"
                    ? "发布任务"
                    : modal.type === "submit"
                      ? "提交完成"
                      : modal.type === "approve"
                        ? "确认完成"
                        : "退回补充"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {detail && (
        <Dialog title="任务详情" close={close}>
          <div className="detailHead">
            <span className={"status " + detail.status}>
              {detail.self_task && detail.status === "done"
                ? "已完成"
                : statusLabel[detail.status]}
            </span>
            <small>
              {detail.day} · {name(detail.author)}发布
            </small>
          </div>
          <h3 className="taskTitle">{detail.title}</h3>
          {detail.difficulty && (
            <p className="muted">
              {["", "易", "中", "难"][detail.difficulty]} ·{" "}
              {detail.recommended
                ? "对方推荐 · 完成 +10 分"
                : "完成 +" + 2 * detail.difficulty + " 分"}
            </p>
          )}
          {detail.detail && <p className="detailText">{detail.detail}</p>}
          <h4>进展记录</h4>
          <ol className="timeline">
            {[
              {
                id: 0,
                actor: detail.author,
                kind: "todo" as const,
                note: "",
                created: detail.created,
              },
              ...detail.events,
            ].map((e) => (
              <li key={e.id}>
                <b>
                  {name(e.actor)} ·{" "}
                  {detail.self_task && e.kind === "done"
                    ? "标记完成"
                    : eventNames[e.kind]}
                </b>
                <small>{stamp(e.created)}</small>
                {e.note && <p>{e.note}</p>}
              </li>
            ))}
          </ol>
          {formError && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}
          <div className="actions">
            {detail.self_task &&
              detail.author === board.seat &&
              detail.status === "todo" && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    if (locked.current) return;
                    locked.current = true;
                    setBusy(true);
                    setFormError("");
                    try {
                      await request({
                        action: "submit",
                        id: detail.id,
                        revision: detail.revision,
                      });
                      setModal(null);
                      setToast("个人任务已完成");
                      await latestRefresh.current(undefined, true);
                    } catch (e) {
                      setFormError(
                        e instanceof Error
                          ? e.message
                          : "暂时无法完成任务，请重试。",
                      );
                    } finally {
                      locked.current = false;
                      setBusy(false);
                    }
                  }}
                >
                  <Check size={16} />
                  标记完成
                </button>
              )}
            {!detail.self_task &&
              detail.author !== board.seat &&
              ["todo", "returned"].includes(detail.status) && (
                <button
                  className="primary"
                  onClick={() => show({ type: "submit", task: detail })}
                >
                  <Check size={16} />
                  提交完成
                </button>
              )}
            {detail.author === board.seat && detail.status === "review" && (
              <>
                <button
                  className="secondary"
                  onClick={() => show({ type: "return", task: detail })}
                >
                  <RotateCcw size={16} />
                  退回补充
                </button>
                <button
                  className="primary"
                  onClick={() => show({ type: "approve", task: detail })}
                >
                  <CheckCheck size={16} />
                  确认完成
                </button>
              </>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
