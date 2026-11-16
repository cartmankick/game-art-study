import { useEffect, useState } from "react";
import { Copy, Link, Ticket } from "lucide-react";
import { ApiError, invitationLink, request } from "./client";
import { Dialog } from "./parts";

type InvitationState = { code: string | null; paired: boolean };

export default function Invitation({
  close,
  onExit,
}: {
  close: () => void;
  onExit: () => void;
}) {
  const [info, setInfo] = useState<InvitationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    request({ action: "invitation" })
      .then((data) => {
        if (active) setInfo(data);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) onExit();
        else setError(e instanceof Error ? e.message : "暂时无法读取邀请码。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry, onExit]);

  async function recover() {
    setLoading(true);
    setError("");
    try {
      setInfo(await request({ action: "recover-invitation" }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onExit();
      else setError(e instanceof Error ? e.message : "生成失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string, label: string) {
    setCopied("");
    setManual("");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label + "已复制");
    } catch {
      setManual(value);
      setCopied("请长按下方内容复制");
    }
  }

  return (
    <Dialog title="邀请码" close={close}>
      <section className="invitePanel">
        {loading && <p role="status">正在{info ? "生成" : "读取"}邀请码…</p>}
        {info?.code && (
          <>
            <p className="muted">
              {info.paired
                ? "对方已加入，邀请码已使用。"
                : "把邀请码或邀请链接私发给另一半。"}
            </p>
            <div className="inviteValue">
              <Ticket size={21} aria-hidden="true" />
              <output aria-label="当前邀请码">{info.code}</output>
            </div>
            {!info.paired && (
              <div className="inviteButtons">
                <button
                  className="secondary"
                  onClick={() => void copy(info.code!, "邀请码")}
                >
                  <Copy size={16} />
                  复制邀请码
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    void copy(invitationLink(info.code!), "邀请链接")
                  }
                >
                  <Link size={16} />
                  复制邀请链接
                </button>
              </div>
            )}
          </>
        )}
        {info &&
          !info.code &&
          (info.paired ? (
            <p>对方已加入，你们可以直接登录。</p>
          ) : (
            <>
              <p>旧邀请码无法显示。生成新码后，原邀请码和邀请链接会失效。</p>
              <button
                className="primary wide"
                disabled={loading}
                onClick={() => void recover()}
              >
                <Ticket size={17} />
                生成新邀请码
              </button>
            </>
          ))}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {error && !info && (
          <button
            className="secondary wide"
            onClick={() => setRetry((v) => v + 1)}
          >
            重新读取
          </button>
        )}
        {copied && (
          <p role="status" className="muted">
            {copied}
          </p>
        )}
        {manual && (
          <input
            aria-label="可手动复制的内容"
            readOnly
            value={manual}
            onFocus={(e) => e.target.select()}
          />
        )}
      </section>
    </Dialog>
  );
}
