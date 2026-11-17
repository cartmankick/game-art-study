import { SkinDate, Theme } from "./Theme";
import { todayCN } from "./types";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Navigation,
  Copy,
  Check,
  Image as ImageIcon,
  ListChecks,
} from "lucide-react";
import { authenticate, invitationLink, request, saved } from "./client";
export function Mark() {
  return (
    <span className="brandMark">
      <Navigation size={22} strokeWidth={2.1} />
    </span>
  );
}
export function RouteSketch() {
  return (
    <svg
      className="routeSketch"
      viewBox="0 0 210 98"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="#d5e2df" strokeWidth="1">
        <path d="m-15 68 72-41 66 29 84-48m-211 78 69-42 64 29 94-55M10 1l50 28-41 60m34-87 73 42 30 54m-50-99 84 46m-44-49 57 32M116 98l-6-32M0 44l34 20" />
        <path d="m67 55 12-8 18 8-11 8z" fill="#ecf2ef" />
        <path d="m159 54 22-12 16 9-20 12z" fill="#e6eeea" />
      </g>
      <path
        d="M29 76c23 0 24-25 46-25s39 20 53 6c12-13 4-29 32-29"
        stroke="#478478"
        strokeDasharray="4 5"
        strokeWidth="2.5"
      />
      <circle
        cx="29"
        cy="76"
        r="4.8"
        fill="white"
        stroke="#4c8077"
        strokeWidth="2.5"
      />
      <path d="m158 22 17 4-14 10 1-7z" fill="#35655e" />
    </svg>
  );
}
type Mode = "login" | "owner" | "join";
function invitationFromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  return p.get("join") || "";
}
export default function Entry({ onEnter }: { onEnter: () => void }) {
  const [incoming] = useState(invitationFromHash),
    [mode, setMode] = useState<Mode>(
      incoming ? "join" : saved("heye.couple.v1.device") ? "owner" : "login",
    );
  const [stage, setStage] = useState<{
      ownerReady: boolean;
      paired: boolean;
    } | null>(null),
    [stateError, setStateError] = useState("");
  const [wait, setWait] = useState(false),
    [error, setError] = useState(""),
    [invite, setInvite] = useState(""),
    [copied, setCopied] = useState(false);
  const touched = useRef(false);
  const [name, setName] = useState(() => saved("depart.name"));
  async function checkStage() {
    try {
      const s = await request({ action: "stage" });
      setStage(s);
      setStateError("");
      if (!touched.current && !incoming) {
        setMode(s.ownerReady ? "login" : "owner");
      }
    } catch {
      setStateError("暂时无法读取注册状态。");
    }
  }
  useEffect(() => {
    void checkStage();
    if (new URLSearchParams(location.hash.slice(1)).has("join"))
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (wait) return;
    const form = new FormData(e.currentTarget);
    const registration = String(form.get("registration") || ""),
      invitation = String(form.get("invitation") || "").trim();
    if (mode !== "login" && registration === invitation) {
      setError("个人注册码和两人共享的邀请码请使用不同的内容。");
      return;
    }
    setWait(true);
    setError("");
    try {
      await authenticate({
        action: mode,
        name,
        registration,
        invitation,
        proof: String(form.get("proof") || ""),
      });
      if (mode === "owner") setInvite(invitationLink(invitation));
      else onEnter();
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败，请重试。");
    } finally {
      setWait(false);
    }
  }
  const labels = { login: "登录", owner: "创建空间", join: "受邀加入" };
  return (
    <main className="entryPage">
      <div className="entryBrand">
        <Mark />
        <strong>出发</strong>
        <Theme />
      </div>
      <section className="welcome">
        <div>
          <span className="welcomeIcons">
            <ListChecks size={17} />
            <span />
            <ImageIcon size={16} />
          </span>
          <h1>两个人的空间</h1>
          <p>互发任务，分享每天的照片。</p>
        </div>
        <RouteSketch />
        <SkinDate day={todayCN()} />
      </section>
      {invite ? (
        <section className="entryCard">
          <div className="successBadge">
            <Check />
          </div>
          <h2>两人空间已创建</h2>
          <p>把邀请链接私发给对方。以后可以在「我们俩」里查看邀请码。</p>
          <label>
            邀请链接
            <input readOnly value={invite} onFocus={(e) => e.target.select()} />
          </label>
          <button
            className="secondary wide"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invite);
                setCopied(true);
              } catch {
                setError("请长按上面的链接复制。");
              }
            }}
          >
            <Copy size={16} />
            {copied ? "已复制" : "复制邀请链接"}
          </button>
          <button className="primary wide" onClick={onEnter}>
            进入出发 <ArrowRight size={17} />
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      ) : (
        <section className="entryCard">
          <nav aria-label="进入方式" className="entryTabs">
            {(["login", "owner", "join"] as Mode[])
              .filter(
                (m) =>
                  m === "login" ||
                  m === mode ||
                  (m === "owner" ? !stage?.ownerReady : !stage?.paired),
              )
              .map((m) => (
                <button
                  key={m}
                  className={mode === m ? "active" : ""}
                  aria-pressed={mode === m}
                  onClick={() => {
                    touched.current = true;
                    setMode(m);
                    setError("");
                  }}
                >
                  {labels[m]}
                </button>
              ))}
          </nav>
          <h2>
            {mode === "owner"
              ? "创建你的双人空间"
              : mode === "join"
                ? "加入对方的空间"
                : "欢迎回来"}
          </h2>
          <p>
            {mode === "owner"
              ? "在进入前设置名字、个人注册码和给对方的邀请码。"
              : mode === "join"
                ? "使用对方给你的邀请码，设置自己的名字和注册码。"
                : "用注册时填写的名字和个人注册码登录。"}
          </p>
          <form key={mode} onSubmit={submit}>
            <label>
              我的名字
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={20}
                placeholder="你希望对方怎么称呼你？"
                autoComplete="username"
              />
            </label>
            {mode === "owner" && (
              <label>
                原创建者专属码
                <input
                  name="proof"
                  type="password"
                  defaultValue={saved("heye.couple.v1.device")}
                  autoComplete="off"
                  required
                  placeholder="首次设置使用原站的专属码"
                />
              </label>
            )}
            <label>
              {mode === "login" ? "个人注册码" : "设置个人注册码"}
              <input
                name="registration"
                type="password"
                required
                minLength={8}
                maxLength={64}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder={
                  mode === "login"
                    ? "输入个人注册码"
                    : "至少 8 位，留作以后登录"
                }
              />
            </label>
            {mode !== "login" && (
              <label>
                {mode === "owner" ? "设置对方的邀请码" : "对方给我的邀请码"}
                <input
                  name="invitation"
                  type={mode === "owner" ? "text" : "password"}
                  defaultValue={mode === "join" ? incoming : ""}
                  required
                  minLength={8}
                  maxLength={64}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    mode === "owner"
                      ? "至少 8 位，分享给另一半"
                      : "输入对方设置的邀请码"
                  }
                />
              </label>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {stateError && (
              <p className="error">
                {stateError}{" "}
                <button type="button" onClick={() => void checkStage()}>
                  重试
                </button>
              </p>
            )}
            <button className="primary wide" disabled={wait}>
              {wait
                ? "正在处理…"
                : mode === "owner"
                  ? "保存设置并创建"
                  : mode === "join"
                    ? "注册并加入"
                    : "登录出发"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          {mode === "login" && <details><summary>忘记个人注册码？</summary><p>请让空间创建者登录，打开「我们俩 → 帮伙伴重设注册码」，把一次性链接私发给你。打开链接即可设置新码。</p></details>}
        </section>
      )}
    </main>
  );
}
