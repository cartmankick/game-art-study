const siteOrigin = "https://cartmankick.github.io";
const maxBytes = 2048;
const headers = {
  "Access-Control-Allow-Origin": siteOrigin,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Cache-Control": "no-store",
  "Vary": "Origin",
};

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers });
}

class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function readPayload(req: Request) {
  if (!req.body || req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError(415, "请提交 JSON 格式的提醒设置。");
  }
  if (Number(req.headers.get("content-length")) > maxBytes) {
    throw new RequestError(413, "提交的内容过长。");
  }
  const reader = req.body.getReader();
  const bytes = new Uint8Array(maxBytes);
  let used = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (used + value.byteLength > maxBytes) {
        await reader.cancel();
        throw new RequestError(413, "提交的内容过长。");
      }
      bytes.set(value, used);
      used += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes.subarray(0, used)));
  } catch {
    throw new RequestError(400, "提交的内容格式有误。");
  }
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      !["status", "bind", "test", "unbind"].includes(data.action)) {
    throw new RequestError(400, "请选择有效的提醒操作。");
  }
  if (typeof data.session !== "string" || !/^[a-f0-9]{64}$/.test(data.session)) {
    throw new RequestError(401, "请先登录出发。");
  }
  const payload: {action: string; session: string; sendkey?: string} = {
    action: data.action,
    session: data.session,
  };
  if (data.action === "bind") {
    if (typeof data.sendKey !== "string" || !/^SCT[A-Za-z0-9]{8,180}$/.test(data.sendKey.trim())) {
      throw new RequestError(400, "请输入以 SCT 开头的 Server酱 Turbo SendKey。");
    }
    payload.sendkey = data.sendKey.trim();
  }
  return payload;
}

const rpcErrors: Record<number, string> = {
  400: "提交的提醒设置有误。",
  401: "登录已过期，请重新登录。",
  403: "无权修改此提醒设置。",
  409: "请先启用微信提醒，再发送测试。",
  429: "请求太频繁，请稍后再试。",
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== siteOrigin) return reply({ error: "请从出发网站进入。" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "请使用网站入口。" }, 405);
  try {
    const p = await readPayload(req);
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const response = await fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/rpc/depart_wechat", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ p }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("RPC unavailable");
    const data = await response.json();
    if (data?.error) {
      const status = Number(data.status);
      return reply({ error: rpcErrors[status] || "提醒服务暂时不可用。" }, rpcErrors[status] ? status : 503);
    }
    if (typeof data?.enabled !== "boolean") throw new Error("Unexpected RPC response");
    const delivery = ["pending", "accepted", "failed", "unknown"].includes(data.delivery) ? data.delivery : undefined;
    return reply({ enabled: data.enabled, delivery });
  } catch (e) {
    if (e instanceof RequestError) return reply({ error: e.message }, e.status);
    return reply({ error: "提醒服务暂时不可用，请稍后重试。" }, 503);
  }
});
