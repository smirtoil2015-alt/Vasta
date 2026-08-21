"use client";

import { useState } from "react";
import { getAuth } from "firebase/auth";
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { findProfileByUsername, normalizePhone, phoneIndexId } from "@/lib/vasta-chat";

export default function NewChatPage() {
  const [mode, setMode] = useState<"private" | "group">("private");
  const [identifier, setIdentifier] = useState("");
  const [memberPhones, setMemberPhones] = useState("");
  const [groupName, setGroupName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookupUid(raw: string) {
    const value = raw.trim();
    if (value.startsWith("@")) {
      const profile = await findProfileByUsername(value);
      if (!profile) throw new Error("لم يتم العثور على هذا المستخدم.");
      return profile.uid;
    }
    const normalized = normalizePhone(value);
    if (!normalized) throw new Error("أدخل رقم هاتف صحيح أو @username.");
    const snap = await getDoc(doc(db, "phoneIndex", phoneIndexId(normalized)));
    if (!snap.exists()) throw new Error("لم يتم العثور على هذا المستخدم.");
    const uid = snap.data().uid as string | undefined;
    if (!uid) throw new Error("بيانات المستخدم غير صالحة.");
    return uid;
  }

  async function createPrivate() {
    const current = getAuth().currentUser; if (!current) throw new Error("سجّل الدخول أولًا.");
    const peerUid = await lookupUid(identifier); if (peerUid === current.uid) throw new Error("لا يمكنك بدء محادثة مع نفسك.");
    const participants = [current.uid, peerUid].sort(); const conversationId = participants.join("_");
    await setDoc(doc(db, "conversations", conversationId), { participants, kind: "private", createdAt: Date.now(), updatedAt: Date.now() }, { merge: true });
    window.location.href = `/private-chat?id=${encodeURIComponent(conversationId)}`;
  }

  async function createGroup() {
    const current = getAuth().currentUser; if (!current) throw new Error("سجّل الدخول أولًا.");
    const rawMembers = memberPhones.split(/[\n,]+/).map(v => v.trim()).filter(Boolean);
    if (!groupName.trim()) throw new Error("اكتب اسم المجموعة.");
    if (rawMembers.length < 1) throw new Error("أضف عضوًا واحدًا على الأقل.");
    if (rawMembers.length > 99) throw new Error("الحد الأقصى 99 عضوًا إضافيًا.");
    const found = new Set<string>([current.uid]);
    for (const item of rawMembers) found.add(await lookupUid(item));
    if (found.size < 2) throw new Error("تحتاج إلى عضو آخر على الأقل.");
    const ref = await addDoc(collection(db, "groups"), { ownerId: current.uid, memberIds: Array.from(found), name: groupName.trim().slice(0, 80), createdAt: Date.now(), updatedAt: Date.now() });
    window.location.href = `/group-chat?id=${encodeURIComponent(ref.id)}`;
  }

  async function submit() {
    setBusy(true); setStatus("");
    try { if (mode === "private") await createPrivate(); else await createGroup(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "تعذر تنفيذ الطلب."); setBusy(false); }
  }

  return <main dir="rtl" style={{ minHeight:"100vh", background:"#071316", color:"#e7f3f1", padding:24, fontFamily:"sans-serif" }}><section style={{ maxWidth:760, margin:"40px auto", background:"#0d1d21", border:"1px solid #17353a", borderRadius:24, padding:28 }}><div style={{color:"#18e6ae",fontWeight:900,letterSpacing:1}}>VASTA</div><h1>محادثة جديدة</h1><p style={{color:"#91aaa6",lineHeight:1.8}}>ابدأ محادثة خاصة أو أنشئ مجموعة من داخل Vasta.</p><div style={{display:"flex",gap:10,margin:"20px 0"}}><button onClick={()=>setMode("private")} style={{flex:1,padding:14,borderRadius:14,border:"1px solid #21474c",background:mode==="private"?"#17353a":"#102226",color:"white"}}>💬 محادثة خاصة</button><button onClick={()=>setMode("group")} style={{flex:1,padding:14,borderRadius:14,border:"1px solid #21474c",background:mode==="group"?"#17353a":"#102226",color:"white"}}>👥 مجموعة</button></div>{mode==="private"?<input dir="ltr" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="رقم الهاتف أو @username" style={{width:"100%",boxSizing:"border-box",padding:16,borderRadius:14,border:"1px solid #21474c",background:"#09171a",color:"white",marginBottom:12}}/>:<><input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="اسم المجموعة" style={{width:"100%",boxSizing:"border-box",padding:16,borderRadius:14,border:"1px solid #21474c",background:"#09171a",color:"white",marginBottom:12}}/><textarea dir="ltr" value={memberPhones} onChange={e=>setMemberPhones(e.target.value)} placeholder="أرقام الهاتف أو @username لكل عضو" rows={7} style={{width:"100%",boxSizing:"border-box",padding:16,borderRadius:14,border:"1px solid #21474c",background:"#09171a",color:"white",marginBottom:12}}/></>}<button disabled={busy} onClick={()=>void submit()} style={{width:"100%",padding:16,borderRadius:14,border:0,background:"#18e6ae",color:"#071316",fontWeight:900,cursor:busy?"wait":"pointer"}}>{busy?"جارٍ الإنشاء...":mode==="private"?"بدء المحادثة":"إنشاء المجموعة"}</button>{status&&<div style={{color:"#ff7784",marginTop:14}}>{status}</div>}</section></main>;
}
