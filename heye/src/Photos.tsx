import { useState, useRef } from "react";
import { ImagePlus, Image as ImageIcon, Upload, RotateCcw } from "lucide-react";
import { preparePhoto, sendPhoto, request } from "./client";
import { Dialog } from "./parts";
import type { Photo } from "./types";
type Item = { file: File; id: string; image?: Blob };
export default function Photos({
  day,
  seat,
  photos,
  who,
  refresh,
}: {
  day: string;
  seat: number;
  photos: Photo[];
  who: (s: number) => string;
  refresh: () => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const picker = useRef<HTMLInputElement>(null),
    running = useRef(false),
    retries = useRef<{ items: Item[]; day: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Photo | null>(null);
  async function upload(items: Item[], date: string) {
    if (running.current || !items.length) return;
    running.current = true;
    setBusy(true);
    setError("");
    retries.current = null;
    let completed = 0;
    try {
      for (const item of items) {
        setProgress("正在上传 " + (completed + 1) + " / " + items.length);
        item.image ??= await preparePhoto(item.file);
        await sendPhoto(item.image, date, item.id);
        completed++;
      }
      setProgress("已上传 " + completed + " 张照片");
      await refresh();
    } catch (e) {
      retries.current = { items: items.slice(completed), day: date };
      setProgress(completed ? "已上传 " + completed + " 张" : "");
      setError(e instanceof Error ? e.message : "上传未完成，请重试。");
      await refresh();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="photoSection">
      <div className="sectionHead">
        <h2>
          当天照片 <small>{photos.length}</small>
        </h2>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => picker.current?.click()}
        >
          <ImagePlus size={16} />
          上传图片
        </button>
      </div>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="选择图片"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void upload(
            files.map((file) => ({ file, id: crypto.randomUUID() })),
            day,
          );
        }}
      />
      {photos.length ? (
        <div className="photoGrid">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setConfirmDelete(false);
                setSelected(p);
              }}
              className="photoTile"
              aria-label={"查看" + who(p.author) + "上传的照片"}
            >
              <img
                src={p.url}
                alt={who(p.author) + "上传的照片"}
                loading="lazy"
              />
              <span>{who(p.author)}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          className="photoBlank"
          onClick={() => picker.current?.click()}
          disabled={busy}
        >
          <ImageIcon size={28} />
          <strong>分享今天的第一张照片</strong>
          <span>从手机相册选择，可一次上传多张</span>
        </button>
      )}
      {progress && (
        <p className="uploadStatus" role="status">
          <Upload size={14} />
          {progress}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <button
            onClick={() =>
              retries.current &&
              void upload(retries.current.items, retries.current.day)
            }
            disabled={busy}
          >
            <RotateCcw size={13} />
            重试
          </button>
        </p>
      )}
      {selected && (
        <Dialog
          title={who(selected.author) + "的照片"}
          close={() => setSelected(null)}
        >
          <img
            className="largePhoto"
            src={photos.find((p) => p.id === selected.id)?.url || selected.url}
            alt={who(selected.author) + "上传的照片"}
          />
          <p className="muted">{selected.day}</p>
          {selected.author === seat && (
            <div className="actions">
              {confirmDelete ? (
                <>
                  <span>删除这张照片？</span>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                  >
                    取消
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await request({
                          action: "remove-photo",
                          id: selected.id,
                        });
                        setSelected(null);
                        setProgress("照片已删除");
                        await refresh();
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "删除失败，请重试",
                        );
                        setSelected(null);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    确认删除
                  </button>
                </>
              ) : (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  删除我的照片
                </button>
              )}
            </div>
          )}
        </Dialog>
      )}
    </section>
  );
}
