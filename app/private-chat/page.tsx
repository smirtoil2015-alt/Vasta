"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  deleteOwnMessage,
  editOwnMessage,
  ensureProfile,
  findProfileByPhone,
  markMessageRead,
  openConversation,
  sendMediaMessage,
  sendTextMessage,
  sendVoiceMessage,
  setMessagePinned,
  setMessageReaction,
  type VastaConversation,
  type VastaMessage,
  type VastaProfile,
  watchMessages,
  watchMessageReactions,
} from "@/lib/vasta-chat";
import { uploadVoiceBlob, chooseVoiceMimeType } from "@/lib/vasta-voice";
import VastaMediaPicker, { type VastaMediaSelection } from "@/components/vasta-media-picker";
import { uploadPrivateMedia } from "@/lib/vasta-media";

function formatTime(value: number) { return new Date(value).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }); }
function duration(ms: number) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`; }

export default function PrivateChat() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<VastaProfile | null>(null);
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState<VastaProfile | null>(null);
  const [conversation, setConversation] = useState<VastaConversation | null>(null);
  const [messages, setMessages] = useState<VastaMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<VastaMessage | null>(null);
  const [editing, setEditing] = useState<VastaMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [reactions, setReactions] = useState<Record<string, Record<string, string>>>({});

  const [recording, setRecording] = useState(false);
  const [voiceMs, setVoiceMs] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceType, setVoiceType] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (!u) return;
    try { setProfile(await ensureProfile(u)); } catch (e) { console.error(e); setError("تعذر تجهيز الحساب."); }
  }), []);
  useEffect(() => { if (!conversation) return; return watchMessages(conversation.id, setMessages, (e) => { console.error(e); setError("تعذر تحديث الرسائل."); }); }, [conversation]);
  useEffect(() => { return () => { stream.current?.getTracks().forEach((t) => t.stop()); if (timer.current) clearInterval(timer.current); if (voiceUrl) URL.revokeObjectURL(voiceUrl); }; }, [voiceUrl]);
  useEffect(() => {
    if (!conversation || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last.senderId !== user?.uid) void markMessageRead(conversation.id, last.id, user?.uid ?? "").catch(() => undefined);
  }, [conversation, messages, user]);
  useEffect(() => {
    if (!conversation) return;
    const cleanups = messages.map((m) => watchMessageReactions(conversation.id, m.id, (r) => setReactions((prev) => ({ ...prev, [m.id]: r }))));
    return () => cleanups.forEach((fn) => fn());
  }, [conversation, messages]);

  async function find() {
    if (!profile) return; setBusy(true); setError("");
    try { const found = await findProfileByPhone(phone); if (!found || found.uid === profile.uid) setError("لم نجد مستخدم Vasta بهذا الرقم."); else setContact(found); }
    catch (e) { console.error(e); setError("فشل البحث."); } finally { setBusy(false); }
  }
  async function open() { if (!profile || !contact) return; try { setConversation(await openConversation(profile, contact)); } catch (e) { console.error(e); setError("تعذر فتح المحادثة الخاصة."); } }
  async function send() {
    if (!profile || !conversation || !text.trim()) return;
    try { await sendTextMessage(conversation.id, profile, text, replyTo ?? undefined); setText(""); setReplyTo(null); }
    catch (e) { console.error(e); setError("تعذر إرسال الرسالة."); }
  }
  async function selectMedia(sel: VastaMediaSelection) {
    if (!profile || !conversation) return; setBusy(true);
    try { const uploaded = await uploadPrivateMedia(conversation.id, profile.uid, sel.file, sel.kind); await sendMediaMessage(conversation.id, profile, uploaded, replyTo ?? undefined); setReplyTo(null); }
    catch (e) { console.error(e); setError("تعذر رفع المرفق الآن."); } finally { setBusy(false); }
  }
  async function startVoice() {
    if (recording || !conversation) return;
    try {
      const mime = chooseVoiceMimeType(); if (!mime) throw new Error("mime");
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks.current = [];
      const r = new MediaRecorder(stream.current, { mimeType: mime }); recorder.current = r; setVoiceType(mime); started.current = Date.now(); setVoiceMs(0); setRecording(true);
      timer.current = setInterval(() => setVoiceMs(Date.now() - started.current), 200);
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => { const b = new Blob(chunks.current, { type: mime }); setVoiceBlob(b); setVoiceUrl(URL.createObjectURL(b)); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
      r.start();
    } catch (e) { console.error(e); setError("اسمح للمتصفح باستخدام الميكروفون."); }
  }
  function stopVoice(cancel = false) {
    if (timer.current) clearInterval(timer.current); timer.current = null;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop(); recorder.current = null; setRecording(false);
    if (cancel) { setVoiceBlob(null); if (voiceUrl) URL.revokeObjectURL(voiceUrl); setVoiceUrl(""); setVoiceMs(0); }
  }
  async function sendVoice() {
    if (!profile || !conversation || !voiceBlob) return; setBusy(true);
    try { const up = await uploadVoiceBlob(conversation.id, profile.uid, voiceBlob); await sendVoiceMessage(conversation.id, profile, up.audioUrl, up.storagePath, Math.max(500, voiceMs), up.mimeType || voiceType); stopVoice(true); }
    catch (e) { console.error(e); setError("تعذر إرسال الرسالة الصوتية."); } finally { setBusy(false); }
  }
  async function editMessage() {
    if (!conversation || !editing || !editText.trim()) return;
    try { await editOwnMessage(conversation.id, editing.id, editText); setEditing(null); setEditText(""); }
    catch (e) { console.error(e); setError("تعذر تعديل الرسالة."); }
  }
  async function removeMessage(m: VastaMessage) {
    if (!conversation) return;
    try { await deleteOwnMessage(conversation.id, m.id); setSelected(null); }
    catch (e) { console.error(e); setError("تعذر حذف الرسالة."); }
  }
  async function togglePin(m: VastaMessage) {
    if (!conversation) return;
    try { await setMessagePinned(conversation.id, m.id, !m.pinned); setSelected(null); }
    catch (e) { console.error(e); setError("تعذر تثبيت الرسالة."); }
  }
  async function react(m: VastaMessage, emoji: string) {
    if (!conversation || !user) return;
    try { const mine = reactions[m.id]?.[user.uid]; await setMessageReaction(conversation.id, m.id, user.uid, mine === emoji ? "" : emoji); setSelected(null); }
    catch (e) { console.error(e); setError("تعذر إضافة التفاعل."); }
  }

  if (!user) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>سجّل الدخول أولًا إلى Vasta.</main>;
  return <main dir="rtl" style={{ minHeight: "100vh", background: "#071316", color: "#e7f3f1", padding: 24, fontFamily: "sans-serif" }}>
    <div style={{ maxWidth: 980, margin: "0 auto", background: "#0d1d21", border: "1px solid #17353a", borderRadius: 24, overflow: "hidden" }}>
      <header style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #17353a" }}><div><b style={{ fontSize: 22 }}>Vasta</b><div style={{ color: "#7e9995", fontSize: 12 }}>محادثة خاصة بين شخصين</div></div>{profile && <span style={{ color: "#7e9995", fontSize: 12 }}>{profile.phoneNumber}</span>}</header>
      {!conversation ? <section style={{ padding: 32 }}><h1 style={{ marginTop: 0 }}>ابدأ محادثة خاصة</h1><p style={{ color: "#91aaa6" }}>ابحث عن المستخدم برقم هاتفه.</p><div style={{ display: "flex", gap: 10, marginTop: 18 }}><input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 ..." style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid #21474c", background: "#09171a", color: "white" }} /><button onClick={() => void find()} disabled={busy} style={{ padding: "0 18px", border: 0, borderRadius: 14, background: "#18e6ae", fontWeight: 800 }}>{busy ? "بحث..." : "بحث"}</button></div>{contact && <button onClick={() => void open()} style={{ marginTop: 18, width: "100%", padding: 16, textAlign: "right", borderRadius: 16, border: "1px solid #21474c", background: "#102226", color: "white" }}><b>{contact.displayName}</b><div dir="ltr" style={{ color: "#88a39f", fontSize: 12 }}>{contact.phoneNumber}</div></button>}{error && <p style={{ color: "#ff7784" }}>{error}</p>}</section> :
      <section style={{ display: "flex", flexDirection: "column", height: "78vh" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #17353a" }}><b>{conversation.names[conversation.participants.find((id) => id !== profile?.uid) || conversation.participants[0]] || "محادثة خاصة"}</b></div>
        <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
          {messages.map((m) => { const mine = m.senderId === user.uid; const myReaction = reactions[m.id]?.[user.uid]; return <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-start" : "flex-end", marginBottom: 10 }}>
            <div style={{ maxWidth: "75%", position: "relative" }}>
              <div onClick={() => setSelected(selected === m.id ? null : m.id)} style={{ padding: 12, borderRadius: 16, background: mine ? "#123e36" : "#17282d", cursor: "pointer" }}>
                {m.pinned && <div style={{ color: "#18e6ae", fontSize: 11, marginBottom: 6 }}>📌 مثبتة</div>}
                {m.replyToText && <div style={{ borderRight: "3px solid #18e6ae", paddingRight: 8, marginBottom: 7, color: "#93aaa6", fontSize: 11 }}>↩ {m.replyToText}</div>}
                {m.deleted ? <i style={{ color: "#88a39f" }}>تم حذف هذه الرسالة</i> : m.kind === "voice" ? <div><audio controls src={m.audioUrl} style={{ maxWidth: 260 }} /><div style={{ fontSize: 11, color: "#8da7a2" }}>{duration(m.durationMs || 0)}</div></div> : m.kind === "media" ? <div>{m.mediaKind === "image" ? <img src={m.mediaUrl} alt={m.fileName || "صورة"} style={{ maxWidth: 320, maxHeight: 320, borderRadius: 12, display: "block" }} /> : m.mediaKind === "video" ? <video controls src={m.mediaUrl} style={{ maxWidth: 320, maxHeight: 320, borderRadius: 12 }} /> : <a href={m.mediaUrl} target="_blank" rel="noreferrer" style={{ color: "#18e6ae" }}>📄 {m.fileName}</a>}</div> : <div>{m.text}</div>}
                <div style={{ fontSize: 10, color: "#6f8985", marginTop: 5 }}>{formatTime(m.createdAt)}{m.edited ? " · تم التعديل" : ""}</div>
              </div>
              {(myReaction || Object.keys(reactions[m.id] || {}).length > 0) && <div style={{ marginTop: 3, fontSize: 12, color: "#18e6ae" }}>{Object.values(reactions[m.id] || {}).join(" ")}</div>}
              {selected === m.id && !m.deleted && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                <button onClick={() => setReplyTo(m)}>↩ رد</button><button onClick={() => void react(m, "❤️")}>❤️</button><button onClick={() => void react(m, "👍")}>👍</button><button onClick={() => void togglePin(m)}>{m.pinned ? "إلغاء التثبيت" : "📌 تثبيت"}</button>
                {mine && <><button onClick={() => { setEditing(m); setEditText(m.text); setSelected(null); }} disabled={m.kind !== "text"}>✏️ تعديل</button><button onClick={() => void removeMessage(m)}>🗑️ حذف</button></>}
              </div>}
            </div>
          </div>; })}
        </div>
        {(replyTo || editing) && <div style={{ padding: "8px 12px", borderTop: "1px solid #17353a", background: "#0a181b", display: "flex", gap: 8, alignItems: "center" }}>{editing ? <><span style={{ flex: 1 }}>✏️ تعديل الرسالة</span><button onClick={() => setEditing(null)}>إلغاء</button></> : <><span style={{ flex: 1, color: "#9ab0ac" }}>↩ الرد على: {replyTo?.deleted ? "رسالة محذوفة" : replyTo?.text}</span><button onClick={() => setReplyTo(null)}>×</button></>}</div>}
        <div style={{ padding: 12, borderTop: "1px solid #17353a", display: "flex", gap: 8, alignItems: "center" }}>
          {voiceUrl ? <><audio controls src={voiceUrl} style={{ flex: 1 }} /><button onClick={() => stopVoice(true)}>إلغاء</button><button onClick={() => void sendVoice()} disabled={busy}>إرسال</button></> : recording ? <><span style={{ color: "#ff6b7a" }}>● تسجيل {duration(voiceMs)}</span><button onClick={() => stopVoice(true)}>حذف</button><button onClick={() => stopVoice(false)}>إيقاف</button></> : editing ? <><input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void editMessage()} style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid #21474c", background: "#09171a", color: "white" }} placeholder="عدّل الرسالة..." /><button onClick={() => void editMessage()} style={{ padding: "0 18px", height: 48, border: 0, borderRadius: 14, background: "#18e6ae", fontWeight: 800 }}>حفظ</button></> : <><button onClick={() => setMediaOpen(true)} title="مرفق">📎</button><button onClick={() => void startVoice()} title="صوت">🎤</button><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void send()} placeholder={replyTo ? "اكتب ردًا..." : "اكتب رسالة..."} style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid #21474c", background: "#09171a", color: "white" }} /><button onClick={() => void send()} style={{ padding: "0 18px", height: 48, border: 0, borderRadius: 14, background: "#18e6ae", fontWeight: 800 }}>إرسال</button></>}
        </div>
        {error && <div style={{ padding: "0 16px 12px", color: "#ff7784" }}>{error}</div>}
      </section>}
    </div>
    <VastaMediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(sel) => void selectMedia(sel)} />
  </main>;
}
