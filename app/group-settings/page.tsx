"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { findProfileByPhone, findProfileByUsername } from "@/lib/vasta-chat";

type Group = { ownerId: string; adminIds?: string[]; memberIds: string[]; name: string };

export default function GroupSettingsPage() {
  const [groupId, setGroupId] = useState("");
  const [uid, setUid] = useState("");
  const [group, setGroup] = useState<Group | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const admins = group?.adminIds?.length ? group.adminIds : group?.ownerId ? [group.ownerId] : [];
  const canManage = !!uid && !!group && admins.includes(uid);

  useEffect(() => {
    setGroupId(new URLSearchParams(window.location.search).get("id") ?? "");
  }, []);

  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid ?? "")), []);

  async function load() {
    if (!groupId) return;
    const snap = await getDoc(doc(db, "groups", groupId));
    if (!snap.exists()) { setStatus("المجموعة غير موجودة."); return; }
    const data = snap.data() as Group;
    setGroup(data); setName(data.name || "المجموعة");
  }
  useEffect(() => { void load(); }, [groupId]);

  async function resolveUid(raw: string) {
    const value = raw.trim();
    const profile = value.startsWith("@") ? await findProfileByUsername(value) : await findProfileByPhone(value);
    if (!profile) throw new Error("لم يتم العثور على المستخدم.");
    return profile.uid;
  }

  async function addMember() {
    if (!canManage) return;
    setBusy(true); setStatus("");
    try { const target = await resolveUid(identifier); if (group!.memberIds.includes(target)) throw new Error("العضو موجود بالفعل."); await updateDoc(doc(db,"groups",groupId), { memberIds: arrayUnion(target), updatedAt: Date.now() }); setIdentifier(""); setStatus("تمت إضافة العضو ✓"); await load(); }
    catch (e) { setStatus(e instanceof Error ? e.message : "تعذر إضافة العضو."); }
    finally { setBusy(false); }
  }

  async function removeMember(target: string) {
    if (!canManage || target === group?.ownerId) return;
    setBusy(true); setStatus("");
    try { await updateDoc(doc(db,"groups",groupId), { memberIds: arrayRemove(target), adminIds: arrayRemove(target), updatedAt: Date.now() }); setStatus("تمت إزالة العضو ✓"); await load(); }
    catch (e) { setStatus(e instanceof Error ? e.message : "تعذر إزالة العضو."); }
    finally { setBusy(false); }
  }

  async function toggleAdmin(target: string) {
    if (!canManage || target === group?.ownerId) return;
    setBusy(true); setStatus("");
    try { const isAdmin = admins.includes(target); await updateDoc(doc(db,"groups",groupId), { adminIds: isAdmin ? arrayRemove(target) : arrayUnion(target), updatedAt: Date.now() }); setStatus(isAdmin ? "تم إلغاء الإشراف ✓" : "تم تعيينه مشرفًا ✓"); await load(); }
    catch (e) { setStatus(e instanceof Error ? e.message : "تعذر تغيير الصلاحية."); }
    finally { setBusy(false); }
  }

  async function rename() {
    if (!canManage || !name.trim()) return;
    setBusy(true); setStatus("");
    try { await updateDoc(doc(db,"groups",groupId), { name: name.trim().slice(0,80), updatedAt: Date.now() }); setStatus("تم تغيير اسم المجموعة ✓"); await load(); }
    catch (e) { setStatus(e instanceof Error ? e.message : "تعذر تغيير الاسم."); }
    finally { setBusy(false); }
  }

  async function leave() {
    if (!group || !uid || uid === group.ownerId) { setStatus("المالك يجب أن ينقل الملكية قبل الخروج."); return; }
    setBusy(true); setStatus("");
    try { await updateDoc(doc(db,"groups",groupId), { memberIds: arrayRemove(uid), adminIds: arrayRemove(uid), updatedAt: Date.now() }); window.location.href = "/"; }
    catch (e) { setStatus(e instanceof Error ? e.message : "تعذر الخروج من المجموعة."); setBusy(false); }
  }

  if (!groupId) return <main dir="rtl" style={{padding:24}}>معرّف المجموعة مفقود.</main>;
  if (!uid) return <main dir="rtl" style={{padding:24}}>سجّل الدخول أولًا إلى Vasta.</main>;
  if (!group) return <main dir="rtl" style={{padding:24}}>جارٍ تحميل المجموعة...</main>;

  return <main dir="rtl" style={{minHeight:"100vh",background:"#071316",color:"#e7f3f1",padding:24,fontFamily:"sans-serif"}}>
    <section style={{maxWidth:760,margin:"30px auto",background:"#0d1d21",border:"1px solid #17353a",borderRadius:24,padding:24}}>
      <a href={`/group-chat?id=${encodeURIComponent(groupId)}`} style={{color:"#18e6ae"}}>← العودة للمجموعة</a>
      <h1>إدارة المجموعة</h1><p style={{color:"#88a39f"}}>المالك: {group.ownerId === uid ? "أنت" : "عضو المجموعة"} · {group.memberIds.length} أعضاء</p>
      {canManage && <>
        <h3>اسم المجموعة</h3><div style={{display:"flex",gap:8}}><input value={name} onChange={e=>setName(e.target.value)} style={{flex:1,padding:14,borderRadius:12,border:"1px solid #21474c",background:"#09171a",color:"white"}}/><button disabled={busy} onClick={()=>void rename()} style={{padding:"0 16px",border:0,borderRadius:12,background:"#18e6ae",fontWeight:900}}>حفظ</button></div>
        <h3 style={{marginTop:24}}>إضافة عضو</h3><div style={{display:"flex",gap:8}}><input dir="ltr" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="رقم الهاتف أو @username" style={{flex:1,padding:14,borderRadius:12,border:"1px solid #21474c",background:"#09171a",color:"white"}}/><button disabled={busy} onClick={()=>void addMember()} style={{padding:"0 16px",border:0,borderRadius:12,background:"#18e6ae",fontWeight:900}}>إضافة</button></div>
      </>}
      <h3 style={{marginTop:24}}>الأعضاء والمشرفون</h3>
      {group.memberIds.map(member => <div key={member} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 0",borderBottom:"1px solid #17353a"}}><div style={{flex:1,fontFamily:"monospace"}}>{member === uid ? "أنت" : member}</div>{admins.includes(member) && <span style={{color:"#18e6ae",fontSize:12}}>مشرف</span>}{canManage && member !== group.ownerId && <><button disabled={busy} onClick={()=>void toggleAdmin(member)}>{admins.includes(member)?"إلغاء الإشراف":"تعيين مشرف"}</button><button disabled={busy} onClick={()=>void removeMember(member)}>إزالة</button></>}</div>)}
      {group.ownerId !== uid && <button disabled={busy} onClick={()=>void leave()} style={{marginTop:24,padding:14,width:"100%",borderRadius:12,border:"1px solid #6b2730",background:"#261317",color:"#ff8793",fontWeight:800}}>مغادرة المجموعة</button>}
      {status && <p style={{color:"#a7d8cf",marginTop:16}}>{status}</p>}
    </section>
  </main>;
}
