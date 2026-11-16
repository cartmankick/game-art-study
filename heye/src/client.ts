import { emptyBoard } from "./types";
const endpoint = "https://etclyxbsvfowfhktvttj.supabase.co/functions/v1/heye-journal";
const storageKey = "heye.couple.v1.device";
function stored() { try { return localStorage.getItem(storageKey)||"" } catch { return "" } }
let code = stored();
function remember(value:string) {
  code=value;
  try{if(value)localStorage.setItem(storageKey,value);else localStorage.removeItem(storageKey)}catch{/* This tab can still use its in-memory credential. */}
}
function local(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}})}
async function call(key:string,payload:Record<string,unknown>){
  return fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,payload}),cache:"no-store",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(18000)});
}
export async function readDay(params:URLSearchParams) {
  if(!code)return local(emptyBoard);
  const result=await call(code,{...Object.fromEntries(params),action:"read"});
  if(result.status===403){remember("");return local(emptyBoard)}
  return result;
}
export async function action(payload:Record<string,unknown>) {
  if(payload.action==="leave"){remember("");return local({ok:true})}
  if(payload.action==="enter"){
    const incoming=String(payload.code||"").replace(/[-\s]/g,"").toUpperCase();
    if(code&&code!==incoming) return local({error:"此浏览器已绑定另一个席位。请私发邀请给对方，或先退出此设备。"},409);
    const result=await call(incoming,{action:"enter"});
    if(result.ok)remember(incoming);
    return result;
  }
  if(!code)return local({error:"请先打开自己的手账。"},401);
  return call(code,payload);
}
