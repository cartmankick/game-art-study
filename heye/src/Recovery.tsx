import { useState } from "react";
import { saved } from "./client";

export function Recovery({owner=false, token=""}: {owner?: boolean; token?:string}) {
  const [link,setLink]=useState("");
  const [message,setMessage]=useState("");
  const [done,setDone]=useState(false);
  const [busy,setBusy]=useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form=event.currentTarget;
    const fields=new FormData(form);
    const registration=String(fields.get("registration"));
    if (!owner && registration!==fields.get("confirm")) {setMessage("两次输入的注册码不同。");return;}
    setBusy(true);setMessage("");
    try {
      const response=await fetch("https://etclyxbsvfowfhktvttj.supabase.co/functions/v1/partner-reset", {
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",referrerPolicy:"no-referrer",
        body:JSON.stringify(owner ? {action:"issue",session:saved("depart.session.v2"),registration} : {action:"redeem",token,registration}),
      });
      const result=await response.json();
      if (!response.ok) throw Error(result.error || "请稍后再试。");
      form.reset();
      if (owner) {
        const url=new URL("./",location.href);
        url.hash="reset="+result.token;
        setLink(url.href);
      } else setDone(true);
    } catch(e) {setMessage(e instanceof Error?e.message:"暂时无法连接。");}
    finally {setBusy(false);}
  }
  return <section className="entryCard">
    <h2>{owner?"帮伙伴重设注册码":done?"注册码已更新":"重设个人注册码"}</h2>
    {done ? <><p>请用原来的名字和新注册码登录。</p><a className="primary wide" href="./">返回登录</a></> :
      <><p>{owner?"输入你自己的个人注册码。生成的链接只发给伙伴，15 分钟内可用一次，重新生成会使旧链接失效。":"为你的原账号设置新注册码，使用 8–64 字节。"}</p>
      <form onSubmit={submit}>
        <label>{owner?"创建者个人注册码":"新个人注册码"}<input required type="password" name="registration" autoComplete={owner?"current-password":"new-password"}/></label>
        {!owner && <label>确认新注册码<input required type="password" name="confirm" autoComplete="new-password"/></label>}
        <button className="primary wide" disabled={busy}>{owner?"生成伙伴重设链接":"保存新注册码"}</button>
      </form></>}
    {link && <><label>伙伴专用重设链接<input readOnly value={link} onFocus={e=>e.target.select()}/></label><button className="secondary wide" onClick={async()=>{try{await navigator.clipboard.writeText(link);setMessage("链接已复制。");}catch{setMessage("请长按上方链接复制。");}}}>复制重设链接</button></>}
    {message && <p role="status">{message}</p>}
  </section>;
}
