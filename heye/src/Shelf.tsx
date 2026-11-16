import { useRef, useState } from "react";
import {
  BookOpen,
  Music2,
  Clapperboard,
  ListChecks,
  Check,
  Plus,
} from "lucide-react";
import { MusicCard } from "./MusicCard";
import { parseMusicShare, musicRows, savedMusic } from "./musicShare";
import { request } from "./client";
import { Dialog } from "./parts";
import type { Board, MediaKind, Completion } from "./types";

const media = {
  book: { label: "书籍", verb: "读完", icon: BookOpen },
  music: { label: "音乐", verb: "听完", icon: Music2 },
  film: { label: "电影", verb: "看完", icon: Clapperboard },
  other: { label: "其他", verb: "完成", icon: ListChecks },
};
const kinds = Object.keys(media) as MediaKind[];
const label = (kind: Completion["kind"]) =>
  kind === "event" ? "共同事件" : kind === "task" ? "任务" : media[kind].label;
const verb = (kind: Completion["kind"]) =>
  kind === "task" || kind === "event" ? "完成" : media[kind].verb;
type Props = { board: Board; loading: boolean; name: (s: number) => string };
export function Shelf({
  board,
  loading,
  name,
  refresh,
}: { refresh: () => Promise<void> } & Props) {
  const [kind, setKind] = useState<MediaKind | "all">("all"),
    [form, setForm] = useState(false);
  const [addKind, setAddKind] = useState<MediaKind>("book"),
    [titles, setTitles] = useState(""),
    [customTitle, setCustomTitle] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    ids = useRef(new Map<string, string>());
  const items = (board.shelf ?? []).filter(
    (i) => kind === "all" || kind === i.kind,
  );
  async function mutate(payload: Record<string, unknown>, adding = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await request(payload);
      if (adding) {
        setForm(false);
        if (kind !== "all") setKind(addKind);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const rows = addKind === "music" ? musicRows(titles) : titles.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  const preview = addKind === "music" && rows.length === 1 ? parseMusicShare(rows[0]) : null;
  function add(e: React.FormEvent) {
    e.preventDefault();
    const unique = new Map<string, {title: string; music_url?: string; artist?: string | null}>();
    for (const row of rows) {
      const share = addKind === "music" ? parseMusicShare(row) : null;
      if (addKind === "music" && !share && /https?:\/\//i.test(row)) {
        setError("请粘贴网易云音乐的分享链接，或只填写作品名称。"); return;
      }
      const item = share ? { ...share, title: (preview && customTitle?.trim()) || share.title } : { title: row };
      unique.set(share?.music_url || item.title, item);
    }
    if (!unique.size || unique.size > 30 || [...unique.values()].some(i => Array.from(i.title).length > 150 || (i.artist && Array.from(i.artist).length > 150))) {
      setError("每次可添加 1–30 项，名称和歌手各最多 150 字。"); return;
    }
    const items = [...unique.values()].map((item) => {
      const key = JSON.stringify([addKind, item]);
      if (!ids.current.has(key)) ids.current.set(key, crypto.randomUUID());
      return { ...item, id: ids.current.get(key) };
    });
    void mutate({ action: "shelf-add", kind: addKind, items }, true);
  }
  return (
    <section className="shelf">
      <div className="sectionHead">
        <h2>作品清单</h2>
        <button
          className="primary"
          onClick={() => {
            setTitles("");
            setCustomTitle(null);
            setAddKind(kind === "all" ? "book" : kind);
            setError("");
            ids.current.clear();
            setForm(true);
          }}
        >
          <Plus size={16} />
          {kind === "music" ? "分享音乐" : "添加作品"}
        </button>
      </div>
      <div className="shelfFilters" aria-label="作品分类">
        {(["all", ...kinds] as const).map((k) => (
          <button key={k} aria-pressed={k === kind} onClick={() => setKind(k)}>
            {k === "all" ? "全部" : media[k].label}
          </button>
        ))}
      </div>
      {error && !form && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <div className="empty">
          {loading ? "正在同步…" : "这里还没有作品，点「添加作品」开始。"}
        </div>
      ) : (
        <ul className="shelfList">
          {items.map((i) => {
            const Icon = media[i.kind].icon;
            const mine = i.people.includes(board.seat);
            const partner = 3 - board.seat;
            const share = savedMusic(i);
            return (
              <li key={i.id} className={share ? "musicItem" : undefined}>
                {share ? <MusicCard share={share} /> : <>
                <span className="shelfIcon">
                  <Icon size={19} />
                </span>
                <div className="workTitle">
                  <small>{label(i.kind)}</small>
                  <strong>{i.title}</strong>
                  <small>
                    {name(partner)} · {i.people.includes(partner) ? "已" : "未"}
                    {verb(i.kind)}
                  </small>
                </div>
                </>}
                {share && <small className="musicStatus">{name(i.author)}分享 · {name(partner)}{i.people.includes(partner) ? "已" : "未"}听完</small>}
                <label className="workCheck">
                  <input
                    type="checkbox"
                    checked={mine}
                    disabled={busy || !board.seat}
                    aria-label={(share?.title || i.title) + "，我已" + verb(i.kind)}
                    onChange={(e) =>
                      void mutate({
                        action: "shelf-check",
                        id: i.id,
                        checked: e.target.checked,
                      })
                    }
                  />
                  <span>我已{verb(i.kind)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {form && (
        <Dialog
          title="添加作品"
          close={() => {
            if (!lock.current) {
              setForm(false);
              setError("");
            }
          }}
        >
          <form onSubmit={add}>
            <label>
              分类
              <select
                value={addKind}
                onChange={(e) => { setAddKind(e.target.value as MediaKind); setCustomTitle(null); }}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {label(k)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {addKind === "music" ? "歌曲名称或网易云分享" : "作品名称"}
              <textarea
                required
                rows={5}
                value={titles}
                onPaste={(e) => { if (!titles.trim() && parseMusicShare(e.clipboardData.getData("text"))) setAddKind("music"); }}
                onChange={(e) => { setTitles(e.target.value); setCustomTitle(null); }}
                placeholder={addKind === "music" ? "粘贴网易云链接或整段分享文字，每行一首" : "每行一个名称，可以整份粘贴"}
              />
            </label>
            {preview && <>
              <label>卡片标题<input value={customTitle ?? preview.title} onChange={e => setCustomTitle(e.target.value)} maxLength={150} /></label>
              <div className="musicPreview"><MusicCard share={{...preview, title: customTitle?.trim() || preview.title}} /></div>
            </>}
            <p className="muted">两个人都能看到，各自勾选完成。</p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy} className="primary wide">
              {busy ? "正在保存…" : "加入清单"}
            </button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
export function Finished({
  board,
  loading,
  name,
  initialType = "all",
}: Props & { initialType?: string }) {
  const [person, setPerson] = useState(0),
    [type, setType] = useState(initialType);
  const rows = (board.finished ?? []).filter(
    (x) =>
      (!person || x.person === 0 || x.person === person) &&
      (type === "all" || x.kind === type),
  );
  const date = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <section>
      <div className="sectionHead">
        <h2>完成记录</h2>
      </div>
      <div className="archiveFilters">
        <label>
          完成人
          <select value={person} onChange={(e) => setPerson(+e.target.value)}>
            <option value={0}>两个人</option>
            {[1, 2].map((s) => (
              <option key={s} value={s}>
                {name(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          类别
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">全部类别</option>
            {(["task", "event", ...kinds] as const).map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {rows.length ? (
        <ul className="shelfList">
          {rows.map((x, i) => {
            const share = savedMusic(x);
            const day = date.format(new Date(x.finished));
            return (
              <li className="completion" key={x.kind + x.id + x.person}>
                {(!i ||
                  day !== date.format(new Date(rows[i - 1].finished))) && (
                  <h3>{day}</h3>
                )}
                <div>
                  <Check size={16} />
                  <div className="workTitle">
                    <small>
                      {x.person === 0 ? "两人" : name(x.person)} · 已
                      {verb(x.kind)} · {label(x.kind)}
                    </small>
                    {share ? <MusicCard share={share} /> : <strong>{x.title}</strong>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty">
          {loading ? "正在同步…" : "还没有符合条件的完成记录"}
        </div>
      )}
    </section>
  );
}
