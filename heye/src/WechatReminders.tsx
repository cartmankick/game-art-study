import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, wechatReminder } from "./client";
import type { WechatStatus } from "./client";
import { Dialog } from "./parts";

const deliveryLabels = {
  pending: "提醒正在等待发送。",
  accepted: "服务商已受理，请到微信查看。",
  failed: "发送失败，请检查 SendKey、微信服务号通道和可用额度。",
  unknown: "暂时无法确认发送结果，请到微信查看。",
};

export function WechatReminders({close, onExit}: {close: () => void; onExit: () => void}) {
  const [status, setStatus] = useState<WechatStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    wechatReminder("status")
      .then(data => { if (active) setStatus(data); })
      .catch(e => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) onExit();
        else setError("暂时无法读取微信提醒设置。");
      })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [onExit]);

  async function update(action: "bind" | "test" | "unbind" | "status", key?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await wechatReminder(action, key);
      setStatus(next);
      if (action === "bind") setMessage("已开启。可以发送测试提醒，检查微信是否收到。");
      if (action === "unbind") setMessage("已关闭你的微信提醒。");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onExit();
      else setError(e instanceof ApiError ? e.message : "连接失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  function bind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = String(new FormData(event.currentTarget).get("sendKey") ?? "").trim();
    if (!key.startsWith("SCT")) {
      setError("请粘贴 Server 酱 Turbo 生成的 SCT 开头的 SendKey。");
      return;
    }
    void update("bind", key);
  }

  return <Dialog title="微信提醒" close={close}>
    <section className="invitePanel">
      <p className="muted">互派任务时，接收人会收到提醒；提交任务时，发布人会收到审核提醒；确认或退回时，接收人会收到结果。</p>
      {status?.enabled && <>
        <strong>我的微信提醒已开启</strong>
        {status.delivery && <p role="status">{deliveryLabels[status.delivery]}</p>}
        <div className="inviteButtons">
          <button className="primary" disabled={busy} onClick={() => void update("test")}>发送测试提醒</button>
          <button className="secondary" disabled={busy} onClick={() => void update("status")}>刷新状态</button>
        </div>
        <button className="secondary wide" disabled={busy} onClick={() => void update("unbind")}>关闭并解绑我的微信</button>
      </>}
      {status && !status.enabled && <>
        <p>用自己的微信登录 <a href="https://sct.ftqq.com/" target="_blank" rel="noreferrer">Server 酱 Turbo</a>，在「消息通道」选择「微信服务号」并完成微信绑定，再复制自己的 SendKey。</p>
        <form onSubmit={bind}>
          <label>我的 SendKey<input name="sendKey" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="粘贴 SCT 开头的 SendKey" required maxLength={256}/></label>
          <p className="muted">开启后，「出发」通过 Server 酱发送任务状态和网站入口。任务名称、正文及照片仅在网站内查看。</p>
          <button className="primary wide" disabled={busy}>开启我的微信提醒</button>
        </form>
      </>}
      {busy && <p role="status">正在处理…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!busy && !status && <button className="secondary wide" onClick={() => void update("status")}>重新读取</button>}
    </section>
  </Dialog>;
}
