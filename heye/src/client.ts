const endpoint =
  "https://etclyxbsvfowfhktvttj.supabase.co/functions/v1/heye-journal";
const tokenKey = "depart.session.v2";
export function saved(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
function persist(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* Memory access remains available. */
  }
}
let session = saved(tokenKey);
export const hasSession = () => !!session;
export const forgetSession = () => {
  session = "";
  persist(tokenKey, "");
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function unpack(r: Response) {
  const v = await r.json();
  if (!r.ok) {
    if (r.status === 401) forgetSession();
    throw new ApiError(r.status, v.error || "操作失败，请重试。");
  }
  return v;
}
export async function request(payload: Record<string, unknown>) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, payload }),
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(30000),
  });
  return unpack(r);
}
export function invitationLink(code: string) {
  const url = new URL("./", location.href);
  url.hash = "join=" + encodeURIComponent(code);
  return url.href;
}
export async function authenticate(p: Record<string, string>) {
  const result = await request(p);
  if (!result.session) throw new Error("登录未完成，请重试。");
  session = result.session;
  persist(tokenKey, session);
  persist("depart.name", p.name.trim());
  persist("heye.couple.v1.device", "");
}
export async function leave() {
  await request({ action: "leave" });
  forgetSession();
}
export async function preparePhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            "浏览器无法读取此图片，请从相册选择 JPEG、PNG 或 WebP 图片。",
          ),
        );
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("图片不可读取。");
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      1920 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("照片处理失败，请重试。");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.66, 0.45]) {
      const blob = await new Promise<Blob | null>((done) =>
        canvas.toBlob(done, "image/jpeg", quality),
      );
      if (blob && blob.size <= 2000000) return blob;
    }
    throw new Error("照片处理后仍然过大，请选择较小的图片。");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function sendPhoto(image: Blob, day: string, id: string) {
  const f = new FormData();
  f.set("session", session);
  f.set("image", image, "photo.jpg");
  f.set("day", day);
  f.set("id", id);
  const r = await fetch(endpoint, {
    method: "POST",
    body: f,
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(90000),
  });
  return unpack(r);
}
