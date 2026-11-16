export type MusicShare = { title: string; music_url: string; artist?: string | null };
const hosts = new Set(["music.163.com", "y.music.163.com", "163cn.tv"]);
const types: Record<string, string> = { song: "单曲", playlist: "歌单", album: "专辑", program: "节目", djradio: "电台" };
const linkPattern = /(?:https?:\/\/[^\s<>"《》【】（）]+|(?:y\.music\.163\.com|music\.163\.com|163cn\.tv)\/[^\s<>"《》【】（）]+)/i;

export function parseMusicShare(text: string): MusicShare | null {
  const match = text.match(linkPattern);
  if (!match) return null;
  const token = match[0].replace(/[)\]，。；、！,.;!]+$/u, "");
  let url: URL;
  try { url = new URL(/^https?:/i.test(token) ? token : "https://" + token); }
  catch { return null; }
  if (!hosts.has(url.hostname) || url.username || url.password || url.port || url.pathname === "/" && !url.hash) return null;
  url.protocol = "https:";
  const route = url.hash.startsWith("#/") ? new URL(url.hash.slice(1), url.origin) : url;
  const type = route.pathname.split("/").filter(Boolean).pop() || "";
  const id = route.searchParams.get("id");
  const direct = Object.hasOwn(types, type) && id && /^\d+$/.test(id);
  const link = direct ? `https://music.163.com/${type}?id=${id}` : url.href;
  if (link.length > 2048) return null;
  const before = text.slice(0, match.index).trim();
  const quoted = before.match(/《(.+)》/u);
  const artist = before.match(/^(?:分享\s*)?(.+?)的(?:单曲|歌曲|专辑|歌单|节目|电台)\s*[：:]?\s*《/u)?.[1]?.trim();
  const name = quoted?.[1]?.trim() || before.replace(/[：:，,\s]+$/u, "").replace(/^分享[:：]\s*/u, "").trim();
  return { title: name || (direct ? `网易云${types[type]} · ${id}` : "网易云音乐分享"), music_url: link, artist };
}

export function musicRows(text: string) {
  return text.replace(/(《[^\n]+》)[ \t]*\r?\n[ \t]*(?=(?:https?:\/\/|163cn\.tv\/|(?:y\.)?music\.163\.com\/))/gi, "$1 ").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

export function savedMusic(item: { kind: string; title: string; music_url?: string | null; artist?: string | null }): MusicShare | null {
  if (item.kind !== "music") return null;
  if (!item.music_url) return parseMusicShare(item.title);
  const share = parseMusicShare(item.music_url);
  return share && { ...share, title: item.title, artist: item.artist };
}
