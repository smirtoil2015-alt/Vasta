"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ensureProfile, normalizeUsername } from "@/lib/vasta-chat";

export default function UsernamePage() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    if (!next) return;
    try {
      const profile = await ensureProfile(next);
      setCurrent(profile.username ?? "");
      setUsername(profile.username ?? "");
    } catch { setStatus("تعذر تحميل اسم المستخدم."); }
  }), []);

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!user) return;
    const clean = normalizeUsername(username);
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) { setStatus("استخدم 3-20 حرفًا: a-z أو 0-9 أو _."); return; }
    setSaving(true); setStatus("");
    try {
      const old = current ? normalizeUsername(current) : "";
      if (old === clean) { setStatus("تم الحفظ ✓"); return; }
      const indexRef = doc(db, "usernameIndex", clean);
      const existing = await getDoc(indexRef);
      if (existing.exists() && (existing.data().uid as string) !== user.uid) throw new Error("taken");
      await setDoc(doc(db, "users", user.uid), { username: clean }, { merge: true });
      await setDoc(indexRef, { uid: user.uid, displayName: user.displayName ?? "مستخدم Vasta" });
      if (old) await setDoc(doc(db, "usernameIndex", old), { uid: user.uid, retired: true }, { merge: true });
      setCurrent(clean); setUsername(clean); setStatus("تم حفظ اسم المستخدم ✓");
    } catch (error) {
      console.error(error); setStatus(error instanceof Error && error.message === "taken" ? "اسم المستخدم مستخدم بالفعل." : "تعذر حفظ اسم المستخدم.");
    } finally { setSaving(false); }
  }

  if (!user) return <main dir="rtl" style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#071316",color:"#e7f3f1"}}>سجّل الدخول أولًا إلى Vasta.</main>;
  return <main dir="rtl" style={{minHeight:"100vh",background:"#071316",color:"#e7f3f1",padding:24,fontFamily:"sans-serif"}}><section style={{maxWidth:620,margin:"50px auto",background:"#0d1d21",border:"1px solid #17353a",borderRadius:24,padding:28}}><div style={{color:"#18e6ae",fontWeight:900}}>VASTA</div><h1>اسم المستخدم</h1><p style={{color:"#91aaa6",lineHeight:1.8}}>يمكن للآخرين العثور عليك عبر @username بدل رقم الهاتف.</p><form onSubmit={save}><input dir="ltr" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} placeholder="vasta_user" autoComplete="off" style={{width:"100%",padding:16,borderRadius:16,border:"1px solid #21474c",background:"#102226",color:"white",fontSize:18,boxSizing:"border-box"}}/><button disabled={saving} style={{marginTop:12,width:"100%",padding:15,border:0,borderRadius:16,background:"#18e6ae",color:"#05241b",fontWeight:900,cursor:"pointer"}}>{saving?"جارٍ الحفظ...":"حفظ @username"}</button></form>{status&&<div style={{marginTop:14,color:"#a7d8cf"}}>{status}</div>}</section></main>;
}
