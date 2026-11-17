const headers = {
  "Access-Control-Allow-Origin": "https://cartmankick.github.io",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status: number) => Response.json(body, {headers, status});
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null,{headers,status:204});
  if (req.method !== "POST") return reply({error:"请从网站进入。"},405);
  try {
    const raw = await req.text();
    if (raw.length > 2000) return reply({error:"内容过长。"},413);
    const p = JSON.parse(raw);
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/rpc/depart_partner_reset", {
      method:"POST", headers:{apikey:key,Authorization:"Bearer " + key,"Content-Type":"application/json"},
      body:JSON.stringify({p}),
    });
    if (!res.ok) return reply({error:"重设服务暂时不可用。"},503);
    const data = await res.json();
    return reply(data,data.status ?? 200);
  } catch {
    return reply({error:"请求失败，请重试。"},400);
  }
});
