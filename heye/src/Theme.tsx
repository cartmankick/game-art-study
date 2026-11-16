import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowUpRight, Check, Eye, Palette } from "lucide-react";
import { Dialog } from "./parts";
import { dateLabel, todayCN } from "./types";

const cleveland = "克利夫兰艺术博物馆";
const works = [
  {
    id: "pond", title: "睡莲", artist: "克洛德·莫奈", year: "约 1915–1926",
    alt: "横幅油画中，蓝紫色的池水倒映树影，粉绿的睡莲浮在水面。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1960.81",
  },
  {
    id: "warhol", title: "金宝汤罐头", artist: "安迪·沃霍尔", year: "1962",
    alt: "美术馆展墙上，三十二幅红白色的金宝汤罐头画布排成四行八列。",
    museum: "纽约现代艺术博物馆", source: "https://www.moma.org/collection/works/79809",
    photograph: {
      by: "Brandon Fick", source: "https://www.flickr.com/photos/ficken/2103465159/",
      license: "CC BY 2.0", terms: "https://creativecommons.org/licenses/by/2.0/",
    },
  },
  {
    id: "shanshui", title: "山水图", artist: "王翚", year: "清代",
    alt: "淡墨层峰之间，一线瀑布向溪谷垂落，山道穿过近处的松林与屋舍。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1915.105",
  },
  {
    id: "huaniao", title: "五色芍药图", artist: "恽寿平", year: "1685",
    alt: "浅金色绢面上，粉白芍药从两侧舒展，右上留有题字与印章。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1967.192",
  },
  {
    id: "night", title: "荒野暮色", artist: "弗雷德里克·埃德温·丘奇", year: "1860",
    alt: "绯红的晚霞铺满湖上天空，前景的松树和山脊已经沉入暮色。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1965.233",
  },
  {
    id: "abstract", title: "红、黄、蓝的构成", artist: "皮特·蒙德里安", year: "1927",
    alt: "黑线把白色画布分成大小不同的矩形，几块红、黄、蓝色分布在边缘。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1967.215",
  },
  {
    id: "warm", title: "瓶中玫瑰", artist: "皮埃尔-奥古斯特·雷诺阿", year: "约 1890",
    alt: "青绿色花瓶中插着一束暖红与奶油色玫瑰，松散的油彩笔触勾勒花瓣。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1941.14",
  },
  {
    id: "jazz", title: "梅·米尔顿", artist: "亨利·德·图卢兹-洛特雷克", year: "1895",
    alt: "石版海报中，浅色长裙的舞者在深蓝背景上起舞，手绘字母沿顶部排开。",
    museum: cleveland, source: "https://www.clevelandart.org/art/1952.10",
  },
  {
    id: "coast", title: "神奈川冲浪里", artist: "葛饰北斋", year: "约 1830–1832",
    alt: "巨浪弯成爪形，木船贴着深蓝色浪谷，远处露出富士山。",
    museum: "大都会艺术博物馆", source: "https://www.metmuseum.org/art/collection/search/45434",
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
  document.documentElement.classList.toggle("withSkin", theme !== "classic");
  const color = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#ffffff";
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

const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "UTC" });

export function SkinDate({ day }: { day: string }) {
  const current = useSyncExternalStore(subscribe, getSkin);
  if (current === "classic") return null;
  return (
    <time className="skinDate" dateTime={day} aria-label={dateLabel(day, true)}>
      <span className="dateMonth">{Number(day.slice(5, 7))} 月</span>
      <b>{day.slice(8, 10)}</b>
      <span className="dateWeek">{weekday.format(new Date(day + "T12:00:00Z"))}</span>
    </time>
  );
}

function SkinPreview({ work, day }: { work: Work; day: string }) {
  return (
    <span className="skinPreview" data-skin={work.id} aria-hidden="true">
      <span className="miniHero">
        <strong>今天的任务</strong><i className="miniDate">{day.slice(8, 10)}</i>
      </span>
      <span className="miniRow"><i /><span>双人任务</span><b>＋</b></span>
      <span className="miniNav"><i /><i /><i /><i /><i /></span>
    </span>
  );
}

function ArtDetails({ work }: { work: Work }) {
  return (
    <>
      <figure className="artDetail">
        <img src={picture(work)} alt={work.alt} />
        <figcaption><strong>{work.artist}</strong><span>{work.year}</span></figcaption>
      </figure>
      <a className="collectionLink" href={work.source} target="_blank" rel="noreferrer">
        {work.museum}馆藏页 <ArrowUpRight size={15} aria-hidden="true" />
      </a>
      {"photograph" in work && (
        <p className="photoCredit">
          展览现场摄影 <a href={work.photograph.source} target="_blank" rel="noreferrer">{work.photograph.by}</a>
          {" · "}<a href={work.photograph.terms} target="_blank" rel="noreferrer">{work.photograph.license}</a>
          <small>图像已转为 WebP。</small>
        </p>
      )}
    </>
  );
}

export function Theme() {
  const [panel, setPanel] = useState<"closed" | "picker" | "art">("closed");
  const current = useSyncExternalStore(subscribe, getSkin);
  const selected = works.find((work) => work.id === current);
  const day = todayCN();
  return (
    <>
      <button className="secondary themeOpen" aria-label="切换皮肤" onClick={() => setPanel("picker")}>
        <Palette size={17} /><span>皮肤</span>
      </button>
      {panel !== "closed" && (
        <Dialog title={panel === "art" && selected ? selected.title : "选择皮肤"} close={() => setPanel("closed")}>
          {panel === "art" && selected ? (
            <>
              <ArtDetails work={selected} />
              <button className="secondary wide" onClick={() => setPanel("picker")}><ArrowLeft size={15} />返回皮肤</button>
            </>
          ) : (
            <>
              <div className="skins">
                {works.map((work) => (
                  <button key={work.id} className="swatch" type="button"
                    aria-label={`${work.title}，${work.artist}`} aria-pressed={work.id === current}
                    onClick={() => choose(work.id)}>
                    <SkinPreview work={work} day={day} />
                    <span className="swatchInfo"><strong>{work.title}</strong><small>{work.artist}</small>
                      {work.id === current && <Check className="skinCheck" size={14} aria-hidden="true" />}
                    </span>
                  </button>
                ))}
              </div>
              <div className="skinActions">
                <button className="secondary" aria-pressed={current === "classic"} onClick={() => choose("classic")}>
                  {current === "classic" && <Check size={14} />}纯白
                </button>
                {selected && <button className="secondary" onClick={() => setPanel("art")}><Eye size={15} />看原作</button>}
                <button className="primary" onClick={() => setPanel("closed")}>完成</button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
