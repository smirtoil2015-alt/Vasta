"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Message = { id: string; senderId: string; text: string; createdAt: number };

export default function GroupChatPage() {
  const groupId = useMemo(() => new URLSearchParams(window.location.search).get("id") ?? "", []);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("المجموعة");
  const [members, setMembers] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  useEffect(() => onAuthStateChanged(auth, (user) => setUserId(user?.uid ?? "")), []);

  useEffect(() => {
    if (!groupId) return;
    let stop = () => {};
    void getDoc(doc(db, "groups", groupId)).then((snap) => {
      const data = snap.data();
      if (data) {
        setName((data.name as string) || "المجموعة");
        setMembers(Array.isArray(data.memberIds) ? data.memberIds.length : 0);
      }
    });
    stop = onSnapshot(query(collection(db, "groups", groupId, "messages"), orderBy("createdAt", "asc"), limit(200)), (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) })));
    });
    return () => stop();
  }, [groupId]);

  async function send() {
    const value = text.trim();
    if (!value || !userId || !groupId) return;
    setText("");
    await addDoc(collection(db, "groups", groupId, "messages"), {
      senderId: userId,
      text: value.slice(0, 10000),
      createdAt: Date.now(),
    });
    await updateDoc(doc(db, "groups", groupId), { updatedAt: Date.now() });
  }

  if (!groupId) return <main dir="rtl" style={{padding: 24, fontFamily: "sans-serif"}}>معرّف المجموعة مفقود.</main>;

  return (
    <main dir="rtl" style={{minHeight:"100vh",background:"#071316",color:"#e7f3f1",fontFamily:"sans-serif",display:"flex",flexDirection:"column"}}>
      <header style={{padding:"16px 20px",borderBottom:"1px solid #17353a",background:"#0d1d21"}}>
        <strong style={{fontSize:20}}>👥 {name}</strong>
        <div style={{color:"#88a39f",marginTop:4}}>{members} أعضاء</div>
      </header>
      <section style={{flex:1,padding:20,maxWidth:900,width:"100%",boxSizing:"border-box",margin:"0 auto"}}>
        {messages.length === 0 && <div style={{color:"#88a39f",textAlign:"center",padding:40}}>ابدأ أول رسالة في المجموعة.</div>}
        {messages.map((m) => (
          <div key={m.id} style={{display:"flex",justifyContent:m.senderId===userId?"flex-start":"flex-end",margin:"8px 0"}}>
            <div style={{background:m.senderId===userId?"#17353a":"#102226",padding:"10px 14px",borderRadius:16,maxWidth:"75%"}}>{m.text}</div>
          </div>
        ))}
      </section>
      <form onSubmit={(e)=>{e.preventDefault();void send();}} style={{padding:16,borderTop:"1px solid #17353a",background:"#0d1d21",display:"flex",gap:10}}>
        <input value={text} onChange={(e)=>setText(e.target.value)} placeholder="اكتب رسالة للمجموعة..." style={{flex:1,padding:14,borderRadius:14,border:"1px solid #21474c",background:"#09171a",color:"white"}} />
        <button type="submit" style={{padding:"0 20px",border:0,borderRadius:14,background:"#18e6ae",fontWeight:900}}>إرسال</button>
      </form>
    </main>
  );
}
