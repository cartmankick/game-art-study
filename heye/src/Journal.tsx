import { readDay,action } from "./client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  KeyRound,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Feather,
  History,
  Link2,
  LoaderCircle,
  MailOpen,
  Plus,
  Heart,
  Mail,
  RotateCcw,
  Send,
  UsersRound,
  X,
} from "lucide-react";
import {
  dateLabel,
  emptyBoard,
  monday,
  offsetDay,
  statusLabel,
  todayCN,
} from "./types";
import type { Board, Task } from "./types";

type Modal =
  | { type: "create" | "space" | "note" | "entry" }
  | { type: "task"; id: string }
  | { type: "submit" | "approve" | "return"; task: Task };
const weekNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const eventName = {
  todo: "寄出约定",
  review: "提交完成",
  returned: "退回补充",
  done: "确认完成",
};
const stamp = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
function Dialog({
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
function EmptyArt({ sent }: { sent: boolean }) {
  return (
    <span className={"emptyArt " + (sent ? "warm" : "cool")} aria-hidden="true">
      <span className="artDot" />
      {sent ? <Send /> : <MailOpen />}
      <i />
      <b />
    </span>
  );
}
function TaskLine({ task, open }: { task: Task; open: () => void }) {
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
        {statusLabel[task.status]}
      </span>
      <ChevronRight size={15} />
    </button>
  );
}
function WeekStrip({
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
    <section className="week" aria-label="按日期查看约定">
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

export default function Journal({ initialDay }: { initialDay: string }) {
  const [day, setDay] = useState(initialDay),
    [today, setToday] = useState(initialDay);
  const [view, setView] = useState<"day" | "history">("day"),
    [filter, setFilter] = useState("all");
  const [board, setBoard] = useState<Board>(emptyBoard),
    [modal, setModal] = useState<Modal | null>(null);
  const [error, setError] = useState(""),
    [formError, setFormError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [entryCode, setEntryCode] = useState("");
  const firstCode=useRef<HTMLInputElement>(null);
  const [inviteLink, setInviteLink] = useState("");
  useEffect(() => {
    function readInvite() {
      const params = new URLSearchParams(location.hash.slice(1));
      const code = params.get("invite");
      if (code === null) return;
      setEntryCode(code.slice(0, 100));
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
      setFormError("");
      setModal({ type: "entry" });
    }
    readInvite();
    window.addEventListener("hashchange", readInvite);
    return () => window.removeEventListener("hashchange", readInvite);
  }, []);
  const seq = useRef(0),
    requestId = useRef(""),
    dateRef = useRef<HTMLInputElement>(null),
    locked = useRef(false);
  const fetchBoard = useCallback(
    async (before?: string, silent = false) => {
      const n = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ day, view, filter });
        if (before) params.set("before", before);
        const res = await readDay(params);
        if (!res.ok) throw new Error("暂时无法同步手账，请重试。");
        const data: Board = await res.json();
        if (n !== seq.current) return;
        setBoard((prev) =>
          before
            ? { ...data, history: [...prev.history, ...data.history] }
            : data,
        );
        setError("");
      } catch {
        if (n === seq.current) setError("暂时无法同步手账，请检查连接后重试。");
      } finally {
        if (n === seq.current) setLoading(false);
      }
    },
    [day, view, filter],
  );
  useEffect(() => {
    setBoard((b) => ({
      ...b,
      tasks: [],
      notes: [],
      history: [],
      activeDays: [],
      more: false,
    }));
    void fetchBoard();
    return () => {
      seq.current++;
    };
  }, [fetchBoard]);
  useEffect(() => {
    const refresh = () => {
      setToday(todayCN());
      if (
        view === "day" &&
        document.visibilityState === "visible" &&
        !locked.current
      )
        void fetchBoard(undefined, true);
    };
    const timer = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [fetchBoard, view]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  function open(m: Modal) {
    setFormError("");
    setInviteLink("");
    setModal(m);
    if (m.type === "create") requestId.current = crypto.randomUUID();
  }
  function protectedOpen(m: Modal) {
    if (!board.seat) open({ type: "entry" });
    else open(m);
  }
  function choose(d: string) {
    setDay(d);
    setView("day");
  }
  function close() {
    if (!locked.current) {
      setModal(null);
      setFormError("");
    }
  }
  async function save(payload: Record<string, unknown>, message: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFormError("");
    try {
      const res=await action(payload);
      const v = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(v.error || "保存失败，请重试。");
      setModal(null);
      if (payload.action === "enter" || payload.action === "leave") {
        setEntryCode("");
        setInviteLink("");
        if (payload.action === "leave") {
          setBoard(emptyBoard);
          setView("day");
        }
      }
      if (typeof payload.day === "string" && payload.day !== day)
        choose(payload.day);
      else await fetchBoard(undefined, true);
      setToast(message);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function showInvite() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFormError("");
    try {
      const res=await action({action:"invite"});
      const result = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !result.code)
        throw new Error(result.error || "无法取得对方邀请链接，请重试。");
      setInviteLink(
        new URL("./",location.href).href + "#invite=" + encodeURIComponent(result.code),
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "暂时无法取得邀请链接。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function submitForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (modal?.type === "create")
      void save(
        {
          action: "create",
          id: requestId.current,
          title: f.get("title"),
          detail: f.get("detail"),
          day: f.get("day"),
        },
        "约定已发布给对方",
      );
    if (modal?.type === "note")
      void save({ action: "note", day, note: f.get("note") }, "当日手记已保存");
    if (modal && "task" in modal)
      void save(
        {
          action: modal.type,
          id: modal.task.id,
          revision: modal.task.revision,
          note: f.get("note"),
        },
        modal.type === "submit"
          ? "已提交，等待对方确认"
          : modal.type === "approve"
            ? "已确认完成"
            : "已退回给对方补充",
      );
  }
  const mine = board.seat || 1;
  const received = board.tasks.filter((t) => t.author !== mine),
    sent = board.tasks.filter((t) => t.author === mine);
  const myNote = board.notes.find((n) => n.author === mine),
    partnerNote = board.notes.find((n) => n.author !== mine);
  const detail =
    modal?.type === "task"
      ? board.tasks.find((t) => t.id === modal.id)
      : undefined;
  const actor = (seat: number) => (seat === mine ? "我" : "对方");
  const submitButton = (label: string) => (
    <button className="primary" type="submit" disabled={busy}>
      {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{" "}
      {label}
    </button>
  );
  const goDay = () => {
    choose(today);
    setFilter("all");
  };
  const writeTask = () => protectedOpen({ type: "create" });
  return (
    <div className="app">
      <header className="top">
        <div className="topInner">
          <button className="brand" onClick={goDay} aria-label="合页首页">
            <img src="./heart.svg" alt="" width="37" height="37" />
            <strong>合页</strong>
            <span className="brandDivider" />
            <span className="tagline">情侣手账</span>
          </button>
          <nav className="mainNav" aria-label="主导航">
            <button className={view === "day" ? "active" : ""} onClick={goDay}>
              <BookOpen size={16} />
              今日手账
            </button>
            <button
              className={view === "history" ? "active" : ""}
              onClick={() =>
                board.seat ? setView("history") : open({ type: "entry" })
              }
            >
              <History size={16} />
              历史记录
            </button>
          </nav>
          <button
            className="spaceButton"
            onClick={() => protectedOpen({ type: "space" })}
          >
            <span className="pairAv" aria-hidden="true">
              <i />
              <i />
            </span>
            <span>我们俩</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="heroText">
            <span className="heroDate">
              <span /> {today.slice(0, 4)} 年{" "}
              {dateLabel(today, true).replace("星期", " · 星期")}
            </span>
            <h1>
              {!board.seat
                ? "写给我们"
                : view === "day"
                  ? "今日手账"
                  : "历史记录"}
              <em aria-hidden="true"><Heart size={18} fill="currentColor"/></em>
            </h1>
            <p>
              {view === "day"
                ? "把小约定寄给对方，把平常的一天写下来。"
                : "按日期翻阅两个人的约定、手记与确认记录。"}
            </p>
            <button className="primary heroBtn" onClick={()=>{if(board.seat)writeTask();else firstCode.current?.focus()}}>
              {!board.seat ? <KeyRound size={18} /> : <Plus size={18} />}{" "}
              {board.seat ? "写个小约定" : "打开我的手账"}
            </button>
          </div>
          <div className="heroArt">
            <img src="./letters.webp" width="720" height="410" alt="两封交叠的信，一枚爱心封蜡和一枝小花" />
          </div>
        </section>
        {error && (
          <div className="alert" role="alert">
            {error}
            <button className="textBtn" onClick={() => void fetchBoard()}>
              重新同步
            </button>
          </div>
        )}
        {!board.seat ? (
          <section className="entryInfo">
            <div className="laneIcon">
              <BookOpen size={18} />
            </div>
            <div className="entryBody">
              <h2>打开我们的手账</h2><p>输入自己的专属码，或打开另一半发来的邀请链接。</p>
              <form className="entryForm" onSubmit={e=>{e.preventDefault();void save({action:"enter",code:entryCode},"已打开你的手账")}}>
                <input ref={firstCode} aria-label="我的专属码" type="password" autoComplete="off" placeholder="粘贴我的专属码" maxLength={100} value={entryCode} required onChange={e=>setEntryCode(e.target.value)}/>
                <button className="primary" type="submit" disabled={busy}>进入手账 <ArrowRight size={16}/></button>
              </form>
              {formError&&!modal&&<p className="formError" role="alert">{formError}</p>}
            </div>
          </section>
        ) : view === "day" ? (
          <>
            <WeekStrip
              day={day}
              today={today}
              active={board.activeDays}
              choose={choose}
            />
            <div className="sectionHead">
              <div className="sectionName">
                <span className="sectionMark" />
                <h2>{day === today ? "今天的小约定" : "当日小约定"}</h2>
              </div>
              <span className="countSummary">
                <span />
                {board.tasks.filter((t) => t.status === "done").length} /{" "}
                {board.tasks.length} 已确认
              </span>
            </div>
            <div className="lanes">
              {[false, true].map((isSent) => {
                const items = isSent ? sent : received;
                return (
                  <section
                    className={"lane " + (isSent ? "sent" : "received")}
                    key={String(isSent)}
                  >
                    <header>
                      <div className="laneIcon">
                        {isSent ? <ArrowUpRight /> : <ArrowDownLeft />}
                      </div>
                      <h3>{isSent ? "我给对方的" : "对方给我的"}</h3>
                      <span className="countPill">
                        {String(items.length).padStart(2, "0")}
                      </span>
                    </header>
                    {items.length ? (
                      <div className="taskList">
                        {items.map((t) => (
                          <TaskLine
                            key={t.id}
                            task={t}
                            open={() => open({ type: "task", id: t.id })}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="empty">
                        <EmptyArt sent={isSent} />
                        <strong>
                          {loading
                            ? "正在翻开手账…"
                            : isSent
                              ? "还没有发出约定"
                              : "还没有收到约定"}
                        </strong>
                        <span>
                          {isSent
                            ? "给对方留一件今天想一起完成的小事。"
                            : "对方发布的当日小约定会出现在这里。"}
                        </span>
                        {isSent ? (
                          <button className="emptyLink" onClick={writeTask}>
                            <Plus size={13} />
                            寄出约定
                          </button>
                        ) : (
                          <button
                            className="emptyLink"
                            onClick={() => protectedOpen({ type: "space" })}
                          >
                            <UsersRound size={13} />
                            查看对方
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
            <div className="sectionHead">
              <div className="sectionName">
                <span className="sectionMark amber" />
                <h2>交换日记</h2>
              </div>
              <button
                className="textBtn"
                onClick={() => protectedOpen({ type: "note" })}
              >
                <Feather size={15} />
                {myNote ? "编辑手记" : "写手记"}
              </button>
            </div>
            <div className="notesCard">
              {[myNote, partnerNote].map((n, i) => (
                <div className="noteColumn" key={i}>
                  <span className={"noteAuthor " + (i ? "peach" : "")}>
                    <span />
                    {i ? "对方的手记" : "我的手记"}
                  </span>
                  <p className={n ? "written" : ""}>
                    {n
                      ? n.body
                      : i
                        ? "对方写下的当日记录会显示在这里。"
                        : "记下今天的进展或感想。"}{" "}
                  </p>
                  {n && <small>{stamp(n.updated)} 更新</small>}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="sectionHead">
              <div className="sectionName">
                <span className="sectionMark" />
                <h2>按日回顾</h2>
              </div>
              <div className="historyDate">
                <CalendarDays size={15} />
                <input
                  ref={dateRef}
                  aria-label="跳转到指定日期"
                  type="date"
                  min="2000-01-01"
                  max="2199-12-31"
                  onChange={(e) => {
                    if (e.target.value) choose(e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="historyCard">
              <div className="historyFilters">
                {[
                  ["all", "全部记录"],
                  ["review", "待我确认"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    className={filter === v ? "on" : ""}
                    onClick={() => setFilter(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {board.history.length ? (
                board.history.map((h) => (
                  <button
                    className="historyRow"
                    key={h.day}
                    onClick={() => choose(h.day)}
                  >
                    <div className="dayBadge">
                      <strong>{h.day.slice(8)}</strong>
                      <small>{Number(h.day.slice(5, 7))} 月</small>
                    </div>
                    <div>
                      <b>{h.day}</b>
                      <small>
                        {h.total} 项约定 · 已确认 {h.done} 项 · {h.notes} 篇手记
                      </small>
                    </div>
                    {h.waiting > 0 && (
                      <span className="status review">
                        {h.waiting} 项待我确认
                      </span>
                    )}
                    <ChevronRight size={18} />
                  </button>
                ))
              ) : (
                <div className="historyEmpty">
                  <History />
                  <b>
                    {loading
                      ? "正在读取记录…"
                      : filter === "review"
                        ? "没有等待你确认的约定"
                        : "还没有历史记录"}
                  </b>
                  <span>
                    {filter === "review"
                      ? "对方提交约定后，可以在这里集中查看。"
                      : "约定和手记会按日期自动保存。"}
                  </span>
                </div>
              )}
              {board.more && (
                <button
                  className="loadMore"
                  disabled={loading}
                  onClick={() => void fetchBoard(board.history.at(-1)?.day)}
                >
                  加载更早记录
                </button>
              )}
            </div>
          </>
        )}
        {board.seat>0 && <nav className="pocketNav" aria-label="手机导航">
          <button className={view==="day"?"current":""} onClick={goDay}><Mail size={20}/>今天</button>
          <button onClick={writeTask} className="composeQuick"><Plus size={22}/>写约定</button>
          <button className={view==="history"?"current":""} onClick={()=>board.seat?setView("history"):open({type:"entry"})}><History size={20}/>回顾</button>
        </nav>}
        <footer>
          <span>
            <BookOpen size={14} /> 合页
          </span>
          <span>情侣手账</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          {toast}
        </div>
      )}
      {modal?.type === "space" && (
        <Dialog title="我们俩" close={close}>
          <p className="dialogIntro">
            这台设备已记住你的席位。换手机或浏览器时，用原来的专属码或邀请链接即可继续。
          </p>
          <div className="members">
            {[0, 1].map((i) => {
              const seat = i === 0 ? mine : 3 - mine;
              const member = board.members.find((m) => m.slot === seat);
              return (
                <div key={i}>
                  <span className={"memberAvatar " + (i ? "peach" : "")}>
                    {i ? "伴" : "我"}
                  </span>
                  <div>
                    <b>
                      {i
                        ? member?.name === "对方"
                          ? "我的对方"
                          : member?.name || "对方席位"
                        : "我的席位"}
                    </b>
                    <small>
                      {member
                        ? "已加入手账"
                        : i
                          ? "等待对方加入"
                          : "等待首次进入"}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
          {board.seat === 1 && (
            <>
              <div className="inviteHelp">
                <Link2 size={18} />
                <div>
                  <strong>邀请对方</strong>
                  <p>
                    将对方专属链接私发给对方。持有人可用对方身份查看和操作手账。
                  </p>
                </div>
              </div>
              {inviteLink ? (
                <div className="copyRow">
                  <input
                    readOnly
                    aria-label="对方邀请链接"
                    value={inviteLink}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="softBtn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteLink);
                        setToast("对方邀请链接已复制");
                      } catch {
                        setFormError("请选中并复制上方链接。");
                      }
                    }}
                  >
                    <Copy size={15} />
                    复制链接
                  </button>
                </div>
              ) : (
                <button
                  className="softBtn"
                  disabled={busy}
                  onClick={() => void showInvite()}
                >
                  <Link2 size={15} />
                  查看对方邀请链接
                </button>
              )}
            </>
          )}
          <button
            className="textBtn leaveDevice"
            disabled={busy}
            onClick={() => void save({ action: "leave" }, "此设备已退出手账")}
          >
            退出此设备
          </button>
          {formError && (
            <p className="formError" role="alert">
              {formError}
            </p>
          )}
        </Dialog>
      )}
      {modal?.type === "entry" && (
        <Dialog title={entryCode ? "打开专属手账" : "输入专属码"} close={close}>
          <p className="dialogIntro">
            每个人的专属码对应一个固定席位。首次进入后，此浏览器会记住你的身份。
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save({ action: "enter", code: entryCode }, "已进入你的手账");
            }}
          >
            <label>
              我的专属码
              <input
                autoFocus
                type="password"
                name="entry"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={100}
                required
                placeholder="输入或粘贴专属码"
                value={entryCode}
                onChange={(e) => setEntryCode(e.target.value)}
              />
            </label>
            {formError && (
              <p className="formError" role="alert">
                {formError}
              </p>
            )}
            <div className="dialogActions">
              <button type="button" className="softBtn" onClick={close}>
                取消
              </button>
              <button
                type="submit"
                className="primary"
                disabled={busy || !entryCode.trim()}
              >
                进入手账 <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal &&
        (modal.type === "create" ||
          modal.type === "note" ||
          "task" in modal) && (
          <Dialog
            title={
              modal.type === "create"
                ? "写个小约定"
                : modal.type === "note"
                  ? myNote
                    ? "编辑我的手记"
                    : "写当天的手记"
                  : modal.type === "submit"
                    ? "提交给对方确认"
                    : modal.type === "approve"
                      ? "确认约定已完成"
                      : "退回补充"
            }
            close={close}
          >
            <form onSubmit={submitForm} key={modal.type}>
              {modal.type === "create" ? (
                <>
                  <label>
                    约定内容
                    <input
                      name="title"
                      placeholder="希望对方完成什么？"
                      maxLength={100}
                      required
                      autoFocus
                    />
                  </label>
                  <label>
                    约定日期
                    <input
                      name="day"
                      type="date"
                      min="2000-01-01"
                      max="2199-12-31"
                      required
                      defaultValue={day}
                    />
                  </label>
                  <label>
                    怎样算完成 <small>选填</small>
                    <textarea
                      name="detail"
                      maxLength={1000}
                      rows={3}
                      placeholder="写清楚做到什么程度就算完成"
                    />
                  </label>
                </>
              ) : modal.type === "note" ? (
                <>
                  <p className="formMeta">{dateLabel(day, true)} · 对方可见</p>
                  <label>
                    我的手记
                    <textarea
                      name="note"
                      rows={5}
                      maxLength={1500}
                      autoFocus
                      required
                      defaultValue={myNote?.body || ""}
                      placeholder="今天完成了什么？有什么想和对方说？"
                    />
                  </label>
                </>
              ) : "task" in modal ? (
                <>
                  <div className="taskQuote">{modal.task.title}</div>
                  <label>
                    {modal.type === "return"
                      ? "需要补充什么？"
                      : modal.type === "submit"
                        ? "完成说明"
                        : "确认留言"}{" "}
                    {modal.type !== "return" && <small>选填</small>}
                    <textarea
                      rows={4}
                      autoFocus
                      name="note"
                      maxLength={1000}
                      required={modal.type === "return"}
                      placeholder={
                        modal.type === "return"
                          ? "告诉对方还有哪些要求需要完成"
                          : "写下这次的记录…"
                      }
                    />
                  </label>
                </>
              ) : null}
              {formError && (
                <p className="formError" role="alert">
                  {formError}
                </p>
              )}
              <div className="dialogActions">
                <button type="button" className="softBtn" onClick={close}>
                  取消
                </button>
                {submitButton(
                  modal.type === "create"
                    ? "寄出约定"
                    : modal.type === "note"
                      ? "保存手记"
                      : modal.type === "return"
                        ? "退回补充"
                        : modal.type === "approve"
                          ? "确认完成"
                          : "提交完成",
                )}
              </div>
            </form>
          </Dialog>
        )}
      {modal?.type === "task" && detail && (
        <Dialog title="约定记录" close={close}>
          <div className="detailHead">
            <span className={"status " + detail.status}>
              {statusLabel[detail.status]}
            </span>
            <small>
              {detail.day} · {actor(detail.author)}发布
            </small>
          </div>
          <h3 className="taskTitle">{detail.title}</h3>
          {detail.detail && <p className="detailText">{detail.detail}</p>}
          <h4 className="timelineHeading">进展记录</h4>
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
                <span />
                <div>
                  <b>
                    {actor(e.actor)}
                    {eventName[e.kind]}
                  </b>
                  <small>{stamp(e.created)}</small>
                  {e.note && <p>{e.note}</p>}
                </div>
              </li>
            ))}
          </ol>
          <div className="dialogActions">
            {detail.author !== mine &&
              ["todo", "returned"].includes(detail.status) && (
                <button
                  className="primary"
                  onClick={() => open({ type: "submit", task: detail })}
                >
                  <Check size={16} />
                  提交完成
                </button>
              )}
            {detail.author === mine && detail.status === "review" && (
              <>
                <button
                  className="softBtn"
                  onClick={() => open({ type: "return", task: detail })}
                >
                  <RotateCcw size={15} />
                  退回补充
                </button>
                <button
                  className="primary"
                  onClick={() => open({ type: "approve", task: detail })}
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
