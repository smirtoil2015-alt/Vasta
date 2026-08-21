"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import AuthGate, { useVastaUser } from "@/app/components/AuthGate";
import { auth, db } from "@/lib/firebase";

type Chat = { id: string; participants: string[]; names: Record<string, string>; lastMessage?: string; lastMessageAt?: number };
type Message = { id: string; text: string; senderId: string; createdAt: number };

function initials(name: string) { return name.trim().slice(0, 1).toUpperCase() || "V"; }
function makeChatId(a: string, b: string) { return [a, b].sort().join("__"); }

function Messenger() {
  const { user } = useVastaUser();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "conversations"), where("participants", "array-contains", user.uid), orderBy("lastMessageAt", "desc"));
    return onSnapshot(q, (snap) => setChats(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Chat, "id">) }))));
  }, [user]);

  useEffect(() => {
    if (!activeChat) { setMessages([]); return; }
    const q = query(collection(db, "conversations", activeChat.id, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) }))));
  }, [activeChat]);

  const activeName = useMemo(() => {
    if (!activeChat || !user) return "Vasta";
    const other = activeChat.participants.find((id) => id !== user.uid) ?? user.uid;
    return activeChat.names[other] ?? "محادثة";
  }, [activeChat, user]);

  async function startChat() {
    if (!user || !email.trim()) return;
    const result = await new Promise<{ uid: string; displayName: string } | null>((resolve) => {
      const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
      const stop = onSnapshot(q, (snap) => { const item = snap.docs.find((d) => d.id !== user.uid); resolve(item ? { uid: item.id, displayName: String(item.data().displayName ?? "Vasta User") } : null); stop(); });
    });
    if (!result) return;
    const id = makeChatId(user.uid, result.uid);
    const chat: Chat = { id, participants: [user.uid, result.uid], names: { [user.uid]: user.displayName ?? "أنا", [result.uid]: result.displayName }, lastMessage: "ابدأ المحادثة ✨", lastMessageAt: Date.now() };
    await setDoc(doc(db, "conversations", id), chat, { merge: true });
    setActiveChat(chat); setEmail("");
  }

  async function send() {
    if (!user || !activeChat || !text.trim()) return;
    const value = text.trim(); const now = Date.now(); setText("");
    await addDoc(collection(db, "conversations", activeChat.id, "messages"), { text: value, senderId: user.uid, createdAt: now });
    await setDoc(doc(db, "conversations", activeChat.id), { lastMessage: value, lastMessageAt: now }, { merge: true });
  }

  return <main className="vasta-shell"><section className="app-frame">
    <aside className="sidebar">
      <header className="sidebar-head"><div><div className="brand">Vasta</div><div className="brand-subtitle">مراسلة أسرع. أذكى. أكثر حرية.</div></div><button className="icon-button">⋮</button></header>
      <div className="search-panel"><div className="search-wrap"><span>⌕</span><input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void startChat()} placeholder="بريد صديق لبدء محادثة" /></div>{email && <button className="search-button" onClick={() => void startChat()}>بدء محادثة</button>}</div>
      <div className="chat-list">{chats.length === 0 ? <div className="empty-chats"><div>🚀</div><strong>Vasta جاهز</strong><span>ابحث عن أول شخص وابدأ المحادثة.</span></div> : chats.map((chat) => { const other = chat.participants.find((id) => id !== user?.uid) ?? ""; return <button key={chat.id} className={`chat-item ${activeChat?.id === chat.id ? "active" : ""}`} onClick={() => setActiveChat(chat)}><div className="avatar">{initials(chat.names[other] ?? "V")}</div><div className="chat-copy"><div className="chat-title-row"><strong>{chat.names[other] ?? "محادثة"}</strong><time>{chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : ""}</time></div><div className="chat-message">{chat.lastMessage ?? ""}</div></div></button>; })}</div>
      <footer className="sidebar-footer"><div className="profile-mini"><div className="avatar small">{initials(user?.displayName ?? "V")}</div><div><strong>{user?.displayName ?? "حسابي"}</strong><span>● متصل الآن</span></div></div><button className="logout-button" onClick={() => void signOut(auth)}>خروج</button></footer>
    </aside>
    <section className="conversation"><header className="conversation-head"><div className="conversation-user"><div className="avatar">{initials(activeName)}</div><div><strong>{activeName}</strong><span>{activeChat ? "متصل عبر الإنترنت • مزامنة لحظية" : "اختر محادثة للبدء"}</span></div></div><div className="conversation-actions"><button className="icon-button">⌕</button><button className="icon-button">⋯</button></div></header>
      <div className="messages-area">{!activeChat ? <div className="welcome-panel"><div className="welcome-logo">V</div><h1>مرحبًا بك في Vasta</h1><p>نبني منصة مراسلة حديثة تركز على السرعة والخصوصية والتخصيص والذكاء.</p><div className="feature-grid"><div><b>⚡ لحظي</b><span>رسائل تتزامن فورًا.</span></div><div><b>🔒 خاص</b><span>صلاحيات وصول دقيقة.</span></div><div><b>🧠 ذكي</b><span>AI مدمج في التجربة القادمة.</span></div></div></div> : <><div className="secure-note">🔒 محادثة Vasta عبر الإنترنت ومزامنة لحظية.</div>{messages.length === 0 && <div className="conversation-empty">ابدأ أول رسالة 👋</div>}{messages.map((m) => <div key={m.id} className={`message ${m.senderId === user?.uid ? "sent" : "received"}`}>{m.text}<time>{new Date(m.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</>}</div>
      {activeChat && <div className="composer"><button className="attach">＋</button><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void send()} placeholder="اكتب رسالة..." /><button className="send" onClick={() => void send()}>➤</button></div>}
    </section>
  </section></main>;
}

export default function Home() { return <AuthGate><Messenger /></AuthGate>; }
