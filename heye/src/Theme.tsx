import { useState } from "react";
import { Palette, Check } from "lucide-react";
import { Dialog } from "./parts";
const skins = [
  ["pond", "睡莲池畔"],
  ["night", "午夜星图"],
  ["abstract", "几何构成"],
  ["warm", "奶油小屋"],
  ["jazz", "蓝调唱片"],
  ["coast", "海岸印刷"],
] as const;
const key = "depart.appearance";
function apply(theme: string) {
  document.documentElement.dataset.skin = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      (
        {
          night: "#151b2d",
          pond: "#f3f5ef",
          abstract: "#fff9e9",
          warm: "#fff5ec",
          jazz: "#edf1fc",
          coast: "#f2f6ed",
        } as Record<string, string>
      )[theme] || "#ffffff",
    );
}
try {
  const saved = localStorage.getItem(key);
  if (skins.some(([s]) => s === saved)) apply(saved!);
} catch {}
export function Theme() {
  const [open, setOpen] = useState(false),
    [current, setCurrent] = useState(
      () => document.documentElement.dataset.skin || "classic",
    );
  function choose(s: string) {
    apply(s);
    setCurrent(s);
    try {
      localStorage.setItem(key, s);
    } catch {}
  }
  return (
    <>
      <button
        className="secondary themeOpen"
        aria-label="切换皮肤"
        onClick={() => setOpen(true)}
      >
        <Palette size={17} />
        <span>皮肤</span>
      </button>
      {open && (
        <Dialog title="选择皮肤" close={() => setOpen(false)}>
          <div className="skins">
            {skins.map(([s, label]) => (
              <button
                key={s}
                className="swatch"
                aria-pressed={s === current}
                onClick={() => choose(s)}
              >
                <span data-swatch={s} />
                <b>
                  {label} {s === current && <Check size={14} />}
                </b>
              </button>
            ))}
          </div>
          <button className="secondary wide" onClick={() => choose("classic")}>
            恢复原白色
          </button>
          <button className="primary wide" onClick={() => setOpen(false)}>
            完成
          </button>
        </Dialog>
      )}
    </>
  );
}
