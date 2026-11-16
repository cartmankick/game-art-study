import { useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, Maximize2, Palette } from "lucide-react";
import { Dialog } from "./parts";

const cleveland = "克利夫兰艺术博物馆";
const works = [
  {
    id: "pond", title: "睡莲", artist: "克洛德·莫奈", year: "约 1915–1926",
    alt: "横幅油画中，蓝紫色的池水倒映树影，粉绿的睡莲浮在水面。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1960.81",
    chrome: "#f6f6f2",
  },
  {
    id: "night", title: "荒野暮色", artist: "弗雷德里克·埃德温·丘奇", year: "1860",
    alt: "绯红的晚霞铺满湖上天空，前景的松树和山脊已经沉入暮色。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1965.233",
    chrome: "#191c20",
  },
  {
    id: "abstract", title: "红、黄、蓝的构成", artist: "皮特·蒙德里安", year: "1927",
    alt: "黑线把白色画布分成大小不同的矩形，几块红、黄、蓝色分布在边缘。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1967.215",
    chrome: "#f5f4f0",
  },
  {
    id: "warm", title: "瓶中玫瑰", artist: "皮埃尔-奥古斯特·雷诺阿", year: "约 1890",
    alt: "青绿色花瓶中插着一束暖红与奶油色玫瑰，松散的油彩笔触勾勒花瓣。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1941.14",
    chrome: "#f9f5ef",
  },
  {
    id: "jazz", title: "梅·米尔顿", artist: "亨利·德·图卢兹-洛特雷克", year: "1895",
    alt: "石版海报中，浅色长裙的舞者在深蓝背景上起舞，手绘字母沿顶部排开。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1952.10",
    chrome: "#f5f2eb",
  },
  {
    id: "coast", title: "神奈川冲浪里", artist: "葛饰北斋", year: "约 1830–1832",
    alt: "巨浪弯成爪形，木船贴着深蓝色浪谷，远处露出富士山。",
    museum: "大都会艺术博物馆", source: "https://www.metmuseum.org/art/collection/search/45434",
    chrome: "#f5f5ee",
  },
] as const;
type Work = (typeof works)[number];
type Skin = Work["id"] | "classic";
const storageKey = "depart.appearance";

function readSkin(): Skin {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "classic") return saved;
    return works.find((work) => work.id === saved)?.id ?? "pond";
  } catch {
    return "pond";
  }
}
let active = readSkin();
const subscribers = new Set<() => void>();
function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => { subscribers.delete(callback); };
}
function apply(theme: Skin) {
  active = theme;
  document.documentElement.dataset.skin = theme;
  const color = works.find((work) => work.id === theme)?.chrome ?? "#ffffff";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  subscribers.forEach((callback) => callback());
}
apply(active);
window.addEventListener("storage", (event) => {
  if (event.key === storageKey || event.key === null) apply(readSkin());
});
function choose(theme: Skin) {
  apply(theme);
  try { localStorage.setItem(storageKey, theme); } catch {}
}
const getSkin = () => active;
function picture(work: Work) { return "./artwork/" + work.id + ".webp"; }

export function Artwork() {
  const current = useSyncExternalStore(subscribe, getSkin);
  const [enlarged, setEnlarged] = useState(false);
  const work = works.find((item) => item.id === current);
  if (!work) return null;
  return (
    <>
      <button type="button" className="artPlate"
        aria-label={`放大查看《${work.title}》`} onClick={() => setEnlarged(true)}>
        <span className="artMat"><img src={picture(work)} alt={work.alt} /></span>
        <span className="artCredit">
          <span><strong>{work.title}</strong><small>{work.artist}</small></span>
          <Maximize2 size={15} aria-hidden="true" />
        </span>
      </button>
      {enlarged && (
        <Dialog title={work.title} close={() => setEnlarged(false)}>
          <figure className="artDetail">
            <img src={picture(work)} alt={work.alt} />
            <figcaption><strong>{work.artist}</strong><span>{work.year}</span></figcaption>
          </figure>
          <a className="collectionLink" href={work.source} target="_blank" rel="noreferrer">
            {work.museum}馆藏页 <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </Dialog>
      )}
    </>
  );
}

export function Theme() {
  const [open, setOpen] = useState(false);
  const current = useSyncExternalStore(subscribe, getSkin);
  return (
    <>
      <button className="secondary themeOpen" aria-label="切换皮肤" onClick={() => setOpen(true)}>
        <Palette size={17} /><span>皮肤</span>
      </button>
      {open && (
        <Dialog title="选择皮肤" close={() => setOpen(false)}>
          <div className="skins">
            {works.map((work) => (
              <button key={work.id} className="swatch" type="button"
                aria-label={`${work.title}，${work.artist}`} aria-pressed={work.id === current}
                onClick={() => choose(work.id)}>
                <span className="swatchMat" data-work={work.id}><img src={picture(work)} alt="" /></span>
                <span className="swatchInfo">
                  <strong>{work.title}</strong><small>{work.artist}</small>
                  {work.id === current && <Check className="skinCheck" size={14} aria-hidden="true" />}
                </span>
              </button>
            ))}
          </div>
          <div className="skinActions">
            <button className="secondary" aria-pressed={current === "classic"} onClick={() => choose("classic")}>
              {current === "classic" && <Check size={14} />}纯白
            </button>
            <button className="primary" onClick={() => setOpen(false)}>完成</button>
          </div>
        </Dialog>
      )}
    </>
  );
}
